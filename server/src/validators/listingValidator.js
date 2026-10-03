const crypto = require('crypto');
const { SUPPORTED_CATEGORIES } = require('../config/categories');

// ----- Constants -----
const TITLE_MIN = 10;
const TITLE_MAX = 200;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 5000;
const PRICE_MIN = 0.01;

/**
 * Deterministic Listing Validator
 *
 * Runs all rule-based checks independently of the LLM.
 * Returns an array of finding objects. An empty array means the listing passed all checks.
 *
 * Each finding has:
 *   { source, field, type, severity, code, issue, explanation }
 *
 * How this is used:
 *   1. Called before the AI step in the review workflow.
 *   2. High-severity findings (required fields, invalid price) are blocking.
 *   3. Results are stored in Review.deterministicFindings.
 */

function validateListing(listing, { checkDuplicate = false, existingHash = null } = {}) {
  const findings = [];

  // --- Required field checks ---
  if (!listing.title || listing.title.trim() === '') {
    findings.push(makeFinding('high', 'title', 'MISSING_TITLE', 'required_field', 'Title is required.'));
  }

  if (!listing.description || listing.description.trim() === '') {
    findings.push(makeFinding('high', 'description', 'MISSING_DESCRIPTION', 'required_field', 'Description is required.'));
  }

  if (!listing.category || listing.category.trim() === '') {
    findings.push(makeFinding('high', 'category', 'MISSING_CATEGORY', 'required_field', 'Category is required.'));
  }

  if (listing.price === undefined || listing.price === null || listing.price === '') {
    findings.push(makeFinding('high', 'price', 'MISSING_PRICE', 'required_field', 'Price is required.'));
  }

  if (!listing.seller || !listing.seller.name || listing.seller.name.trim() === '') {
    findings.push(makeFinding('high', 'seller', 'MISSING_SELLER_NAME', 'required_field', 'Seller name is required.', 'POLICY-006'));
  }

  // --- Title length ---
  if (listing.title && listing.title.trim() !== '') {
    const len = listing.title.trim().length;
    if (len < TITLE_MIN) {
      findings.push(makeFinding('medium', 'title', 'TITLE_TOO_SHORT', 'length_violation',
        `Title must be at least ${TITLE_MIN} characters (currently ${len}).`));
    } else if (len > TITLE_MAX) {
      findings.push(makeFinding('medium', 'title', 'TITLE_TOO_LONG', 'length_violation',
        `Title must not exceed ${TITLE_MAX} characters (currently ${len}).`, 'BRAND-001'));
    }
  }

  // --- Description length ---
  if (listing.description && listing.description.trim() !== '') {
    const len = listing.description.trim().length;
    if (len < DESCRIPTION_MIN) {
      findings.push(makeFinding('medium', 'description', 'DESCRIPTION_TOO_SHORT', 'length_violation',
        `Description must be at least ${DESCRIPTION_MIN} characters (currently ${len}).`, 'BRAND-002'));
    } else if (len > DESCRIPTION_MAX) {
      findings.push(makeFinding('low', 'description', 'DESCRIPTION_TOO_LONG', 'length_violation',
        `Description exceeds ${DESCRIPTION_MAX} characters (currently ${len}).`));
    }
  }

  // --- Price validation ---
  if (listing.price !== undefined && listing.price !== null && listing.price !== '') {
    const priceNum = Number(listing.price);
    if (isNaN(priceNum)) {
      findings.push(makeFinding('high', 'price', 'INVALID_PRICE_FORMAT', 'invalid_format',
        'Price must be a numeric value.', 'POLICY-007'));
    } else if (priceNum <= 0) {
      findings.push(makeFinding('high', 'price', 'INVALID_PRICE_NON_POSITIVE', 'invalid_value',
        `Price must be greater than zero (received: ${priceNum}).`, 'POLICY-007'));
    } else if (priceNum < PRICE_MIN) {
      findings.push(makeFinding('medium', 'price', 'PRICE_TOO_LOW', 'invalid_value',
        `Price must be at least ${PRICE_MIN} (received: ${priceNum}).`, 'POLICY-007'));
    }
  }

  // --- Category validation ---
  if (listing.category && !SUPPORTED_CATEGORIES.includes(listing.category)) {
    findings.push(makeFinding('high', 'category', 'UNSUPPORTED_CATEGORY', 'invalid_value',
      `Category '${listing.category}' is not supported. Supported categories: ${SUPPORTED_CATEGORIES.join(', ')}.`));
  }

  // --- Attributes validation ---
  if (listing.attributes) {
    const attrEntries = listing.attributes instanceof Map
      ? [...listing.attributes.entries()]
      : Object.entries(listing.attributes);

    for (const [key, value] of attrEntries) {
      if (typeof key !== 'string' || key.trim() === '') {
        findings.push(makeFinding('low', 'attributes', 'INVALID_ATTRIBUTE_KEY', 'invalid_format',
          'Attribute keys must be non-empty strings.', 'BRAND-005'));
        break;
      }
      if (value !== null && value !== undefined && typeof value !== 'string') {
        findings.push(makeFinding('low', 'attributes', 'INVALID_ATTRIBUTE_VALUE', 'invalid_format',
          `Attribute '${key}' must have a string value.`, 'BRAND-005'));
      }
    }
  }

  // --- Duplicate detection ---
  // If checkDuplicate is true and a hash matching an existing listing was provided,
  // this listing is a near-exact duplicate.
  if (checkDuplicate && existingHash) {
    findings.push(makeFinding('high', 'listing', 'DUPLICATE_LISTING', 'duplicate',
      'A listing with identical or near-identical content already exists. Duplicate listings are not permitted.'));
  }

  return findings;
}

/**
 * Computes a SHA-256 content hash from normalised listing fields.
 *
 * Duplicate detection strategy:
 *   - Normalize: lowercase, collapse whitespace, trim.
 *   - Hash fields: title + description + category + seller.name.
 *   - Two listings are duplicates if their content hash matches.
 *   - This catches exact duplicates and minor whitespace/capitalisation variants.
 *   - Does NOT catch paraphrase duplicates (that would require ML; out of scope).
 */
function computeContentHash(listing) {
  const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const raw = [
    normalize(listing.title),
    normalize(listing.description),
    normalize(listing.category),
    normalize(listing.seller?.name),
  ].join('||');

  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Helper: Creates a finding object with consistent shape.
 */
function makeFinding(severity, field, code, type, issue, policySection = null) {
  return {
    source: 'deterministic',
    field,
    type,
    severity,
    code,
    issue,
    explanation: issue,
    ...(policySection ? { policySection } : {}),
  };
}

module.exports = { validateListing, computeContentHash };
