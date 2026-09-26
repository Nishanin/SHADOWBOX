export interface ValidationLayer {
  id: string;
  name: string;
  status: 'PASS';
  summary: string;
  icon: string;
}

export interface FixAppliedData {
  title: string;
  description: string;
  affectedFile: string;
  beforeMethods: string[];
  afterMethods: string[];
  codeDiff: {
    beforeLines: string[];
    afterLines: string[];
  };
}

export interface RegressionResultData {
  title: string;
  purpose: string;
  testName: string;
  result: string;
  expected: string;
  actual: string;
  environment: string;
  status: string;
  explanation: string;
}

export interface TestSuiteResultData {
  title: string;
  total: number;
  passed: number;
  failed: number;
  status: string;
  command: string;
  explanation: string;
}

export interface ShadowboxVerificationData {
  title: string;
  environment: string;
  nodeVersion: string;
  timezone: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  exitCode: number;
  status: string;
  explanation: string;
  earlierStatus: string;
  currentStatus: string;
}

export interface BeforeAfterSnapshot {
  environment: string;
  tests: string;
  result: string;
  status: string;
}

export interface BeforeAfterComparisonData {
  title: string;
  before: BeforeAfterSnapshot;
  after: BeforeAfterSnapshot;
  note: string;
}

export interface VerificationEvidenceData {
  title: string;
  label: string;
  points: string[];
}

export interface VerificationBoundaryData {
  title: string;
  statement: string;
}

export interface FinalWorkflowStep {
  name: string;
  completed: boolean;
  stepNumber: number;
}

export interface FinalVerificationData {
  status: string;
  summary: string;
  workflowSteps: FinalWorkflowStep[];
}

export interface VerificationPageData {
  pageTitle: string;
  pageSubtitle: string;
  statusBadge: string;
  scenario: string;
  summaryText: string;
  layers: ValidationLayer[];
  fixApplied: FixAppliedData;
  regression: RegressionResultData;
  testSuite: TestSuiteResultData;
  shadowboxVerification: ShadowboxVerificationData;
  beforeAfter: BeforeAfterComparisonData;
  evidence: VerificationEvidenceData;
  boundary: VerificationBoundaryData;
  finalResult: FinalVerificationData;
}
