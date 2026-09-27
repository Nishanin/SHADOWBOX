const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// Configurable / test-stubbable execFile handler
let execFileFn = execFile;

/**
 * For unit test stubbing without network access.
 * @param {Function} stubFn
 */
function _setExecFile(stubFn) {
  execFileFn = stubFn;
}

/**
 * Restores original execFile implementation.
 */
function _resetExecFile() {
  execFileFn = execFile;
}

/**
 * Validates that the provided URL is strictly an HTTPS GitHub repository URL.
 * Rejects credentials, non-GitHub domains, IP addresses, custom ports, and path traversal.
 *
 * @param {string} urlStr
 * @returns {{ valid: boolean, cleanUrl?: string, owner?: string, repo?: string, error?: string }}
 */
function validateRepositoryUrl(urlStr) {
  if (typeof urlStr !== 'string' || !urlStr.trim()) {
    return { valid: false, error: 'Repository URL is required and must be a non-empty string.' };
  }

  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // 1. Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS repository URLs are permitted.' };
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Repository URLs containing credentials are not permitted.' };
  }

  // 3. Strict hostname check: strictly github.com (no subdomains, IP addresses, or localhost)
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com') {
    return { valid: false, error: 'Only repositories hosted on github.com are currently supported.' };
  }

  // 4. Reject non-standard ports
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: 'Custom network ports are not permitted.' };
  }

  // 5. Reject query parameters or hash fragments
  if (parsed.search || parsed.hash) {
    return { valid: false, error: 'Repository URLs must not include query strings or hash fragments.' };
  }

  // 6. Path validation: must be /<owner>/<repo>
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (pathParts.length !== 2) {
    return { valid: false, error: 'URL path must match the format /<owner>/<repository>.' };
  }

  const [owner, rawRepo] = pathParts;
  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;

  // GitHub username: alphanumeric and hyphens (cannot start with hyphen, 1-39 chars)
  const validOwnerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  // GitHub repo name: alphanumeric, hyphens, underscores, dots (1-100 chars)
  const validRepoRegex = /^[a-zA-Z0-9_.-]+$/;

  if (!validOwnerRegex.test(owner) || owner.length > 39) {
    return { valid: false, error: `Invalid GitHub owner name: '${owner}'.` };
  }

  if (!validRepoRegex.test(repo) || repo.length > 100 || repo === '.' || repo === '..') {
    return { valid: false, error: `Invalid GitHub repository name: '${rawRepo}'.` };
  }

  const cleanUrl = `https://github.com/${owner}/${repo}`;
  return { valid: true, cleanUrl, owner, repo };
}

/**
 * Validates that the branch name does not violate git ref rules or attempt flag injection.
 *
 * @param {string} [branchStr]
 * @returns {{ valid: boolean, branch?: string, error?: string }}
 */
function validateBranch(branchStr) {
  if (branchStr === undefined || branchStr === null || branchStr === '') {
    return { valid: true, branch: 'main' };
  }

  if (typeof branchStr !== 'string') {
    return { valid: false, error: 'Branch name must be a string.' };
  }

  const branch = branchStr.trim();
  if (branch.length === 0) {
    return { valid: true, branch: 'main' };
  }

  // Reject flag injection
  if (branch.startsWith('-')) {
    return { valid: false, error: 'Branch name cannot start with a hyphen.' };
  }

  // Allowed ref characters: alphanumeric, _, ., /, -
  const safeBranchRegex = /^[a-zA-Z0-9_.\/-]+$/;
  if (
    !safeBranchRegex.test(branch) ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.endsWith('/') ||
    branch.endsWith('.lock')
  ) {
    return { valid: false, error: `Invalid branch name format: '${branch}'.` };
  }

  if (branch.length > 250) {
    return { valid: false, error: 'Branch name exceeds maximum length of 250 characters.' };
  }

  return { valid: true, branch };
}

/**
 * Executes a git command safely using execFile (array arguments, no shell interpolation).
 *
 * @param {string[]} args
 * @param {object} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0' // Prevent interactive authentication prompts
    };

    const execOptions = {
      timeout: options.timeout || 30000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...defaultEnv, ...(options.env || {}) },
      cwd: options.cwd || process.cwd(),
      windowsHide: true
    };

    execFileFn('git', args, execOptions, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout ? stdout.toString() : (err.stdout || '');
        err.stderr = stderr ? stderr.toString() : (err.stderr || '');
        return reject(err);
      }
      resolve({
        stdout: stdout ? stdout.toString().trim() : '',
        stderr: stderr ? stderr.toString().trim() : ''
      });
    });
  });
}

/**
 * Ingests a validated external GitHub repository into an ephemeral staging context:
 * 1. Creates ephemeral temporary directory in OS temp.
 * 2. Clones the repository with --depth 1 --single-branch --branch <branch>.
 * 3. Resolves the commit SHA (git rev-parse HEAD).
 * 4. Inspects repository metadata (detects package.json, scripts, test runner).
 * 5. Generates an archive tarball for later Shadowbox container reproduction.
 * 6. Cleans up cloned working tree in a finally block.
 *
 * @param {object} params
 * @param {string} params.repositoryUrl
 * @param {string} params.branch
 * @param {string} params.sessionId
 * @returns {Promise<{ resolvedCommit: string, repositoryMetadata: object, archivePath: string }>}
 */
async function ingestRepository({ repositoryUrl, branch = 'main', sessionId }) {
  const tempBase = os.tmpdir();
  const ingestDir = path.join(tempBase, 'shadowbox-ingest', sessionId);
  const archivesDir = path.join(tempBase, 'shadowbox-archives');
  const archivePath = path.join(archivesDir, `${sessionId}.tar`);

  // Ensure directories exist
  fs.mkdirSync(path.dirname(ingestDir), { recursive: true });
  fs.mkdirSync(archivesDir, { recursive: true });

  try {
    // 1. Sandboxed Shallow Clone
    try {
      await runGit(
        ['clone', '--depth', '1', '--single-branch', '--branch', branch, repositoryUrl, ingestDir],
        { timeout: 30000 }
      );
    } catch (cloneErr) {
      const stderr = cloneErr.stderr || cloneErr.message || '';
      if (cloneErr.killed || cloneErr.signal === 'SIGTERM') {
        const error = new Error('Repository clone timed out after 30 seconds.');
        error.statusCode = 504;
        error.error = 'GatewayTimeout';
        throw error;
      }
      if (stderr.includes('Remote branch') && stderr.includes('not found')) {
        const error = new Error(`Branch '${branch}' was not found in upstream repository.`);
        error.statusCode = 422;
        error.error = 'UnprocessableEntity';
        throw error;
      }
      if (stderr.includes('Authentication failed') || stderr.includes('could not read Username')) {
        const error = new Error(
          'Repository could not be cloned. Private repositories or repositories requiring authentication are not supported.'
        );
        error.statusCode = 422;
        error.error = 'UnprocessableEntity';
        throw error;
      }
      const error = new Error(`Failed to clone repository: ${stderr.trim() || cloneErr.message}`);
      error.statusCode = 422;
      error.error = 'UnprocessableEntity';
      throw error;
    }

    // 2. Resolve exact commit SHA
    const revCheck = await runGit(['-C', ingestDir, 'rev-parse', 'HEAD']);
    const resolvedCommit = revCheck.stdout;

    // 3. Inspect Repository Metadata (read-only filesystem checks, NO host execution!)
    const metadata = inspectRepositoryMetadata(ingestDir);

    // 4. Create Git archive tarball of HEAD
    await runGit(['-C', ingestDir, 'archive', '--format=tar', `--output=${archivePath}`, 'HEAD']);

    return {
      resolvedCommit,
      repositoryMetadata: metadata,
      archivePath
    };
  } finally {
    // 5. Always clean up temporary working tree on host
    try {
      if (fs.existsSync(ingestDir)) {
        fs.rmSync(ingestDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Inspects cloned repository structure without executing any scripts on the host.
 *
 * @param {string} repoDir
 * @returns {object}
 */
function inspectRepositoryMetadata(repoDir) {
  const packageJsonPath = path.join(repoDir, 'package.json');
  const isNodeProject = fs.existsSync(packageJsonPath);

  if (!isNodeProject) {
    return {
      isNodeProject: false,
      packageManager: null,
      testScript: null,
      scripts: [],
      hasDockerFile: fs.existsSync(path.join(repoDir, 'Dockerfile'))
    };
  }

  let packageData = {};
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    packageData = JSON.parse(raw);
  } catch {
    packageData = {};
  }

  const scripts = packageData.scripts && typeof packageData.scripts === 'object'
    ? Object.keys(packageData.scripts)
    : [];

  let testScript = null;
  if (scripts.includes('test')) {
    testScript = 'test';
  } else if (scripts.includes('test:ci')) {
    testScript = 'test:ci';
  } else {
    testScript = scripts.find((s) => s.startsWith('test')) || null;
  }

  // Detect lockfile
  let packageManager = 'npm';
  if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (fs.existsSync(path.join(repoDir, 'bun.lockb'))) {
    packageManager = 'bun';
  } else if (fs.existsSync(path.join(repoDir, 'package-lock.json'))) {
    packageManager = 'npm';
  }

  return {
    isNodeProject: true,
    name: packageData.name || null,
    version: packageData.version || null,
    packageManager,
    testScript,
    scripts,
    hasDockerFile: fs.existsSync(path.join(repoDir, 'Dockerfile'))
  };
}

module.exports = {
  validateRepositoryUrl,
  validateBranch,
  ingestRepository,
  inspectRepositoryMetadata,
  runGit,
  _setExecFile,
  _resetExecFile
};
