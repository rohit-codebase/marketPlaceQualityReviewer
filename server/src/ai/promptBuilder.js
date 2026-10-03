/**
 * Prompt Builder
 *
 * Constructs the system prompt and user message sent to the LLM.
 *
 * Design principles:
 * - System prompt defines the reviewer role and strict output format.
 * - User message contains the listing data and relevant policy sections only.
 * - The LLM is told to cite ONLY the provided policy IDs.
 * - The LLM is told to extract exact substrings for originalText without fabricating text.
 * - The LLM is told to separate verified observations from assumptions.
 */

const SYSTEM_PROMPT = `You are a marketplace listing quality reviewer. Your job is to evaluate product and service listings against the provided policy and brand content guidelines.

CRITICAL RULES:
1. Only evaluate the listing against the EXACT policy sections provided to you.
2. Every finding MUST cite a policySection ID. You may cite ONLY policy IDs included in the provided policy context. Never invent a policy ID. Never cite a policy section that was not provided.
3. originalText MUST be an exact substring extracted directly from the listing field (or null if not applicable). Never invent or hallucinate text that is not in the listing.
4. Separate what you can observe in the listing text from what you are assuming. Use the "assumptions" array for unverifiable external facts.
5. Do NOT invent product specifications or claim external verification you don't have.
6. When suggesting revised text, preserve all factual information from the original. Only change what violates policy.
7. Assign severity consistently: high = clear policy violation or prohibited content, medium = likely issue or incomplete information, low = style/tone suggestion.
8. Return ONLY a valid JSON object matching the schema below. No preamble, no explanation outside the JSON.

OUTPUT SCHEMA (return exactly this structure):
{
  "summary": "A 2-3 sentence overall assessment.",
  "overallStatus": "pass | review | fail",
  "findings": [
    {
      "field": "title | description | price | category | attributes | seller | tags | listing",
      "type": "misleading_claim | prohibited_content | incomplete_content | unclear_content | unverifiable_claim | brand_violation | comparative_claim | other",
      "severity": "low | medium | high",
      "issue": "Short issue label (max 10 words)",
      "explanation": "Clear explanation of why this is an issue.",
      "policySection": "POLICY-XXX or BRAND-XXX (REQUIRED - MUST match one of the provided policy IDs)",
      "originalText": "Exact substring from the listing field (if applicable)",
      "suggestedText": "A minimal, policy-compliant revision (if applicable)",
      "confidence": 0.95
    }
  ],
  "assumptions": [
    "A statement of something you assumed or could not verify from the listing text alone."
  ]
}

SEVERITY GUIDELINES:
- "fail" overall status: one or more high-severity findings.
- "review" overall status: one or more medium-severity findings, no high.
- "pass" overall status: only low-severity findings or no findings.

If the listing is clean, return findings: [] and overallStatus: "pass".`;

/**
 * Builds the user message containing the listing and policy context.
 *
 * @param {object} listing      - The listing object.
 * @param {Array}  sections     - Retrieved policy sections to include.
 * @returns {string}            - The formatted user message string.
 */
function buildUserMessage(listing, sections) {
  const allowedIds = sections.map((s) => s.id).join(', ');

  const listingData = {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    price: listing.price,
    attributes: listing.attributes instanceof Map ? Object.fromEntries(listing.attributes) : (listing.attributes || {}),
    seller: {
      name: listing.seller?.name || '',
      contact: listing.seller?.contact || '',
    },
    tags: listing.tags || [],
  };

  const policyContext = sections
    .map((s) => `[ID: ${s.id}] ${s.title} (${s.category})\n${s.content}`)
    .join('\n\n---\n\n');

  return `ALLOWED POLICY IDS FOR CITATION:
[${allowedIds}]
Note: You may cite ONLY from the above list of policy IDs in your findings.

LISTING TO REVIEW:
${JSON.stringify(listingData, null, 2)}

RELEVANT POLICY SECTIONS:
${policyContext}

Please review the listing against these policy sections and return ONLY the JSON object.`;
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };
