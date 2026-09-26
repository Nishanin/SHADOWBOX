import type { RootCauseData } from '../types/rootCause';

/**
 * Static demo root cause synthesis dataset for the SHADOWBOX Root Cause page.
 *
 * Consolidates the 3-stream evidence matrix from the Investigation stage
 * to deliver a high-confidence diagnosis of the timezone-sensitive Date resolution failure.
 */
export const ROOT_CAUSE_DATA: RootCauseData = {
  pageTitle: 'Root Cause',
  pageSubtitle:
    'Synthesized root cause analysis combining environment, code, and CI evidence streams.',
  status: 'CONFIRMED',
  failureTarget: 'invoice date validation',
  confidenceRating: 'HIGH',
  confidenceNote: 'Correlated across three independent evidence streams.',
  primaryDiagnosis: {
    title: 'Timezone-dependent calendar date resolution in invoiceChecker.js',
    description:
      'The invoice date validator extracts calendar date components using local-time Date getter methods (getFullYear, getMonth, getDate) on a UTC ISO-8601 timestamp (2024-01-14T23:30:00.000Z). While the test asserts the UTC calendar date 2024-01-14, the implementation evaluates according to process-local time. In the failing environment, timezone-sensitive extraction shifts the 23:30Z timestamp across the calendar boundary into the next day, returning 2024-01-15 instead of the expected 2024-01-14, producing a deterministic assertion failure.',
    impactSummary: 'Prevents CI deployment pipeline passage despite successful local developer testing.',
    category: 'Environment / Timezone Sensitivity',
    affectedComponent: 'demo-app/src/invoiceChecker.js (Invoice Calendar Validator)',
  },
  codeInspection: {
    filename: 'demo-app/src/invoiceChecker.js',
    description:
      'The implementation relies on Date.prototype local accessors which evaluate according to host timezone rather than UTC.',
    lines: [
      {
        lineNumber: 14,
        content: 'export function parseInvoiceCalendarDate(invoice) {',
        highlight: 'normal',
      },
      {
        lineNumber: 15,
        content: '  const date = new Date(invoice.timestamp);',
        highlight: 'normal',
      },
      {
        lineNumber: 16,
        content: '  // BUG: Local-time getters shift dates across UTC boundaries',
        highlight: 'warning',
      },
      {
        lineNumber: 17,
        content: '  const year = date.getFullYear();',
        highlight: 'highlight',
      },
      {
        lineNumber: 18,
        content: "  const month = String(date.getMonth() + 1).padStart(2, '0');",
        highlight: 'highlight',
      },
      {
        lineNumber: 19,
        content: "  const day = String(date.getDate()).padStart(2, '0');",
        highlight: 'highlight',
      },
      {
        lineNumber: 20,
        content: '  return `${year}-${month}-${day}`;',
        highlight: 'normal',
      },
      {
        lineNumber: 21,
        content: '}',
        highlight: 'normal',
      },
    ],
    highlightedTokens: ['getFullYear()', 'getMonth()', 'getDate()'],
  },
  evidenceStreams: [
    {
      id: 'stream-env',
      dimension: 'Environment',
      icon: '🌐',
      source: 'Host vs Container Timezone Inspection',
      finding: 'Host environment timezone configurations alter process-local calendar date extraction across midnight boundaries.',
      weight: 'Strong (Direct Factor)',
      keyDetails: [
        'Local: macOS · Node 20 · Passing run',
        'CI: Ubuntu · Node 20 · TZ=UTC (Failing run)',
        'Discrepancy: Local-time Date getters evaluate differently across environment boundaries',
      ],
    },
    {
      id: 'stream-code',
      dimension: 'Code',
      icon: '📄',
      source: 'AST & Source Inspection (demo-app/src/invoiceChecker.js)',
      finding: 'Local Date accessor calls evaluate against process locale rather than UTC timestamp values.',
      weight: 'Primary Mechanism',
      keyDetails: [
        'Method calls: getFullYear(), getMonth(), getDate()',
        'Input format: ISO-8601 UTC string (2024-01-14T23:30:00.000Z)',
        'Output format: YYYY-MM-DD formatted with local getters',
      ],
    },
    {
      id: 'stream-ci',
      dimension: 'CI',
      icon: '⚙️',
      source: 'CI Runner & Reproduction Sandbox Log',
      finding: 'Standard Ubuntu runner default TZ=UTC induces deterministic failure on 23:30Z boundaries.',
      weight: 'Reproducible Trigger',
      keyDetails: [
        'Runner OS: Ubuntu 22.04 LTS · Node 20.20.2',
        'Assertion Failure: Expected "2024-01-14", Received "2024-01-15"',
        'Reproduction: 100% reproducible with TZ=UTC node execution',
      ],
    },
  ],
  mechanismTrace: {
    timestamp: '2024-01-14T23:30:00.000Z',
    steps: [
      {
        stepNumber: 1,
        label: 'Input Timestamp Created',
        localState: '2024-01-14T23:30:00.000Z',
        ciState: '2024-01-14T23:30:00.000Z',
        note: 'Exact same ISO-8601 UTC timestamp provided to both test runs.',
      },
      {
        stepNumber: 2,
        label: 'Process Timezone Applied',
        localState: 'Local Host (Passing)',
        ciState: 'CI / Reproduction (TZ=UTC)',
        note: 'Node.js process reads host environment timezone configuration.',
      },
      {
        stepNumber: 3,
        label: 'Calendar Date Extraction',
        localState: '2024-01-14 (Passes assertion)',
        ciState: '2024-01-15 (Day boundary shift)',
        note: 'Local-time Date accessors evaluate timestamp across calendar boundary.',
      },
      {
        stepNumber: 4,
        label: 'Assertion Verification',
        localState: 'Expected "2024-01-14" === Received "2024-01-14"',
        ciState: 'Expected "2024-01-14" !== Received "2024-01-15"',
        note: 'Test assertion expects UTC date 2024-01-14; received 2024-01-15 in CI.',
      },
    ],
  },
  recommendation: {
    title: 'Isolated Reproduction in Shadowbox',
    description:
      'Launch a sandboxed reproduction container configured with TZ=UTC and Node 20 to isolate and recreate the failure independently of the host workstation.',
    targetEnvironment: 'Docker Sandbox · Node 20-alpine · TZ=UTC',
    containerImage: 'shadowbox-repro:node20-utc',
  },
  ctaText: 'Reproduce in Shadowbox',
  ctaPath: '/shadowbox',
  backPath: '/investigation',
};
