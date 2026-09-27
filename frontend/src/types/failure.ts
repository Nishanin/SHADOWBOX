export type StatusType = 'FAILED' | 'FAIL' | 'PASS' | 'UNCONFIRMED';

export interface EnvironmentRun {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  environment: string;
  os: string;
  runtime: string;
  timezone: string;
}

export interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
}

export interface FailureDetailsData {
  expected: string;
  actual: string;
  timestamp: string;
  environment: string;
}

export interface InitialSignalData {
  title: string;
  statusTag: string;
  description: string;
  advisoryNote?: string;
}

export interface FailureScenarioData {
  pageTitle: string;
  pageSubtitle: string;
  status: string;
  testName: string;
  testFile: string;
  suiteName: string;
  metrics: TestMetrics;
  environments: {
    local: EnvironmentRun;
    ci: EnvironmentRun;
  };
  details: FailureDetailsData;
  rawLogOutput: string[];
  initialSignal: InitialSignalData;
  ctaText: string;
  ctaPath: string;
}
