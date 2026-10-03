const { getAllSections } = require('./policyStore');

/**
 * Policy Retriever — Keyword + Category Based
 *
 * Strategy:
 * 1. Always include category-specific sections that match the listing's category.
 * 2. Score every policy section by counting keyword matches against the listing text.
 * 3. Return all sections with at least one match, sorted by score descending.
 * 4. Always include a minimum set of baseline sections (brand tone, required info).
 *
 * This approach is deterministic and explainable — no vector DB needed.
 * Max sections returned: 8 (to keep AI prompt manageable).
 */
const MAX_SECTIONS = 8;

// Sections always included as a baseline regardless of keyword matches.
const BASELINE_SECTION_IDS = ['POLICY-010', 'POLICY-011', 'BRAND-001', 'BRAND-002'];

function retrieveRelevantSections(listing) {
  const allSections = getAllSections();

  // Build a single string of listing text for keyword matching.
  const listingText = [
    listing.title,
    listing.description,
    listing.category,
    ...(listing.tags || []),
    ...Object.values(listing.attributes || {}),
  ]
    .join(' ')
    .toLowerCase();

  const scored = allSections.map((section) => {
    let score = 0;

    // Boost for category-specific sections that match this listing's category.
    if (
      section.appliesTo &&
      section.appliesTo.includes(listing.category)
    ) {
      score += 10;
    }

    // Score by keyword matches in the listing text.
    const keywords = section.keywords || [];
    for (const keyword of keywords) {
      if (listingText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Baseline sections always get a minimum score.
    if (BASELINE_SECTION_IDS.includes(section.id)) {
      score = Math.max(score, 1);
    }

    return { section, score };
  });

  // Filter to only sections with a score, sort by score desc, cap at MAX_SECTIONS.
  const relevant = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SECTIONS)
    .map((s) => s.section);

  return relevant;
}

module.exports = { retrieveRelevantSections };
