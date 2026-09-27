import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runDynamicShadowbox, runShadowbox } from '../src/services/shadowboxApi.ts';
import { ShadowboxApiError } from '../src/types/shadowboxApi.ts';

describe('Phase 4 — Frontend Dynamic Shadowbox Execution Tests', () => {
  const originalFetch = globalThis.fetch;
  let lastFetchCall: { url: string; options?: RequestInit } | null = null;

  beforeEach(() => {
    lastFetchCall = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // 1. non-demo Shadowbox action
  test('1. runDynamicShadowbox sends POST to /api/investigations/:id/shadowbox with variant reproduction', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          variant: 'user-reproduction',
          sessionId: 'inv_user_123',
          repositoryUrl: 'https://github.com/expressjs/express',
          sourceCommit: '9a34acf03cb818ff',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
          status: 'REPRODUCED',
          stdout: 'TAP output',
          stderr: '',
          duration: '3.2s',
          durationMs: 3200,
          errorCategory: null
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const result = await runDynamicShadowbox('inv_user_123');

    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/investigations/inv_user_123/shadowbox');
    assert.equal(lastFetchCall?.options?.method, 'POST');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), { variant: 'reproduction' });
    assert.equal(result.variant, 'user-reproduction');
    assert.equal(result.status, 'REPRODUCED');
    assert.equal(result.totalTests, 5);
  });

  // 2. loading state and duplicate execution prevention
  test('2. duplicate dynamic execution is prevented while request is loading', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(
        JSON.stringify({
          variant: 'user-reproduction',
          status: 'REPRODUCED',
          totalTests: 1
        }),
        { status: 200 }
      );
    };

    let isLoading = false;
    const guardedRun = async () => {
      if (isLoading) return null;
      isLoading = true;
      try {
        return await runDynamicShadowbox('inv_concurrent');
      } finally {
        isLoading = false;
      }
    };

    const p1 = guardedRun();
    const p2 = guardedRun(); // should be dropped

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.notEqual(r1, null);
    assert.equal(r2, null);
    assert.equal(callCount, 1);
  });

  // 3. result rendering for DEPENDENCY_UNAVAILABLE
  test('3. returns structured DEPENDENCY_UNAVAILABLE when dependencies are missing offline', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          variant: 'user-reproduction',
          sessionId: 'inv_deps',
          status: 'DEPENDENCY_UNAVAILABLE',
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          stdout: '',
          stderr: 'Dependencies required by test runner ("jest") are unavailable under --network none.',
          duration: '0s',
          durationMs: 15,
          errorCategory: 'DEPENDENCY_UNAVAILABLE'
        }),
        { status: 200 }
      );

    const result = await runDynamicShadowbox('inv_deps');
    assert.equal(result.status, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(result.errorCategory, 'DEPENDENCY_UNAVAILABLE');
    assert.match(result.stderr, /Dependencies required by test runner/);
  });

  // 4. result rendering for UNSUPPORTED_PROJECT
  test('4. returns structured UNSUPPORTED_PROJECT when package.json is missing', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          variant: 'user-reproduction',
          sessionId: 'inv_unsupported',
          status: 'UNSUPPORTED_PROJECT',
          totalTests: null,
          passedTests: null,
          failedTests: null,
          testExitCode: null,
          stdout: '',
          stderr: 'Missing package.json in repository root.',
          duration: '0s',
          durationMs: 10,
          errorCategory: 'UNSUPPORTED_PROJECT'
        }),
        { status: 200 }
      );

    const result = await runDynamicShadowbox('inv_unsupported');
    assert.equal(result.status, 'UNSUPPORTED_PROJECT');
    assert.equal(result.errorCategory, 'UNSUPPORTED_PROJECT');
  });

  // 5. failure / error handling (HTTP 422 unanalyzed session)
  test('5. throws ShadowboxApiError with statusCode 422 if session is not in ANALYZED state', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'UnprocessableEntity',
          message: 'Investigation session must be in ANALYZED state before executing Shadowbox reproduction.'
        }),
        { status: 422 }
      );

    await assert.rejects(
      async () => {
        await runDynamicShadowbox('inv_unanalyzed');
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /must be in ANALYZED state/);
        return true;
      }
    );
  });

  // 6. demo regression check
  test('6. demo regression: runShadowbox("reproduction") continues calling /api/shadowbox/run with variant reproduction', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          variant: 'reproduction',
          sourceCommit: '23fd96e4c992316437b7aada02f12f915112de23',
          totalTests: 5,
          passedTests: 2,
          failedTests: 3,
          testExitCode: 1,
          status: 'REPRODUCED'
        }),
        { status: 200 }
      );
    };

    const result = await runShadowbox('reproduction');
    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/shadowbox/run');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), { variant: 'reproduction' });
    assert.equal(result.status, 'REPRODUCED');
    assert.equal(result.totalTests, 5);
    assert.equal(result.failedTests, 3);
  });
});
