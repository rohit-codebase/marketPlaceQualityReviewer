const marketplacePolicy = require('./data/marketplacePolicy.json');
const brandContentGuide = require('./data/brandContentGuide.json');

// Combine both sources into a single flat array indexed by ID for O(1) lookup.
const allSections = [...marketplacePolicy, ...brandContentGuide];
const sectionMap = new Map(allSections.map((s) => [s.id, s]));

/**
 * Returns all policy sections.
 */
function getAllSections() {
  return allSections;
}

/**
 * Returns a single section by its stable ID (e.g. "POLICY-001").
 * Returns null if not found.
 */
function getSectionById(id) {
  return sectionMap.get(id) || null;
}

/**
 * Returns whether a section ID exists in the knowledge base.
 * Used by the AI output validator to ensure the LLM only cites real IDs.
 */
function sectionExists(id) {
  return sectionMap.has(id);
}

module.exports = { getAllSections, getSectionById, sectionExists };
