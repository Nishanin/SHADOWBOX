const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

describe('Shadowbox Backend API - Real Integration Tests', { timeout: 120000 }, () => {
  test('REAL Integration: POST /api/shadowbox/run reproduction', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.variant, 'reproduction');
    assert.equal(res.body.sourceCommit, '23fd96e4c992316437b7aada02f12f915112de23');
    assert.equal(res.body.status, 'REPRODUCED');
    assert.equal(res.body.totalTests, 5);
    assert.equal(res.body.passedTests, 2);
    assert.equal(res.body.failedTests, 3);
    assert.equal(res.body.testExitCode, 1);
    assert.equal(res.body.errorCategory, null);
    assert.ok(res.body.imageTag, 'Expected imageTag to be present');
    assert.ok(res.body.stdout.includes('TAP version 13'), 'Expected TAP output in stdout');
  });

  test('REAL Integration: POST /api/shadowbox/run verification', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'verification' });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.variant, 'verification');
    assert.equal(res.body.sourceCommit, '96b905b36325a2bb055f2eeba8fb0d1460dfc5c7');
    assert.equal(res.body.status, 'VERIFIED');
    assert.equal(res.body.totalTests, 7);
    assert.equal(res.body.passedTests, 7);
    assert.equal(res.body.failedTests, 0);
    assert.equal(res.body.testExitCode, 0);
    assert.equal(res.body.errorCategory, null);
    assert.ok(res.body.imageTag, 'Expected imageTag to be present');
    assert.ok(res.body.stdout.includes('TAP version 13'), 'Expected TAP output in stdout');
  });
});
