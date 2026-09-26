import type { InvestigationPageData } from '../types/investigation';

/**
 * Static demo investigation dataset for the SHADOWBOX Investigation view.
 *
 * Demonstrates three parallel investigation tracks (Environment, Code, CI)
 * examining the failure simultaneously without sequential dependencies.
 */
export const INVESTIGATION_DATA: InvestigationPageData = {
  pageTitle: 'Investigation',
  pageSubtitle:
    'Three parallel investigations are examining the failure across environment, code, and CI.',
  overallStatus: 'INVESTIGATING',
  failureTarget: 'invoice date validation',
  tracks: [
    {
      id: 'environment',
      label: 'Environment Agent',
      agent: 'Environment',
      status: 'COMPLETE',
      focus: 'Runtime and environment differences',
      runAt: '2024-01-14T23:31:02.104Z',
      findings: [
        {
          title: 'Timezone differs between local and CI',
          description:
            'Local execution uses IST while the CI reproduction runs with TZ=UTC.',
          impact: 'HIGH',
        },
      ],
      evidence: [
        {
          type: 'runtime-env',
          source: 'Host Environment Profile',
          description: 'Local development environment profile inspected.',
          technicalValues: ['Local: macOS · Node 20 · IST'],
        },
        {
          type: 'runtime-env',
          source: 'Reproduction Container Profile',
          description: 'Automated CI reproduction sandbox profile inspected.',
          technicalValues: ['CI: Ubuntu · Node 20 · UTC'],
        },
        {
          type: 'env-variable',
          source: 'Environment Variable Snapshot',
          description: 'Process environment variable captured during reproduction failure.',
          technicalValues: ['TZ=UTC'],
        },
      ],
      missingEvidence: [
        {
          description:
            'Exact CI runtime configuration outside the captured reproduction environment.',
          whyItMatters:
            'Captures any unversioned system locale configurations or upstream runner overrides.',
        },
      ],
    },
    {
      id: 'code',
      label: 'Code Agent',
      agent: 'Code',
      status: 'COMPLETE',
      focus: 'Code paths involved in date resolution',
      runAt: '2024-01-14T23:31:03.421Z',
      findings: [
        {
          title: 'Calendar date is derived from a timezone-sensitive Date object',
          description:
            'The failing code extracts calendar components from a UTC timestamp using local-time Date accessors.',
          impact: 'HIGH',
        },
      ],
      evidence: [
        {
          type: 'source-code',
          source: 'src/invoiceChecker.js',
          description: 'Target implementation file containing the invoice date parser.',
          technicalValues: ['invoiceChecker.js'],
        },
        {
          type: 'ast-inspection',
          source: 'AST & Call Stack Analysis',
          description:
            'Local-time getter accessors invoked on JavaScript Date instance instead of UTC variants.',
          technicalValues: ['getFullYear()', 'getMonth()', 'getDate()'],
        },
      ],
      missingEvidence: [
        {
          description: 'No additional code paths are currently implicated.',
          whyItMatters:
            'Confirms that the discrepancy is isolated to this parser and not caused by helper libraries or database serializations.',
        },
      ],
    },
    {
      id: 'ci',
      label: 'CI Agent',
      agent: 'CI',
      status: 'COMPLETE',
      focus: 'CI configuration and execution context',
      runAt: '2024-01-14T23:31:04.890Z',
      findings: [
        {
          title: 'CI executes the test suite under UTC',
          description: 'The CI reproduction environment explicitly runs with TZ=UTC.',
          impact: 'MEDIUM',
        },
      ],
      evidence: [
        {
          type: 'env-config',
          source: 'CI Environment Descriptor',
          description: 'Configured default timezone for the continuous integration step.',
          technicalValues: ['TZ=UTC'],
        },
        {
          type: 'runtime-version',
          source: 'Node.js Execution Runtime',
          description: 'Verified runner engine version executing the CI test suite.',
          technicalValues: ['Node 20.20.2'],
        },
        {
          type: 'command-execution',
          source: 'Reproduction Pipeline Log',
          description: 'Test command execution invocation in the reproduction environment.',
          technicalValues: ['npm test -- src/invoiceChecker.test.js'],
        },
      ],
      missingEvidence: [
        {
          description:
            'Original hosted CI runner configuration is not available in the frontend demo.',
          whyItMatters:
            'Limits verification to the reproduction container rather than the historical pipeline run.',
        },
      ],
    },
  ],
  synthesis: {
    title: 'Investigation Synthesis',
    tag: 'PRELIMINARY',
    description:
      'Multiple independent signals point to an environment-sensitive date calculation.',
    contributingSignals: [
      {
        dimension: 'Environment',
        summary: 'Timezone differs between local (IST) and CI (UTC).',
      },
      {
        dimension: 'Code',
        summary: 'Local-time Date accessors (getFullYear, getMonth, getDate) are used.',
      },
      {
        dimension: 'CI',
        summary: 'Reproduction environment executes explicitly under TZ=UTC.',
      },
    ],
  },
  ctaText: 'Review Root Cause',
  ctaPath: '/root-cause',
};
