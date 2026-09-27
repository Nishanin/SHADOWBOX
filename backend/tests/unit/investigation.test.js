const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../src/app');
const sessionService = require('../../src/services/session.service');
const ingestionService = require('../../src/services/ingestion.service');

describe('Shadowbox Investigation & Ingestion Service - Unit Tests', () => {
  // Helper to install mock git execution
  function setupGitMock({
    cloneTimeout = false,
    cloneFails = false,
    cloneStderr = '',
    isNonNode = false,
    commitSha = 'c0ffee1234567890123456789012345678901234'
  } = {}) {
    ingestionService._setExecFile((cmd, args, options, callback) => {
      if (cmd !== 'git') {
        return callback(new Error(`Unexpected command: ${cmd}`));
      }

      const subCmd = args[0] === '-C' ? args[2] : args[0];

      if (subCmd === 'clone') {
        if (cloneTimeout) {
          const err = new Error('Command timed out');
          err.killed = true;
          err.signal = 'SIGTERM';
          return callback(err);
        }
        if (cloneFails) {
          const err = new Error('git clone error');
          const stderr = cloneStderr || 'fatal: repository not found';
          err.stderr = stderr;
          return callback(err, '', stderr);
        }

        // Simulate successful clone into destination directory
        const destDir = args[args.length - 1];
        fs.mkdirSync(destDir, { recursive: true });

        if (!isNonNode) {
          fs.writeFileSync(
            path.join(destDir, 'package.json'),
            JSON.stringify({
              name: 'sample-project',
              version: '1.2.0',
              scripts: {
                test: 'node --test',
                build: 'echo build'
              }
            })
          );
          fs.writeFileSync(path.join(destDir, 'package-lock.json'), '{}');
        } else {
          // Non-Node project
          fs.writeFileSync(path.join(destDir, 'main.py'), 'print("Hello Python")');
        }

        return callback(null, 'Cloning into destination...\n', '');
      }

      if (subCmd === 'rev-parse') {
        return callback(null, `${commitSha}\n`, '');
      }

      if (subCmd === 'archive') {
        const outArg = args.find((a) => a.startsWith('--output='));
        if (outArg) {
          const outPath = outArg.replace('--output=', '');
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, 'fake-tar-archive-bytes');
        }
        return callback(null, '', '');
      }

      return callback(null, '', '');
    });
  }

  beforeEach(() => {
    sessionService.clearSessions();
    setupGitMock();
  });

  afterEach(() => {
    ingestionService._resetExecFile();
    sessionService.clearSessions();
  });

  // 1. Valid GitHub HTTPS URL
  test('1. Valid GitHub HTTPS URL successfully creates and initializes session', async () => {
    const payload = {
      repositoryUrl: 'https://github.com/facebook/react',
      branch: 'main',
      errorDescription: 'Jest test suite failed in CI with timeout error',
      ciLog: 'Error: Timeout of 5000ms exceeded',
      environment: {
        os: 'ubuntu-22.04',
        nodeVersion: '20',
        timezone: 'UTC'
      }
    };

    const res = await request(app).post('/api/investigations').send(payload);

    assert.equal(res.status, 201);
    assert.match(res.body.id, /^inv_[0-9a-f]+$/);
    assert.equal(res.body.isDemo, false);
    assert.equal(res.body.repositoryUrl, 'https://github.com/facebook/react');
    assert.equal(res.body.branch, 'main');
    assert.equal(res.body.resolvedCommit, 'c0ffee1234567890123456789012345678901234');
    assert.equal(res.body.status, 'INITIALIZED');
    assert.equal(res.body.errorDescription, payload.errorDescription);
    assert.equal(res.body.ciLog, payload.ciLog);
    assert.deepEqual(res.body.environment, payload.environment);
    assert.ok(res.body.createdAt);
    assert.ok(res.body.repositoryMetadata);
    assert.equal(res.body.repositoryMetadata.isNodeProject, true);
    assert.equal(res.body.repositoryMetadata.packageManager, 'npm');
    assert.equal(res.body.repositoryMetadata.testScript, 'test');

    // Security check: no temporary server file paths exposed
    assert.equal(res.body.archivePath, undefined);
    assert.equal(res.body.ingestDir, undefined);
  });

  // 2. Invalid URL
  test('2. Invalid URL format is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'not_a_valid_url',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Invalid URL format/);
  });

  // 3. Non-GitHub URL
  test('3. Non-GitHub URL is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://gitlab.com/owner/repository',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Only repositories hosted on github\.com are currently supported/);
  });

  // 4. HTTP URL
  test('4. Insecure HTTP URL is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'http://github.com/owner/repository',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Only HTTPS repository URLs are permitted/);
  });

  // 5. URL containing credentials
  test('5. URL containing credentials is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://username:token@github.com/owner/repository',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Repository URLs containing credentials are not permitted/);
  });

  // 6. localhost URL
  test('6. Localhost URL is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://localhost/owner/repository',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Only repositories hosted on github\.com are currently supported/);
  });

  // 7. IP address
  test('7. IP address URL is rejected with 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://192.168.1.100/owner/repository',
      branch: 'main',
      errorDescription: 'Any failure'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Only repositories hosted on github\.com are currently supported/);
  });

  // 8. Invalid branch
  test('8. Invalid branch name or branch starting with hyphen is rejected with 400', async () => {
    // 8a. Flag injection attempt
    const res1 = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/owner/repository',
      branch: '--upload-pack=exploit',
      errorDescription: 'Any failure'
    });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.error, 'BadRequest');
    assert.match(res1.body.message, /Branch name cannot start with a hyphen/);

    // 8b. Traversal attempt
    const res2 = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/owner/repository',
      branch: 'main..other',
      errorDescription: 'Any failure'
    });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.error, 'BadRequest');
    assert.match(res2.body.message, /Invalid branch name format/);
  });

  // 9. Missing repositoryUrl
  test('9. Missing repositoryUrl when isDemo is false returns 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      branch: 'main',
      errorDescription: 'Tests failed'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Field 'repositoryUrl' is required/);
  });

  // 10. Missing errorDescription
  test('10. Missing errorDescription when isDemo is false returns 400', async () => {
    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/owner/repository',
      branch: 'main'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'BadRequest');
    assert.match(res.body.message, /Field 'errorDescription' is required/);
  });

  // 11. Demo mode
  test('11. Demo mode ({ isDemo: true }) returns 201 with verified demo session without cloning', async () => {
    const res = await request(app).post('/api/investigations').send({
      isDemo: true
    });

    assert.equal(res.status, 201);
    assert.match(res.body.id, /^inv_[0-9a-f]+$/);
    assert.equal(res.body.isDemo, true);
    assert.equal(res.body.repositoryUrl, 'https://github.com/Nishanin/SHADOWBOX');
    assert.equal(res.body.branch, 'main');
    assert.equal(res.body.resolvedCommit, '23fd96e4c992316437b7aada02f12f915112de23');
    assert.equal(res.body.status, 'INITIALIZED');
    assert.match(res.body.errorDescription, /Invoice date validator resolves to 2024-01-15/);
    assert.equal(res.body.repositoryMetadata.isNodeProject, true);
    assert.equal(res.body.repositoryMetadata.name, 'shadowbox-demo-app');
    assert.equal(res.body.archivePath, undefined);
  });

  // 12. Successful session retrieval
  test('12. Successful session retrieval via GET /api/investigations/:id returns 200', async () => {
    // Create demo session first
    const postRes = await request(app).post('/api/investigations').send({ isDemo: true });
    assert.equal(postRes.status, 201);
    const sessionId = postRes.body.id;

    // Retrieve by ID
    const getRes = await request(app).get(`/api/investigations/${sessionId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.id, sessionId);
    assert.equal(getRes.body.isDemo, true);
    assert.equal(getRes.body.status, 'INITIALIZED');
    assert.equal(getRes.body.archivePath, undefined);
  });

  // 13. Unknown session
  test('13. Unknown session ID returns 404 NotFound', async () => {
    const res = await request(app).get('/api/investigations/inv_nonexistent_99999');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'NotFound');
    assert.match(res.body.message, /Investigation session '.*' was not found/);
  });

  // 14. Unsupported/non-Node repository handling
  test('14. Unsupported/non-Node repository is ingested with isNodeProject=false', async () => {
    setupGitMock({ isNonNode: true });

    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/psf/requests',
      branch: 'main',
      errorDescription: 'Python requests failure in CI'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'INITIALIZED');
    assert.ok(res.body.repositoryMetadata);
    assert.equal(res.body.repositoryMetadata.isNodeProject, false);
    assert.equal(res.body.repositoryMetadata.packageManager, null);
    assert.equal(res.body.repositoryMetadata.testScript, null);
    assert.deepEqual(res.body.repositoryMetadata.scripts, []);
  });

  // 15. Clone failure/timeout handling
  test('15a. Clone timeout triggers 504 GatewayTimeout', async () => {
    setupGitMock({ cloneTimeout: true });

    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/large/repo',
      branch: 'main',
      errorDescription: 'Clone hangs'
    });

    assert.equal(res.status, 504);
    assert.equal(res.body.error, 'GatewayTimeout');
    assert.match(res.body.message, /Repository clone timed out after 30 seconds/);
  });

  test('15b. Clone failure (private or not found) triggers 422 UnprocessableEntity', async () => {
    setupGitMock({
      cloneFails: true,
      cloneStderr: 'fatal: Authentication failed for https://github.com/private/repo.git'
    });

    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/private/repo',
      branch: 'main',
      errorDescription: 'Private repository test'
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'UnprocessableEntity');
    assert.match(res.body.message, /Private repositories or repositories requiring authentication are not supported/);
  });

  test('15c. Branch not found in upstream repository triggers 422 UnprocessableEntity', async () => {
    setupGitMock({
      cloneFails: true,
      cloneStderr: 'fatal: Remote branch non-existent-branch not found in upstream origin'
    });

    const res = await request(app).post('/api/investigations').send({
      repositoryUrl: 'https://github.com/owner/repo',
      branch: 'non-existent-branch',
      errorDescription: 'Missing branch test'
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'UnprocessableEntity');
    assert.match(res.body.message, /Branch 'non-existent-branch' was not found in upstream repository/);
  });
});
