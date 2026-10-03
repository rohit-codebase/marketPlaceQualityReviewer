const { validateListing, computeContentHash } = require('../validators/listingValidator');

/**
 * Tests for the deterministic listing validator.
 * These are pure function tests — no DB or LLM needed.
 */

// A valid baseline listing to mutate in each test
const validListing = {
  title: 'Sony WH-1000XM5 Wireless Headphones',
  description: 'Industry-leading noise cancellation headphones with 30-hour battery life and multipoint Bluetooth connection.',
  category: 'Electronics',
  price: 349.99,
  attributes: { color: 'Black', connectivity: 'Bluetooth 5.2' },
  seller: { name: 'TechStore Pro', contact: 'contact@techstore.com' },
  tags: ['headphones', 'wireless'],
};

describe('Deterministic Listing Validator', () => {
  // ---- Required fields ----
  test('should pass for a valid listing', () => {
    const findings = validateListing(validListing);
    const highFindings = findings.filter((f) => f.severity === 'high');
    expect(highFindings).toHaveLength(0);
  });

  test('should fail when title is missing', () => {
    const findings = validateListing({ ...validListing, title: '' });
    expect(findings.some((f) => f.code === 'MISSING_TITLE')).toBe(true);
  });

  test('should fail when description is missing', () => {
    const findings = validateListing({ ...validListing, description: '' });
    expect(findings.some((f) => f.code === 'MISSING_DESCRIPTION')).toBe(true);
  });

  test('should fail when seller name is missing', () => {
    const findings = validateListing({ ...validListing, seller: { name: '' } });
    expect(findings.some((f) => f.code === 'MISSING_SELLER_NAME')).toBe(true);
  });

  // ---- Price validation ----
  test('should fail for non-numeric price', () => {
    const findings = validateListing({ ...validListing, price: 'free' });
    expect(findings.some((f) => f.code === 'INVALID_PRICE_FORMAT')).toBe(true);
  });

  test('should fail for zero price', () => {
    const findings = validateListing({ ...validListing, price: 0 });
    expect(findings.some((f) => f.code === 'INVALID_PRICE_NON_POSITIVE')).toBe(true);
  });

  test('should fail for negative price', () => {
    const findings = validateListing({ ...validListing, price: -10 });
    expect(findings.some((f) => f.code === 'INVALID_PRICE_NON_POSITIVE')).toBe(true);
  });

  test('should pass for valid positive price', () => {
    const findings = validateListing({ ...validListing, price: 0.01 });
    expect(findings.some((f) => f.field === 'price' && f.severity === 'high')).toBe(false);
  });

  // ---- Category validation ----
  test('should fail for unsupported category', () => {
    const findings = validateListing({ ...validListing, category: 'Weapons' });
    expect(findings.some((f) => f.code === 'UNSUPPORTED_CATEGORY')).toBe(true);
  });

  test('should pass for supported category', () => {
    const findings = validateListing({ ...validListing, category: 'Electronics' });
    expect(findings.some((f) => f.code === 'UNSUPPORTED_CATEGORY')).toBe(false);
  });

  // ---- Title length ----
  test('should flag title shorter than minimum', () => {
    const findings = validateListing({ ...validListing, title: 'Short' });
    expect(findings.some((f) => f.code === 'TITLE_TOO_SHORT')).toBe(true);
  });

  test('should flag title longer than maximum', () => {
    const findings = validateListing({ ...validListing, title: 'A'.repeat(201) });
    expect(findings.some((f) => f.code === 'TITLE_TOO_LONG')).toBe(true);
  });

  // ---- Description length ----
  test('should flag description shorter than minimum', () => {
    const findings = validateListing({ ...validListing, description: 'Short desc' });
    expect(findings.some((f) => f.code === 'DESCRIPTION_TOO_SHORT')).toBe(true);
  });

  // ---- Duplicate detection ----
  test('should flag duplicate when hash is provided', () => {
    const findings = validateListing(validListing, {
      checkDuplicate: true,
      existingHash: 'somehash',
    });
    expect(findings.some((f) => f.code === 'DUPLICATE_LISTING')).toBe(true);
  });

  test('should not flag duplicate when no existing hash is given', () => {
    const findings = validateListing(validListing, { checkDuplicate: false });
    expect(findings.some((f) => f.code === 'DUPLICATE_LISTING')).toBe(false);
  });

  // ---- Content hash ----
  test('computeContentHash should produce same hash for equivalent listings', () => {
    const listing1 = { ...validListing, title: '  Sony WH-1000XM5  ' };
    const listing2 = { ...validListing, title: 'sony wh-1000xm5' };
    expect(computeContentHash(listing1)).toBe(computeContentHash(listing2));
  });

  test('computeContentHash should produce different hashes for different listings', () => {
    const listing1 = { ...validListing, title: 'Product A' };
    const listing2 = { ...validListing, title: 'Product B' };
    expect(computeContentHash(listing1)).not.toBe(computeContentHash(listing2));
  });
});
