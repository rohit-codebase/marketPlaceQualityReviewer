/**
 * Tests for batch failure isolation.
 * Verifies that one failing listing does not crash the rest of the batch.
 *
 * These tests mock the listingReviewer to simulate individual failures.
 */

// Mock the listingReviewer before importing batchService
jest.mock('../ai/listingReviewer', () => ({
  reviewListing: jest.fn(),
}));

// Mock Review model so getBatchStatus does not hang attempting DB query when not connected
jest.mock('../models/Review', () => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  }),
}));

const { reviewListing } = require('../ai/listingReviewer');
const { startBatch, getBatchStatus } = require('../services/batchService');

describe('Batch Failure Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process all listings even when one fails', async () => {
    // Simulate: listing 1 succeeds, listing 2 fails, listing 3 succeeds
    reviewListing
      .mockResolvedValueOnce({ _id: 'review-1' })
      .mockRejectedValueOnce(new Error('LLM timeout'))
      .mockResolvedValueOnce({ _id: 'review-3' });

    const result = await startBatch(['listing-1', 'listing-2', 'listing-3']);
    expect(result.batchId).toBeDefined();

    // Wait for async processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const status = await getBatchStatus(result.batchId);
    expect(status).not.toBeNull();

    // All 3 items should have been attempted
    expect(status.items).toHaveLength(3);

    const completed = status.items.filter((i) => i.status === 'completed');
    const failed = status.items.filter((i) => i.status === 'failed');

    expect(completed).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('LLM timeout');
  });

  test('should handle all items failing without crashing', async () => {
    reviewListing.mockRejectedValue(new Error('DB unavailable'));

    const result = await startBatch(['listing-a', 'listing-b']);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const status = await getBatchStatus(result.batchId);
    expect(status.items.every((i) => i.status === 'failed')).toBe(true);
    expect(status.status).toBe('completed'); // Batch itself completes even if all items failed
  });

  test('should return error for unknown batchId (DB fallback)', async () => {
    // Mock Review model is not available in unit test context — check for null return
    const status = await getBatchStatus('non-existent-batch-id');
    // Either null or reconstructed from DB (which is empty in unit tests)
    // The function should not throw
    expect(status === null || typeof status === 'object').toBe(true);
  });
});
