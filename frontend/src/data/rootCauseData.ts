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
  confidenceScore: 98,
  confidenceRating: 'HIGH',
  primaryDiagnosis: {
    title: 'Timezone-dependent calendar date resolution in invoiceChecker.js',
    description:
      'The invoice date validator extracts calendar date components using local-time Date getter methods (getFullYear, getMonth, getDate) on a UTC ISO-8601 timestamp (2024-01-14T23:30:00.000Z). In local environments with positive UTC offsets such as IST (UTC+5:30), the 23:30Z moment rolls over past midnight into 05:00 on 2024-01-15, producing the expected local calendar date. In CI environments operating under UTC (UTC+0:00), the date remains 2024-01-14, causing a deterministic assertion failure.',
    impactSummary: 'Prevents CI deployment pipeline passage despite successful local developer testing.',
    category: 'Environment / Timezone Sensitivity',
    affectedComponent: 'src/invoiceChecker.js (Invoice Calendar Validator)',
  },
  codeInspection: {
    filename: 'src/invoiceChecker.js',
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
      finding: 'Local workstation configured with IST (UTC+5:30); CI reproduction container set to TZ=UTC.',
      weight: 'Strong (Direct Factor)',
      keyDetails: [
        'Local: macOS · Node 20 · IST (UTC+5:30)',
        'CI: Ubuntu · Node 20 · UTC (UTC+0:00)',
        'Timezone offset delta: +330 minutes',
      ],
    },
    {
      id: 'stream-code',
      dimension: 'Code',
      icon: '📄',
      source: 'AST & Source Inspection (src/invoiceChecker.js)',
      finding: 'Local Date accessor calls evaluate against process locale rather than UTC timestamp values.',
      weight: 'Primary Mechanism',
      keyDetails: [
        'Method calls: getFullYear(), getMonth(), getDate()',
        'Input format: ISO-8601 UTC string (2024-01-14T23:30:00.000Z)',
        'Output format: YYYY-MM-DD string formatted with local offsets',
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
        'Runner OS: Ubuntu 22.04 LTS',
        'Runtime: Node 20.20.2',
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
        localState: 'IST (UTC+5:30)',
        ciState: 'UTC (UTC+0:00)',
        note: 'Node.js process reads host environment timezone configuration.',
      },
      {
        stepNumber: 3,
        label: 'Local Time Representation',
        localState: '2024-01-15 05:00:00 (Next Day)',
        ciState: '2024-01-14 23:30:00 (Same Day)',
        note: 'UTC 23:30 + 5h30m = 05:00 on the following calendar day.',
      },
      {
        stepNumber: 4,
        label: 'Date Component Extraction',
        localState: 'date.getDate() → 15 (Evaluated as 2024-01-15)',
        ciState: 'date.getDate() → 14 (Evaluated as 2024-01-14)',
        note: 'Test assertion fails under UTC due to single-day shift.',
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
