const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const app = require('../../src/app');
const sessionService = require('../../src/services/session.service');
const dynamicShadowboxService = require('../../src/services/dynamicShadowbox.service');

describe('Dynamic Shadowbox Execution Backend Tests', () => {
  let tempDir;
  let mockArchivePath;

  beforeEach(() => {
    sessionService.clearSessions();
    tempDir = path.join(os.tmpdir(), `test-shadowbox-runs-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create a dummy tar archive
    mockArchivePath = path.join(tempDir, 'repo.tar');
    fs.writeFileSync(mockArchivePath, 'dummy-tar-bytes');
  });

  afterEach(() => {
    sessionService.clearSessions();
    dynamicShadowboxService._resetExecFile();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  });

  // 1. non-demo session requires ANALYZED
  test('1. non-demo session requires ANALYZED status before reproduction', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'INITIALIZED' // Not yet ANALYZED
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /must be in ANALYZED state/);
  });

  // 2. missing archive rejected
  test('2. missing archive is rejected with INFRASTRUCTURE_ERROR', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: path.join(tempDir, 'missing-archive.tar')
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'INFRASTRUCTURE_ERROR');
    assert.equal(res.body.errorCategory, 'MISSING_ARCHIVE');
  });

  // 3. missing package.json
  test('3. missing package.json results in UNSUPPORTED_PROJECT', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    // Mock unpackArchive to create an empty directory without package.json
    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      // Mock tar unpack: creates no package.json
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UNSUPPORTED_PROJECT');
    assert.match(res.body.stderr, /Missing package\.json/);
  });

  // 4. unsupported project type (malformed package.json)
  test('4. malformed package.json results in UNSUPPORTED_PROJECT', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    // Mock tar unpack to write malformed package.json
    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        fs.writeFileSync(path.join(dest, 'package.json'), '{ broken json syntax');
      }
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UNSUPPORTED_PROJECT');
    assert.equal(res.body.errorCategory, 'MALFORMED_PACKAGE_JSON');
  });

  // 5. unsupported test command
  test('5. unsupported test command (e.g. pytest, cargo) results in UNSUPPORTED_TEST_COMMAND', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        fs.writeFileSync(
          path.join(dest, 'package.json'),
          JSON.stringify({ name: 'test-app', scripts: { test: 'pytest' } })
        );
      }
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UNSUPPORTED_TEST_COMMAND');
    assert.match(res.body.stderr, /Allowed test runners/);
  });

  // 6. safe command selection
  test('6. safe command selection parses node --test and arguments accurately', () => {
    const pkg = {
      scripts: {
        test: 'node --test tests/**/*.test.js'
      }
    };
    const decision = dynamicShadowboxService.determineSafeTestCommand(pkg);
    assert.equal(decision.isSafe, true);
    assert.equal(decision.runner, 'node-test');
    assert.deepEqual(decision.args, ['node', '--test', 'tests/**/*.test.js']);
  });

  // 7. reproduction result persistence
  test('7. reproduction result is persisted in the session state', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        fs.writeFileSync(
          path.join(dest, 'package.json'),
          JSON.stringify({ name: 'test-app', scripts: { test: 'node --test' } })
        );
        return callback(null, '', '');
      }
      if (cmd === 'docker' && args[0] === 'build') {
        return callback(null, 'Successfully built\n', '');
      }
      if (cmd === 'docker' && args[0] === 'run') {
        const mockTap = `
TAP version 13
# tests 5
# pass 2
# fail 3
Test exit code: 1`;
        const err = new Error('Test failed');
        err.code = 1;
        return callback(err, mockTap, '');
      }
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'REPRODUCED');
    assert.equal(res.body.totalTests, 5);
    assert.equal(res.body.passedTests, 2);
    assert.equal(res.body.failedTests, 3);
    assert.equal(res.body.testExitCode, 1);

    // Verify stored in session
    const stored = sessionService.getSession(session.id);
    assert.equal(stored.status, 'REPRODUCED');
    assert.ok(stored.reproductionResult);
    assert.equal(stored.reproductionResult.status, 'REPRODUCED');
  });

  // 8. timeout handling
  test('8. container execution timeout results in status TIMEOUT', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        fs.writeFileSync(
          path.join(dest, 'package.json'),
          JSON.stringify({ name: 'test-app', scripts: { test: 'node --test' } })
        );
        return callback(null, '', '');
      }
      if (cmd === 'docker' && args[0] === 'build') {
        return callback(null, '', '');
      }
      if (cmd === 'docker' && args[0] === 'run') {
        const err = new Error('Execution timed out');
        err.killed = true;
        err.signal = 'SIGTERM';
        return callback(err, '', 'Timed out');
      }
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'TIMEOUT');
    assert.equal(res.body.errorCategory, 'TIMEOUT');
  });

  // 9. dependency unavailable handling
  test('9. missing offline dependencies results in DEPENDENCY_UNAVAILABLE without network installation', async () => {
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        // Jest required but no node_modules in archive
        fs.writeFileSync(
          path.join(dest, 'package.json'),
          JSON.stringify({
            name: 'test-app',
            devDependencies: { jest: '^29.0.0' },
            scripts: { test: 'jest' }
          })
        );
        return callback(null, '', '');
      }
      return callback(null, '', '');
    });

    const res = await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'DEPENDENCY_UNAVAILABLE');
    assert.match(res.body.stderr, /strict network isolation/);
  });

  // 10. Docker command construction
  test('10. Docker command uses --network none, resource limits, and TZ=UTC', async () => {
    let capturedDockerRunArgs = [];

    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: 'https://github.com/owner/repo',
      status: 'ANALYZED',
      archivePath: mockArchivePath
    });

    dynamicShadowboxService._setExecFile((cmd, args, options, callback) => {
      if (cmd === 'tar') {
        const dest = args[args.indexOf('-C') + 1];
        fs.writeFileSync(
          path.join(dest, 'package.json'),
          JSON.stringify({ name: 'test-app', scripts: { test: 'node --test' } })
        );
        return callback(null, '', '');
      }
      if (cmd === 'docker' && args[0] === 'build') {
        return callback(null, '', '');
      }
      if (cmd === 'docker' && args[0] === 'run') {
        capturedDockerRunArgs = args;
        return callback(null, '# tests 1\n# pass 1\n', '');
      }
      return callback(null, '', '');
    });

    await request(app)
      .post(`/api/investigations/${session.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.ok(capturedDockerRunArgs.includes('--network'));
    assert.equal(capturedDockerRunArgs[capturedDockerRunArgs.indexOf('--network') + 1], 'none');
    assert.ok(capturedDockerRunArgs.includes('--memory'));
    assert.equal(capturedDockerRunArgs[capturedDockerRunArgs.indexOf('--memory') + 1], '512m');
    assert.ok(capturedDockerRunArgs.includes('--cpus'));
    assert.equal(capturedDockerRunArgs[capturedDockerRunArgs.indexOf('--cpus') + 1], '1.0');
    assert.ok(capturedDockerRunArgs.includes('TZ=UTC'));
  });

  // 11. user input cannot inject shell arguments
  test('11. user script with shell operators is rejected with UNSUPPORTED_TEST_COMMAND', () => {
    const pkg1 = { scripts: { test: 'node --test; rm -rf /' } };
    const decision1 = dynamicShadowboxService.determineSafeTestCommand(pkg1);
    assert.equal(decision1.isSafe, false);
    assert.match(decision1.reason, /shell redirection or chaining operators/);

    const pkg2 = { scripts: { test: 'node --test && echo hacked' } };
    const decision2 = dynamicShadowboxService.determineSafeTestCommand(pkg2);
    assert.equal(decision2.isSafe, false);
    assert.match(decision2.reason, /shell redirection or chaining operators/);
  });

  // 12. demo execution remains compatible
  test('12. demo execution remains compatible and executes existing reproduction suite', async () => {
    const demoSession = sessionService.createDemoSession();
    demoSession.status = 'ANALYZED';

    const res = await request(app)
      .post(`/api/investigations/${demoSession.id}/shadowbox`)
      .send({ variant: 'reproduction' });

    assert.equal(res.status, 200);
    assert.equal(res.body.variant, 'reproduction');
    assert.equal(res.body.status, 'REPRODUCED');
    assert.equal(res.body.totalTests, 5);
    assert.equal(res.body.passedTests, 2);
    assert.equal(res.body.failedTests, 3);
  });
});
