const path = require('path');
const fs = require('fs');

/**
 * Static CI Investigator.
 *
 * Inspects CI pipeline configurations (.github/workflows, .gitlab-ci.yml, etc.)
 * and parses user-provided CI logs without executing CI scripts.
 */
class CIInvestigator {
  /**
   * Performs CI pipeline and execution log analysis.
   *
   * @param {object} params
   * @param {string} [params.repoDir] Path to the unpacked repository
   * @param {string[]} [params.repoFiles] Relative file paths
   * @param {string} [params.ciLog] User-provided CI log output
   * @param {string} [params.errorDescription] User-provided error description
   * @returns {object} Structured CI investigation result
   */
  analyze({ repoDir, repoFiles = [], ciLog = '', errorDescription = '' }) {
    const findings = [];
    const evidence = [];
    const missingEvidence = [];
    let ciConfigFound = false;
    let ciConfigFile = null;

    // 1. Inspect CI configuration files
    const ciLocations = [
      '.github/workflows',
      '.gitlab-ci.yml',
      '.circleci/config.yml',
      '.travis.yml'
    ];

    let detectedWorkflowFiles = [];
    if (repoFiles && repoFiles.length > 0) {
      detectedWorkflowFiles = repoFiles.filter((f) =>
        f.startsWith('.github/workflows/') ||
        f === '.gitlab-ci.yml' ||
        f.startsWith('.circleci/') ||
        f === '.travis.yml'
      );
    } else if (repoDir && fs.existsSync(repoDir)) {
      for (const loc of ciLocations) {
        const full = path.join(repoDir, loc);
        if (fs.existsSync(full)) {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            try {
              const files = fs.readdirSync(full);
              for (const f of files) {
                if (f.endsWith('.yml') || f.endsWith('.yaml')) {
                  detectedWorkflowFiles.push(path.join(loc, f).replace(/\\/g, '/'));
                }
              }
            } catch {
              // Ignore read error
            }
          } else if (stat.isFile()) {
            detectedWorkflowFiles.push(loc);
          }
        }
      }
    }

    if (detectedWorkflowFiles.length > 0) {
      ciConfigFound = true;
      ciConfigFile = detectedWorkflowFiles[0];

      findings.push({
        id: 'ci-workflow-detected',
        type: 'OBSERVED_FACT',
        impact: 'MEDIUM',
        title: `CI workflow configuration found: ${ciConfigFile}`,
        description: `Repository defines CI automation in ${detectedWorkflowFiles.join(', ')}.`,
        location: ciConfigFile,
        evidence: `Found ${detectedWorkflowFiles.length} CI configuration file(s)`
      });

      evidence.push({
        type: 'env-config',
        source: ciConfigFile,
        description: 'CI workflow configuration file in repository.',
        technicalValues: detectedWorkflowFiles
      });

      // Inspect workflow content for OS, Node, TZ, test command
      if (repoDir) {
        const fullWfPath = path.join(repoDir, ciConfigFile);
        if (fs.existsSync(fullWfPath)) {
          try {
            const wfContent = fs.readFileSync(fullWfPath, 'utf8');

            // runs-on
            const runsOnMatch = wfContent.match(/runs-on:\s*([^\s\r\n]+)/);
            if (runsOnMatch) {
              const runnerOS = runsOnMatch[1];
              findings.push({
                id: 'ci-runner-os',
                type: 'OBSERVED_FACT',
                impact: 'MEDIUM',
                title: `CI runner OS configured: ${runnerOS}`,
                description: `CI workflow specifies runner environment "${runnerOS}".`,
                location: `${ciConfigFile}:runs-on`,
                evidence: runsOnMatch[0]
              });
              evidence.push({
                type: 'runtime-env',
                source: `${ciConfigFile}:runs-on`,
                description: 'Configured CI runner operating system.',
                technicalValues: [runnerOS]
              });
            }

            // node-version matrix
            const nodeMatch = wfContent.match(/node-version:\s*\[?([0-9.,\s'"]+)\]?/);
            if (nodeMatch) {
              findings.push({
                id: 'ci-node-version',
                type: 'OBSERVED_FACT',
                impact: 'MEDIUM',
                title: `CI matrix specifies Node version(s): ${nodeMatch[1].trim()}`,
                description: `CI pipeline tests against Node versions: ${nodeMatch[1].trim()}.`,
                location: `${ciConfigFile}:node-version`,
                evidence: nodeMatch[0]
              });
            }

            // TZ environment variable
            const tzMatch = wfContent.match(/TZ:\s*([^\s\r\n]+)/);
            if (tzMatch) {
              findings.push({
                id: 'ci-tz-env',
                type: 'OBSERVED_FACT',
                impact: 'HIGH',
                title: `CI workflow explicitly sets TZ: ${tzMatch[1]}`,
                description: `Continuous integration step exports timezone "${tzMatch[1]}".`,
                location: `${ciConfigFile}:env.TZ`,
                evidence: tzMatch[0]
              });
              evidence.push({
                type: 'env-variable',
                source: `${ciConfigFile}:env`,
                description: 'CI pipeline configured default timezone.',
                technicalValues: [`TZ=${tzMatch[1]}`]
              });
            }
          } catch {
            // Ignore file read error
          }
        }
      }
    } else {
      missingEvidence.push({
        description: 'No continuous integration configuration was found in the repository.',
        whyItMatters:
          'Without a versioned CI workflow, exact runner operating system, Node version, and environment variables cannot be confirmed directly from the repo.'
      });
    }

    // 2. Parse User-Provided CI Log
    const parsedLog = this.parseCILog(ciLog);

    if (parsedLog) {
      if (parsedLog.framework) {
        findings.push({
          id: 'ci-framework-detected',
          type: 'OBSERVED_FACT',
          impact: 'LOW',
          title: `Test runner framework identified: ${parsedLog.framework}`,
          description: `Log patterns match test output format of ${parsedLog.framework}.`,
          location: 'CI Log Output',
          evidence: `Framework: ${parsedLog.framework}`
        });
      }

      if (parsedLog.failingTests.length > 0) {
        findings.push({
          id: 'ci-failing-tests',
          type: 'OBSERVED_FACT',
          impact: 'HIGH',
          title: `Failing test case(s) identified in CI log: ${parsedLog.failingTests.join(', ')}`,
          description: `CI execution encountered deterministic failure in: ${parsedLog.failingTests.join(', ')}.`,
          location: 'CI Log Output: Failures',
          evidence: parsedLog.failingTests.join('; ')
        });

        evidence.push({
          type: 'command-execution',
          source: 'CI Execution Log',
          description: 'Failed test case identifier captured in log.',
          technicalValues: parsedLog.failingTests
        });
      }

      if (parsedLog.expected && parsedLog.actual) {
        findings.push({
          id: 'ci-assertion-diff',
          type: 'OBSERVED_FACT',
          impact: 'HIGH',
          title: `Assertion discrepancy: Expected "${parsedLog.expected}", Received "${parsedLog.actual}"`,
          description: `Test assertion failed comparing expected value against actual output.`,
          location: 'CI Log Output: Assertion',
          evidence: `Expected: "${parsedLog.expected}" !== Received: "${parsedLog.actual}"`
        });

        evidence.push({
          type: 'assertion-failure',
          source: 'CI Test Assertion',
          description: 'Assertion discrepancy captured from runner log.',
          technicalValues: [`Expected: "${parsedLog.expected}"`, `Received: "${parsedLog.actual}"`]
        });
      }

      if (parsedLog.exitCode !== null) {
        evidence.push({
          type: 'process-exit',
          source: 'CI Runner Exit Code',
          description: 'Process termination code.',
          technicalValues: [`Exit Code: ${parsedLog.exitCode}`]
        });
      }
    } else if (!ciLog || !ciLog.trim()) {
      missingEvidence.push({
        description: 'No CI execution log was provided by the user.',
        whyItMatters:
          'Exact failure stack traces, assertion differences, and runner error messages must be inferred from the repository configuration.'
      });
    }

    return {
      agent: 'CI',
      label: 'CI Agent',
      status: 'COMPLETE',
      focus: 'CI configuration and execution context',
      runAt: new Date().toISOString(),
      ciConfigFound,
      ciConfigFile,
      parsedLog,
      findings,
      evidence,
      missingEvidence
    };
  }

  /**
   * Parses test output logs for frameworks (Jest, TAP, Mocha, Vitest).
   */
  parseCILog(logText) {
    if (!logText || typeof logText !== 'string' || !logText.trim()) {
      return null;
    }

    const result = {
      framework: null,
      failingTests: [],
      expected: null,
      actual: null,
      exitCode: null
    };

    // 1. Detect TAP / Node Test Runner
    if (logText.includes('TAP version') || logText.includes('not ok ')) {
      result.framework = 'Node Test Runner (TAP)';
      const notOkMatches = logText.matchAll(/not ok \d+ - ([^\r\n]+)/g);
      for (const m of notOkMatches) {
        result.failingTests.push(m[1].trim());
      }
    }

    // 2. Detect Jest / Vitest
    if (logText.includes('FAIL ') || logText.includes('● ') || logText.includes('Jest') || logText.includes('vitest')) {
      result.framework = result.framework || (logText.includes('vitest') ? 'Vitest' : 'Jest');
      const failMatches = logText.matchAll(/FAIL\s+([^\r\n]+)/g);
      for (const m of failMatches) {
        result.failingTests.push(m[1].trim());
      }
      const testNameMatches = logText.matchAll(/[✕✗x]\s+([^\r\n]+)/g);
      for (const m of testNameMatches) {
        result.failingTests.push(m[1].trim());
      }
    }

    // 3. Detect Mocha
    if (logText.includes('failing') && (logText.includes('passing') || logText.includes('mocha'))) {
      result.framework = result.framework || 'Mocha';
      const mochaFailMatches = logText.matchAll(/\d+\)\s+([^\r\n:]+)/g);
      for (const m of mochaFailMatches) {
        result.failingTests.push(m[1].trim());
      }
    }

    // Fallback framework detection
    if (!result.framework && (logText.includes('AssertionError') || logText.includes('Error:'))) {
      result.framework = 'Generic Assertion';
    }

    // Extract Expected vs Actual
    const expectedMatch = logText.match(/Expected:\s*["']?([^"'\r\n]+)["']?/i);
    const receivedMatch = logText.match(/(?:Received|Got|Actual):\s*["']?([^"'\r\n]+)["']?/i);
    if (expectedMatch) {
      result.expected = expectedMatch[1].trim();
    }
    if (receivedMatch) {
      result.actual = receivedMatch[1].trim();
    }

    // Extract Exit Code
    const exitMatch = logText.match(/(?:exit code|code):\s*(\d+)/i);
    if (exitMatch) {
      result.exitCode = parseInt(exitMatch[1], 10);
    } else if (logText.includes('FAIL') || logText.includes('not ok')) {
      result.exitCode = 1;
    }

    // Deduplicate failing tests
    result.failingTests = Array.from(new Set(result.failingTests));

    return result;
  }
}

module.exports = new CIInvestigator();
