const mongoose = require('mongoose');

/**
 * A single finding produced by deterministic validation or AI review.
 * Shared sub-schema used inside Review documents.
 */
const findingSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    type: { type: String, required: true },        // e.g. "misleading_claim", "required_field"
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    issue: { type: String, required: true },
    explanation: { type: String },
    policySection: { type: String },               // e.g. "POLICY-001"
    originalText: { type: String },
    suggestedText: { type: String },
    confidence: { type: Number, min: 0, max: 1 },
    source: { type: String, enum: ['deterministic', 'ai'], required: true },
    // AI-specific code for deterministic findings
    code: { type: String },
  },
  { _id: false }
);

/**
 * Review model.
 * One review per trigger. A listing can have multiple reviews over time.
 */
const reviewSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    // Snapshot of the listing at review time (so history is not affected by later edits)
    listingSnapshot: { type: Object, required: true },
    deterministicFindings: [findingSchema],
    aiFindings: [findingSchema],
    aiSummary: { type: String },
    aiOverallStatus: { type: String, enum: ['pass', 'review', 'fail'] },
    aiAssumptions: [{ type: String }],
    policySectionsUsed: [{ type: String }],       // Array of policy section IDs
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    errorMessage: { type: String },               // Populated when status === 'failed'
    completedAt: { type: Date },
    // Batch ID if this review was triggered as part of a batch
    batchId: { type: String, index: true },
  },
  { timestamps: true }
);

// Compound index for fast paginated history queries sorted by recency
reviewSchema.index({ status: 1, createdAt: -1 });

// Index for listing review lookup
reviewSchema.index({ listingId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
