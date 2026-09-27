import type {
  InvestigationSession,
  ShadowboxRunResult,
  ShadowboxServiceStatus,
  ShadowboxVariant,
  UserIntakePayload,
} from '../types/shadowboxApi.ts';
import { ShadowboxApiError } from '../types/shadowboxApi.ts';

/**
 * Resolves the API base URL from Vite environment or default localhost:3001.
 */
export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
  if (proc?.env?.VITE_API_BASE_URL) {
    return proc.env.VITE_API_BASE_URL;
  }
  return 'http://localhost:3001';
}
/**
 * Checks backend availability and capabilities.
 */
export async function getShadowboxStatus(): Promise<ShadowboxServiceStatus> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/shadowbox/status`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ShadowboxApiError(
        errorData?.message || `Failed to fetch status (HTTP ${response.status})`,
        response.status,
        errorData?.errorCategory || null,
        errorData
      );
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ShadowboxApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. Please ensure the backend is running. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Executes an approved source variant ('reproduction' or 'verification') in the Shadowbox container.
 *
 * CRITICAL SEMANTICS:
 * When variant is 'reproduction' and status is 'REPRODUCED', HTTP 200 with testExitCode 1
 * is considered a complete SUCCESS, because reproducing the defect is the intended outcome.
 */
export async function runShadowbox(variant: ShadowboxVariant): Promise<ShadowboxRunResult> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/shadowbox/run`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ variant }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. Please ensure the backend server is running. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);

  // 1. HTTP 200 OK: Valid execution result (REPRODUCED or VERIFIED)
  if (response.ok) {
    return data as ShadowboxRunResult;
  }

  // 2. HTTP 422: Invalid variant or UNEXPECTED_RESULT
  if (response.status === 422) {
    const msg =
      data?.message ||
      (data?.status === 'UNEXPECTED_RESULT'
        ? 'Execution produced an unexpected test result.'
        : 'Invalid variant request.');
    throw new ShadowboxApiError(msg, 422, data?.errorCategory || 'UNEXPECTED_RESULT', data);
  }

  // 3. HTTP 503: Docker daemon or execution service unavailable
  if (response.status === 503) {
    const msg =
      data?.message ||
      data?.stderr ||
      'Shadowbox infrastructure unavailable: Docker daemon is not responding.';
    throw new ShadowboxApiError(msg, 503, data?.errorCategory || 'DOCKER_UNAVAILABLE', data);
  }

  // 4. HTTP 500 / other errors: Infrastructure failure
  const msg =
    data?.message ||
    data?.stderr ||
    `Shadowbox execution failed with HTTP ${response.status}.`;
  throw new ShadowboxApiError(msg, response.status, data?.errorCategory || 'INFRASTRUCTURE_ERROR', data);
}

/**
 * Creates an investigation session from user intake or verified demo request.
 * Calls POST /api/investigations.
 */
export async function createInvestigation(
  payload: UserIntakePayload
): Promise<InvestigationSession> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/investigations`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. Please ensure the backend is running. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);

  // HTTP 201 Created (or ok)
  if (response.status === 201 || response.ok) {
    return data as InvestigationSession;
  }

  // HTTP 400 Bad Request
  if (response.status === 400) {
    const msg = data?.message || 'Invalid investigation request parameters.';
    throw new ShadowboxApiError(msg, 400, data?.error || 'BAD_REQUEST', data);
  }

  // HTTP 422 Unprocessable Entity
  if (response.status === 422) {
    const msg = data?.message || 'Repository or branch could not be processed.';
    throw new ShadowboxApiError(msg, 422, data?.error || 'UNPROCESSABLE_ENTITY', data);
  }

  // HTTP 504 Gateway Timeout
  if (response.status === 504) {
    const msg = data?.message || 'Repository clone timed out after 30 seconds.';
    throw new ShadowboxApiError(msg, 504, data?.error || 'GATEWAY_TIMEOUT', data);
  }

  // Other errors
  const msg = data?.message || `Investigation creation failed with HTTP ${response.status}.`;
  throw new ShadowboxApiError(msg, response.status, data?.error || 'SERVER_ERROR', data);
}

/**
 * Retrieves an investigation session by ID.
 * Calls GET /api/investigations/:id.
 */
export async function getInvestigation(id: string): Promise<InvestigationSession> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/investigations/${encodeURIComponent(id)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. Please ensure the backend is running. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);

  if (response.ok) {
    return data as InvestigationSession;
  }

  if (response.status === 404) {
    const msg = data?.message || `Investigation session '${id}' was not found.`;
    throw new ShadowboxApiError(msg, 404, data?.error || 'NOT_FOUND', data);
  }

  const msg = data?.message || `Failed to fetch investigation session '${id}' (HTTP ${response.status}).`;
  throw new ShadowboxApiError(msg, response.status, data?.error || 'SERVER_ERROR', data);
}

/** Starts static analysis for an ingested investigation session. */
export async function analyzeInvestigation(id: string): Promise<InvestigationSession> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/investigations/${encodeURIComponent(id)}/analyze`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);
  if (response.ok) return data as InvestigationSession;

  throw new ShadowboxApiError(
    data?.message || `Investigation analysis failed with HTTP ${response.status}.`,
    response.status,
    data?.error || 'ANALYSIS_ERROR',
    data
  );
}

/**
 * Executes isolated Shadowbox reproduction for a user-supplied repository session.
 * Calls POST /api/investigations/:id/shadowbox with { variant: 'reproduction' }.
 */
export async function runDynamicShadowbox(sessionId: string): Promise<ShadowboxRunResult> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/investigations/${encodeURIComponent(sessionId)}/shadowbox`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ variant: 'reproduction' }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ShadowboxApiError(
      `Backend unavailable: Unable to connect to Shadowbox API at ${baseUrl}. (${message})`,
      0,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => null);

  if (response.ok) {
    return data as ShadowboxRunResult;
  }

  throw new ShadowboxApiError(
    data?.message || `Dynamic Shadowbox reproduction failed with HTTP ${response.status}.`,
    response.status,
    data?.error || 'SHADOWBOX_ERROR',
    data
  );
}


