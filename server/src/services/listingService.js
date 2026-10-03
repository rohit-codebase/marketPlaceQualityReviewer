const Listing = require('../models/Listing');
const { computeContentHash } = require('../validators/listingValidator');
const { SUPPORTED_CATEGORIES } = require('../config/categories');

/**
 * Listing Service
 * Contains all database interaction for listings.
 * Controllers stay thin by delegating to this service.
 */

async function createListing(data) {
  // Compute content hash for duplicate detection
  const contentHash = computeContentHash(data);

  const listing = new Listing({ ...data, contentHash });
  await listing.save();
  return listing;
}

async function getAllListings({ page = 1, limit = 20, status, category } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  const skip = (page - 1) * limit;
  const [listings, total] = await Promise.all([
    Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Listing.countDocuments(filter),
  ]);

  return { listings, total, page, limit };
}

async function getListingById(id) {
  return Listing.findById(id);
}

async function updateListing(id, data) {
  const existing = await Listing.findById(id);
  if (!existing) {
    const err = new Error(`Listing ${id} not found`);
    err.statusCode = 404;
    throw err;
  }

  // Whitelist updateable fields to prevent arbitrary field injection
  const allowedFields = ['title', 'description', 'category', 'price', 'attributes', 'seller', 'tags'];
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      if (field === 'seller' && typeof data.seller === 'object') {
        const existingSeller = existing.seller?.toObject ? existing.seller.toObject() : (existing.seller || {});
        existing.seller = { ...existingSeller, ...data.seller };
      } else if (field === 'attributes' && typeof data.attributes === 'object') {
        existing.attributes = data.attributes;
      } else {
        existing[field] = data[field];
      }
    }
  });

  // Recompute content hash from the complete merged listing object
  const newContentHash = computeContentHash(existing.toObject());

  // Check if another listing already has this hash (duplicate detection)
  const duplicate = await Listing.findOne({
    contentHash: newContentHash,
    _id: { $ne: existing._id },
  });

  if (duplicate) {
    const err = new Error('Another listing with identical content already exists.');
    err.statusCode = 409;
    err.code = 'DUPLICATE_LISTING';
    throw err;
  }

  existing.contentHash = newContentHash;
  await existing.save();
  return existing;
}

async function getDashboardStats() {
  const [total, pending, approved, rejected, highSeverity] = await Promise.all([
    Listing.countDocuments(),
    Listing.countDocuments({ status: 'under_review' }),
    Listing.countDocuments({ status: 'approved' }),
    Listing.countDocuments({ status: 'rejected' }),
    // Listings with high-severity issues are those currently under_review or rejected
    Listing.countDocuments({ status: { $in: ['under_review', 'rejected'] } }),
  ]);

  return { total, pending, approved, rejected, highSeverity };
}

module.exports = { createListing, getAllListings, getListingById, updateListing, getDashboardStats };
