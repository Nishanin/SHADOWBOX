const crypto = require('crypto');

/**
 * In-memory Session Manager for SHADOWBOX investigations.
 */
class SessionService {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Generates a unique session ID prefixed with 'inv_'.
   * @returns {string}
   */
  generateId() {
    return 'inv_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Creates a new investigation session.
   *
   * @param {object} params
   * @param {boolean} [params.isDemo=false]
   * @param {string} [params.repositoryUrl]
   * @param {string} [params.branch='main']
   * @param {string} [params.resolvedCommit=null]
   * @param {string} [params.errorDescription=null]
   * @param {string} [params.ciLog=null]
   * @param {object} [params.environment=null]
   * @param {'INITIALIZING' | 'INITIALIZED' | 'FAILED'} [params.status='INITIALIZING']
   * @param {object} [params.repositoryMetadata=null]
   * @param {string} [params.archivePath=null]
   * @returns {object}
   */
  createSession({
    isDemo = false,
    repositoryUrl = null,
    branch = 'main',
    resolvedCommit = null,
    errorDescription = null,
    ciLog = null,
    environment = null,
    status = 'INITIALIZING',
    repositoryMetadata = null,
    archivePath = null
  }) {
    const id = this.generateId();
    const session = {
      id,
      isDemo: Boolean(isDemo),
      repositoryUrl: repositoryUrl || null,
      branch: branch || 'main',
      resolvedCommit: resolvedCommit || null,
      errorDescription: errorDescription || null,
      ciLog: ciLog || null,
      environment: environment && typeof environment === 'object' ? environment : null,
      status, // 'INITIALIZING' | 'INITIALIZED' | 'FAILED'
      repositoryMetadata: repositoryMetadata || null,
      archivePath: archivePath || null,
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Creates a session representing the verified built-in demo.
   * Does NOT touch GitHub; references the pre-verified timezone discrepancy scenario.
   *
   * @returns {object}
   */
  createDemoSession() {
    const id = this.generateId();
    const session = {
      id,
      isDemo: true,
      repositoryUrl: 'https://github.com/Nishanin/SHADOWBOX',
      branch: 'main',
      resolvedCommit: '23fd96e4c992316437b7aada02f12f915112de23',
      errorDescription:
        'Invoice date validator resolves to 2024-01-15 instead of 2024-01-14 in UTC environment (passes locally in IST)',
      ciLog: [
        'FAIL demo-app/src/invoiceChecker.test.js',
        '✕ should preserve the invoice calendar date',
        '  Expected: "2024-01-14"',
        '  Received: "2024-01-15"',
        '3 failed, 2 passed, 5 total'
      ].join('\n'),
      environment: {
        os: 'Ubuntu 22.04',
        nodeVersion: '20',
        timezone: 'UTC'
      },
      status: 'INITIALIZED',
      repositoryMetadata: {
        isNodeProject: true,
        name: 'shadowbox-demo-app',
        packageManager: 'npm',
        testScript: 'test',
        scripts: ['test', 'test:utc'],
        hasDockerFile: true
      },
      archivePath: null, // Demo mode uses existing variants.json / demo-app architecture
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Retrieves a session by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getSession(id) {
    if (!id || typeof id !== 'string') return null;
    return this.sessions.get(id) || null;
  }

  /**
   * Updates an existing session.
   * @param {string} id
   * @param {object} updates
   * @returns {object|null}
   */
  updateSession(id, updates) {
    const session = this.getSession(id);
    if (!session) return null;
    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
    return session;
  }

  /**
   * Deletes a session by ID.
   * @param {string} id
   * @returns {boolean}
   */
  deleteSession(id) {
    return this.sessions.delete(id);
  }

  /**
   * Clears all sessions (useful for tests).
   */
  clearSessions() {
    this.sessions.clear();
  }

  /**
   * Returns a sanitized public view of a session, stripping internal host filesystem paths.
   *
   * @param {object|null} session
   * @returns {object|null}
   */
  toPublicView(session) {
    if (!session) return null;
    const { archivePath, ...publicSession } = session;
    return publicSession;
  }
}

module.exports = new SessionService();
