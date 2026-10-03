const Review = require('../models/Review');
const { reviewListing } = require('../ai/listingReviewer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Batch Service
 *
 * Processes a small list of listing IDs one at a time.
 * Design principle: if one listing fails, continue with the rest.
 * Per-listing status is tracked within the in-memory batch state,
 * and each review document is stored individually with the batchId.
 *
 * A simple in-memory store tracks active batch state so the client can poll.
 * For production scale, this would be replaced with a queue/job store.
 */

// In-memory batch state: batchId → { status, items }
const activeBatches = new Map();

/**
 * Starts an async batch review. Returns the batchId immediately.
 * Processing happens in the background.
 */
async function startBatch(listingIds) {
  if (!Array.isArray(listingIds) || listingIds.length === 0) {
    const err = new Error('listingIds must be a non-empty array');
    err.statusCode = 400;
    throw err;
  }

  // Deduplicate IDs intentionally
  const uniqueListingIds = [...new Set(listingIds.map(String).map((s) => s.trim()).filter(Boolean))];

  if (uniqueListingIds.length === 0) {
    const err = new Error('At least one valid listingId is required');
    err.statusCode = 400;
    throw err;
  }

  if (uniqueListingIds.length > 20) {
    const err = new Error('Batch size is limited to 20 listings');
    err.statusCode = 400;
    throw err;
  }

  const batchId = uuidv4();

  const items = uniqueListingIds.map((id) => ({
    listingId: id,
    status: 'pending',
    reviewId: null,
    error: null,
  }));

  activeBatches.set(batchId, { batchId, status: 'processing', items, startedAt: new Date() });

  // Process in background — do not await
  processBatch(batchId, uniqueListingIds).catch((err) => {
    logger.error({ operation: 'batch_fatal', batchId, error: err.message });
    const batch = activeBatches.get(batchId);
    if (batch) batch.status = 'failed';
  });

  return { batchId, itemCount: uniqueListingIds.length };
}

async function processBatch(batchId, listingIds) {
  const batch = activeBatches.get(batchId);

  for (let i = 0; i < listingIds.length; i++) {
    const listingId = listingIds[i];
    const item = batch.items[i];
    item.status = 'processing';

    logger.info({ operation: 'batch_item_start', batchId, listingId });

    try {
      const requestId = uuidv4();
      const review = await reviewListing(listingId, requestId, batchId);
      item.status = review.status === 'failed' ? 'failed' : 'completed';
      item.reviewId = review._id ? review._id.toString() : null;
      if (review.status === 'failed') {
        item.error = review.errorMessage || 'Review completed with failure status';
      }
    } catch (err) {
      // Isolate the failure — mark item as failed and move on
      item.status = 'failed';
      item.error = err.message || 'Review failed';
      logger.error({ operation: 'batch_item_failed', batchId, listingId, error: err.message });
    }
  }

  // Mark batch complete only after all items have been attempted
  batch.status = 'completed';
  batch.completedAt = new Date();
  logger.info({ operation: 'batch_complete', batchId });
}

/**
 * Returns current batch status from in-memory store.
 * If the batch is not found in memory (e.g. server restarted), queries the DB.
 */
async function getBatchStatus(batchId) {
  if (activeBatches.has(batchId)) {
    return activeBatches.get(batchId);
  }

  // Fallback: reconstruct from DB
  const reviews = await Review.find({ batchId }).select('listingId status _id errorMessage');
  if (reviews.length === 0) return null;

  return {
    batchId,
    status: 'completed',
    items: reviews.map((r) => ({
      listingId: r.listingId.toString(),
      reviewId: r._id.toString(),
      status: r.status === 'failed' ? 'failed' : 'completed',
      error: r.errorMessage || null,
    })),
  };
}

module.exports = { startBatch, getBatchStatus };
