const express = require('express');
const router = express.Router();
const sessionService = require('../services/session.service');
const ingestionService = require('../services/ingestion.service');

/**
 * POST /api/investigations
 *
 * Creates a new investigation session from either:
 * 1. Demo mode: { isDemo: true }
 * 2. External GitHub repository: { repositoryUrl, branch, errorDescription, ciLog?, environment? }
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Request body must be a JSON object.'
      });
    }

    const { repositoryUrl, branch, errorDescription, ciLog, environment, isDemo } = body;

    // 1. DEMO MODE
    if (isDemo === true) {
      const demoSession = sessionService.createDemoSession();
      return res.status(201).json(sessionService.toPublicView(demoSession));
    }

    // 2. Validate external ingestion inputs
    if (!repositoryUrl || typeof repositoryUrl !== 'string' || !repositoryUrl.trim()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: "Field 'repositoryUrl' is required when isDemo is false."
      });
    }

    if (!errorDescription || typeof errorDescription !== 'string' || !errorDescription.trim()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: "Field 'errorDescription' is required when isDemo is false."
      });
    }

    const urlCheck = ingestionService.validateRepositoryUrl(repositoryUrl);
    if (!urlCheck.valid) {
      return res.status(400).json({
        error: 'BadRequest',
        message: urlCheck.error
      });
    }

    const branchCheck = ingestionService.validateBranch(branch);
    if (!branchCheck.valid) {
      return res.status(400).json({
        error: 'BadRequest',
        message: branchCheck.error
      });
    }

    // 3. Create INITIALIZING session
    const session = sessionService.createSession({
      isDemo: false,
      repositoryUrl: urlCheck.cleanUrl,
      branch: branchCheck.branch,
      errorDescription: errorDescription.trim(),
      ciLog: typeof ciLog === 'string' ? ciLog : null,
      environment: environment && typeof environment === 'object' ? environment : null,
      status: 'INITIALIZING'
    });

    // 4. Ingest repository into ephemeral context
    let ingestionResult;
    try {
      ingestionResult = await ingestionService.ingestRepository({
        repositoryUrl: urlCheck.cleanUrl,
        branch: branchCheck.branch,
        sessionId: session.id
      });
    } catch (ingestErr) {
      sessionService.updateSession(session.id, { status: 'FAILED' });
      const statusCode = ingestErr.statusCode || 500;
      return res.status(statusCode).json({
        error: ingestErr.error || 'IngestionError',
        message: ingestErr.message || 'Failed to ingest repository.'
      });
    }

    // 5. Update session with resolved commit and metadata
    sessionService.updateSession(session.id, {
      resolvedCommit: ingestionResult.resolvedCommit,
      repositoryMetadata: ingestionResult.repositoryMetadata,
      archivePath: ingestionResult.archivePath,
      status: 'INITIALIZED'
    });

    const updatedSession = sessionService.getSession(session.id);
    return res.status(201).json(sessionService.toPublicView(updatedSession));
  } catch (err) {
    next(err);
  }
});

const analysisService = require('../services/analysis.service');

/**
 * GET /api/investigations/:id
 *
 * Retrieves an investigation session by ID.
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const session = sessionService.getSession(id);

  if (!session) {
    return res.status(404).json({
      error: 'NotFound',
      message: `Investigation session '${id}' was not found.`
    });
  }

  return res.status(200).json(sessionService.toPublicView(session));
});

/**
 * POST /api/investigations/:id/analyze
 *
 * Performs static multi-stream analysis (Environment, Code, CI) and synthesis
 * on the ingested repository session without executing repository code.
 */
router.post('/:id/analyze', async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = sessionService.getSession(id);

    if (!session) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Investigation session '${id}' was not found.`
      });
    }

    const updatedSession = await analysisService.analyzeSession(id);
    return res.status(200).json(sessionService.toPublicView(updatedSession));
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        error: 'NotFound',
        message: err.message
      });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.error || 'AnalysisError',
      message: err.message || 'Failed to complete static investigation analysis.'
    });
  }
});

const dynamicShadowboxService = require('../services/dynamicShadowbox.service');

/**
 * POST /api/investigations/:id/shadowbox
 *
 * Executes isolated Shadowbox reproduction for the investigation session.
 * For non-demo sessions: builds and executes a controlled Docker container with
 * network disabled (--network none) and strict resource limits.
 * For demo sessions: executes the verified built-in reproduction suite.
 */
router.post('/:id/shadowbox', async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = sessionService.getSession(id);

    if (!session) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Investigation session '${id}' was not found.`
      });
    }

    const { variant } = req.body || {};
    if (variant !== 'reproduction') {
      return res.status(422).json({
        error: 'UnprocessableEntity',
        message: "Field 'variant' must be strictly 'reproduction'."
      });
    }

    const result = await dynamicShadowboxService.executeReproduction(id);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        error: 'NotFound',
        message: err.message
      });
    }
    if (err.statusCode === 422) {
      return res.status(422).json({
        error: err.error || 'UnprocessableEntity',
        message: err.message
      });
    }
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.error || 'ShadowboxExecutionError',
      message: err.message || 'Shadowbox reproduction execution failed.'
    });
  }
});

module.exports = router;
