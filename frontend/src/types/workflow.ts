/**
 * Shared TypeScript types for the SHADOWBOX frontend.
 *
 * These are structural types for the routing/layout layer only.
 * Backend data-contract types will be defined separately once
 * the API contract is agreed with the backend team.
 */

/** The ordered steps of the SHADOWBOX workflow. */
export type WorkflowStep =
  | 'failure'
  | 'investigation'
  | 'root-cause'
  | 'shadowbox'
  | 'verification';

/** Metadata for a single workflow step, used to drive nav/routing. */
export interface WorkflowStepMeta {
  id: WorkflowStep;
  label: string;
  path: string;
  description: string;
}
export interface UserEnvironmentInfo {
  os?: string;
  nodeVersion?: string;
  timezone?: string;
}

export interface UserIntakePayload {
  repositoryUrl?: string;
  branch?: string;
  errorDescription?: string;
  ciLog?: string;
  environment?: UserEnvironmentInfo;
  isDemo?: boolean;
}

export interface RepositoryMetadata {
  isNodeProject: boolean;
  name?: string | null;
  version?: string | null;
  packageManager?: string | null;
  testScript?: string | null;
  scripts?: string[];
  hasDockerFile?: boolean;
}

export interface InvestigationSession {
  id: string;
  isDemo: boolean;
  repositoryUrl: string | null;
  branch: string;
  resolvedCommit: string | null;
  errorDescription: string | null;
  ciLog: string | null;
  environment: UserEnvironmentInfo | null;
  status: 'INITIALIZING' | 'INITIALIZED' | 'ANALYZING' | 'ANALYZED' | 'FAILED' | string;
  repositoryMetadata: RepositoryMetadata | null;
  createdAt: string;
  investigationData?: import('./investigation').InvestigationPageData;
  rootCauseData?: import('./rootCause').RootCauseData;
  environmentInvestigation?: unknown;
  codeInvestigation?: unknown;
  ciInvestigation?: unknown;
  synthesis?: unknown;
}

export interface WorkflowOutletContext {
  reproductionResult: import('./shadowboxApi').ShadowboxRunResult | null;
  setReproductionResult: (result: import('./shadowboxApi').ShadowboxRunResult | null) => void;
  verificationResult: import('./shadowboxApi').ShadowboxRunResult | null;
  setVerificationResult: (result: import('./shadowboxApi').ShadowboxRunResult | null) => void;
  session: InvestigationSession | null;
  setSession: (session: InvestigationSession | null) => void;
}

