import type { UserEnvironmentInfo, UserIntakePayload } from '../types/workflow';

export interface IntakeFormValues {
  repositoryUrl: string;
  branch?: string;
  errorDescription: string;
  ciLog?: string;
  environment?: UserEnvironmentInfo;
}

export interface IntakeValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  cleanedPayload?: UserIntakePayload;
}

/**
 * Validates user intake inputs before sending to the backend API.
 * Follows frontend-level validation rules; backend remains authoritative.
 */
export function validateIntakeForm(values: Partial<IntakeFormValues>): IntakeValidationResult {
  const errors: Record<string, string> = {};

  // 1. repositoryUrl (REQUIRED)
  const rawUrl = (values.repositoryUrl || '').trim();
  if (!rawUrl) {
    errors.repositoryUrl = 'GitHub repository URL is required.';
  } else {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') {
        errors.repositoryUrl = 'Repository URL must use HTTPS (e.g. https://github.com/owner/repo).';
      } else if (parsed.hostname.toLowerCase() !== 'github.com') {
        errors.repositoryUrl = 'Only repositories hosted on github.com are currently supported.';
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length !== 2) {
          errors.repositoryUrl = 'URL path must match the format /<owner>/<repository>.';
        }
      }
    } catch {
      errors.repositoryUrl = 'Invalid URL format.';
    }
  }

  // 2. errorDescription (REQUIRED)
  const rawError = (values.errorDescription || '').trim();
  if (!rawError) {
    errors.errorDescription = 'Error or failure description is required.';
  }

  // 3. branch (OPTIONAL, default: 'main')
  let branch = (values.branch || '').trim();
  if (!branch) {
    branch = 'main';
  } else if (branch.startsWith('-')) {
    errors.branch = 'Branch name cannot start with a hyphen.';
  }

  const isValid = Object.keys(errors).length === 0;

  // Clean environment fields if provided
  let environment: UserEnvironmentInfo | undefined;
  if (values.environment) {
    const os = values.environment.os?.trim();
    const nodeVersion = values.environment.nodeVersion?.trim();
    const timezone = values.environment.timezone?.trim();
    if (os || nodeVersion || timezone) {
      environment = {
        ...(os ? { os } : {}),
        ...(nodeVersion ? { nodeVersion } : {}),
        ...(timezone ? { timezone } : {}),
      };
    }
  }

  const cleanedPayload: UserIntakePayload | undefined = isValid
    ? {
        repositoryUrl: rawUrl,
        branch,
        errorDescription: rawError,
        ciLog: values.ciLog?.trim() || undefined,
        environment,
        isDemo: false,
      }
    : undefined;

  return {
    isValid,
    errors,
    cleanedPayload,
  };
}
