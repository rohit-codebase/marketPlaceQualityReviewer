const { callLLM, generateMockReview } = require('../ai/llmClient');

describe('LLM Client and Mock Reviewer Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should return configuration error when LLM_PROVIDER is unsupported', async () => {
    process.env.LLM_PROVIDER = 'unsupported_provider';

    await expect(
      callLLM('system', 'user message', 'req-1', ['POLICY-001'])
    ).rejects.toThrow('Unsupported LLM_PROVIDER');
  });

  test('should run high-fidelity mock reviewer when LLM_PROVIDER is mock or API key is absent', async () => {
    process.env.LLM_PROVIDER = 'mock';
    delete process.env.LLM_API_KEY;

    const userMessage = JSON.stringify({
      title: 'Best Phone Ever — 100% Guaranteed Lowest Price in the Market',
      description: 'Clinically proven to improve productivity. Once in a lifetime deal — act now.',
      category: 'Electronics',
    });

    const result = await callLLM('system', userMessage, 'req-2', ['POLICY-001', 'BRAND-004']);
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.overallStatus).toBe('fail'); // Superlative triggers high severity fail
    expect(result.findings.length).toBeGreaterThan(0);
    // Findings cite provided policy IDs
    expect(result.findings.every((f) => ['POLICY-001', 'BRAND-004'].includes(f.policySection))).toBe(true);
  });

  test('mock reviewer should return pass status for clean listing without violations', () => {
    const cleanUserMessage = JSON.stringify({
      title: 'Sony Wireless Headphones',
      description: 'Standard noise cancelling wireless headphones with 30 hour battery life and comfortable fit.',
      category: 'Electronics',
    });

    const result = generateMockReview(cleanUserMessage, ['POLICY-001']);
    expect(result.overallStatus).toBe('pass');
    expect(result.findings).toHaveLength(0);
  });

  test('mock reviewer should not fabricate originalText that is not in listing', () => {
    const listingMsg = JSON.stringify({
      title: 'Running Shoes with #1 Cushioning',
      description: 'Comfortable road running shoes with breathable mesh and responsive foam.',
      category: 'Sports',
    });

    const result = generateMockReview(listingMsg, ['POLICY-001']);
    expect(result.findings.length).toBeGreaterThan(0);
    const titleFinding = result.findings.find((f) => f.field === 'title');
    expect(titleFinding).toBeDefined();
    expect(titleFinding.originalText).toBe('#1');
  });
});
