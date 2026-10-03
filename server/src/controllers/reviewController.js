const reviewService = require('../services/reviewService');

/**
 * Review Controller — handles HTTP for review operations.
 */

async function triggerReview(req, res, next) {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      return res.status(400).json({ success: false, error: 'listingId is required' });
    }
    const review = await reviewService.triggerReview(listingId);
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (err.statusCode === 409 || err.message.includes('already in progress')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    if (err.statusCode === 404 || err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
}

async function getReview(req, res, next) {
  try {
    const review = await reviewService.getReviewById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
}

async function submitAction(req, res, next) {
  try {
    const reviewId = req.params.id;
    const action = await reviewService.recordAction(reviewId, req.body);
    res.status(201).json({ success: true, data: action });
  } catch (err) {
    if (err.statusCode === 400 || err.message.includes('Invalid') || err.message.includes('must be')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.statusCode === 404 || err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.getHistory({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getReviewDetail(req, res, next) {
  try {
    const { review, actions } = await reviewService.getReviewWithActions(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    res.json({ success: true, data: { review, actions } });
  } catch (err) {
    next(err);
  }
}

module.exports = { triggerReview, getReview, submitAction, getHistory, getReviewDetail };
