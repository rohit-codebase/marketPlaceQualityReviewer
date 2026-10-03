const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request logger middleware.
 * Attaches a unique requestId to every incoming request for correlation.
 */
function requestLogger(req, res, next) {
  req.requestId = uuidv4();
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      operation: 'http_request',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = requestLogger;
