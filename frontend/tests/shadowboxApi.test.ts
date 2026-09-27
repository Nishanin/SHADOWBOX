import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runShadowbox, getShadowboxStatus } from '../src/services/shadowboxApi.ts';
import { ShadowboxApiError } from '../src/types/shadowboxApi.ts';

describe('Shadowbox Frontend API Integration Tests', () => {
  const originalFetch = globalThis.fetch;
  let lastFetchCall: { url: string; options?: RequestInit } | null = null;

  beforeEach(() => {
    lastFetchCall = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // 1. reproduction request uses variant "reproduction"
  test('1. runShadowbox("reproduction") sends correct endpoint and body', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          variant: 'reproduction',
          sourceCommit: '23fd96e4c992316437b7aada02f12f915112de23',
          imageTag: 'shadowbox-reproduction:tag',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
          status: 'REPRODUCED',
          stdout: 'TAP output',
          stderr: '',
          duration: '2.5s',
          durationMs: 2500,
          errorCategory: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const result = await runShadowbox('reproduction');
    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/shadowbox/run');
    assert.equal(lastFetchCall?.options?.method, 'POST');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), {
      variant: 'reproduction',
    });
    assert.equal(result.variant, 'reproduction');
    assert.equal(result.status, 'REPRODUCED');
  });

  // 2. verification request uses variant "verification"
  test('2. runShadowbox("verification") sends correct endpoint and body', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          variant: 'verification',
          sourceCommit: '96b905b36325a2bb055f2eeba8fb0d1460dfc5c7',
          imageTag: 'shadowbox-verification:tag',
          totalTests: 7,
          passedTests: 7,
          failedTests: 0,
          testExitCode: 0,
          status: 'VERIFIED',
          stdout: 'TAP output',
          stderr: '',
          duration: '2.1s',
          durationMs: 2100,
          errorCategory: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const result = await runShadowbox('verification');
    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/shadowbox/run');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), {
      variant: 'verification',
    });
    assert.equal(result.variant, 'verification');
    assert.equal(result.status, 'VERIFIED');
  });

  // 3. REPRODUCED is treated as successful
  test('3. REPRODUCED status is resolved successfully on HTTP 200', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          variant: 'reproduction',
          status: 'REPRODUCED',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
        }),
        { status: 200 }
      );

    const result = await runShadowbox('reproduction');
    assert.equal(result.status, 'REPRODUCED');
  });

  // 4. testExitCode 1 + REPRODUCED is not an error
  test('4. testExitCode 1 with status REPRODUCED does not throw and is valid success', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          variant: 'reproduction',
          status: 'REPRODUCED',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
          duration: '2.8s',
        }),
        { status: 200 }
      );

    // Must resolve cleanly, not reject
    const result = await runShadowbox('reproduction');
    assert.equal(result.testExitCode, 1);
    assert.equal(result.status, 'REPRODUCED');
    assert.equal(result.totalTests, 5);
    assert.equal(result.failedTests, 3);
  });

  // 5. VERIFIED is rendered correctly (resolves cleanly)
  test('5. VERIFIED status with 7/7 passing and exitCode 0 is returned accurately', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          variant: 'verification',
          status: 'VERIFIED',
          totalTests: 7,
          passedTests: 7,
          failedTests: 0,
          testExitCode: 0,
          duration: '2.2s',
        }),
        { status: 200 }
      );

    const result = await runShadowbox('verification');
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.totalTests, 7);
    assert.equal(result.passedTests, 7);
    assert.equal(result.failedTests, 0);
    assert.equal(result.testExitCode, 0);
  });

  // 6. 422 is handled
  test('6. HTTP 422 throws ShadowboxApiError with statusCode 422', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'Unprocessable Entity',
          message: "Field 'variant' must be strictly one of: reproduction, verification",
        }),
        { status: 422 }
      );

    await assert.rejects(
      async () => {
        await runShadowbox('reproduction');
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /Field 'variant' must be strictly one of/);
        return true;
      }
    );
  });

  // 7. 500/503 is handled
  test('7. HTTP 500 / 503 throws ShadowboxApiError with infrastructure info', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'INFRASTRUCTURE_ERROR',
          errorCategory: 'DOCKER_DAEMON_UNAVAILABLE',
          stderr: 'Docker daemon is not running',
        }),
        { status: 503 }
      );

    await assert.rejects(
      async () => {
        await runShadowbox('reproduction');
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 503);
        assert.equal(err.errorCategory, 'DOCKER_DAEMON_UNAVAILABLE');
        return true;
      }
    );
  });

  // 8. network failure is handled cleanly
  test('8. Network failure throws user-friendly ShadowboxApiError without raw stack trace', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await runShadowbox('reproduction');
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 0);
        assert.equal(err.errorCategory, 'NETWORK_ERROR');
        assert.match(err.message, /Backend unavailable: Unable to connect to Shadowbox API/);
        return true;
      }
    );
  });

  // 9. duplicate execution is prevented while loading (logic test)
  test('9. Duplicate execution guard prevents concurrent execution', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(
        JSON.stringify({
          variant: 'reproduction',
          status: 'REPRODUCED',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
        }),
        { status: 200 }
      );
    };

    let isLoading = false;
    const guardedRun = async () => {
      if (isLoading) return null;
      isLoading = true;
      try {
        return await runShadowbox('reproduction');
      } finally {
        isLoading = false;
      }
    };

    // First call starts
    const p1 = guardedRun();
    // Second concurrent call while isLoading is true
    const p2 = guardedRun();

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.notEqual(r1, null);
    assert.equal(r2, null, 'Second concurrent call should be dropped by guard');
    assert.equal(callCount, 1, 'Only one HTTP call should have been made');
  });

  // 10. getShadowboxStatus test
  test('10. getShadowboxStatus fetches backend capabilities successfully', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          service: 'shadowbox',
          available: true,
          variants: ['reproduction', 'verification'],
          dockerAvailable: true,
        }),
        { status: 200 }
      );

    const status = await getShadowboxStatus();
    assert.equal(status.service, 'shadowbox');
    assert.equal(status.available, true);
    assert.deepEqual(status.variants, ['reproduction', 'verification']);
  });
});
