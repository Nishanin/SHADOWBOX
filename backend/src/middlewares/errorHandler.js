/**
 * Centralized error-handling middleware.
 */
function errorHandler(err, req, res, next) {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Malformed JSON',
      message: 'The request body could not be parsed as valid JSON.'
    });
  }

  // Log full error internally for diagnostics
  console.error('[ERROR]', {
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack
  });

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: statusCode === 500 ? 'An internal server error occurred.' : err.message
  });
}

module.exports = errorHandler;
