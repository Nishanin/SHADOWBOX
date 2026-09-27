const express = require('express');
const router = express.Router();
const shadowboxService = require('../services/shadowbox.service');
const config = require('../config');

/**
 * GET /api/shadowbox/status
 * Returns backend service status and platform capability.
 */
router.get('/status', async (req, res, next) => {
  try {
    const dockerInfo = await shadowboxService.checkDockerAvailability();
    res.status(200).json({
      service: 'shadowbox',
      available: dockerInfo.available,
      variants: config.allowedVariants,
      dockerAvailable: dockerInfo.available,
      dockerVersion: dockerInfo.version
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/shadowbox/run
 * Executes an approved source variant ('reproduction' or 'verification').
 */
router.post('/run', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: "Request body must be a JSON object containing 'variant'."
      });
    }

    const { variant } = req.body;

    if (!variant || typeof variant !== 'string' || !config.allowedVariants.includes(variant)) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: `Field 'variant' must be strictly one of: ${config.allowedVariants.join(', ')}`,
        allowedVariants: config.allowedVariants
      });
    }

    // Reject unexpected extra keys to prevent parameter pollution
    const allowedKeys = ['variant'];
    const extraKeys = Object.keys(req.body).filter((key) => !allowedKeys.includes(key));
    if (extraKeys.length > 0) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: `Unexpected field(s) in request body: ${extraKeys.join(', ')}. Only 'variant' is allowed.`
      });
    }

    const result = await shadowboxService.runVariant(variant);

    // Map runner classification to HTTP status code:
    // 200: REPRODUCED (defect observed as expected) or VERIFIED (all tests passed)
    // 422: UNEXPECTED_RESULT (application test counts mismatch)
    // 503 / 500: INFRASTRUCTURE_ERROR (Docker / Git / Host environment failure)
    switch (result.status) {
      case 'REPRODUCED':
      case 'VERIFIED':
        return res.status(200).json(result);
      case 'UNEXPECTED_RESULT':
        return res.status(422).json(result);
      case 'INFRASTRUCTURE_ERROR': {
        const httpStatus = result.errorCategory === 'DOCKER_DAEMON_UNAVAILABLE' ? 503 : 500;
        return res.status(httpStatus).json(result);
      }
      default:
        return res.status(500).json(result);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
