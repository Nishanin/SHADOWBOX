import type { WorkflowStepMeta } from '../types/workflow';

/**
 * Static definition of all workflow steps.
 * Used by the navigation and router to drive the step indicator.
 */
export const WORKFLOW_STEPS: WorkflowStepMeta[] = [
  {
    id: 'failure',
    label: 'Failure',
    path: '/',
    description: 'The observed environment-dependent failure',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    path: '/investigation',
    description: 'Three-agent investigation: environment, code, CI',
  },
  {
    id: 'root-cause',
    label: 'Root Cause',
    path: '/root-cause',
    description: 'Synthesized root cause with evidence matrix',
  },
  {
    id: 'shadowbox',
    label: 'Shadowbox',
    path: '/shadowbox',
    description: 'Isolated Docker reproduction of the failure',
  },
  {
    id: 'verification',
    label: 'Verification',
    path: '/verification',
    description: 'Fix applied and verified across all environments',
  },
];
