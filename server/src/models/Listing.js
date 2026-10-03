const mongoose = require('mongoose');
const { SUPPORTED_CATEGORIES } = require('../config/categories');

/**
 * Listing model.
 * contentHash is a SHA-256 of normalized (lowercased+trimmed) title+description+category+seller.
 * It enables fast O(1) duplicate detection via a unique index.
 */
const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, enum: SUPPORTED_CATEGORIES },
    price: { type: Number, required: true, min: 0.01 },
    attributes: { type: Map, of: String, default: {} },
    seller: {
      name: { type: String, required: true, trim: true },
      contact: { type: String, trim: true },
    },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    status: {
      type: String,
      enum: ['active', 'under_review', 'approved', 'rejected'],
      default: 'active',
    },
    // SHA-256 hash of normalized listing fields — used for duplicate detection.
    contentHash: { type: String },
  },
  { timestamps: true }
);

// Ensure the same content hash cannot be stored twice.
listingSchema.index({ contentHash: 1 }, { unique: true, sparse: true });

// Text index for search (optional but useful for future filtering).
listingSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Listing', listingSchema);
