const { OpenAI } = require('openai');
const logger = require('../utils/logger');

/**
 * LLM Client — isolated OpenAI / Mock provider wrapper.
 *
 * Requirements:
 * - Uses the installed OpenAI SDK.
 * - Reads API key only from process.env.LLM_API_KEY.
 * - Reads model from process.env.LLM_MODEL || 'gpt-4o'.
 * - Validates provider ('openai' or 'mock').
 * - Timeout: 45000ms (comfortably below frontend 60s timeout).
 * - Handles timeout, auth, rate limit, unavailable, empty, invalid JSON safely.
 * - Never logs or exposes API keys or sensitive credentials.
 */

let openaiClient = null;

function getClient() {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  if (provider !== 'openai' && provider !== 'mock') {
    const err = new Error(
      `Unsupported LLM_PROVIDER: "${process.env.LLM_PROVIDER}". Supported providers are "openai" and "mock".`
    );
    err.code = 'CONFIG_ERROR';
    err.statusCode = 500;
    throw err;
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    const err = new Error('LLM_API_KEY environment variable is not set');
    err.code = 'MISSING_API_KEY';
    err.statusCode = 500;
    throw err;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 45000, // 45 seconds timeout
    });
  }
  return openaiClient;
}

/**
 * High-fidelity deterministic mock reviewer for local development.
 * Evaluates listing text against supplied policy sections without hallucinating text.
 */
function generateMockReview(userMessage, allowedPolicyIds = null) {
  const findings = [];

  // Extract listing fields from userMessage
  let title = '';
  let description = '';
  let category = '';

  const titleMatch = userMessage.match(/"title":\s*"([^"]+)"/i);
  if (titleMatch) title = titleMatch[1];

  const descMatch = userMessage.match(/"description":\s*"([^"]+)"/i);
  if (descMatch) description = descMatch[1];

  const catMatch = userMessage.match(/"category":\s*"([^"]+)"/i);
  if (catMatch) category = catMatch[1];

  // Helper to ensure cited policy is allowed
  const choosePolicy = (preferredId, fallbackId = 'POLICY-001') => {
    if (!allowedPolicyIds || allowedPolicyIds.includes(preferredId)) return preferredId;
    if (allowedPolicyIds.includes(fallbackId)) return fallbackId;
    return allowedPolicyIds[0] || preferredId;
  };

  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  // 1. Superlatives in title (unsubstantiated claims)
  const superlativeRegex = /(100% guaranteed lowest price|guaranteed lowest price|#1|best in the world|world's best|number one)/i;
  const titleSuperlative = title.match(superlativeRegex);
  if (titleSuperlative) {
    findings.push({
      field: 'title',
      type: 'misleading_claim',
      severity: 'high',
      issue: 'Unsubstantiated superlative claim',
      explanation: `Title includes "${titleSuperlative[0]}", which violates listing guidelines without independent verification.`,
      policySection: choosePolicy('POLICY-001', 'BRAND-001'),
      originalText: titleSuperlative[0],
      suggestedText: title.replace(superlativeRegex, 'Quality').trim(),
      confidence: 0.95,
    });
  }

  // 2. Prohibited medical / clinical / cure claims in description
  const medicalRegex = /(clinically proven to improve|clinically proven|scientifically proven|anti-aging|erases wrinkles|outperforms all competitors|cure|cures)/i;
  const descMedical = description.match(medicalRegex);
  if (descMedical) {
    findings.push({
      field: 'description',
      type: 'prohibited_content',
      severity: 'high',
      issue: 'Unverified medical/clinical claim',
      explanation: `Description contains absolute claim "${descMedical[0]}" without documented scientific certification.`,
      policySection: choosePolicy('POLICY-001', 'POLICY-002'),
      originalText: descMedical[0],
      suggestedText: 'designed to support daily care',
      confidence: 0.92,
    });
  }

  // 3. Exaggerated hype or artificial urgency in description
  const hypeRegex = /(act now|once in a lifetime|unlimited performance|zero lag|revolutionary|mind-blowing)/i;
  const descHype = description.match(hypeRegex);
  if (descHype) {
    findings.push({
      field: 'description',
      type: 'brand_violation',
      severity: 'medium',
      issue: 'Exaggerated hype language',
      explanation: `Phrasing "${descHype[0]}" introduces artificial urgency or hyperbolic marketing language prohibited by brand standards.`,
      policySection: choosePolicy('BRAND-004', 'BRAND-003'),
      originalText: descHype[0],
      suggestedText: 'reliable performance and consistent responsiveness',
      confidence: 0.88,
    });
  }

  // 4. Incomplete description check (< 50 characters)
  if (description.length > 0 && description.length < 50) {
    findings.push({
      field: 'description',
      type: 'incomplete_content',
      severity: 'medium',
      issue: 'Description below minimum length standards',
      explanation: 'Description is too brief to provide buyers with key specifications and feature details.',
      policySection: choosePolicy('BRAND-002', 'POLICY-003'),
      originalText: description,
      suggestedText: `${description} Includes standard manufacturer specifications, durable construction, and reliable quality for regular use.`,
      confidence: 0.9,
    });
  }

  // Determine authoritative overallStatus
  const hasHigh = findings.some((f) => f.severity === 'high');
  const hasMedium = findings.some((f) => f.severity === 'medium');
  const overallStatus = hasHigh ? 'fail' : hasMedium ? 'review' : 'pass';

  let summary = '';
  if (overallStatus === 'fail') {
    summary = `The listing contains ${findings.length} policy violation(s), including high-severity unsubstantiated claims.`;
  } else if (overallStatus === 'review') {
    summary = `The listing requires review to align with brand tone and completeness standards.`;
  } else {
    summary = 'The listing is clear, factual, and fully complies with marketplace policy and brand content guidelines.';
  }

  return {
    summary,
    overallStatus,
    findings,
    assumptions: [
      'Reviewed using local mock validation engine.',
      'Factual specifications are assumed to represent standard manufacturer baseline.',
    ],
  };
}

/**
 * Calls OpenAI chat completions with structured JSON response format.
 * Falls back to high-fidelity mock reviewer if LLM_API_KEY is not set or LLM_PROVIDER is mock.
 *
 * @param {string} systemPrompt     - System role and instruction prompt.
 * @param {string} userMessage      - Listing and policy context.
 * @param {string} requestId        - Request ID for structured logging.
 * @param {string[]} allowedPolicyIds - Array of policy IDs provided to model.
 * @returns {Promise<object>}       - Parsed JSON object from model.
 */
async function callLLM(systemPrompt, userMessage, requestId, allowedPolicyIds = null) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  // Validate provider configuration
  if (provider !== 'openai' && provider !== 'mock') {
    const configError = new Error(
      `Unsupported LLM_PROVIDER: "${process.env.LLM_PROVIDER}". Supported providers are "openai" and "mock".`
    );
    configError.code = 'CONFIG_ERROR';
    throw configError;
  }

  const model = process.env.LLM_MODEL || 'gpt-4o';
  const apiKey = process.env.LLM_API_KEY;
  const isMock = provider === 'mock' || !apiKey;

  const startTime = Date.now();
  logger.info({
    operation: 'llm_call_start',
    requestId,
    model: isMock ? 'mock-reviewer' : model,
    provider: isMock ? 'mock' : 'openai',
  });

  // 1. Mock Mode Fallback
  if (isMock) {
    const mockOutput = generateMockReview(userMessage, allowedPolicyIds);
    const duration = Date.now() - startTime;
    logger.info({
      operation: 'llm_call_success',
      requestId,
      model: 'mock-reviewer',
      durationMs: duration,
      findingsCount: mockOutput.findings.length,
    });
    return mockOutput;
  }

  // 2. Live OpenAI Call
  const client = getClient();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000,
    });

    const duration = Date.now() - startTime;
    const rawContent = response.choices?.[0]?.message?.content;

    if (!rawContent || rawContent.trim() === '') {
      const emptyErr = new Error('AI provider returned an empty response.');
      emptyErr.code = 'LLM_EMPTY_RESPONSE';
      throw emptyErr;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const jsonErr = new Error('AI provider returned a malformed JSON response.');
      jsonErr.code = 'LLM_INVALID_JSON';
      throw jsonErr;
    }

    logger.info({
      operation: 'llm_call_success',
      requestId,
      model,
      durationMs: duration,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    });

    return parsed;
  } catch (err) {
    const duration = Date.now() - startTime;

    // Map OpenAI SDK errors to clear internal error codes
    let safeMessage = err.message || 'AI review request failed';
    let errorCode = err.code || 'LLM_ERROR';

    if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT') {
      safeMessage = 'AI review timed out. The model did not respond within the allocated time.';
      errorCode = 'LLM_TIMEOUT';
    } else if (err.status === 401 || err.name === 'AuthenticationError') {
      safeMessage = 'Authentication failed with OpenAI. Please verify LLM_API_KEY in .env.';
      errorCode = 'LLM_AUTH_ERROR';
    } else if (err.status === 429 || err.name === 'RateLimitError') {
      safeMessage = 'OpenAI rate limit exceeded. Please wait a moment before trying again.';
      errorCode = 'LLM_RATE_LIMIT';
    } else if (err.status === 503 || err.name === 'APIConnectionError') {
      safeMessage = 'AI review service is temporarily unreachable. Please try again later.';
      errorCode = 'LLM_SERVICE_UNAVAILABLE';
    }

    logger.error({
      operation: 'llm_call_failed',
      requestId,
      model,
      durationMs: duration,
      errorCode,
      error: safeMessage,
    });

    const standardizedError = new Error(safeMessage);
    standardizedError.code = errorCode;
    throw standardizedError;
  }
}

module.exports = { callLLM, generateMockReview };
