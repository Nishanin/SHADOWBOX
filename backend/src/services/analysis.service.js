const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const sessionService = require('./session.service');
const environmentInvestigator = require('./environmentInvestigator');
const codeInvestigator = require('./codeInvestigator');
const ciInvestigator = require('./ciInvestigator');
const synthesisService = require('./synthesisService');

let execFileFn = execFile;

function _setExecFile(fn) {
  execFileFn = fn;
}

function _resetExecFile() {
  execFileFn = execFile;
}

/**
 * Dynamic Investigation Analysis Orchestrator.
 *
 * Runs Environment, Code, and CI static investigators on the ingested repository
 * and synthesizes a root-cause candidate. Never executes repository code.
 */
class AnalysisService {
  /**
   * Analyzes an investigation session.
   *
   * @param {string} sessionId
   * @returns {Promise<object>} Updated session with dynamic analysis findings
   */
  async analyzeSession(sessionId) {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      const err = new Error(`Investigation session '${sessionId}' was not found.`);
      err.statusCode = 404;
      err.error = 'NotFound';
      throw err;
    }

    // 1. DEMO MODE: Return authoritative verified demo analysis
    if (session.isDemo) {
      return this.buildDemoAnalysis(session);
    }

    // 2. EXTERNAL REPOSITORY: Set status to ANALYZING
    sessionService.updateSession(sessionId, { status: 'ANALYZING' });

    const tempBase = os.tmpdir();
    const analysisDir = path.join(tempBase, 'shadowbox-analysis', sessionId);

    try {
      // Ensure analysis directory exists
      fs.mkdirSync(analysisDir, { recursive: true });

      // Unpack archive if present
      if (session.archivePath) {
        if (!fs.existsSync(session.archivePath)) {
          const error = new Error('The ingested repository archive is no longer available.');
          error.statusCode = 422;
          error.error = 'RepositoryUnavailable';
          throw error;
        }
        await this.unpackArchive(session.archivePath, analysisDir);
      }

      // Collect relative file paths
      const repoFiles = this.collectRelativeFiles(analysisDir, analysisDir);

      // Read package.json if available
      let packageJson = null;
      const pkgPath = path.join(analysisDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch {
          packageJson = null;
        }
      }

      // 3. Run Environment Investigator
      const envReport = environmentInvestigator.analyze({
        repoDir: analysisDir,
        userEnvironment: session.environment,
        ciLog: session.ciLog,
        packageJson,
        repoFiles
      });

      // 4. Run Code Investigator
      const codeReport = codeInvestigator.analyze({
        repoDir: analysisDir,
        repoFiles,
        errorDescription: session.errorDescription,
        ciLog: session.ciLog
      });

      // 5. Run CI Investigator
      const ciReport = ciInvestigator.analyze({
        repoDir: analysisDir,
        repoFiles,
        ciLog: session.ciLog,
        errorDescription: session.errorDescription
      });

      // 6. Run Root Cause Synthesis
      const synthesisReport = synthesisService.synthesize({
        envReport,
        codeReport,
        ciReport,
        errorDescription: session.errorDescription,
        ciLog: session.ciLog,
        repositoryUrl: session.repositoryUrl
      });

      // 7. Format UI datasets (compatible with InvestigationPage & RootCausePage)
      const investigationData = this.formatInvestigationPageData(session, envReport, codeReport, ciReport, synthesisReport);
      const rootCauseData = this.formatRootCausePageData(session, codeReport, synthesisReport);

      // 8. Update session
      const updates = {
        status: 'ANALYZED',
        environmentInvestigation: envReport,
        codeInvestigation: codeReport,
        ciInvestigation: ciReport,
        synthesis: synthesisReport,
        investigationData,
        rootCauseData
      };

      sessionService.updateSession(sessionId, updates);
      return sessionService.getSession(sessionId);
    } catch (err) {
      sessionService.updateSession(sessionId, { status: 'FAILED' });
      throw err;
    } finally {
      // 9. Clean up temporary unpacked analysis directory
      try {
        if (fs.existsSync(analysisDir)) {
          fs.rmSync(analysisDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup failure
      }
    }
  }

  /**
   * Safely unpacks tar archive using child_process.execFile.
   */
  unpackArchive(archivePath, targetDir) {
    return new Promise((resolve) => {
      execFileFn('tar', ['-xf', archivePath, '-C', targetDir], { timeout: 15000 }, (err) => {
        // If tar extraction fails or errors, continue with best effort
        resolve();
      });
    });
  }

  /**
   * Helper to collect relative files.
   */
  collectRelativeFiles(dir, baseDir, depth = 0) {
    if (depth > 6 || !fs.existsSync(dir)) return [];
    let files = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(this.collectRelativeFiles(full, baseDir, depth + 1));
        } else if (entry.isFile()) {
          files.push(path.relative(baseDir, full).replace(/\\/g, '/'));
        }
      }
    } catch {
      // Ignore
    }
    return files;
  }

  /**
   * Formats investigation data into the InvestigationPageData UI model.
   */
  formatInvestigationPageData(session, envReport, codeReport, ciReport, synthesisReport) {
    const targetLabel = session.repositoryUrl
      ? `${session.repositoryUrl} (${session.resolvedCommit ? session.resolvedCommit.slice(0, 8) : session.branch})`
      : 'User Repository';

    return {
      pageTitle: 'Investigation',
      pageSubtitle: 'Dynamic static analysis examining failure across environment, code, and CI streams.',
      overallStatus: 'COMPLETE',
      failureTarget: targetLabel,
      tracks: [
        {
          id: 'environment',
          label: 'Environment Agent',
          agent: 'Environment',
          status: 'COMPLETE',
          focus: 'Runtime and environment differences',
          runAt: envReport.runAt,
          findings: envReport.findings.map((f) => ({
            type: f.type,
            title: f.title,
            description: f.description,
            impact: f.impact,
            location: f.location,
            evidence: f.evidence
          })),
          evidence: envReport.evidence,
          missingEvidence: envReport.missingEvidence
        },
        {
          id: 'code',
          label: 'Code Agent',
          agent: 'Code',
          status: 'COMPLETE',
          focus: 'Code paths involved in date and environment resolution',
          runAt: codeReport.runAt,
          findings: codeReport.findings.map((f) => ({
            type: f.type,
            title: f.title,
            description: f.description,
            impact: f.impact,
            location: f.location,
            evidence: f.evidence
          })),
          evidence: codeReport.evidence,
          missingEvidence: codeReport.missingEvidence
        },
        {
          id: 'ci',
          label: 'CI Agent',
          agent: 'CI',
          status: 'COMPLETE',
          focus: 'CI configuration and execution context',
          runAt: ciReport.runAt,
          findings: ciReport.findings.map((f) => ({
            type: f.type,
            title: f.title,
            description: f.description,
            impact: f.impact,
            location: f.location,
            evidence: f.evidence
          })),
          evidence: ciReport.evidence,
          missingEvidence: ciReport.missingEvidence
        }
      ],
      synthesis: {
        title: 'Investigation Synthesis',
        tag: synthesisReport.confidenceRating,
        description: synthesisReport.primaryDiagnosis.description,
        contributingSignals: [
          {
            dimension: 'Environment',
            summary: envReport.findings.length > 0 ? envReport.findings[0].title : 'Environment parameters inspected'
          },
          {
            dimension: 'Code',
            summary: codeReport.findings.length > 0 ? codeReport.findings[0].title : 'Source code patterns inspected'
          },
          {
            dimension: 'CI',
            summary: ciReport.findings.length > 0 ? ciReport.findings[0].title : 'CI runner log and workflow inspected'
          }
        ]
      },
      ctaText: 'Review Root Cause',
      ctaPath: '/root-cause'
    };
  }

  /**
   * Formats synthesis data into the RootCauseData UI model.
   */
  formatRootCausePageData(session, codeReport, synthesisReport) {
    const targetLabel = session.repositoryUrl
      ? `${session.repositoryUrl} (${session.resolvedCommit ? session.resolvedCommit.slice(0, 8) : session.branch})`
      : 'User Repository';

    // Fallback code inspection panel if none generated
    const codeInspection = codeReport?.codeInspection || {
      filename: 'package.json',
      description: 'Repository configuration inspected.',
      lines: [
        { lineNumber: 1, content: '{', highlight: 'normal' },
        { lineNumber: 2, content: `  "name": "${session.repositoryMetadata?.name || 'repository'}",`, highlight: 'normal' },
        { lineNumber: 3, content: `  "scripts": { "test": "${session.repositoryMetadata?.testScript || 'test'}" }`, highlight: 'highlight' },
        { lineNumber: 4, content: '}', highlight: 'normal' }
      ],
      highlightedTokens: ['test']
    };

    return {
      pageTitle: 'Root Cause',
      pageSubtitle: 'Synthesized root cause analysis combining environment, code, and CI evidence streams.',
      status: synthesisReport.status,
      failureTarget: targetLabel,
      confidenceRating: synthesisReport.confidenceRating,
      confidenceNote: synthesisReport.confidenceNote,
      primaryDiagnosis: synthesisReport.primaryDiagnosis,
      codeInspection,
      evidenceStreams: synthesisReport.evidenceStreams,
      missingEvidence: synthesisReport.missingEvidence || [],
      mechanismTrace: synthesisReport.mechanismTrace || {
        timestamp: new Date().toISOString(),
        steps: [
          {
            stepNumber: 1,
            label: 'Test Execution Initiated',
            localState: 'Executed under developer environment',
            ciState: 'Executed under CI container environment',
            note: 'Static analysis observed behavioral discrepancy.'
          },
          {
            stepNumber: 2,
            label: 'Assertion Verification',
            localState: 'Passes expected condition',
            ciState: 'Fails assertion condition in CI',
            note: 'See evidence streams for isolated contributing factors.'
          }
        ]
      },
      recommendation: {
        title: synthesisReport.recommendation.title,
        description: synthesisReport.recommendation.description,
        targetEnvironment: synthesisReport.recommendation.targetEnvironment,
        containerImage: synthesisReport.recommendation.containerImage
      },
      ctaText: 'Reproduce in Shadowbox',
      ctaPath: '/shadowbox',
      backPath: '/investigation'
    };
  }

  /**
   * Returns verified demo analysis data for demo sessions without external calls.
   */
  buildDemoAnalysis(session) {
    const updates = {
      status: 'ANALYZED',
      environmentInvestigation: {
        agent: 'Environment',
        label: 'Environment Agent',
        status: 'COMPLETE',
        focus: 'Runtime and environment differences',
        runAt: '2024-01-14T23:31:02.104Z',
        detected: { timezone: 'UTC', declaredNode: '20' },
        findings: [
          {
            id: 'demo-env-tz',
            type: 'OBSERVED_FACT',
            impact: 'HIGH',
            title: 'Timezone differs between local and CI',
            description: 'Local execution uses IST while the CI reproduction runs with TZ=UTC.',
            location: 'Environment Profile',
            evidence: 'TZ=UTC'
          }
        ],
        evidence: [
          {
            type: 'runtime-env',
            source: 'Host Environment Profile',
            description: 'Local development environment profile inspected.',
            technicalValues: ['Local: macOS · Node 20 · IST']
          },
          {
            type: 'runtime-env',
            source: 'Reproduction Container Profile',
            description: 'Automated CI reproduction sandbox profile inspected.',
            technicalValues: ['CI: Ubuntu · Node 20 · UTC']
          },
          {
            type: 'env-variable',
            source: 'Environment Variable Snapshot',
            description: 'Process environment variable captured during reproduction failure.',
            technicalValues: ['TZ=UTC']
          }
        ],
        missingEvidence: [
          {
            description: 'Exact CI runtime configuration outside the captured reproduction environment.',
            whyItMatters: 'Captures any unversioned system locale configurations or upstream runner overrides.'
          }
        ]
      },
      codeInvestigation: {
        agent: 'Code',
        label: 'Code Agent',
        status: 'COMPLETE',
        focus: 'Code paths involved in date resolution',
        runAt: '2024-01-14T23:31:03.421Z',
        findings: [
          {
            id: 'demo-code-getters',
            type: 'OBSERVED_FACT',
            impact: 'HIGH',
            title: 'Calendar date is derived from a timezone-sensitive Date object',
            description: 'The failing code extracts calendar components from a UTC timestamp using local-time Date accessors.',
            location: 'demo-app/src/invoiceChecker.js:17',
            evidence: 'getFullYear(), getMonth(), getDate()'
          }
        ],
        evidence: [
          {
            type: 'source-code',
            source: 'demo-app/src/invoiceChecker.js',
            description: 'Target implementation file containing the invoice date parser.',
            technicalValues: ['demo-app/src/invoiceChecker.js']
          },
          {
            type: 'ast-inspection',
            source: 'AST & Call Stack Analysis',
            description: 'Local-time getter accessors invoked on JavaScript Date instance instead of UTC variants.',
            technicalValues: ['getFullYear()', 'getMonth()', 'getDate()']
          }
        ],
        missingEvidence: [
          {
            description: 'No additional code paths are currently implicated.',
            whyItMatters: 'Confirms that the discrepancy is isolated to this parser and not caused by helper libraries.'
          }
        ],
        codeInspection: {
          filename: 'demo-app/src/invoiceChecker.js',
          description: 'The implementation relies on Date.prototype local accessors which evaluate according to host timezone rather than UTC.',
          lines: [
            { lineNumber: 14, content: 'export function parseInvoiceCalendarDate(invoice) {', highlight: 'normal' },
            { lineNumber: 15, content: '  const date = new Date(invoice.timestamp);', highlight: 'normal' },
            { lineNumber: 16, content: '  // BUG: Local-time getters shift dates across UTC boundaries', highlight: 'warning' },
            { lineNumber: 17, content: '  const year = date.getFullYear();', highlight: 'highlight' },
            { lineNumber: 18, content: "  const month = String(date.getMonth() + 1).padStart(2, '0');", highlight: 'highlight' },
            { lineNumber: 19, content: "  const day = String(date.getDate()).padStart(2, '0');", highlight: 'highlight' },
            { lineNumber: 20, content: '  return `${year}-${month}-${day}`;', highlight: 'normal' },
            { lineNumber: 21, content: '}', highlight: 'normal' }
          ],
          highlightedTokens: ['getFullYear()', 'getMonth()', 'getDate()']
        }
      },
      ciInvestigation: {
        agent: 'CI',
        label: 'CI Agent',
        status: 'COMPLETE',
        focus: 'CI configuration and execution context',
        runAt: '2024-01-14T23:31:04.890Z',
        ciConfigFound: true,
        ciConfigFile: '.github/workflows/ci.yml',
        findings: [
          {
            id: 'demo-ci-utc',
            type: 'OBSERVED_FACT',
            impact: 'MEDIUM',
            title: 'CI executes the test suite under UTC',
            description: 'The CI reproduction environment explicitly runs with TZ=UTC.',
            location: 'CI Environment Descriptor',
            evidence: 'TZ=UTC'
          }
        ],
        evidence: [
          {
            type: 'env-config',
            source: 'CI Environment Descriptor',
            description: 'Configured default timezone for the continuous integration step.',
            technicalValues: ['TZ=UTC']
          },
          {
            type: 'runtime-version',
            source: 'Node.js Execution Runtime',
            description: 'Verified runner engine version executing the CI test suite.',
            technicalValues: ['Node 20.20.2']
          },
          {
            type: 'command-execution',
            source: 'Reproduction Pipeline Log',
            description: 'Test command execution invocation in the reproduction environment.',
            technicalValues: ['npm test -- demo-app/src/invoiceChecker.test.js']
          }
        ],
        missingEvidence: [
          {
            description: 'Original hosted CI runner configuration is not available in the frontend demo.',
            whyItMatters: 'Limits verification to the reproduction container rather than the historical pipeline run.'
          }
        ]
      },
      synthesis: {
        status: 'CONFIRMED',
        confidenceRating: 'HIGH',
        confidenceNote: 'Correlated across three independent evidence streams.',
        primaryDiagnosis: {
          title: 'Timezone-dependent calendar date resolution in invoiceChecker.js',
          description:
            'The invoice date validator extracts calendar date components using local-time Date getter methods (getFullYear, getMonth, getDate) on a UTC ISO-8601 timestamp (2024-01-14T23:30:00.000Z). While the test asserts the UTC calendar date 2024-01-14, the implementation evaluates according to process-local time. In the failing environment, timezone-sensitive extraction shifts the 23:30Z timestamp across the calendar boundary into the next day, returning 2024-01-15 instead of the expected 2024-01-14, producing a deterministic assertion failure.',
          impactSummary: 'Prevents CI deployment pipeline passage despite successful local developer testing.',
          category: 'Environment / Timezone Sensitivity',
          affectedComponent: 'demo-app/src/invoiceChecker.js (Invoice Calendar Validator)'
        },
        recommendation: {
          title: 'Isolated Reproduction in Shadowbox',
          description:
            'Launch a sandboxed reproduction container configured with TZ=UTC and Node 20 to isolate and recreate the failure independently of the host workstation.',
          targetEnvironment: 'Docker Sandbox · Node 20-alpine · TZ=UTC',
          containerImage: 'shadowbox-repro:node20-utc'
        }
      }
    };

    updates.investigationData = this.formatInvestigationPageData(
      session,
      updates.environmentInvestigation,
      updates.codeInvestigation,
      updates.ciInvestigation,
      updates.synthesis
    );
    updates.rootCauseData = this.formatRootCausePageData(
      session,
      updates.codeInvestigation,
      updates.synthesis
    );

    sessionService.updateSession(session.id, updates);
    return sessionService.getSession(session.id);
  }
}

const analysisService = new AnalysisService();
analysisService._setExecFile = _setExecFile;
analysisService._resetExecFile = _resetExecFile;

module.exports = analysisService;
