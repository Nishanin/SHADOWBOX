import type { ShadowboxPageData } from '../types/shadowbox';

/**
 * Static demo dataset for the SHADOWBOX reproduction page.
 *
 * Demonstrates the isolated reproduction of the timezone-sensitive
 * invoiceChecker date failure in a controlled Linux container under TZ=UTC.
 */
export const SHADOWBOX_DATA: ShadowboxPageData = {
  pageTitle: 'Shadowbox',
  pageSubtitle:
    'Reproduce the failure in an isolated environment before applying the fix.',
  statusBadge: 'REPRODUCTION',
  scenario: 'invoice date validation',
  environment: {
    label: 'ISOLATED ENVIRONMENT',
    baseImage: 'node:20-alpine',
    nodeVersion: '20.20.2',
    operatingEnvironment: 'Linux container',
    timezone: 'UTC',
    envVariable: 'TZ=UTC',
    workingDir: '/workspace',
  },
  command: {
    command: 'npm test',
    fullInvocation: 'TZ=UTC npm test',
  },
  result: {
    status: 'FAILURE REPRODUCED',
    label: 'DEMO REPRODUCTION RESULT',
    totalTests: 5,
    passedCount: 2,
    failedCount: 3,
    exitCode: 1,
  },
  logLines: [
    'Environment: TZ=UTC Node v20.20.2',
    'FAIL  demo-app/src/invoiceChecker.test.js',
    '',
    '✕ should preserve the invoice calendar date',
    '  Expected: "2024-01-14"',
    '  Received: "2024-01-15"',
    '',
    '3 failed, 2 passed, 5 total',
    'Exit code: 1',
  ],
  match: {
    title: 'Failure Match',
    status: 'MATCHED',
    matchSummary: 'Failure signature matches',
    original: {
      environment: 'CI / UTC',
      expected: '2024-01-14',
      actual: '2024-01-15',
    },
    reproduction: {
      environment: 'Isolated / UTC',
      expected: '2024-01-14',
      actual: '2024-01-15',
    },
    epistemicNote:
      'Failure signature matches the original CI defect. Claim is limited to the observed assertion discrepancy under UTC; byte-for-byte log identity across historical CI pipelines is not implied.',
  },
  evidence: {
    title: 'Reproduction Evidence',
    points: [
      'The same timestamp is used (2024-01-14T23:30:00.000Z).',
      'The reproduction runs under TZ=UTC.',
      'The same expected/actual date mismatch occurs (2024-01-14 vs 2024-01-15).',
      'The same test scenario fails (should preserve the invoice calendar date).',
      "The reproduction is isolated from the developer's local environment.",
    ],
    conclusion:
      'The environment-sensitive failure can be reproduced independently of the original machine.',
  },
  boundary: {
    title: 'Reproduction Boundary',
    statement:
      'The reproduction confirms the failure mechanism in the controlled environment. It does not by itself prove that every CI runner uses the same configuration.',
  },
  ctaText: 'Continue to Verification',
  ctaPath: '/verification',
  backPath: '/root-cause',
};
