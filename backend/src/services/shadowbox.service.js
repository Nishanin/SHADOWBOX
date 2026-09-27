const { spawn, execFile } = require('child_process');
const path = require('path');
const config = require('../config');

/**
 * Validates that the requested variant is strictly in the allowed list.
 * @param {string} variant
 * @returns {boolean}
 */
function isValidVariant(variant) {
  return typeof variant === 'string' && config.allowedVariants.includes(variant);
}

/**
 * Resolves the runner executable and arguments based on the host platform.
 * @param {string} variant
 * @returns {{ executable: string, args: string[] }}
 */
function getRunnerInvocation(variant) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const runnerPath = path.join(config.shadowboxDir, 'runner.ps1');
    return {
      executable: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', runnerPath, '-Variant', variant, '-Format', 'json']
    };
  } else {
    const runnerPath = path.join(config.shadowboxDir, 'runner.sh');
    return {
      executable: 'bash',
      args: [runnerPath, variant, '--json']
    };
  }
}

/**
 * Executes a shadowbox variant via the platform runner and returns the structured result contract.
 * @param {string} variant
 * @param {number} [timeoutMs]
 * @returns {Promise<object>}
 */
function runVariant(variant, timeoutMs = config.shadowboxTimeoutMs) {
  return new Promise((resolve) => {
    if (!isValidVariant(variant)) {
      return resolve({
        variant: variant || null,
        sourceCommit: null,
        imageTag: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        testExitCode: null,
        status: 'INFRASTRUCTURE_ERROR',
        stdout: '',
        stderr: `Variant '${variant}' is invalid. Allowed variants: ${config.allowedVariants.join(', ')}`,
        duration: '0s',
        durationMs: 0,
        errorCategory: 'INVALID_VARIANT'
      });
    }

    const { executable, args } = getRunnerInvocation(variant);
    const startTime = Date.now();

    let child;
    try {
      child = spawn(executable, args, {
        cwd: config.shadowboxDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (spawnErr) {
      return resolve({
        variant,
        sourceCommit: null,
        imageTag: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        testExitCode: null,
        status: 'INFRASTRUCTURE_ERROR',
        stdout: '',
        stderr: `Failed to spawn runner process: ${spawnErr.message}`,
        duration: '0s',
        durationMs: Date.now() - startTime,
        errorCategory: 'PROCESS_SPAWN_ERROR'
      });
    }

    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') {
        execFile('taskkill', ['/pid', child.pid.toString(), '/t', '/f'], () => {});
      } else {
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        variant,
        sourceCommit: null,
        imageTag: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        testExitCode: null,
        status: 'INFRASTRUCTURE_ERROR',
        stdout: stdoutData,
        stderr: `Process execution error: ${err.message}`,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        durationMs: Date.now() - startTime,
        errorCategory: 'PROCESS_ERROR'
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const duration = `${(durationMs / 1000).toFixed(2)}s`;

      if (timedOut) {
        return resolve({
          variant,
          sourceCommit: null,
          imageTag: null,
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          status: 'INFRASTRUCTURE_ERROR',
          stdout: stdoutData,
          stderr: `Execution timed out after ${timeoutMs}ms.`,
          duration,
          durationMs,
          errorCategory: 'TIMEOUT'
        });
      }

      // Parse JSON output contract emitted by runner
      const trimmed = stdoutData.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
          return resolve(parsed);
        } catch (jsonErr) {
          return resolve({
            variant,
            sourceCommit: null,
            imageTag: null,
            totalTests: null,
            passedTests: null,
            failedTests: null,
            testExitCode: code,
            status: 'INFRASTRUCTURE_ERROR',
            stdout: stdoutData,
            stderr: `JSON parse error on runner output: ${jsonErr.message}. Stderr: ${stderrData}`,
            duration,
            durationMs,
            errorCategory: 'OUTPUT_PARSE_ERROR'
          });
        }
      }

      // If no JSON block found
      resolve({
        variant,
        sourceCommit: null,
        imageTag: null,
        totalTests: null,
        passedTests: null,
        failedTests: null,
        testExitCode: code,
        status: 'INFRASTRUCTURE_ERROR',
        stdout: stdoutData,
        stderr: stderrData || 'Runner did not emit structured JSON contract.',
        duration,
        durationMs,
        errorCategory: 'OUTPUT_PARSE_ERROR'
      });
    });
  });
}

/**
 * Lightweight check for Docker daemon availability.
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<{ available: boolean, version: string | null }>}
 */
function checkDockerAvailability(timeoutMs = 2000) {
  return new Promise((resolve) => {
    execFile('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve({ available: false, version: null });
      }
      resolve({ available: true, version: stdout.trim() });
    });
  });
}

module.exports = {
  isValidVariant,
  getRunnerInvocation,
  runVariant,
  checkDockerAvailability
};
