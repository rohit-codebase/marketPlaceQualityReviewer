const logger = require('../utils/logger');

/**
 * Global error handler.
 * Returns structured error responses without exposing internal stack traces.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  logger.error({
    operation: 'unhandled_error',
    requestId: req.requestId,
    error: err.message,
    statusCode,
  });

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: messages,
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
    });
  }

  // Generic fallback — never expose stack trace
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'An unexpected error occurred. Please try again.' : err.message,
  });
}

module.exports = errorHandler;
