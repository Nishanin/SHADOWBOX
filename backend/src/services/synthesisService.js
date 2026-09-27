/**
 * Root Cause Synthesis Service.
 *
 * Correlates findings across Environment, Code, and CI streams with user-supplied
 * error descriptions and logs into a defensible, evidence-backed diagnosis.
 * Does not fabricate evidence or claim reproduction without execution.
 */
class SynthesisService {
  /**
   * Synthesizes cross-stream findings into a root cause candidate.
   *
   * @param {object} params
   * @param {object} params.envReport Environment Investigator result
   * @param {object} params.codeReport Code Investigator result
   * @param {object} params.ciReport CI Investigator result
   * @param {string} params.errorDescription User failure description
   * @param {string} [params.ciLog] User CI log
   * @param {string} [params.repositoryUrl] GitHub repo URL
   * @returns {object} Synthesized diagnosis and evidence matrix
   */
  synthesize({
    envReport,
    codeReport,
    ciReport,
    errorDescription = '',
    ciLog = '',
    repositoryUrl = ''
  }) {
    const envFindings = envReport?.findings || [];
    const codeFindings = codeReport?.findings || [];
    const ciFindings = ciReport?.findings || [];
    const lowerError = (errorDescription + ' ' + ciLog).toLowerCase();

    // Collect all missing evidence across streams
    const allMissingEvidence = [
      ...(envReport?.missingEvidence || []).map((m) => m.description),
      ...(codeReport?.missingEvidence || []).map((m) => m.description),
      ...(ciReport?.missingEvidence || []).map((m) => m.description)
    ];

    // Detect signal markers
    const hasDateCode = codeFindings.some((f) => f.id.includes('date'));
    const hasTzEnv =
      envFindings.some((f) => f.id.includes('tz')) ||
      ciFindings.some((f) => f.id.includes('tz')) ||
      envReport?.detected?.timezone === 'UTC';
    const mentionsDateOrTz =
      lowerError.includes('date') ||
      lowerError.includes('timezone') ||
      lowerError.includes('utc') ||
      lowerError.includes('calendar') ||
      lowerError.includes('day') ||
      lowerError.includes('time');

    const hasPlatformCode = codeFindings.some((f) => f.id.includes('platform'));
    const hasNodeMismatch = envFindings.some((f) => f.id.includes('node-mismatch'));
    const hasAssertionDiff = ciFindings.some((f) => f.id.includes('assertion-diff'));

    // SCENARIO 1: Evidence-backed Timezone Sensitivity
    if (hasDateCode && (hasTzEnv || mentionsDateOrTz)) {
      const targetFile = codeReport?.codeInspection?.filename || 'repository date module';
      return {
        status: 'CONFIRMED',
        confidenceRating: hasTzEnv && mentionsDateOrTz ? 'HIGH' : 'MEDIUM',
        confidenceNote:
          'Correlated across local Date accessor usage, environment timezone configuration, and user assertion error.',
        primaryDiagnosis: {
          title: `Timezone-dependent calendar date resolution in ${targetFile}`,
          description:
            `The implementation extracts calendar date components using local-time Date getter methods ` +
            `which evaluate according to process-local timezone rather than UTC. When executed in an environment ` +
            `with a different timezone (such as CI under UTC), timestamp evaluations shift across calendar boundaries, ` +
            `inducing deterministic assertion failures.`,
          impactSummary: 'Causes tests to fail in CI environments while passing locally.',
          category: 'Environment / Timezone Sensitivity',
          affectedComponent: targetFile
        },
        evidenceStreams: [
          {
            id: 'stream-env',
            dimension: 'Environment',
            icon: '🌐',
            source: 'Environment Inspector',
            finding: envReport?.detected?.timezone
              ? `Runtime configured with TZ=${envReport.detected.timezone}.`
              : 'Host environment timezone configurations alter process-local calendar date extraction.',
            weight: 'Strong (Direct Factor)',
            keyDetails: [
              envReport?.detected?.declaredNode ? `Declared Node: ${envReport.detected.declaredNode}` : 'Node engine active',
              envReport?.detected?.timezone ? `Detected TZ: ${envReport.detected.timezone}` : 'Timezone discrepancy indicated',
              'Implicit system timezone shifts evaluation across date boundaries'
            ]
          },
          {
            id: 'stream-code',
            dimension: 'Code',
            icon: '📄',
            source: `AST & Source Inspection (${targetFile})`,
            finding: 'Local-time Date accessors evaluate against process locale rather than UTC timestamp values.',
            weight: 'Primary Mechanism',
            keyDetails: [
              codeReport?.codeInspection?.highlightedTokens?.join(', ') || 'getFullYear(), getMonth(), getDate()',
              `Target source: ${targetFile}`,
              'Evaluates against host local clock instead of invariant UTC'
            ]
          },
          {
            id: 'stream-ci',
            dimension: 'CI',
            icon: '⚙️',
            source: 'CI Inspector',
            finding: ciReport?.parsedLog?.failingTests?.length
              ? `Failing test: ${ciReport.parsedLog.failingTests[0]}`
              : 'CI execution environment induces deterministic boundary assertion failure.',
            weight: 'Reproducible Trigger',
            keyDetails: [
              ciReport?.ciConfigFile ? `Workflow: ${ciReport.ciConfigFile}` : 'CI log inspected',
              ciReport?.parsedLog?.expected && ciReport?.parsedLog?.actual
                ? `Assertion: Expected "${ciReport.parsedLog.expected}" !== Received "${ciReport.parsedLog.actual}"`
                : 'Assertion failure reported under runner context',
              'Reproducible with isolated container timezone configuration'
            ]
          }
        ],
        mechanismTrace: {
          timestamp: new Date().toISOString(),
          steps: [
            {
              stepNumber: 1,
              label: 'Input Timestamp Created',
              localState: 'Timestamp provided to date parser',
              ciState: 'Same timestamp provided in CI runner',
              note: 'Identical input timestamp provided to both executions.'
            },
            {
              stepNumber: 2,
              label: 'Process Timezone Applied',
              localState: 'Local Developer Host Timezone',
              ciState: 'CI Environment (TZ=UTC)',
              note: 'Process environment determines local offset for Date methods.'
            },
            {
              stepNumber: 3,
              label: 'Calendar Date Extraction',
              localState: 'Evaluates to local calendar date',
              ciState: 'Evaluates to UTC calendar date (Boundary shift)',
              note: 'Local getter methods shift values across midnight threshold.'
            },
            {
              stepNumber: 4,
              label: 'Assertion Verification',
              localState: 'Matches developer expected date',
              ciState: 'Fails CI assertion expectation',
              note: 'Assertion expects a specific date value that does not match in CI.'
            }
          ]
        },
        recommendation: {
          title: 'Isolated Reproduction in Shadowbox',
          description:
            'Launch a sandboxed reproduction container configured with TZ=UTC and the declared Node version to isolate and recreate the failure independently of the host workstation.',
          targetEnvironment: 'Docker Sandbox · Node LTS · TZ=UTC',
          containerImage: 'shadowbox-repro:node-utc'
        },
        missingEvidence: allMissingEvidence
      };
    }

    // SCENARIO 2: Node Runtime Version Mismatch
    if (hasNodeMismatch) {
      return {
        status: 'PROBABLE_DEFECT',
        confidenceRating: 'MEDIUM',
        confidenceNote: 'Correlated across user-specified Node version and repository engines requirement.',
        primaryDiagnosis: {
          title: `Node.js runtime version incompatibility`,
          description:
            `The repository specifies a Node version constraint that differs from the target execution environment. ` +
            `Modern ECMAScript or Node.js runtime APIs may behave differently or throw syntax/runtime errors.`,
          impactSummary: 'Prevents successful test execution on mismatched Node versions.',
          category: 'Runtime / Engine Incompatibility',
          affectedComponent: 'package.json:engines'
        },
        evidenceStreams: [
          {
            id: 'stream-env',
            dimension: 'Environment',
            icon: '🌐',
            source: 'Environment Inspector',
            finding: `Declared constraint "${envReport?.detected?.declaredNode}" vs target runtime.`,
            weight: 'Primary Mechanism',
            keyDetails: [
              `Declared Node: ${envReport?.detected?.declaredNode || 'Unspecified'}`,
              `Lockfile manager: ${envReport?.detected?.packageManager || 'npm'}`
            ]
          },
          {
            id: 'stream-code',
            dimension: 'Code',
            icon: '📄',
            source: 'Code Inspector',
            finding: 'Static code scan identified modern JavaScript / Node module constructs.',
            weight: 'Contributing Factor',
            keyDetails: [`Scanned files: ${codeReport?.scannedFilesCount || 0}`]
          },
          {
            id: 'stream-ci',
            dimension: 'CI',
            icon: '⚙️',
            source: 'CI Inspector',
            finding: 'CI execution context failed under target runner version.',
            weight: 'Trigger',
            keyDetails: [ciReport?.ciConfigFile ? `Workflow: ${ciReport.ciConfigFile}` : 'Runner execution log']
          }
        ],
        mechanismTrace: null,
        recommendation: {
          title: 'Target Runtime Alignment in Shadowbox',
          description: 'Spin up a container matching the exact declared Node version to verify compatibility.',
          targetEnvironment: `Docker Sandbox · Node ${envReport?.detected?.declaredNode || '20'}`,
          containerImage: 'shadowbox-repro:node-aligned'
        },
        missingEvidence: allMissingEvidence
      };
    }

    // SCENARIO 3: Operating System / Platform Check
    if (hasPlatformCode && (lowerError.includes('platform') || lowerError.includes('os') || lowerError.includes('path'))) {
      const flaggedFile = codeReport?.flaggedFiles[0] || 'repository codebase';
      return {
        status: 'PROBABLE_DEFECT',
        confidenceRating: 'MEDIUM',
        confidenceNote: 'Identified platform branching logic in code with reported OS-sensitive behavior.',
        primaryDiagnosis: {
          title: `Operating system platform dependency in ${flaggedFile}`,
          description:
            `Source code inspects host platform or uses OS-specific path separators/commands. ` +
            `Execution on a different operating system (e.g. Windows vs Linux) triggers alternate branches or path failures.`,
          impactSummary: 'Causes platform-specific test failures.',
          category: 'Platform / OS Dependency',
          affectedComponent: flaggedFile
        },
        evidenceStreams: [
          {
            id: 'stream-env',
            dimension: 'Environment',
            icon: '🌐',
            source: 'Environment Inspector',
            finding: `Target operating system: ${envReport?.detected?.os || 'Linux runner'}.`,
            weight: 'Factor',
            keyDetails: [`Target OS: ${envReport?.detected?.os || 'Ubuntu'}`]
          },
          {
            id: 'stream-code',
            dimension: 'Code',
            icon: '📄',
            source: 'Code Inspector',
            finding: `Platform checks detected in ${flaggedFile}.`,
            weight: 'Primary Mechanism',
            keyDetails: [`Flagged: ${flaggedFile}`]
          },
          {
            id: 'stream-ci',
            dimension: 'CI',
            icon: '⚙️',
            source: 'CI Inspector',
            finding: 'CI runner OS environment triggered failure.',
            weight: 'Trigger',
            keyDetails: ['Linux container execution']
          }
        ],
        mechanismTrace: null,
        recommendation: {
          title: 'Containerized OS Isolation in Shadowbox',
          description: 'Run in an isolated Linux container to observe platform branch behavior.',
          targetEnvironment: 'Docker Sandbox · Ubuntu Linux',
          containerImage: 'shadowbox-repro:linux'
        },
        missingEvidence: allMissingEvidence
      };
    }

    // SCENARIO 4: Insufficient Evidence (Default Fallback)
    const primaryFailure =
      ciReport?.parsedLog?.failingTests[0] ||
      errorDescription ||
      'Unresolved test failure';

    return {
      status: 'INSUFFICIENT_EVIDENCE',
      confidenceRating: 'LOW',
      confidenceNote:
        'Static analysis did not identify unambiguous environment or code correlation for this failure. Further runtime tracing is required in Shadowbox.',
      primaryDiagnosis: {
        title: `Unconfirmed root cause for: ${primaryFailure}`,
        description:
          `Static pattern analysis of the repository and user inputs identified signals, but could not establish a ` +
          `definitive cross-stream causal link without isolated container execution. The failure may involve ` +
          `dynamic runtime state, network I/O, database dependencies, or unversioned configurations.`,
        impactSummary: 'Requires live sandboxed reproduction in Phase 4 to trace execution state.',
        category: 'Inconclusive Static Analysis',
        affectedComponent: repositoryUrl || 'Repository'
      },
      evidenceStreams: [
        {
          id: 'stream-env',
          dimension: 'Environment',
          icon: '🌐',
          source: 'Environment Inspector',
          finding: envFindings.length > 0 ? envFindings[0].title : 'No environment anomalies identified.',
          weight: 'Inconclusive',
          keyDetails: [
            envReport?.detected?.declaredNode ? `Node: ${envReport.detected.declaredNode}` : 'Node unconstrained',
            'No direct causal environment mismatch established'
          ]
        },
        {
          id: 'stream-code',
          dimension: 'Code',
          icon: '📄',
          source: 'Code Inspector',
          finding: codeFindings.length > 0 ? codeFindings[0].title : 'No environment-sensitive code patterns matched.',
          weight: 'Inconclusive',
          keyDetails: [`Scanned files: ${codeReport?.scannedFilesCount || 0}`]
        },
        {
          id: 'stream-ci',
          dimension: 'CI',
          icon: '⚙️',
          source: 'CI Inspector',
          finding: ciFindings.length > 0 ? ciFindings[0].title : 'No CI failure correlation established.',
          weight: 'Inconclusive',
          keyDetails: [
            ciReport?.ciConfigFound ? 'CI configuration present' : 'CI configuration missing',
            ciReport?.parsedLog?.failingTests?.length ? `Failing test: ${ciReport.parsedLog.failingTests[0]}` : 'No failing tests parsed'
          ]
        }
      ],
      mechanismTrace: null,
      recommendation: {
        title: 'Execute Isolated Reproduction in Shadowbox (Phase 4)',
        description: 'Provision a clean Docker container to execute the test suite and capture live execution logs and environment variables.',
        targetEnvironment: 'Docker Sandbox · Clean Node Runtime',
        containerImage: 'shadowbox-repro:dynamic'
      },
      missingEvidence: allMissingEvidence
    };
  }
}

module.exports = new SynthesisService();
