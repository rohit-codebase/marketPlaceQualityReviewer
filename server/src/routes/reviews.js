const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reviewController');

const { reviewTriggerLimiter } = require('../middleware/rateLimiter');

// Expensive AI review creation is rate-limited to prevent abuse/costs
router.post('/', reviewTriggerLimiter, ctrl.triggerReview);

// Read endpoints and human action submission are not throttled by the AI trigger limiter
router.get('/history', ctrl.getHistory);
router.get('/history/:id', ctrl.getReviewDetail);
router.get('/:id', ctrl.getReview);
router.post('/:id/actions', ctrl.submitAction);

module.exports = router;
