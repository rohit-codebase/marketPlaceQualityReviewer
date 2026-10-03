const { validateAIOutput } = require('../ai/outputValidator');

/**
 * Tests for the AI output validator.
 * Ensures malformed LLM responses are rejected and authoritative rules are enforced.
 */

const validOutput = {
  summary: 'The listing contains an unverifiable price claim.',
  overallStatus: 'review',
  findings: [
    {
      field: 'title',
      type: 'unverifiable_claim',
      severity: 'high',
      issue: 'Unverifiable lowest price claim',
      explanation: 'The phrase "guaranteed lowest price" cannot be verified.',
      policySection: 'POLICY-001',
      originalText: 'Guaranteed lowest price',
      suggestedText: 'Competitive pricing',
      confidence: 0.9,
    },
  ],
  assumptions: ['No third-party price comparison data is available.'],
};

describe('AI Output Validator', () => {
  test('should accept a valid AI response and enforce authoritative overallStatus', () => {
    const result = validateAIOutput(validOutput, ['POLICY-001']);
    expect(result.valid).toBe(true);
    expect(result.data.findings).toHaveLength(1);
    expect(result.data.findings[0].source).toBe('ai');
    // High severity finding authoritatively forces 'fail'
    expect(result.data.overallStatus).toBe('fail');
  });

  test('should reject response that is not an object', () => {
    const result = validateAIOutput('not an object');
    expect(result.valid).toBe(false);
  });

  test('should reject missing summary', () => {
    const result = validateAIOutput({ ...validOutput, summary: '' });
    expect(result.valid).toBe(false);
  });

  test('should reject invalid overallStatus', () => {
    const result = validateAIOutput({ ...validOutput, overallStatus: 'unknown' });
    expect(result.valid).toBe(false);
  });

  test('should reject findings that are not an array', () => {
    const result = validateAIOutput({ ...validOutput, findings: 'not array' });
    expect(result.valid).toBe(false);
  });

  test('should reject finding with invalid severity', () => {
    const badFinding = { ...validOutput.findings[0], severity: 'critical' };
    const result = validateAIOutput({ ...validOutput, findings: [badFinding] });
    expect(result.valid).toBe(false);
  });

  test('should reject finding with invalid type', () => {
    const badFinding = { ...validOutput.findings[0], type: 'made_up_type' };
    const result = validateAIOutput({ ...validOutput, findings: [badFinding] });
    expect(result.valid).toBe(false);
  });

  test('should reject missing policySection', () => {
    const badFinding = { ...validOutput.findings[0], policySection: null };
    const result = validateAIOutput({ ...validOutput, findings: [badFinding] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('policySection is required'))).toBe(true);
  });

  test('should reject finding with non-existent policy section', () => {
    const badFinding = { ...validOutput.findings[0], policySection: 'POLICY-999' };
    const result = validateAIOutput({ ...validOutput, findings: [badFinding] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('POLICY-999'))).toBe(true);
  });

  test('should reject policySection that was not supplied in allowedPolicyIds', () => {
    // POLICY-001 exists globally, but was NOT in the provided allowedPolicyIds context
    const result = validateAIOutput(validOutput, ['BRAND-001', 'BRAND-002']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not in the policy context supplied'))).toBe(true);
  });

  test('should accept empty findings array (clean listing) as pass', () => {
    const result = validateAIOutput({ ...validOutput, findings: [], overallStatus: 'pass' });
    expect(result.valid).toBe(true);
    expect(result.data.findings).toHaveLength(0);
    expect(result.data.overallStatus).toBe('pass');
  });

  test('should authoritatively override overallStatus pass to fail when high severity exists', () => {
    const result = validateAIOutput({ ...validOutput, overallStatus: 'pass' });
    expect(result.valid).toBe(true);
    expect(result.data.overallStatus).toBe('fail');
  });

  test('should authoritatively set overallStatus to review when medium severity exists without high', () => {
    const medFinding = { ...validOutput.findings[0], severity: 'medium' };
    const result = validateAIOutput({ ...validOutput, findings: [medFinding], overallStatus: 'pass' });
    expect(result.valid).toBe(true);
    expect(result.data.overallStatus).toBe('review');
  });

  test('should reject confidence outside 0-1 range', () => {
    const badFinding = { ...validOutput.findings[0], confidence: 1.5 };
    const result = validateAIOutput({ ...validOutput, findings: [badFinding] });
    expect(result.valid).toBe(false);
  });

  test('should sanitize originalText if text is fabricated and not found in listing', () => {
    const listing = { title: 'Smartphone Pro 128GB', description: 'Brand new in box' };
    const findingWithFabricatedText = {
      ...validOutput.findings[0],
      originalText: 'Completely made up text never written in listing',
    };
    const result = validateAIOutput({ ...validOutput, findings: [findingWithFabricatedText] }, null, listing);
    expect(result.valid).toBe(true);
    // Fabricated originalText is sanitized to null
    expect(result.data.findings[0].originalText).toBeNull();
  });
});
