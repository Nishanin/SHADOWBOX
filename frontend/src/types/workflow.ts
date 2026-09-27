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

export interface WorkflowOutletContext {
  reproductionResult: import('./shadowboxApi').ShadowboxRunResult | null;
  setReproductionResult: (result: import('./shadowboxApi').ShadowboxRunResult | null) => void;
  verificationResult: import('./shadowboxApi').ShadowboxRunResult | null;
  setVerificationResult: (result: import('./shadowboxApi').ShadowboxRunResult | null) => void;
}
