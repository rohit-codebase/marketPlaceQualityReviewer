const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/batchController');

const { reviewTriggerLimiter } = require('../middleware/rateLimiter');

// Rate limit starting batches, but allow polling status freely under generalLimiter
router.post('/', reviewTriggerLimiter, ctrl.startBatch);
router.get('/:batchId', ctrl.getBatchStatus);

module.exports = router;
