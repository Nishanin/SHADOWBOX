const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const shadowboxService = require('../../src/services/shadowbox.service');

describe('Shadowbox Backend API - Unit Tests', () => {
  const originalRunVariant = shadowboxService.runVariant;
  const originalCheckDocker = shadowboxService.checkDockerAvailability;

  afterEach(() => {
    shadowboxService.runVariant = originalRunVariant;
    shadowboxService.checkDockerAvailability = originalCheckDocker;
  });

  // 1. GET /api/health
  test('1. GET /api/health returns 200 with service info', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'shadowbox-backend');
  });

  // 2. GET /api/shadowbox/status
  test('2. GET /api/shadowbox/status returns backend status and capabilities', async () => {
    shadowboxService.checkDockerAvailability = async () => ({
      available: true,
      version: '29.8.0'
    });

    const res = await request(app).get('/api/shadowbox/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.service, 'shadowbox');
    assert.equal(res.body.available, true);
    assert.deepEqual(res.body.variants, ['reproduction', 'verification']);
    assert.equal(res.body.dockerAvailable, true);
  });

  // 3. POST /api/shadowbox/run with reproduction (Mocked)
  test('3. POST /api/shadowbox/run with reproduction returns 200 and REPRODUCED status', async () => {
    shadowboxService.runVariant = async (variant) => ({
      variant,
      sourceCommit: '23fd96e4c992316437b7aada02f12f915112de23',
      imageTag: 'shadowbox-reproduction:testtag',
      totalTests: 5,
      passedTests: 2,
      failedTests: 3,
      testExitCode: 1,
      status: 'REPRODUCED',
      stdout: 'TAP output...',
      stderr: '',
      duration: '2.5s',
      durationMs: 2500,
      errorCategory: null
    });

    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.variant, 'reproduction');
    assert.equal(res.body.status, 'REPRODUCED');
    assert.equal(res.body.totalTests, 5);
    assert.equal(res.body.passedTests, 2);
    assert.equal(res.body.failedTests, 3);
    assert.equal(res.body.testExitCode, 1);
  });

  // 4. POST /api/shadowbox/run with verification (Mocked)
  test('4. POST /api/shadowbox/run with verification returns 200 and VERIFIED status', async () => {
    shadowboxService.runVariant = async (variant) => ({
      variant,
      sourceCommit: '96b905b36325a2bb055f2eeba8fb0d1460dfc5c7',
      imageTag: 'shadowbox-verification:testtag',
      totalTests: 7,
      passedTests: 7,
      failedTests: 0,
      testExitCode: 0,
      status: 'VERIFIED',
      stdout: 'TAP output...',
      stderr: '',
      duration: '2.4s',
      durationMs: 2400,
      errorCategory: null
    });

    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'verification' });

    assert.equal(res.status, 200);
    assert.equal(res.body.variant, 'verification');
    assert.equal(res.body.status, 'VERIFIED');
    assert.equal(res.body.totalTests, 7);
    assert.equal(res.body.passedTests, 7);
    assert.equal(res.body.failedTests, 0);
    assert.equal(res.body.testExitCode, 0);
  });

  // 5. Invalid variant
  test('5. POST /api/shadowbox/run with invalid variant returns 422', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'invalid-custom-branch' });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'Unprocessable Entity');
    assert.match(res.body.message, /Field 'variant' must be strictly one of/);
  });

  // 6. Missing request body / missing variant
  test('6. POST /api/shadowbox/run with missing variant returns 422', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({});

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'Unprocessable Entity');
    assert.match(res.body.message, /Field 'variant' must be strictly one of/);
  });

  // 7. Malformed input (unexpected extra keys attempting injection)
  test('7. POST /api/shadowbox/run with unexpected injection fields returns 422', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({
        variant: 'reproduction',
        sourceCommit: 'arbitrary-commit',
        command: 'rm -rf /'
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'Unprocessable Entity');
    assert.match(res.body.message, /Unexpected field\(s\) in request body/);
  });

  test('7b. Malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/shadowbox/run')
      .set('Content-Type', 'application/json')
      .send('{ "variant": "reproduction", broken json');

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Malformed JSON');
  });

  // 8. Runner infrastructure error handling
  test('8. POST /api/shadowbox/run with infrastructure error returns 500 or 503', async () => {
    shadowboxService.runVariant = async (variant) => ({
      variant,
      sourceCommit: null,
      imageTag: null,
      totalTests: null,
      passedTests: null,
      failedTests: null,
      testExitCode: null,
      status: 'INFRASTRUCTURE_ERROR',
      stdout: '',
      stderr: 'Docker daemon is not running',
      duration: '0.1s',
      durationMs: 100,
      errorCategory: 'DOCKER_DAEMON_UNAVAILABLE'
    });

    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'INFRASTRUCTURE_ERROR');
    assert.equal(res.body.errorCategory, 'DOCKER_DAEMON_UNAVAILABLE');
  });

  // 9. Runner unexpected-result handling
  test('9. POST /api/shadowbox/run with UNEXPECTED_RESULT returns 422', async () => {
    shadowboxService.runVariant = async (variant) => ({
      variant,
      sourceCommit: '23fd96e4c992316437b7aada02f12f915112de23',
      imageTag: 'shadowbox-reproduction:testtag',
      totalTests: 4,
      passedTests: 4,
      failedTests: 0,
      testExitCode: 0,
      status: 'UNEXPECTED_RESULT',
      stdout: 'Unexpected test result',
      stderr: '',
      duration: '2.1s',
      durationMs: 2100,
      errorCategory: 'UNEXPECTED_TEST_METRICS'
    });

    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 422);
    assert.equal(res.body.status, 'UNEXPECTED_RESULT');
    assert.equal(res.body.errorCategory, 'UNEXPECTED_TEST_METRICS');
  });

  // 10. Timeout handling
  test('10. POST /api/shadowbox/run timeout returns 500 with TIMEOUT errorCategory', async () => {
    shadowboxService.runVariant = async (variant) => ({
      variant,
      sourceCommit: null,
      imageTag: null,
      totalTests: null,
      passedTests: null,
      failedTests: null,
      testExitCode: null,
      status: 'INFRASTRUCTURE_ERROR',
      stdout: '',
      stderr: 'Execution timed out after 60000ms.',
      duration: '60.00s',
      durationMs: 60000,
      errorCategory: 'TIMEOUT'
    });

    const res = await request(app)
      .post('/api/shadowbox/run')
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 500);
    assert.equal(res.body.status, 'INFRASTRUCTURE_ERROR');
    assert.equal(res.body.errorCategory, 'TIMEOUT');
  });
});
