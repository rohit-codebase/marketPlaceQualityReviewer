const request = require('supertest');

// Mock services to isolate route and middleware testing without database dependencies
jest.mock('../services/reviewService', () => ({
  getHistory: jest.fn().mockResolvedValue({ reviews: [], total: 0, page: 1, limit: 20 }),
  triggerReview: jest.fn().mockResolvedValue({ _id: 'mock-review-id', status: 'completed' }),
  getReviewById: jest.fn().mockResolvedValue({ _id: 'mock-review-id' }),
  getReviewWithActions: jest.fn().mockResolvedValue({ review: { _id: 'mock-review-id' }, actions: [] }),
  recordAction: jest.fn().mockResolvedValue({ _id: 'mock-action-id' }),
}));

jest.mock('../services/batchService', () => ({
  startBatch: jest.fn().mockResolvedValue({ batchId: 'mock-batch-id', itemCount: 1 }),
  getBatchStatus: jest.fn().mockResolvedValue({ batchId: 'mock-batch-id', status: 'completed', items: [] }),
}));

jest.mock('../services/listingService', () => ({
  getAllListings: jest.fn().mockResolvedValue({ listings: [], total: 0 }),
  getListingById: jest.fn().mockResolvedValue({ _id: 'mock-listing-id' }),
  createListing: jest.fn().mockResolvedValue({ _id: 'mock-listing-id' }),
  updateListing: jest.fn().mockResolvedValue({ _id: 'mock-listing-id' }),
  getDashboardStats: jest.fn().mockResolvedValue({ total: 0, pending: 0, approved: 0, rejected: 0 }),
  getRecentReviews: jest.fn().mockResolvedValue([]),
}));

const app = require('../app');

describe('Rate Limiter Route Isolation Regression Tests', () => {
  test('GET /api/reviews/history does NOT consume the reviewTriggerLimiter', async () => {
    // Dispatch 35 requests to /api/reviews/history (which exceeds the 30-req/min reviewTriggerLimiter)
    for (let i = 0; i < 35; i++) {
      const res = await request(app).get('/api/reviews/history');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  test('GET /api/batch-reviews/:batchId does NOT consume the reviewTriggerLimiter (polling is safe)', async () => {
    // Polling status 35 times must not trigger 429
    for (let i = 0; i < 35; i++) {
      const res = await request(app).get('/api/batch-reviews/mock-batch-id');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  test('POST /api/reviews DOES consume reviewTriggerLimiter and throttles when limit is exceeded', async () => {
    let hitRateLimit = false;

    // Send requests until rate limiter is triggered (max: 30)
    for (let i = 0; i < 35; i++) {
      const res = await request(app)
        .post('/api/reviews')
        .send({ listingId: '507f1f77bcf86cd799439011' });

      if (res.status === 429) {
        hitRateLimit = true;
        expect(res.body.error).toContain('Too many review requests');
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
  });
});
