const Review = require('../models/Review');
const ReviewAction = require('../models/ReviewAction');
const Listing = require('../models/Listing');
const { reviewListing } = require('../ai/listingReviewer');
const { computeContentHash } = require('../validators/listingValidator');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Review Service
 * Handles triggering reviews, fetching review data, and recording reviewer actions.
 */

/**
 * Triggers a new review for a listing.
 * Prevents simultaneous duplicate review triggers for the same listing.
 */
async function triggerReview(listingId) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    const err = new Error(`Listing ${listingId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // Check if listing is already under review
  if (listing.status === 'under_review') {
    const recentReview = await Review.findOne({
      listingId: listing._id,
      status: { $in: ['pending', 'in_progress'] },
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    });
    if (recentReview) {
      const err = new Error('Review already in progress for this listing.');
      err.statusCode = 409;
      throw err;
    }
  }

  const requestId = uuidv4();
  const review = await reviewListing(listingId, requestId);
  return review;
}

/**
 * Returns a review by ID with its listing populated.
 */
async function getReviewById(reviewId) {
  return Review.findById(reviewId).populate('listingId', 'title category seller status');
}

/**
 * Records a reviewer action (approve/edit/reject) on a specific finding.
 * Strict validation to prevent arbitrary field injection or invalid states.
 */
async function recordAction(reviewId, actionData) {
  const { field, findingIndex, action, originalText, aiSuggestion, finalValue, source } = actionData;

  // 1. Whitelist allowed actions
  const ALLOWED_ACTIONS = ['approve', 'edit', 'reject'];
  if (!ALLOWED_ACTIONS.includes(action)) {
    const err = new Error(`Invalid action "${action}". Allowed actions are: ${ALLOWED_ACTIONS.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Whitelist allowed fields to prevent Mongo injection / prototype pollution
  const ALLOWED_FIELDS = ['title', 'description', 'category', 'price', 'tags', 'listing'];
  if (!ALLOWED_FIELDS.includes(field)) {
    const err = new Error(`Invalid field "${field}". Allowed fields are: ${ALLOWED_FIELDS.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate finding index
  const indexNum = Number(findingIndex);
  if (!Number.isInteger(indexNum) || indexNum < 0) {
    const err = new Error('findingIndex must be a non-negative integer.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate finalValue when approving/editing
  if (action !== 'reject') {
    if (finalValue === undefined || finalValue === null || (typeof finalValue !== 'string' && typeof finalValue !== 'number')) {
      const err = new Error('finalValue must be provided as a string or number when approving or editing.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 5. Verify review and listing exist
  const review = await Review.findById(reviewId);
  if (!review) {
    const err = new Error(`Review ${reviewId} not found`);
    err.statusCode = 404;
    throw err;
  }

  const listing = await Listing.findById(review.listingId);
  if (!listing) {
    const err = new Error(`Listing associated with review ${reviewId} not found`);
    err.statusCode = 404;
    throw err;
  }

  // 6. Record action with finding identity
  const actionSource = source === 'deterministic' ? 'deterministic' : 'ai';
  const reviewAction = new ReviewAction({
    reviewId,
    listingId: review.listingId,
    field,
    source: actionSource,
    findingIndex: indexNum,
    findingId: actionData.findingId || `${actionSource}-${indexNum}`,
    action,
    originalText: originalText ? String(originalText) : null,
    aiSuggestion: aiSuggestion ? String(aiSuggestion) : null,
    finalValue: action !== 'reject' ? String(finalValue) : null,
    timestamp: new Date(),
  });

  await reviewAction.save();

  // 7. Safely apply approved / edited value to listing
  if (action === 'approve' || action === 'edit') {
    if (finalValue !== undefined && finalValue !== null && field !== 'listing') {
      if (field === 'price') {
        const parsedPrice = Number(finalValue);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          const err = new Error('Price must be a positive number.');
          err.statusCode = 400;
          throw err;
        }
        listing.price = parsedPrice;
      } else if (field === 'tags') {
        listing.tags = Array.isArray(finalValue)
          ? finalValue
          : String(finalValue).split(',').map((t) => t.trim()).filter(Boolean);
      } else {
        listing[field] = String(finalValue).trim();
      }

      // Recompute contentHash after field modification
      listing.contentHash = computeContentHash(listing.toObject());
      await listing.save();
    }
  }

  logger.info({
    operation: 'review_action_recorded',
    reviewId: reviewId.toString(),
    listingId: review.listingId.toString(),
    field,
    source: actionSource,
    action,
  });

  return reviewAction;
}

/**
 * Returns all completed reviews for the history page with optimized projections and pagination.
 */
async function getHistory({ page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  // Use projection to exclude heavy fields (listingSnapshot, policySectionsUsed, aiAssumptions) from list view
  const [reviews, total] = await Promise.all([
    Review.find({ status: { $in: ['completed', 'failed'] } })
      .select('listingId aiOverallStatus status deterministicFindings aiFindings createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('listingId', 'title category seller.name')
      .lean(),
    Review.countDocuments({ status: { $in: ['completed', 'failed'] } }),
  ]);

  return {
    reviews,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Returns a review with all associated reviewer actions (for the history detail view).
 */
async function getReviewWithActions(reviewId) {
  const [review, actions] = await Promise.all([
    Review.findById(reviewId).populate('listingId').lean(),
    ReviewAction.find({ reviewId }).sort({ timestamp: 1 }).lean(),
  ]);
  return { review, actions };
}

/**
 * Returns recent reviews for the dashboard with lean projection.
 */
async function getRecentReviews(limit = 5) {
  const safeLimit = Math.min(20, Math.max(1, parseInt(limit) || 5));
  return Review.find({ status: { $in: ['completed', 'failed'] } })
    .select('listingId aiOverallStatus status deterministicFindings aiFindings createdAt')
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate('listingId', 'title category')
    .lean();
}

module.exports = { triggerReview, getReviewById, recordAction, getHistory, getReviewWithActions, getRecentReviews };
