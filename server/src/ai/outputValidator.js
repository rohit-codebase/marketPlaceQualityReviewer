const { sectionExists } = require('../policies/policyStore');

/**
 * AI Output Validator
 *
 * Validates the structured JSON returned by the LLM before storing or displaying.
 *
 * Requirements:
 * 1. Validates schema and value constraints.
 * 2. Enforces required policySection on every AI finding.
 * 3. Enforces that policySection is one of the policy IDs supplied to the model (allowedPolicyIds).
 * 4. Verifies originalText corresponds to actual text in the listing field.
 * 5. Authoritatively enforces overallStatus logic server-side:
 *    - Any high severity -> 'fail'
 *    - Any medium severity (no high) -> 'review'
 *    - Only low or no findings -> 'pass'
 */

const VALID_STATUSES = ['pass', 'review', 'fail'];
const VALID_SEVERITIES = ['low', 'medium', 'high'];
const VALID_FINDING_TYPES = [
  'misleading_claim',
  'prohibited_content',
  'incomplete_content',
  'unclear_content',
  'unverifiable_claim',
  'brand_violation',
  'comparative_claim',
  'other',
];
const VALID_FIELDS = [
  'title',
  'description',
  'price',
  'category',
  'attributes',
  'seller',
  'tags',
  'listing',
];

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function validateAIOutput(raw, allowedPolicyIds = null, listing = null) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Response is not a valid JSON object'] };
  }

  // 1. summary
  if (typeof raw.summary !== 'string' || raw.summary.trim() === '') {
    errors.push('Missing or empty "summary"');
  }

  // 2. overallStatus
  if (!VALID_STATUSES.includes(raw.overallStatus)) {
    errors.push(
      `Invalid "overallStatus": "${raw.overallStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  // 3. findings
  if (!Array.isArray(raw.findings)) {
    errors.push('"findings" must be an array');
  } else {
    raw.findings.forEach((finding, i) => {
      const prefix = `findings[${i}]`;

      if (!finding || typeof finding !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }

      // field
      if (!VALID_FIELDS.includes(finding.field)) {
        errors.push(
          `${prefix}.field "${finding.field}" is not valid. Must be one of: ${VALID_FIELDS.join(', ')}`
        );
      }

      // type
      if (!VALID_FINDING_TYPES.includes(finding.type)) {
        errors.push(
          `${prefix}.type "${finding.type}" is not valid. Must be one of: ${VALID_FINDING_TYPES.join(', ')}`
        );
      }

      // severity
      if (!VALID_SEVERITIES.includes(finding.severity)) {
        errors.push(
          `${prefix}.severity "${finding.severity}" must be low, medium, or high`
        );
      }

      // issue
      if (typeof finding.issue !== 'string' || finding.issue.trim() === '') {
        errors.push(`${prefix}.issue is missing or empty`);
      }

      // policySection is MANDATORY
      if (!finding.policySection || typeof finding.policySection !== 'string' || finding.policySection.trim() === '') {
        errors.push(`${prefix}.policySection is required for every AI finding`);
      } else {
        const citedId = finding.policySection.trim();

        // Must exist in knowledge base
        if (!sectionExists(citedId)) {
          errors.push(
            `${prefix}.policySection "${citedId}" does not exist in the policy knowledge base`
          );
        }

        // Must be in the allowedPolicyIds provided to the model (if specified)
        if (allowedPolicyIds && Array.isArray(allowedPolicyIds) && !allowedPolicyIds.includes(citedId)) {
          errors.push(
            `${prefix}.policySection "${citedId}" was not in the policy context supplied to the reviewer`
          );
        }
      }

      // confidence
      if (
        finding.confidence !== undefined &&
        finding.confidence !== null &&
        (typeof finding.confidence !== 'number' ||
          isNaN(finding.confidence) ||
          finding.confidence < 0 ||
          finding.confidence > 1)
      ) {
        errors.push(`${prefix}.confidence must be a number between 0 and 1`);
      }

      // originalText verification against listing content
      if (listing && finding.originalText && typeof finding.originalText === 'string') {
        const needle = normalize(finding.originalText);
        if (needle.length > 0) {
          let fieldContent = '';
          if (finding.field === 'title') {
            fieldContent = normalize(listing.title);
          } else if (finding.field === 'description') {
            fieldContent = normalize(listing.description);
          } else if (finding.field === 'tags') {
            fieldContent = normalize(Array.isArray(listing.tags) ? listing.tags.join(' ') : listing.tags);
          } else if (finding.field === 'seller') {
            fieldContent = normalize(`${listing.seller?.name || ''} ${listing.seller?.contact || ''}`);
          } else if (finding.field === 'price') {
            fieldContent = normalize(String(listing.price));
          } else if (finding.field === 'category') {
            fieldContent = normalize(listing.category);
          } else if (finding.field === 'attributes') {
            const attrObj = listing.attributes instanceof Map ? Object.fromEntries(listing.attributes) : (listing.attributes || {});
            fieldContent = normalize(JSON.stringify(attrObj));
          } else {
            // General listing field
            fieldContent = normalize(`${listing.title || ''} ${listing.description || ''}`);
          }

          // If fabricated text that doesn't exist in the field, sanitize or flag
          if (!fieldContent.includes(needle)) {
            // Sanitize to avoid presenting fabricated quoted text in UI
            finding.originalText = null;
          }
        }
      }
    });
  }

  // assumptions
  if (raw.assumptions !== undefined && !Array.isArray(raw.assumptions)) {
    errors.push('"assumptions" must be an array of strings');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Authoritative server-side status correction
  const findingsList = raw.findings || [];
  const hasHigh = findingsList.some((f) => f.severity === 'high');
  const hasMedium = findingsList.some((f) => f.severity === 'medium');

  let authoritativeStatus = 'pass';
  if (hasHigh) {
    authoritativeStatus = 'fail';
  } else if (hasMedium) {
    authoritativeStatus = 'review';
  } else {
    authoritativeStatus = 'pass';
  }

  return {
    valid: true,
    data: {
      summary: raw.summary.trim(),
      overallStatus: authoritativeStatus, // Backend is authoritative
      findings: findingsList.map((f) => ({
        ...f,
        policySection: f.policySection ? f.policySection.trim() : null,
        source: 'ai',
      })),
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
    },
  };
}

module.exports = { validateAIOutput };
