const rateLimit = require('express-rate-limit');

/**
 * Basic rate limiter — prevents abuse.
 * The AI review endpoint is also rate-limited separately to control LLM costs.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Generous limit for normal navigation and read requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

// Applied ONLY to expensive AI creation endpoints (POST /api/reviews and POST /api/batch-reviews)
const reviewTriggerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 AI triggers per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many review requests. Please wait a moment before submitting more listings for review.',
  },
});

module.exports = { generalLimiter, reviewTriggerLimiter, reviewLimiter: reviewTriggerLimiter };
