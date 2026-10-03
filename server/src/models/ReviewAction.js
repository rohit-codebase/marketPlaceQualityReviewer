const mongoose = require('mongoose');

/**
 * ReviewAction model.
 * Records every human decision on an AI suggestion: approve, edit, or reject.
 * Preserves the full chain: original → AI suggestion → final human-approved value.
 */
const reviewActionSchema = new mongoose.Schema(
  {
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true, index: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    // Which field this action applies to (e.g. "title", "description")
    field: { type: String, required: true },
    source: { type: String, enum: ['ai', 'deterministic'], default: 'ai' },
    findingId: { type: String },
    // Index of the finding within the finding array
    findingIndex: { type: Number, required: true, min: 0 },
    action: { type: String, enum: ['approve', 'edit', 'reject'], required: true },
    originalText: { type: String },
    aiSuggestion: { type: String },
    // The final value the reviewer committed — may be aiSuggestion (approve), edited value (edit), or null (reject)
    finalValue: { type: String },
    // Placeholder for future authentication; stored as string for now
    reviewerId: { type: String, default: 'anonymous' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReviewAction', reviewActionSchema);
