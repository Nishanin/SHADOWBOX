const path = require('path');
const fs = require('fs');

/**
 * Static Environment Investigator.
 *
 * Inspects repository configuration, package.json, lockfiles, runtime configs,
 * and user-supplied environment parameters without executing repository code.
 */
class EnvironmentInvestigator {
  /**
   * Analyzes environment-dependent signals in the repository.
   *
   * @param {object} params
   * @param {string} [params.repoDir] Path to the unpacked repository
   * @param {object} [params.userEnvironment] User-provided environment info
   * @param {string} [params.ciLog] User-provided CI log
   * @param {object} [params.packageJson] Parsed package.json
   * @param {string[]} [params.repoFiles] Relative file paths in repo
   * @returns {object} Structured environment investigation result
   */
  analyze({ repoDir, userEnvironment, ciLog, packageJson, repoFiles = [] }) {
    const findings = [];
    const evidence = [];
    const missingEvidence = [];
    const detected = {
      declaredNode: null,
      packageManager: null,
      timezone: null,
      os: null,
      envVars: {}
    };

    // 1. Inspect package.json engines & packageManager
    if (packageJson && typeof packageJson === 'object') {
      if (packageJson.engines && packageJson.engines.node) {
        detected.declaredNode = packageJson.engines.node;
        findings.push({
          id: 'env-node-engines',
          type: 'OBSERVED_FACT',
          impact: 'MEDIUM',
          title: `Node runtime specified: ${packageJson.engines.node}`,
          description: `package.json defines engines.node = "${packageJson.engines.node}".`,
          location: 'package.json:engines.node',
          evidence: `engines.node: "${packageJson.engines.node}"`
        });
        evidence.push({
          type: 'runtime-version',
          source: 'package.json:engines',
          description: 'Declared Node.js compatibility constraint.',
          technicalValues: [`Node ${packageJson.engines.node}`]
        });
      }

      if (packageJson.packageManager) {
        detected.packageManager = packageJson.packageManager;
        findings.push({
          id: 'env-pkg-manager',
          type: 'OBSERVED_FACT',
          impact: 'LOW',
          title: `Package manager defined: ${packageJson.packageManager}`,
          description: `package.json specifies packageManager = "${packageJson.packageManager}".`,
          location: 'package.json:packageManager',
          evidence: `packageManager: "${packageJson.packageManager}"`
        });
      }

      // Check for TZ in package.json scripts
      if (packageJson.scripts) {
        for (const [scriptName, scriptCmd] of Object.entries(packageJson.scripts)) {
          if (typeof scriptCmd === 'string' && scriptCmd.includes('TZ=')) {
            const tzMatch = scriptCmd.match(/TZ=([^\s]+)/);
            const tzVal = tzMatch ? tzMatch[1] : 'UTC';
            detected.timezone = tzVal;
            findings.push({
              id: `env-tz-script-${scriptName}`,
              type: 'OBSERVED_FACT',
              impact: 'HIGH',
              title: `Timezone environment variable configured in script "${scriptName}"`,
              description: `Script "${scriptName}" explicitly sets TZ=${tzVal}.`,
              location: `package.json:scripts.${scriptName}`,
              evidence: scriptCmd
            });
            evidence.push({
              type: 'env-variable',
              source: `package.json:scripts.${scriptName}`,
              description: 'Explicit process timezone definition in npm script.',
              technicalValues: [`TZ=${tzVal}`]
            });
          }
        }
      }
    }

    // 2. Inspect version pinning files (.nvmrc, .node-version)
    if (repoDir) {
      const nvmrcPath = path.join(repoDir, '.nvmrc');
      if (fs.existsSync(nvmrcPath)) {
        try {
          const nvmVal = fs.readFileSync(nvmrcPath, 'utf8').trim();
          detected.declaredNode = detected.declaredNode || nvmVal;
          findings.push({
            id: 'env-nvmrc',
            type: 'OBSERVED_FACT',
            impact: 'MEDIUM',
            title: `Node version pinned in .nvmrc: ${nvmVal}`,
            description: `.nvmrc specifies Node version "${nvmVal}".`,
            location: '.nvmrc',
            evidence: nvmVal
          });
        } catch {
          // Ignore read error
        }
      }

      const nodeVersionPath = path.join(repoDir, '.node-version');
      if (fs.existsSync(nodeVersionPath)) {
        try {
          const nvVal = fs.readFileSync(nodeVersionPath, 'utf8').trim();
          detected.declaredNode = detected.declaredNode || nvVal;
          findings.push({
            id: 'env-node-version-file',
            type: 'OBSERVED_FACT',
            impact: 'MEDIUM',
            title: `Node version pinned in .node-version: ${nvVal}`,
            description: `.node-version specifies "${nvVal}".`,
            location: '.node-version',
            evidence: nvVal
          });
        } catch {
          // Ignore read error
        }
      }

      // Check lockfile presence
      if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
        detected.packageManager = detected.packageManager || 'pnpm';
      } else if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
        detected.packageManager = detected.packageManager || 'yarn';
      } else if (fs.existsSync(path.join(repoDir, 'package-lock.json'))) {
        detected.packageManager = detected.packageManager || 'npm';
      }
    }

    // 3. Inspect user-provided environment parameters
    if (userEnvironment && typeof userEnvironment === 'object') {
      if (userEnvironment.os) {
        detected.os = userEnvironment.os;
        evidence.push({
          type: 'runtime-env',
          source: 'User Environment Input: OS',
          description: 'User specified target operating system.',
          technicalValues: [userEnvironment.os]
        });
      }
      if (userEnvironment.nodeVersion) {
        evidence.push({
          type: 'runtime-version',
          source: 'User Environment Input: Node',
          description: 'User specified target Node runtime version.',
          technicalValues: [`Node ${userEnvironment.nodeVersion}`]
        });
      }
      if (userEnvironment.timezone) {
        detected.timezone = detected.timezone || userEnvironment.timezone;
        evidence.push({
          type: 'env-variable',
          source: 'User Environment Input: Timezone',
          description: 'User specified target runtime timezone.',
          technicalValues: [`TZ=${userEnvironment.timezone}`]
        });
      }
    }

    // 4. Scan CI log for environment clues
    if (ciLog && typeof ciLog === 'string') {
      if (/TZ\s*=\s*UTC|timezone:\s*UTC/i.test(ciLog)) {
        detected.timezone = 'UTC';
        findings.push({
          id: 'env-log-tz-utc',
          type: 'OBSERVED_FACT',
          impact: 'HIGH',
          title: 'CI execution environment runs with TZ=UTC',
          description: 'CI logs indicate the reproduction runner was executed under UTC timezone.',
          location: 'CI Log Output',
          evidence: 'TZ=UTC detected in log'
        });
        evidence.push({
          type: 'env-variable',
          source: 'CI Execution Log',
          description: 'Active process timezone during failure.',
          technicalValues: ['TZ=UTC']
        });
      }

      const nodeLogMatch = ciLog.match(/Node(?:\.js)?\s+(?:version\s+)?v?(\d+\.\d+(?:\.\d+)?)/i);
      if (nodeLogMatch) {
        evidence.push({
          type: 'runtime-version',
          source: 'CI Execution Log',
          description: 'Runtime engine version captured in log.',
          technicalValues: [`Node ${nodeLogMatch[1]}`]
        });
      }
    }

    // 5. Inferred relationship: Check for runtime mismatch
    if (userEnvironment?.nodeVersion && detected.declaredNode) {
      const userMajor = parseInt(userEnvironment.nodeVersion, 10);
      const declMatch = detected.declaredNode.match(/(\d+)/);
      const declMajor = declMatch ? parseInt(declMatch[1], 10) : null;
      if (declMajor && userMajor && declMajor !== userMajor) {
        findings.push({
          id: 'env-node-mismatch',
          type: 'INFERRED_RELATIONSHIP',
          impact: 'HIGH',
          title: `Node version discrepancy: user specified ${userEnvironment.nodeVersion} vs declared ${detected.declaredNode}`,
          description: `The user specified Node ${userEnvironment.nodeVersion}, but the repository requires Node ${detected.declaredNode}. Runtime API differences may cause failures.`,
          location: 'Environment Comparison',
          evidence: `User: ${userEnvironment.nodeVersion} | Declared: ${detected.declaredNode}`
        });
      }
    }

    // 6. Check for missing evidence
    if (!detected.timezone && !userEnvironment?.timezone) {
      missingEvidence.push({
        description: 'Process timezone was not explicitly declared in package scripts or user input.',
        whyItMatters: 'If code uses timezone-sensitive Date accessors, implicit system timezone shifts can alter test assertions.'
      });
    }

    if (!detected.declaredNode && !userEnvironment?.nodeVersion) {
      missingEvidence.push({
        description: 'No Node.js version constraint defined in engines or .nvmrc.',
        whyItMatters: 'Engine version differences between workstations and CI runners can introduce subtle behavior changes.'
      });
    }

    return {
      agent: 'Environment',
      label: 'Environment Agent',
      status: 'COMPLETE',
      focus: 'Runtime and environment differences',
      runAt: new Date().toISOString(),
      detected,
      findings,
      evidence,
      missingEvidence
    };
  }
}

module.exports = new EnvironmentInvestigator();
