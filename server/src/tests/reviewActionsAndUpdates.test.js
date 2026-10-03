const { updateListing } = require('../services/listingService');
const { recordAction } = require('../services/reviewService');
const Listing = require('../models/Listing');
const Review = require('../models/Review');
const ReviewAction = require('../models/ReviewAction');

jest.mock('../models/Listing');
jest.mock('../models/Review');
jest.mock('../models/ReviewAction');

describe('Listing Updates and Review Action Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateListing() partial updates & hash recomputation', () => {
    test('partial update should preserve untouched fields and recompute hash', async () => {
      const mockListing = {
        _id: 'listing-123',
        title: 'Original Title',
        description: 'Original Description',
        category: 'Electronics',
        price: 100,
        seller: { name: 'Seller A', contact: 'a@test.com' },
        tags: ['gadgets'],
        contentHash: 'old-hash',
        toObject() {
          return {
            title: this.title,
            description: this.description,
            category: this.category,
            price: this.price,
            seller: this.seller,
            tags: this.tags,
            contentHash: this.contentHash,
          };
        },
        save: jest.fn().mockResolvedValue(true),
      };

      Listing.findById.mockResolvedValue(mockListing);
      Listing.findOne.mockResolvedValue(null); // No duplicate

      const updated = await updateListing('listing-123', { title: 'Updated Title' });

      expect(updated.title).toBe('Updated Title');
      // Untouched fields must be preserved
      expect(updated.description).toBe('Original Description');
      expect(updated.price).toBe(100);
      expect(mockListing.save).toHaveBeenCalled();
    });

    test('update resulting in duplicate hash should throw 409 error', async () => {
      const mockListing = {
        _id: 'listing-123',
        title: 'Title',
        description: 'Desc',
        category: 'Electronics',
        seller: { name: 'Seller' },
        toObject() {
          return { title: this.title, description: this.description, category: this.category, seller: this.seller };
        },
        save: jest.fn(),
      };

      Listing.findById.mockResolvedValue(mockListing);
      // Simulate another listing having this content hash
      Listing.findOne.mockResolvedValue({ _id: 'other-listing-456' });

      await expect(
        updateListing('listing-123', { title: 'Duplicate Title' })
      ).rejects.toThrow('Another listing with identical content already exists.');
    });
  });

  describe('recordAction() security and field whitelisting', () => {
    test('should reject invalid action not in [approve, edit, reject]', async () => {
      await expect(
        recordAction('review-1', {
          field: 'title',
          findingIndex: 0,
          action: 'delete_database',
        })
      ).rejects.toThrow('Invalid action');
    });

    test('should reject forbidden fields like __proto__ or contentHash', async () => {
      await expect(
        recordAction('review-1', {
          field: '__proto__',
          findingIndex: 0,
          action: 'approve',
          finalValue: 'hacked',
        })
      ).rejects.toThrow('Invalid field');

      await expect(
        recordAction('review-1', {
          field: 'contentHash',
          findingIndex: 0,
          action: 'approve',
          finalValue: 'manual-hash',
        })
      ).rejects.toThrow('Invalid field');
    });

    test('should reject negative finding index', async () => {
      await expect(
        recordAction('review-1', {
          field: 'title',
          findingIndex: -1,
          action: 'approve',
          finalValue: 'New',
        })
      ).rejects.toThrow('non-negative integer');
    });

    test('should record approved action and safely update listing field', async () => {
      const mockReview = {
        _id: 'review-1',
        listingId: 'listing-1',
      };
      const mockListing = {
        _id: 'listing-1',
        title: 'Old Title',
        description: 'Desc',
        category: 'Electronics',
        seller: { name: 'Seller' },
        toObject() {
          return { title: this.title, description: this.description, category: this.category, seller: this.seller };
        },
        save: jest.fn().mockResolvedValue(true),
      };

      Review.findById.mockResolvedValue(mockReview);
      Listing.findById.mockResolvedValue(mockListing);
      ReviewAction.prototype.save = jest.fn().mockResolvedValue(true);

      const action = await recordAction('review-1', {
        field: 'title',
        findingIndex: 0,
        source: 'ai',
        action: 'approve',
        finalValue: 'Approved Safe Title',
      });

      expect(action).toBeDefined();
      expect(mockListing.title).toBe('Approved Safe Title');
      expect(mockListing.save).toHaveBeenCalled();
    });
  });
});
