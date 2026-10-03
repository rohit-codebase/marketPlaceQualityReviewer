const { callLLM } = require('./llmClient');
const { SYSTEM_PROMPT, buildUserMessage } = require('./promptBuilder');
const { validateAIOutput } = require('./outputValidator');
const { retrieveRelevantSections } = require('../policies/policyRetriever');
const { validateListing, computeContentHash } = require('../validators/listingValidator');
const logger = require('../utils/logger');
const Listing = require('../models/Listing');
const Review = require('../models/Review');

// In-process lock to prevent simultaneous duplicate review triggers for the same listing
const activeReviewLocks = new Set();

/**
 * Listing Reviewer — AI Workflow Orchestrator
 *
 * Full workflow for a single listing review:
 *   1. Check concurrency and load listing
 *   2. Check for duplicate content hash
 *   3. Run deterministic validation (independent of AI)
 *   4. Retrieve relevant policy sections
 *   5. Build prompt and call LLM (OpenAI or mock)
 *   6. Strictly validate AI output (schema, supplied policy IDs, originalText)
 *   7. Update review status:
 *      - Completed review -> status='completed'
 *      - LLM failure or invalid output -> status='failed'
 *   8. Update listing status:
 *      - Approved if pass + 0 deterministic issues
 *      - Rejected if fail or high-severity issues
 *      - Under review if medium issues
 *      - Revert to 'active' if AI review failed
 *
 * @param {string} listingId   - MongoDB ObjectId of the listing to review.
 * @param {string} requestId   - Unique request ID for logging.
 * @param {string} [batchId]   - Optional batch ID if part of a batch run.
 * @returns {Promise<Review>}  - The saved Review document.
 */
async function reviewListing(listingId, requestId, batchId = null) {
  const listingIdStr = listingId.toString();

  // 1. Concurrency control: prevent duplicate simultaneous reviews
  if (activeReviewLocks.has(listingIdStr)) {
    const conflictErr = new Error('Review already in progress for this listing.');
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  activeReviewLocks.add(listingIdStr);

  try {
    logger.info({ operation: 'review_start', requestId, listingId: listingIdStr, batchId });

    // Load listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      const notFoundErr = new Error(`Listing ${listingId} not found`);
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }

    // Check if listing is already under review from another process
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

    // Mark listing as under review
    listing.status = 'under_review';
    await listing.save();

    // 2. Duplicate detection: compute SHA-256 contentHash from complete listing
    const contentHash = computeContentHash(listing.toObject());
    const existingDuplicate = await Listing.findOne({
      contentHash,
      _id: { $ne: listing._id },
    });

    // 3. Deterministic validation (runs independently of any LLM)
    const deterministicFindings = validateListing(listing.toObject(), {
      checkDuplicate: !!existingDuplicate,
      existingHash: existingDuplicate ? contentHash : null,
    });

    logger.info({
      operation: 'deterministic_validation',
      requestId,
      listingId: listingIdStr,
      findingsCount: deterministicFindings.length,
    });

    // 4. Retrieve relevant policy sections
    const relevantSections = retrieveRelevantSections(listing.toObject());
    const sectionIds = relevantSections.map((s) => s.id);

    logger.info({
      operation: 'policy_retrieval',
      requestId,
      listingId: listingIdStr,
      sections: sectionIds,
    });

    // 5. Build prompt and call LLM
    let aiFindings = [];
    let aiSummary = '';
    let aiOverallStatus = 'review';
    let aiAssumptions = [];
    let reviewStatus = 'completed';
    let errorMessage = null;

    try {
      const userMessage = buildUserMessage(listing.toObject(), relevantSections);
      const rawAIResponse = await callLLM(SYSTEM_PROMPT, userMessage, requestId, sectionIds);

      // 6. Strict validation of AI output against allowed policy IDs & listing text
      const validationResult = validateAIOutput(rawAIResponse, sectionIds, listing.toObject());

      if (!validationResult.valid) {
        // As required by Section 8: Treat invalid AI output as FAILED review
        logger.warn({
          operation: 'ai_output_invalid',
          requestId,
          listingId: listingIdStr,
          errors: validationResult.errors,
        });

        reviewStatus = 'failed';
        errorMessage = `AI output validation failed: ${validationResult.errors.join('; ')}`;
        aiSummary = 'AI review failed schema/policy validation. Deterministic findings preserved.';
        aiOverallStatus = 'review';
      } else {
        reviewStatus = 'completed';
        aiFindings = validationResult.data.findings;
        aiSummary = validationResult.data.summary;
        aiOverallStatus = validationResult.data.overallStatus;
        aiAssumptions = validationResult.data.assumptions;

        logger.info({
          operation: 'ai_review_complete',
          requestId,
          listingId: listingIdStr,
          overallStatus: aiOverallStatus,
          aiFindings: aiFindings.length,
        });
      }
    } catch (err) {
      logger.error({
        operation: 'ai_review_failed',
        requestId,
        listingId: listingIdStr,
        errorCode: err.code,
        error: err.message,
      });

      reviewStatus = 'failed';
      errorMessage = err.message || 'AI review request failed';
      aiSummary = 'AI review could not be completed. Deterministic findings preserved.';
      aiOverallStatus = 'review';
    }

    // 7. Persist the Review document
    const review = new Review({
      listingId: listing._id,
      listingSnapshot: listing.toObject(),
      deterministicFindings,
      aiFindings,
      aiSummary,
      aiOverallStatus,
      aiAssumptions,
      policySectionsUsed: sectionIds,
      status: reviewStatus,
      errorMessage,
      completedAt: new Date(),
      ...(batchId ? { batchId } : {}),
    });

    await review.save();

    // 8. Authoritative Listing Status update
    const hasHighSeverityDeterministic = deterministicFindings.some((f) => f.severity === 'high');

    if (reviewStatus === 'completed') {
      if (hasHighSeverityDeterministic || aiOverallStatus === 'fail') {
        listing.status = 'rejected';
      } else if (aiOverallStatus === 'pass' && deterministicFindings.length === 0) {
        listing.status = 'approved';
      } else {
        listing.status = 'under_review';
      }
    } else {
      // If AI review failed, revert listing from under_review back to active
      listing.status = 'active';
    }

    if (!listing.contentHash) {
      listing.contentHash = contentHash;
    }

    await listing.save();

    logger.info({
      operation: 'review_saved',
      requestId,
      listingId: listingIdStr,
      reviewId: review._id.toString(),
      reviewStatus,
      listingStatus: listing.status,
    });

    return review;
  } finally {
    activeReviewLocks.delete(listingIdStr);
  }
}

module.exports = { reviewListing };
