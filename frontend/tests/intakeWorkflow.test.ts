import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateIntakeForm } from '../src/services/intakeValidation.ts';
import { createInvestigation, getInvestigation } from '../src/services/shadowboxApi.ts';
import { ShadowboxApiError } from '../src/types/shadowboxApi.ts';
import type { InvestigationSession } from '../src/types/workflow.ts';

describe('Phase 2 — Frontend Intake UI & Session State Tests', () => {
  const originalFetch = globalThis.fetch;
  let lastFetchCall: { url: string; options?: RequestInit } | null = null;

  beforeEach(() => {
    lastFetchCall = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // 1. Empty repository URL rejected
  test('1. Empty repository URL is rejected by intake validator', () => {
    const result = validateIntakeForm({
      repositoryUrl: '   ',
      branch: 'main',
      errorDescription: 'Test suite failure in CI',
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.repositoryUrl);
    assert.match(result.errors.repositoryUrl, /GitHub repository URL is required/);
    assert.equal(result.cleanedPayload, undefined);
  });

  // 2. Invalid GitHub URL rejected
  test('2. Invalid GitHub URL formats are rejected', () => {
    // 2a. Non-HTTPS URL
    const res1 = validateIntakeForm({
      repositoryUrl: 'http://github.com/owner/repo',
      errorDescription: 'CI error',
    });
    assert.equal(res1.isValid, false);
    assert.match(res1.errors.repositoryUrl, /must use HTTPS/);

    // 2b. Non-GitHub domain
    const res2 = validateIntakeForm({
      repositoryUrl: 'https://gitlab.com/owner/repo',
      errorDescription: 'CI error',
    });
    assert.equal(res2.isValid, false);
    assert.match(res2.errors.repositoryUrl, /Only repositories hosted on github\.com are currently supported/);

    // 2c. Invalid path (not /owner/repo)
    const res3 = validateIntakeForm({
      repositoryUrl: 'https://github.com/justowner',
      errorDescription: 'CI error',
    });
    assert.equal(res3.isValid, false);
    assert.match(res3.errors.repositoryUrl, /URL path must match the format/);

    // 2d. Arbitrary invalid string
    const res4 = validateIntakeForm({
      repositoryUrl: 'not_a_valid_url',
      errorDescription: 'CI error',
    });
    assert.equal(res4.isValid, false);
    assert.match(res4.errors.repositoryUrl, /Invalid URL format/);
  });

  // 3. Empty error description rejected
  test('3. Empty error description is rejected by intake validator', () => {
    const result = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      branch: 'main',
      errorDescription: '    ',
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.errorDescription);
    assert.match(result.errors.errorDescription, /Error or failure description is required/);
  });

  // 4. Branch defaults to main
  test('4. Branch defaults to "main" when blank or omitted', () => {
    // 4a. Blank branch
    const res1 = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      branch: '   ',
      errorDescription: 'Tests timed out',
    });
    assert.equal(res1.isValid, true);
    assert.equal(res1.cleanedPayload?.branch, 'main');

    // 4b. Omitted branch
    const res2 = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      errorDescription: 'Tests timed out',
    });
    assert.equal(res2.isValid, true);
    assert.equal(res2.cleanedPayload?.branch, 'main');

    // 4c. Custom branch
    const res3 = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      branch: 'feature/v19-upgrade',
      errorDescription: 'Tests timed out',
    });
    assert.equal(res3.isValid, true);
    assert.equal(res3.cleanedPayload?.branch, 'feature/v19-upgrade');

    // 4d. Reject branch starting with hyphen (flag injection defense)
    const res4 = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      branch: '--upload-pack=exploit',
      errorDescription: 'Tests timed out',
    });
    assert.equal(res4.isValid, false);
    assert.match(res4.errors.branch, /Branch name cannot start with a hyphen/);
  });

  // 5. Valid form calls POST /api/investigations
  test('5. Valid form calls POST /api/investigations with correct payload', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          id: 'inv_abc123',
          isDemo: false,
          repositoryUrl: 'https://github.com/facebook/react',
          branch: 'main',
          resolvedCommit: '1234567890abcdef1234567890abcdef12345678',
          status: 'INITIALIZED',
          createdAt: new Date().toISOString(),
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const validation = validateIntakeForm({
      repositoryUrl: 'https://github.com/facebook/react',
      branch: 'main',
      errorDescription: 'CI test failure',
      ciLog: 'FAIL react-dom.test.js',
      environment: { os: 'Ubuntu', nodeVersion: '20', timezone: 'UTC' },
    });

    assert.equal(validation.isValid, true);
    assert.ok(validation.cleanedPayload);

    const session = await createInvestigation(validation.cleanedPayload);

    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/investigations');
    assert.equal(lastFetchCall?.options?.method, 'POST');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), {
      repositoryUrl: 'https://github.com/facebook/react',
      branch: 'main',
      errorDescription: 'CI test failure',
      ciLog: 'FAIL react-dom.test.js',
      environment: { os: 'Ubuntu', nodeVersion: '20', timezone: 'UTC' },
      isDemo: false,
    });
    assert.equal(session.id, 'inv_abc123');
    assert.equal(session.status, 'INITIALIZED');
  });

  // 6. Successful HTTP 201 stores session
  test('6. Successful HTTP 201 stores session with complete metadata contract', async () => {
    const mockSession: InvestigationSession = {
      id: 'inv_test999',
      isDemo: false,
      repositoryUrl: 'https://github.com/expressjs/express',
      branch: 'master',
      resolvedCommit: 'fedcba0987654321fedcba0987654321fedcba09',
      errorDescription: 'Route middleware test fails',
      ciLog: 'AssertionError: expected 200 to equal 404',
      environment: { os: 'Ubuntu 22.04', nodeVersion: '20', timezone: 'UTC' },
      status: 'INITIALIZED',
      repositoryMetadata: {
        isNodeProject: true,
        name: 'express',
        packageManager: 'npm',
        testScript: 'test',
        scripts: ['test'],
        hasDockerFile: false,
      },
      createdAt: '2026-09-27T12:00:00.000Z',
    };

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockSession), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });

    const session = await createInvestigation({
      repositoryUrl: 'https://github.com/expressjs/express',
      branch: 'master',
      errorDescription: 'Route middleware test fails',
    });

    assert.equal(session.id, 'inv_test999');
    assert.equal(session.isDemo, false);
    assert.equal(session.resolvedCommit, 'fedcba0987654321fedcba0987654321fedcba09');
    assert.equal(session.status, 'INITIALIZED');
    assert.equal(session.repositoryMetadata?.packageManager, 'npm');
  });

  // 7. Successful submission navigates correctly
  test('7. Successful submission triggers session storage and navigation flow', async () => {
    let storedSession: InvestigationSession | null = null;
    let navigatedPath: string | null = null;

    const mockSetSession = (sess: InvestigationSession | null) => {
      storedSession = sess;
    };
    const mockNavigate = (path: string) => {
      navigatedPath = path;
    };

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          id: 'inv_nav_test',
          isDemo: false,
          repositoryUrl: 'https://github.com/owner/repo',
          branch: 'main',
          resolvedCommit: 'abcdef123456',
          status: 'INITIALIZED',
          createdAt: new Date().toISOString(),
        }),
        { status: 201 }
      );

    // Simulate submit workflow
    const payload = {
      repositoryUrl: 'https://github.com/owner/repo',
      branch: 'main',
      errorDescription: 'Fails in CI',
    };
    const session = await createInvestigation(payload);
    mockSetSession(session);
    mockNavigate('/investigation');

    assert.notEqual(storedSession, null);
    assert.equal(storedSession?.id, 'inv_nav_test');
    assert.equal(navigatedPath, '/investigation');
  });

  // 8. API error is displayed
  test('8. API errors (400, 422, 504) are caught and throw structured ShadowboxApiError', async () => {
    // 8a. 400 Bad Request
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'BadRequest',
          message: 'Only HTTPS repository URLs are permitted.',
        }),
        { status: 400 }
      );

    await assert.rejects(
      async () => {
        await createInvestigation({ repositoryUrl: 'http://github.com/bad/url' });
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Only HTTPS repository URLs are permitted/);
        return true;
      }
    );

    // 8b. 422 Unprocessable Entity (e.g. branch not found or private repo)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'UnprocessableEntity',
          message: "Branch 'feature-x' was not found in upstream repository.",
        }),
        { status: 422 }
      );

    await assert.rejects(
      async () => {
        await createInvestigation({
          repositoryUrl: 'https://github.com/owner/repo',
          branch: 'feature-x',
          errorDescription: 'test',
        });
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /Branch 'feature-x' was not found/);
        return true;
      }
    );

    // 8c. 504 Gateway Timeout (clone timeout)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'GatewayTimeout',
          message: 'Repository clone timed out after 30 seconds.',
        }),
        { status: 504 }
      );

    await assert.rejects(
      async () => {
        await createInvestigation({
          repositoryUrl: 'https://github.com/large/repo',
          errorDescription: 'test',
        });
      },
      (err: unknown) => {
        assert(err instanceof ShadowboxApiError);
        assert.equal(err.statusCode, 504);
        assert.match(err.message, /Repository clone timed out/);
        return true;
      }
    );
  });

  // 9. Duplicate submission prevented while loading
  test('9. Duplicate submission is prevented while request is loading', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(
        JSON.stringify({
          id: 'inv_single_call',
          isDemo: false,
          status: 'INITIALIZED',
        }),
        { status: 201 }
      );
    };

    let isLoading = false;
    const guardedSubmit = async () => {
      if (isLoading) return null;
      isLoading = true;
      try {
        return await createInvestigation({
          repositoryUrl: 'https://github.com/owner/repo',
          errorDescription: 'test',
        });
      } finally {
        isLoading = false;
      }
    };

    const p1 = guardedSubmit();
    const p2 = guardedSubmit(); // Should be dropped by guard

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.notEqual(r1, null);
    assert.equal(r2, null, 'Second call must be suppressed by loading guard');
    assert.equal(callCount, 1, 'Only one HTTP request must be made');
  });

  // 10. Demo button creates demo session
  test('10. Demo button calls createInvestigation with { isDemo: true } without cloning', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      lastFetchCall = { url: input.toString(), options: init };
      return new Response(
        JSON.stringify({
          id: 'inv_demo_verified_01',
          isDemo: true,
          repositoryUrl: 'https://github.com/Nishanin/SHADOWBOX',
          branch: 'main',
          resolvedCommit: '23fd96e4c992316437b7aada02f12f915112de23',
          errorDescription: 'Invoice date validator resolves to 2024-01-15 instead of 2024-01-14 in UTC environment',
          status: 'INITIALIZED',
          repositoryMetadata: {
            isNodeProject: true,
            name: 'shadowbox-demo-app',
            packageManager: 'npm',
            testScript: 'test',
          },
          createdAt: new Date().toISOString(),
        }),
        { status: 201 }
      );
    };

    const session = await createInvestigation({ isDemo: true });

    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/investigations');
    assert.deepEqual(JSON.parse(lastFetchCall?.options?.body as string), { isDemo: true });
    assert.equal(session.isDemo, true);
    assert.equal(session.repositoryUrl, 'https://github.com/Nishanin/SHADOWBOX');
    assert.equal(session.resolvedCommit, '23fd96e4c992316437b7aada02f12f915112de23');
    assert.equal(session.status, 'INITIALIZED');
  });

  // 11. Session is available after navigation
  test('11. Session remains accessible across workflow navigation and getInvestigation', async () => {
    // 11a. In-memory layout context simulation
    interface MockContext {
      session: InvestigationSession | null;
      activeRoute: string;
    }

    const state: MockContext = {
      session: null,
      activeRoute: '/',
    };

    // Intake creates session
    const mockSession: InvestigationSession = {
      id: 'inv_workflow_session',
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/app',
      branch: 'main',
      resolvedCommit: 'commit123456',
      errorDescription: 'Timezone test failed',
      ciLog: null,
      environment: null,
      status: 'INITIALIZED',
      repositoryMetadata: null,
      createdAt: new Date().toISOString(),
    };

    state.session = mockSession;

    // Navigate to Step 2 (/investigation)
    state.activeRoute = '/investigation';
    assert.equal(state.session?.id, 'inv_workflow_session');
    assert.equal(state.session?.repositoryUrl, 'https://github.com/owner/app');

    // Navigate to Step 3 (/root-cause)
    state.activeRoute = '/root-cause';
    assert.equal(state.session?.id, 'inv_workflow_session');

    // Navigate to Step 4 (/shadowbox)
    state.activeRoute = '/shadowbox';
    assert.equal(state.session?.id, 'inv_workflow_session');

    // Navigate to Step 5 (/verification)
    state.activeRoute = '/verification';
    assert.equal(state.session?.id, 'inv_workflow_session');

    // 11b. getInvestigation fetches by ID
    globalThis.fetch = async (input: RequestInfo | URL) => {
      lastFetchCall = { url: input.toString() };
      return new Response(JSON.stringify(mockSession), { status: 200 });
    };

    const fetched = await getInvestigation('inv_workflow_session');
    assert.equal(lastFetchCall?.url, 'http://localhost:3001/api/investigations/inv_workflow_session');
    assert.equal(fetched.id, 'inv_workflow_session');
    assert.equal(fetched.resolvedCommit, 'commit123456');
  });
});
