import type { FailureScenarioData } from '../types/failure';

/**
 * Static demo failure scenario for the SHADOWBOX entry page.
 *
 * Captures an environment-dependent discrepancy where a test suite passes
 * locally on macOS under IST (UTC+5:30) but fails in CI on Ubuntu under UTC.
 */
export const FAILURE_DATA: FailureScenarioData = {
  pageTitle: 'Failure',
  pageSubtitle:
    'A test passes locally but fails in CI. Investigate the environment difference and reproduce the failure.',
  status: 'FAILED',
  testName: 'invoice date validation',
  testFile: 'src/invoiceChecker.test.js',
  suiteName: 'Invoice Calendar Date Suite',
  metrics: {
    total: 5,
    passed: 2,
    failed: 3,
  },
  environments: {
    local: {
      id: 'local-env',
      name: 'Local',
      status: 'PASS',
      environment: 'macOS · Node 20 · IST',
      os: 'macOS',
      runtime: 'Node 20',
      timezone: 'IST (UTC+5:30)',
    },
    ci: {
      id: 'ci-env',
      name: 'CI',
      status: 'FAIL',
      environment: 'Ubuntu · Node 20 · UTC',
      os: 'Ubuntu 22.04',
      runtime: 'Node 20',
      timezone: 'UTC',
    },
  },
  details: {
    expected: 'Invoice date should remain 2024-01-14',
    actual: 'Invoice date resolved to 2024-01-15',
    timestamp: '2024-01-14T23:30:00.000Z',
    environment: 'TZ=UTC',
  },
  rawLogOutput: [
    'FAIL  src/invoiceChecker.test.js',
    '',
    '✕ should preserve the invoice calendar date',
    '  Expected: "2024-01-14"',
    '  Received: "2024-01-15"',
    '',
    '3 failed, 2 passed, 5 total',
  ],
  initialSignal: {
    title: 'Initial Signal',
    statusTag: 'UNCONFIRMED',
    description:
      'The failure appears environment-dependent. The same UTC timestamp resolves to different calendar dates depending on the process timezone.',
    advisoryNote:
      'Heuristic detection only. Further isolated reproduction is required before drawing conclusions.',
  },
  ctaText: 'Investigate Failure',
  ctaPath: '/investigation',
};
