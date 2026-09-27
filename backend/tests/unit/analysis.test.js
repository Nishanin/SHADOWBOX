const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const app = require('../../src/app');
const sessionService = require('../../src/services/session.service');
const environmentInvestigator = require('../../src/services/environmentInvestigator');
const codeInvestigator = require('../../src/services/codeInvestigator');
const ciInvestigator = require('../../src/services/ciInvestigator');
const synthesisService = require('../../src/services/synthesisService');
const analysisService = require('../../src/services/analysis.service');

describe('Dynamic Investigation & Synthesis Service - Unit Tests', () => {
  beforeEach(() => {
    sessionService.clearSessions();
  });

  afterEach(() => {
    sessionService.clearSessions();
    analysisService._resetExecFile();
  });

  // ==========================================
  // 1. Environment Investigator Tests
  // ==========================================
  describe('Environment Investigator', () => {
    test('1. Detects Node version from package.json engines', () => {
      const result = environmentInvestigator.analyze({
        packageJson: {
          engines: { node: '>= 20.0.0' },
          packageManager: 'pnpm@9.0.0'
        }
      });

      assert.equal(result.status, 'COMPLETE');
      assert.equal(result.detected.declaredNode, '>= 20.0.0');
      assert.equal(result.detected.packageManager, 'pnpm@9.0.0');
      const fact = result.findings.find((f) => f.id === 'env-node-engines');
      assert.ok(fact);
      assert.equal(fact.type, 'OBSERVED_FACT');
      assert.match(fact.title, />= 20\.0\.0/);
    });

    test('2. Detects explicit timezone configuration in npm scripts and CI log', () => {
      const result = environmentInvestigator.analyze({
        packageJson: {
          scripts: { 'test:utc': 'TZ=UTC node --test' }
        },
        ciLog: 'Runner environment: Linux 5.15, TZ=UTC, Node.js v20.10.0'
      });

      assert.equal(result.detected.timezone, 'UTC');
      const scriptFinding = result.findings.find((f) => f.id === 'env-tz-script-test:utc');
      assert.ok(scriptFinding);
      assert.equal(scriptFinding.type, 'OBSERVED_FACT');
      assert.equal(scriptFinding.impact, 'HIGH');

      const logFinding = result.findings.find((f) => f.id === 'env-log-tz-utc');
      assert.ok(logFinding);
      assert.equal(logFinding.impact, 'HIGH');
    });

    test('3. Flags missing timezone and Node version evidence when undeclared', () => {
      const result = environmentInvestigator.analyze({
        packageJson: { name: 'unconstrained-app' }
      });

      assert.equal(result.detected.timezone, null);
      assert.equal(result.detected.declaredNode, null);
      assert.ok(result.missingEvidence.length >= 2);
      assert.match(result.missingEvidence[0].description, /timezone/i);
    });
  });

  // ==========================================
  // 2. Code Investigator Tests
  // ==========================================
  describe('Code Investigator', () => {
    let mockDir;

    beforeEach(() => {
      mockDir = path.join(os.tmpdir(), `test-code-repo-${Date.now()}`);
      fs.mkdirSync(mockDir, { recursive: true });
    });

    afterEach(() => {
      try {
        if (fs.existsSync(mockDir)) {
          fs.rmSync(mockDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore
      }
    });

    test('4. Detects local Date getter API usage (getFullYear, getMonth, getDate)', () => {
      const dateFilePath = path.join(mockDir, 'dateParser.js');
      fs.writeFileSync(
        dateFilePath,
        `export function parseDate(ts) {
          const d = new Date(ts);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const day = d.getDate();
          return y + '-' + m + '-' + day;
        }`
      );

      const result = codeInvestigator.analyze({
        repoDir: mockDir,
        errorDescription: 'Invoice date validator resolves to wrong calendar day in UTC'
      });

      assert.equal(result.status, 'COMPLETE');
      const dateFinding = result.findings.find((f) => f.id === 'code-date-local-getters');
      assert.ok(dateFinding);
      assert.equal(dateFinding.type, 'OBSERVED_FACT');
      assert.equal(dateFinding.impact, 'HIGH');
      assert.ok(result.codeInspection);
      assert.equal(result.codeInspection.filename, 'dateParser.js');
      assert.ok(result.codeInspection.highlightedTokens.includes('getFullYear()'));

      // Inferred relationship with user error
      const correlation = result.findings.find((f) => f.id === 'code-date-tz-correlation');
      assert.ok(correlation);
      assert.equal(correlation.type, 'INFERRED_RELATIONSHIP');
    });

    test('5. Detects process.env access in source files', () => {
      const configPath = path.join(mockDir, 'config.js');
      fs.writeFileSync(
        configPath,
        `const port = process.env.PORT || 3000;
         const apiKey = process.env.SECRET_API_KEY;`
      );

      const result = codeInvestigator.analyze({
        repoDir: mockDir
      });

      const envFinding = result.findings.find((f) => f.id === 'code-process-env-access');
      assert.ok(envFinding);
      assert.equal(envFinding.type, 'OBSERVED_FACT');
      assert.match(envFinding.description, /process\.env/);
    });

    test('6. Detects platform-specific checks (process.platform / os.platform)', () => {
      const osPath = path.join(mockDir, 'platformUtils.js');
      fs.writeFileSync(
        osPath,
        `const isWin = process.platform === 'win32';
         export function getExecutable() {
           return isWin ? 'app.exe' : 'app';
         }`
      );

      const result = codeInvestigator.analyze({
        repoDir: mockDir,
        errorDescription: 'Fails on Ubuntu runner'
      });

      const platformFinding = result.findings.find((f) => f.id === 'code-platform-check');
      assert.ok(platformFinding);
      assert.equal(platformFinding.type, 'OBSERVED_FACT');
      assert.equal(platformFinding.impact, 'MEDIUM');
    });
  });

  // ==========================================
  // 3. CI Investigator Tests
  // ==========================================
  describe('CI Investigator', () => {
    let mockDir;

    beforeEach(() => {
      mockDir = path.join(os.tmpdir(), `test-ci-repo-${Date.now()}`);
      fs.mkdirSync(mockDir, { recursive: true });
    });

    afterEach(() => {
      try {
        if (fs.existsSync(mockDir)) {
          fs.rmSync(mockDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore
      }
    });

    test('7. Detects CI workflow configuration, runner OS, and environment variables', () => {
      const wfDir = path.join(mockDir, '.github', 'workflows');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'ci.yml'),
        `name: CI
jobs:
  test:
    runs-on: ubuntu-22.04
    env:
      TZ: UTC
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: [20]
      - run: npm test`
      );

      const result = ciInvestigator.analyze({
        repoDir: mockDir
      });

      assert.equal(result.status, 'COMPLETE');
      assert.equal(result.ciConfigFound, true);
      assert.equal(result.ciConfigFile, '.github/workflows/ci.yml');

      const osFinding = result.findings.find((f) => f.id === 'ci-runner-os');
      assert.ok(osFinding);
      assert.match(osFinding.evidence, /ubuntu-22\.04/);

      const tzFinding = result.findings.find((f) => f.id === 'ci-tz-env');
      assert.ok(tzFinding);
      assert.match(tzFinding.evidence, /TZ:\s*UTC/);
    });

    test('8. Parses structured test failure, assertion diff, and exit code from CI log', () => {
      const sampleLog = `
TAP version 13
# Subtest: invoiceChecker
    not ok 1 - should format calendar date correctly
      ---
      duration_ms: 1.2
      Expected: "2024-01-14"
      Received: "2024-01-15"
      ...
1..1
# tests 1
# fail 1
Test exit code: 1
`;
      const result = ciInvestigator.analyze({
        ciLog: sampleLog
      });

      assert.equal(result.parsedLog?.framework, 'Node Test Runner (TAP)');
      assert.deepEqual(result.parsedLog?.failingTests, ['should format calendar date correctly']);
      assert.equal(result.parsedLog?.expected, '2024-01-14');
      assert.equal(result.parsedLog?.actual, '2024-01-15');
      assert.equal(result.parsedLog?.exitCode, 1);

      const diffFinding = result.findings.find((f) => f.id === 'ci-assertion-diff');
      assert.ok(diffFinding);
      assert.equal(diffFinding.type, 'OBSERVED_FACT');
      assert.equal(diffFinding.impact, 'HIGH');
    });

    test('9. Produces MISSING_EVIDENCE when no CI configuration or log is present', () => {
      const result = ciInvestigator.analyze({
        repoDir: mockDir,
        ciLog: ''
      });

      assert.equal(result.ciConfigFound, false);
      assert.ok(result.missingEvidence.length >= 2);
      assert.match(result.missingEvidence[0].description, /No continuous integration configuration/);
      assert.match(result.missingEvidence[1].description, /No CI execution log/);
    });
  });

  // ==========================================
  // 4. Root Cause Synthesis Tests
  // ==========================================
  describe('Root Cause Synthesis', () => {
    test('10. Synthesizes high-confidence timezone defect from cross-stream evidence', () => {
      const envReport = {
        detected: { timezone: 'UTC', declaredNode: '20' },
        findings: [{ id: 'env-tz-script', title: 'TZ=UTC in script' }],
        missingEvidence: []
      };
      const codeReport = {
        findings: [{ id: 'code-date-local-getters', title: 'Date getFullYear/getMonth/getDate' }],
        codeInspection: { filename: 'src/dateUtils.js', highlightedTokens: ['getDate()'] },
        flaggedFiles: ['src/dateUtils.js'],
        missingEvidence: []
      };
      const ciReport = {
        findings: [{ id: 'ci-assertion-diff', title: 'Expected 2024-01-14 !== 2024-01-15' }],
        parsedLog: { failingTests: ['test_date'], expected: '2024-01-14', actual: '2024-01-15' },
        missingEvidence: []
      };

      const synthesis = synthesisService.synthesize({
        envReport,
        codeReport,
        ciReport,
        errorDescription: 'Expected Jan 14, received Jan 15 under UTC'
      });

      assert.equal(synthesis.status, 'CONFIRMED');
      assert.equal(synthesis.confidenceRating, 'HIGH');
      assert.equal(synthesis.primaryDiagnosis.category, 'Environment / Timezone Sensitivity');
      assert.match(synthesis.primaryDiagnosis.title, /Timezone-dependent calendar date resolution in src\/dateUtils\.js/);
      assert.equal(synthesis.evidenceStreams.length, 3);
      assert.ok(synthesis.mechanismTrace);
      assert.equal(synthesis.mechanismTrace.steps.length, 4);
    });

    test('11. Flags INSUFFICIENT_EVIDENCE when signals are missing or inconclusive', () => {
      const envReport = { detected: {}, findings: [], missingEvidence: [{ description: 'No TZ' }] };
      const codeReport = { findings: [], flaggedFiles: [], missingEvidence: [{ description: 'No Date' }] };
      const ciReport = { findings: [], parsedLog: { failingTests: [] }, missingEvidence: [] };

      const synthesis = synthesisService.synthesize({
        envReport,
        codeReport,
        ciReport,
        errorDescription: 'Some unknown random assertion broke'
      });

      assert.equal(synthesis.status, 'INSUFFICIENT_EVIDENCE');
      assert.equal(synthesis.confidenceRating, 'LOW');
      assert.match(synthesis.primaryDiagnosis.title, /Unconfirmed root cause/);
      assert.equal(synthesis.mechanismTrace, null);
    });
  });

  // ==========================================
  // 5. API Endpoint Tests (POST /api/investigations/:id/analyze)
  // ==========================================
  describe('POST /api/investigations/:id/analyze API', () => {
    test('12. Analyzes a demo session and returns authoritative demo analysis data immediately', async () => {
      const demoRes = await request(app).post('/api/investigations').send({ isDemo: true });
      assert.equal(demoRes.status, 201);
      const sessionId = demoRes.body.id;

      const analyzeRes = await request(app).post(`/api/investigations/${sessionId}/analyze`);
      assert.equal(analyzeRes.status, 200);
      assert.equal(analyzeRes.body.id, sessionId);
      assert.equal(analyzeRes.body.status, 'ANALYZED');
      assert.equal(analyzeRes.body.isDemo, true);

      // Verify dynamic dataset structures
      assert.ok(analyzeRes.body.investigationData);
      assert.equal(analyzeRes.body.investigationData.tracks.length, 3);
      assert.ok(analyzeRes.body.rootCauseData);
      assert.equal(analyzeRes.body.rootCauseData.status, 'CONFIRMED');
      assert.equal(analyzeRes.body.rootCauseData.confidenceRating, 'HIGH');
      assert.equal(analyzeRes.body.archivePath, undefined); // Security: internal path stripped
    });

    test('13. Analyzes an ingested session and stores multi-stream findings and synthesis', async () => {
      // Create session directly in sessionService
      const session = sessionService.createSession({
        isDemo: false,
        repositoryUrl: 'https://github.com/example/date-app',
        branch: 'main',
        resolvedCommit: 'abcdef1234567890abcdef1234567890abcdef12',
        errorDescription: 'Invoice calendar date validator resolves to 2024-01-15 instead of 2024-01-14 in UTC environment',
        ciLog: 'Expected: "2024-01-14", Received: "2024-01-15", TZ=UTC',
        environment: { os: 'Ubuntu', nodeVersion: '20', timezone: 'UTC' },
        status: 'INITIALIZED'
      });

      const res = await request(app).post(`/api/investigations/${session.id}/analyze`);
      assert.equal(res.status, 200);
      assert.equal(res.body.id, session.id);
      assert.equal(res.body.status, 'ANALYZED');

      // Check streams
      assert.ok(res.body.environmentInvestigation);
      assert.equal(res.body.environmentInvestigation.detected.timezone, 'UTC');
      assert.ok(res.body.ciInvestigation);
      assert.ok(res.body.synthesis);
      assert.ok(res.body.investigationData);
      assert.ok(res.body.rootCauseData);
      assert.equal(res.body.archivePath, undefined);
    });

    test('14. Returns 404 NotFound when analyzing an unknown session ID', async () => {
      const res = await request(app).post('/api/investigations/inv_nonexistent_9999/analyze');
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'NotFound');
      assert.match(res.body.message, /not found/);
    });
  });
});
