import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runShadowbox, getShadowboxStatus } from '../src/services/shadowboxApi.ts';

describe('REAL Backend Integration Tests (Live http://localhost:3001)', { timeout: 120000 }, () => {
  test('REAL Backend: Status endpoint responds with capabilities', async () => {
    const status = await getShadowboxStatus();
    assert.equal(status.service, 'shadowbox');
    assert.equal(status.available, true);
    assert.deepEqual(status.variants, ['reproduction', 'verification']);
    assert.equal(status.dockerAvailable, true);
  });

  test('REAL Backend: POST /api/shadowbox/run reproduction produces live REPRODUCED result', async () => {
    const result = await runShadowbox('reproduction');
    assert.equal(result.variant, 'reproduction');
    assert.equal(result.sourceCommit, '23fd96e4c992316437b7aada02f12f915112de23');
    assert.equal(result.status, 'REPRODUCED');
    assert.equal(result.totalTests, 5);
    assert.equal(result.passedTests, 2);
    assert.equal(result.failedTests, 3);
    assert.equal(result.testExitCode, 1);
    assert.equal(result.errorCategory, null);
    assert.ok(result.imageTag, 'Expected imageTag from container execution');
    assert.ok(result.stdout.includes('TAP version 13'), 'Expected live TAP stdout');
  });

  test('REAL Backend: POST /api/shadowbox/run verification produces live VERIFIED result', async () => {
    const result = await runShadowbox('verification');
    assert.equal(result.variant, 'verification');
    assert.equal(result.sourceCommit, '96b905b36325a2bb055f2eeba8fb0d1460dfc5c7');
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.totalTests, 7);
    assert.equal(result.passedTests, 7);
    assert.equal(result.failedTests, 0);
    assert.equal(result.testExitCode, 0);
    assert.equal(result.errorCategory, null);
    assert.ok(result.imageTag, 'Expected imageTag from container execution');
    assert.ok(result.stdout.includes('TAP version 13'), 'Expected live TAP stdout');
  });
});
