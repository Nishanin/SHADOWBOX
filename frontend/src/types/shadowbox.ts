export interface ReproductionEnvSpec {
  label: string;
  baseImage: string;
  nodeVersion: string;
  operatingEnvironment: string;
  timezone: string;
  envVariable: string;
  workingDir: string;
}

export interface ReproductionCommandSpec {
  command: string;
  fullInvocation: string;
}

export interface ReproductionResult {
  status: string;
  label: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  exitCode: number;
}

export interface FailureMatchSide {
  environment: string;
  expected: string;
  actual: string;
}

export interface FailureMatchComparison {
  title: string;
  status: string;
  matchSummary: string;
  original: FailureMatchSide;
  reproduction: FailureMatchSide;
  epistemicNote: string;
}

export interface ReproductionEvidenceData {
  title: string;
  points: string[];
  conclusion: string;
}

export interface ReproductionBoundaryData {
  title: string;
  statement: string;
}

export interface ShadowboxPageData {
  pageTitle: string;
  pageSubtitle: string;
  statusBadge: string;
  scenario: string;
  environment: ReproductionEnvSpec;
  command: ReproductionCommandSpec;
  result: ReproductionResult;
  logLines: string[];
  match: FailureMatchComparison;
  evidence: ReproductionEvidenceData;
  boundary: ReproductionBoundaryData;
  ctaText: string;
  ctaPath: string;
  backPath: string;
}
