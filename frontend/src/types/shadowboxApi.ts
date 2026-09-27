/**
 * Types representing the Shadowbox Backend API Contract.
 */

export type ShadowboxVariant = 'reproduction' | 'verification';

export type ShadowboxStatus =
  | 'REPRODUCED'
  | 'VERIFIED'
  | 'UNEXPECTED_RESULT'
  | 'INFRASTRUCTURE_ERROR';

export interface ShadowboxRunResult {
  variant: ShadowboxVariant;
  sourceCommit: string | null;
  imageTag: string | null;
  totalTests: number | null;
  passedTests: number | null;
  failedTests: number | null;
  testExitCode: number | null;
  status: ShadowboxStatus | string;
  stdout: string;
  stderr: string;
  duration: string;
  durationMs: number;
  errorCategory: string | null;
}

export interface ShadowboxServiceStatus {
  service: string;
  available: boolean;
  variants: ShadowboxVariant[];
  dockerAvailable?: boolean;
  dockerVersion?: string | null;
}

export interface ShadowboxApiErrorResponse {
  error: string;
  message?: string;
  status?: string;
  errorCategory?: string | null;
  allowedVariants?: string[];
  stderr?: string;
}

export class ShadowboxApiError extends Error {
  statusCode: number;
  errorCategory?: string | null;
  apiResponse?: ShadowboxApiErrorResponse | ShadowboxRunResult;

  constructor(
    message: string,
    statusCode: number,
    errorCategory?: string | null,
    apiResponse?: ShadowboxApiErrorResponse | ShadowboxRunResult
  ) {
    super(message);
    this.name = 'ShadowboxApiError';
    this.statusCode = statusCode;
    this.errorCategory = errorCategory;
    this.apiResponse = apiResponse;
  }
}
