const listingService = require('../services/listingService');
const reviewService = require('../services/reviewService');

/**
 * Listing Controller — thin layer between routes and service.
 * Only handles HTTP request/response; business logic lives in services.
 */

async function createListing(req, res, next) {
  try {
    const listing = await listingService.createListing(req.body);
    res.status(201).json({ success: true, data: listing });
  } catch (err) {
    // MongoDB duplicate key error (contentHash unique index violation)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A listing with identical content already exists.',
        code: 'DUPLICATE_LISTING',
      });
    }
    next(err);
  }
}

async function getListings(req, res, next) {
  try {
    const { page, limit, status, category } = req.query;
    const result = await listingService.getAllListings({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      category,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getListingById(req, res, next) {
  try {
    const listing = await listingService.getListingById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
}

async function updateListing(req, res, next) {
  try {
    const listing = await listingService.updateListing(req.params.id, req.body);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    res.json({ success: true, data: listing });
  } catch (err) {
    if (err.statusCode === 404 || err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.statusCode === 409 || err.code === 'DUPLICATE_LISTING' || err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Another listing with identical content already exists.',
        code: 'DUPLICATE_LISTING',
      });
    }
    next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const [stats, recentReviews] = await Promise.all([
      listingService.getDashboardStats(),
      reviewService.getRecentReviews(5),
    ]);
    res.json({ success: true, data: { stats, recentReviews } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createListing, getListings, getListingById, updateListing, getDashboard };
