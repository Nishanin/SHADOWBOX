const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const sessionService = require('./session.service');
const shadowboxService = require('./shadowbox.service');

let execFileFn = execFile;

function _setExecFile(fn) {
  execFileFn = fn;
}

function _resetExecFile() {
  execFileFn = execFile;
}

/**
 * Dynamic Shadowbox Execution Service for User-Supplied Repositories.
 *
 * Enforces strict security constraints:
 * - Docker only (--network none, --memory 512m, --cpus 1.0)
 * - Controlled base image (node:20-alpine)
 * - Runs as non-root (USER node)
 * - Safe test command validation against allowlist
 * - Ephemeral build context & image cleanup in finally block
 * - Zero execution of repository scripts on host
 */
class DynamicShadowboxService {
  /**
   * Executes reproduction for an investigation session.
   *
   * @param {string} sessionId
   * @param {object} [options]
   * @param {number} [options.timeoutMs=60000]
   * @returns {Promise<object>} Structured execution result
   */
  async executeReproduction(sessionId, options = {}) {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      const err = new Error(`Investigation session '${sessionId}' was not found.`);
      err.statusCode = 404;
      err.error = 'NotFound';
      throw err;
    }

    // 1. DEMO MODE: Delegate to verified demo execution
    if (session.isDemo) {
      const demoResult = await shadowboxService.runVariant('reproduction');
      sessionService.updateSession(sessionId, {
        reproductionResult: demoResult,
        status: demoResult.status === 'REPRODUCED' ? 'REPRODUCED' : 'FAILED'
      });
      return demoResult;
    }

    // 2. NON-DEMO: Validate session lifecycle state
    const allowedStates = ['ANALYZED', 'REPRODUCING', 'REPRODUCED', 'NO_FAILURE', 'UNSUPPORTED', 'FAILED'];
    if (!allowedStates.includes(session.status)) {
      const err = new Error(
        `Investigation session must be in ANALYZED state before executing Shadowbox reproduction (current status: ${session.status}).`
      );
      err.statusCode = 422;
      err.error = 'UnprocessableEntity';
      throw err;
    }

    // 3. Validate archive availability
    if (!session.archivePath || !fs.existsSync(session.archivePath)) {
      const missingResult = {
        variant: 'user-reproduction',
        sessionId,
        repositoryUrl: session.repositoryUrl,
        sourceCommit: session.resolvedCommit,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        testExitCode: null,
        status: 'INFRASTRUCTURE_ERROR',
        stdout: '',
        stderr: 'Repository archive is missing or has expired on disk.',
        duration: '0s',
        durationMs: 0,
        errorCategory: 'MISSING_ARCHIVE'
      };
      sessionService.updateSession(sessionId, {
        reproductionResult: missingResult,
        status: 'FAILED'
      });
      return missingResult;
    }

    sessionService.updateSession(sessionId, { status: 'REPRODUCING' });

    const tempBase = os.tmpdir();
    const buildContext = path.join(tempBase, 'shadowbox-user-runs', sessionId);
    const appDir = path.join(buildContext, 'app');
    const imageTag = `shadowbox-user-${sessionId.toLowerCase().replace(/[^a-z0-9]/g, '')}:latest`;
    const startTime = Date.now();

    try {
      // Ensure build context directories exist
      fs.mkdirSync(appDir, { recursive: true });

      // Unpack archive into appDir
      await this.unpackArchive(session.archivePath, appDir);

      // 4. Validate project scope: must contain package.json
      const pkgPath = path.join(appDir, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        const unsupportedResult = {
          variant: 'user-reproduction',
          sessionId,
          repositoryUrl: session.repositoryUrl,
          sourceCommit: session.resolvedCommit,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          status: 'UNSUPPORTED_PROJECT',
          stdout: '',
          stderr: 'Missing package.json in repository root. Shadowbox currently supports only Node.js repositories with a root package.json.',
          duration: '0s',
          durationMs: Date.now() - startTime,
          errorCategory: 'UNSUPPORTED_PROJECT'
        };
        sessionService.updateSession(sessionId, {
          reproductionResult: unsupportedResult,
          status: 'UNSUPPORTED'
        });
        return unsupportedResult;
      }

      let packageJson = {};
      try {
        packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      } catch (parseErr) {
        const malformedResult = {
          variant: 'user-reproduction',
          sessionId,
          repositoryUrl: session.repositoryUrl,
          sourceCommit: session.resolvedCommit,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          status: 'UNSUPPORTED_PROJECT',
          stdout: '',
          stderr: `Malformed package.json in repository: ${parseErr.message}`,
          duration: '0s',
          durationMs: Date.now() - startTime,
          errorCategory: 'MALFORMED_PACKAGE_JSON'
        };
        sessionService.updateSession(sessionId, {
          reproductionResult: malformedResult,
          status: 'UNSUPPORTED'
        });
        return malformedResult;
      }

      // 5. Select and validate test command against allowlist
      const commandDecision = this.determineSafeTestCommand(packageJson);
      if (!commandDecision.isSafe) {
        const unsafeResult = {
          variant: 'user-reproduction',
          sessionId,
          repositoryUrl: session.repositoryUrl,
          sourceCommit: session.resolvedCommit,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          status: 'UNSUPPORTED_TEST_COMMAND',
          stdout: '',
          stderr: commandDecision.reason,
          duration: '0s',
          durationMs: Date.now() - startTime,
          errorCategory: 'UNSUPPORTED_TEST_COMMAND'
        };
        sessionService.updateSession(sessionId, {
          reproductionResult: unsafeResult,
          status: 'UNSUPPORTED'
        });
        return unsafeResult;
      }

      // 6. Check dependency availability
      const nodeModulesExist = fs.existsSync(path.join(appDir, 'node_modules'));
      const hasThirdPartyDeps =
        (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) ||
        (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0);

      // If third party test runner (like jest/mocha/vitest) or external dependencies are required
      // but node_modules is missing from the offline archive:
      if (!nodeModulesExist && commandDecision.requiresExternalRunner) {
        const depResult = {
          variant: 'user-reproduction',
          sessionId,
          repositoryUrl: session.repositoryUrl,
          sourceCommit: session.resolvedCommit,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          status: 'DEPENDENCY_UNAVAILABLE',
          stdout: '',
          stderr:
            `Dependencies required by test runner ("${commandDecision.runner}") are unavailable in the isolated archive. ` +
            `Under strict network isolation (--network none), dependency installation is prevented to guarantee host and container security.`,
          duration: '0s',
          durationMs: Date.now() - startTime,
          errorCategory: 'DEPENDENCY_UNAVAILABLE'
        };
        sessionService.updateSession(sessionId, {
          reproductionResult: depResult,
          status: 'UNSUPPORTED'
        });
        return depResult;
      }

      // 7. Write Shadowbox-controlled Dockerfile (NEVER use repository Dockerfile)
      const dockerfileContent = [
        'FROM node:20-alpine',
        'WORKDIR /app',
        '# Copy repository files into controlled container',
        'COPY app /app',
        '# Force UTC timezone and non-interactive testing context',
        'ENV TZ=UTC',
        'ENV CI=true',
        'ENV NODE_ENV=test',
        '# Run as non-root user',
        'USER node'
      ].join('\n');

      fs.writeFileSync(path.join(buildContext, 'Dockerfile'), dockerfileContent);

      // 8. Build Docker Image
      const buildResult = await this.runDocker(['build', '-t', imageTag, buildContext], { timeout: 30000 });
      if (buildResult.exitCode !== 0) {
        const errResult = {
          variant: 'user-reproduction',
          sessionId,
          repositoryUrl: session.repositoryUrl,
          sourceCommit: session.resolvedCommit,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: buildResult.exitCode,
          status: 'INFRASTRUCTURE_ERROR',
          stdout: buildResult.stdout,
          stderr: `Failed to build Shadowbox image: ${buildResult.stderr}`,
          duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
          durationMs: Date.now() - startTime,
          errorCategory: 'DOCKER_BUILD_FAILED'
        };
        sessionService.updateSession(sessionId, {
          reproductionResult: errResult,
          status: 'FAILED'
        });
        return errResult;
      }

      // 9. Run Container with strict security isolation
      // --network none: No internet access
      // --memory 512m: Resource cap
      // --cpus 1.0: CPU cap
      const runArgs = [
        'run',
        '--rm',
        '--network',
        'none',
        '--memory',
        '512m',
        '--cpus',
        '1.0',
        '-e',
        'TZ=UTC',
        '-e',
        'CI=true',
        imageTag,
        ...commandDecision.args
      ];

      const runResult = await this.runDocker(runArgs, { timeout: options.timeoutMs || 45000 });
      const durationMs = Date.now() - startTime;
      const duration = `${(durationMs / 1000).toFixed(2)}s`;

      // 10. Classify execution results
      const classification = this.classifyExecutionResult({
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        exitCode: runResult.exitCode,
        timedOut: runResult.timedOut,
        hasThirdPartyDeps,
        nodeModulesExist
      });

      const finalResult = {
        variant: 'user-reproduction',
        sessionId,
        repositoryUrl: session.repositoryUrl,
        sourceCommit: session.resolvedCommit,
        totalTests: classification.totalTests,
        passedTests: classification.passedTests,
        failedTests: classification.failedTests,
        testExitCode: runResult.exitCode,
        status: classification.status,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
        duration,
        durationMs,
        errorCategory: classification.errorCategory
      };

      // Persist in session
      const nextSessionStatus =
        classification.status === 'REPRODUCED'
          ? 'REPRODUCED'
          : classification.status === 'NO_FAILURE'
          ? 'NO_FAILURE'
          : classification.status.startsWith('UNSUPPORTED') || classification.status === 'DEPENDENCY_UNAVAILABLE'
          ? 'UNSUPPORTED'
          : 'FAILED';

      sessionService.updateSession(sessionId, {
        reproductionResult: finalResult,
        status: nextSessionStatus
      });

      return finalResult;
    } finally {
      // 11. Cleanup temporary build context & Docker image in finally block
      try {
        if (fs.existsSync(buildContext)) {
          fs.rmSync(buildContext, { recursive: true, force: true });
        }
      } catch {
        // Ignore
      }
      // Attempt image cleanup in background
      try {
        execFileFn('docker', ['rmi', '-f', imageTag], { timeout: 10000, windowsHide: true }, () => {});
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Evaluates package.json test scripts against security allowlist.
   */
  determineSafeTestCommand(packageJson) {
    const scripts = packageJson.scripts || {};
    let candidate = scripts.test || scripts['test:ci'] || scripts['test:unit'] || '';

    // If no test script declared, check if tests directory exists or default to node --test
    if (!candidate || typeof candidate !== 'string' || !candidate.trim()) {
      return {
        isSafe: true,
        command: 'node --test',
        args: ['node', '--test'],
        runner: 'node-test',
        requiresExternalRunner: false
      };
    }

    const trimmed = candidate.trim();

    // Check for dangerous shell operators
    if (/[\;&\|><`$\n\r]/.test(trimmed)) {
      return {
        isSafe: false,
        reason: `Test script "${trimmed}" contains shell redirection or chaining operators (;&|><). Only direct test runner commands are permitted.`
      };
    }

    // Allowlist runners
    if (/^node\s+--test\b/.test(trimmed)) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      return {
        isSafe: true,
        command: trimmed,
        args: parts,
        runner: 'node-test',
        requiresExternalRunner: false
      };
    }

    if (/^jest\b/.test(trimmed)) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      return {
        isSafe: true,
        command: trimmed,
        args: ['npx', '--no-install', ...parts],
        runner: 'jest',
        requiresExternalRunner: true
      };
    }

    if (/^vitest\b/.test(trimmed)) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      return {
        isSafe: true,
        command: trimmed,
        args: ['npx', '--no-install', ...parts],
        runner: 'vitest',
        requiresExternalRunner: true
      };
    }

    if (/^mocha\b/.test(trimmed)) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      return {
        isSafe: true,
        command: trimmed,
        args: ['npx', '--no-install', ...parts],
        runner: 'mocha',
        requiresExternalRunner: true
      };
    }

    // Default node execution on test file (e.g. "node test.js")
    if (/^node\s+([a-zA-Z0-9_.\/-]+)$/.test(trimmed)) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      return {
        isSafe: true,
        command: trimmed,
        args: parts,
        runner: 'node',
        requiresExternalRunner: false
      };
    }

    return {
      isSafe: false,
      reason: `Unsupported test command "${trimmed}". Allowed test runners: node --test, jest, vitest, mocha.`
    };
  }

  /**
   * Classifies test output into structured status: REPRODUCED, NO_FAILURE, DEPENDENCY_UNAVAILABLE, TIMEOUT, etc.
   */
  classifyExecutionResult({ stdout = '', stderr = '', exitCode = 0, timedOut = false, hasThirdPartyDeps = false, nodeModulesExist = false }) {
    if (timedOut) {
      return {
        status: 'TIMEOUT',
        errorCategory: 'TIMEOUT',
        totalTests: null,
        passedTests: null,
        failedTests: null
      };
    }

    const fullOutput = stdout + '\n' + stderr;

    // Check for missing dependencies
    if (
      fullOutput.includes('Cannot find module') ||
      fullOutput.includes('MODULE_NOT_FOUND') ||
      fullOutput.includes('not found: jest') ||
      fullOutput.includes('sh: 1: jest: not found') ||
      fullOutput.includes('sh: jest: not found') ||
      fullOutput.includes('command not found') ||
      (!nodeModulesExist && hasThirdPartyDeps && exitCode !== 0 && !fullOutput.includes('not ok') && !fullOutput.includes('FAIL'))
    ) {
      return {
        status: 'DEPENDENCY_UNAVAILABLE',
        errorCategory: 'DEPENDENCY_UNAVAILABLE',
        totalTests: null,
        passedTests: null,
        failedTests: null
      };
    }

    // Check for TAP (Node --test) metrics
    if (fullOutput.includes('TAP version') || fullOutput.includes('# tests')) {
      const testsMatch = fullOutput.match(/# tests\s+(\d+)/);
      const passMatch = fullOutput.match(/# pass\s+(\d+)/);
      const failMatch = fullOutput.match(/# fail\s+(\d+)/);

      const totalTests = testsMatch ? parseInt(testsMatch[1], 10) : null;
      const passedTests = passMatch ? parseInt(passMatch[1], 10) : null;
      const failedTests = failMatch ? parseInt(failMatch[1], 10) : null;

      if (failedTests !== null && failedTests > 0) {
        return {
          status: 'REPRODUCED',
          errorCategory: null,
          totalTests,
          passedTests,
          failedTests
        };
      }

      if (exitCode === 0 && passedTests !== null && passedTests > 0 && (failedTests === 0 || failedTests === null)) {
        return {
          status: 'NO_FAILURE',
          errorCategory: null,
          totalTests,
          passedTests,
          failedTests: 0
        };
      }
    }

    // Check for Jest / Vitest output metrics
    if (fullOutput.includes('Tests:') || fullOutput.includes('FAIL ')) {
      const failedMatch = fullOutput.match(/(\d+)\s+failed/);
      const passedMatch = fullOutput.match(/(\d+)\s+passed/);
      const totalMatch = fullOutput.match(/(\d+)\s+total/);

      const failedTests = failedMatch ? parseInt(failedMatch[1], 10) : null;
      const passedTests = passedMatch ? parseInt(passedMatch[1], 10) : null;
      const totalTests = totalMatch ? parseInt(totalMatch[1], 10) : null;

      if (failedTests !== null && failedTests > 0) {
        return {
          status: 'REPRODUCED',
          errorCategory: null,
          totalTests: totalTests ?? ((failedTests || 0) + (passedTests || 0)),
          passedTests: passedTests ?? 0,
          failedTests
        };
      }

      if (exitCode === 0 && passedTests !== null && passedTests > 0) {
        return {
          status: 'NO_FAILURE',
          errorCategory: null,
          totalTests,
          passedTests,
          failedTests: 0
        };
      }
    }

    // General assertion or test error
    if (exitCode !== 0 && (fullOutput.includes('AssertionError') || fullOutput.includes('not ok ') || fullOutput.includes('FAIL'))) {
      return {
        status: 'REPRODUCED',
        errorCategory: null,
        totalTests: 1,
        passedTests: 0,
        failedTests: 1
      };
    }

    if (exitCode === 0) {
      return {
        status: 'NO_FAILURE',
        errorCategory: null,
        totalTests: null,
        passedTests: null,
        failedTests: 0
      };
    }

    return {
      status: 'INFRASTRUCTURE_ERROR',
      errorCategory: 'COMMAND_FAILED',
      totalTests: null,
      passedTests: null,
      failedTests: null
    };
  }

  /**
   * Safely unpacks tar archive using execFile.
   */
  unpackArchive(archivePath, targetDir) {
    return new Promise((resolve) => {
      execFileFn('tar', ['-xf', archivePath, '-C', targetDir], { timeout: 15000, windowsHide: true }, () => {
        resolve();
      });
    });
  }

  /**
   * Executes a docker command via execFile.
   */
  runDocker(args, options = {}) {
    return new Promise((resolve) => {
      let timedOut = false;
      const timeoutMs = options.timeout || 45000;

      const child = execFileFn('docker', args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
        if (err && (err.killed || err.signal === 'SIGTERM')) {
          timedOut = true;
        }
        resolve({
          exitCode: err ? (err.code || 1) : 0,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : '',
          timedOut
        });
      });
    });
  }
}

const dynamicShadowboxService = new DynamicShadowboxService();
dynamicShadowboxService._setExecFile = _setExecFile;
dynamicShadowboxService._resetExecFile = _resetExecFile;

module.exports = dynamicShadowboxService;
