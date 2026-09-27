import type { VerificationPageData } from '../types/verification';

/**
 * Static demo dataset for the final SHADOWBOX Verification page.
 *
 * Validates that the corrected UTC Date accessors eliminate the regression
 * across the regression test, the existing suite, and the controlled reproduction.
 */
export const VERIFICATION_DATA: VerificationPageData = {
  pageTitle: 'Verification',
  pageSubtitle:
    'The fix has been validated against the regression, existing tests, and the controlled reproduction environment.',
  statusBadge: 'VERIFIED',
  scenario: 'invoice date validation',
  summaryText: 'Fix verified across all validation layers.',
  layers: [
    {
      id: 'layer-regression',
      name: 'Regression Test',
      status: 'PASS',
      summary: 'Timestamp boundary specifically exercised under TZ=UTC.',
      icon: '🛡️',
    },
    {
      id: 'layer-suite',
      name: 'Existing Test Suite',
      status: 'PASS',
      summary: '7 of 7 invoice validation tests passing with zero regressions.',
      icon: '🧪',
    },
    {
      id: 'layer-shadowbox',
      name: 'Shadowbox Reproduction',
      status: 'PASS',
      summary: 'Controlled Linux container with TZ=UTC now exits code 0.',
      icon: '📦',
    },
  ],
  fixApplied: {
    title: 'Fix Applied',
    description:
      'Calendar components are now extracted using UTC-based Date accessors rather than process-local accessors.',
    affectedFile: 'demo-app/src/invoiceChecker.js',
    beforeMethods: ['getFullYear()', 'getMonth()', 'getDate()'],
    afterMethods: ['getUTCFullYear()', 'getUTCMonth()', 'getUTCDate()'],
    codeDiff: {
      beforeLines: [
        '// Before (Process-local Date accessors):',
        'const year = date.getFullYear();',
        "const month = String(date.getMonth() + 1).padStart(2, '0');",
        "const day = String(date.getDate()).padStart(2, '0');",
      ],
      afterLines: [
        '// After (Timezone-invariant UTC accessors):',
        'const year = date.getUTCFullYear();',
        "const month = String(date.getUTCMonth() + 1).padStart(2, '0');",
        "const day = String(date.getUTCDate()).padStart(2, '0');",
      ],
    },
  },
  regression: {
    title: 'Regression Test',
    purpose: 'Ensure the original timezone boundary failure cannot return.',
    testName: 'should preserve the invoice calendar date',
    result: 'PASS',
    expected: '2024-01-14',
    actual: '2024-01-14',
    environment: 'TZ=UTC',
    status: 'PASS',
    explanation:
      'The regression specifically exercises the timestamp boundary that previously produced the incorrect calendar date.',
  },
  testSuite: {
    title: 'Existing Test Suite',
    total: 7,
    passed: 7,
    failed: 0,
    status: 'PASS',
    command: 'npm test',
    explanation: 'All existing invoice validation tests continue to pass after the fix.',
  },
  shadowboxVerification: {
    title: 'Shadowbox Verification',
    environment: 'node:20-alpine',
    nodeVersion: '20.20.2',
    timezone: 'TZ=UTC',
    totalTests: 7,
    passedCount: 7,
    failedCount: 0,
    exitCode: 0,
    status: 'PASS',
    earlierStatus: 'FAILURE REPRODUCED',
    currentStatus: 'PASS',
    explanation:
      'The same controlled environment that previously reproduced the failure now passes after the fix.',
  },
  beforeAfter: {
    title: 'Before vs After',
    before: {
      environment: 'TZ=UTC',
      tests: '5 total',
      result: '2 passed / 3 failed',
      status: 'FAILURE REPRODUCED',
    },
    after: {
      environment: 'TZ=UTC',
      tests: '7 total',
      result: '7 passed / 0 failed',
      status: 'VERIFIED',
    },
    note: 'The verified workflow has 7 tests after the regression coverage was strengthened.',
  },
  evidence: {
    title: 'Verification Evidence',
    label: 'VERIFIED EVIDENCE',
    points: [
      'Regression test passes under UTC.',
      'Existing test suite passes completely.',
      'Controlled Shadowbox environment passes completely.',
      'Exit code is 0 in the verified reproduction.',
      'The previously reproduced timezone failure no longer occurs.',
    ],
  },
  boundary: {
    title: 'Verification Boundary',
    statement:
      'The verification demonstrates that the corrected implementation passes the available regression coverage and the controlled reproduction environment. It does not establish that every possible production environment has been tested.',
  },
  finalResult: {
    status: 'VERIFIED',
    summary:
      'The timezone-sensitive failure was reproduced, corrected, and successfully eliminated in the controlled verification environment.',
    workflowSteps: [
      { stepNumber: 1, name: 'Failure', completed: true },
      { stepNumber: 2, name: 'Investigation', completed: true },
      { stepNumber: 3, name: 'Root Cause', completed: true },
      { stepNumber: 4, name: 'Shadowbox', completed: true },
      { stepNumber: 5, name: 'Verification', completed: true },
    ],
  },
};
