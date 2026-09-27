import type {
  ShadowboxRunResult,
  ShadowboxServiceStatus,
  ShadowboxVariant,
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
