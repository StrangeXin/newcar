import { describe, expect, it } from 'vitest';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'basic': { input: 0.25, output: 1.25 },
  'advanced': { input: 3.0, output: 15.0 },
  'best': { input: 15.0, output: 75.0 },
  'MiniMax-M2.7': { input: 0.25, output: 1.25 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['basic'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

describe('AiUsageService', () => {
  describe('estimateCost', () => {
    it('should calculate cost for basic model', () => {
      const cost = estimateCost('basic', 1000, 500);
      expect(cost).toBeCloseTo(0.000875, 6);
    });

    it('should calculate cost for advanced model', () => {
      const cost = estimateCost('advanced', 10000, 2000);
      expect(cost).toBeCloseTo(0.06, 6);
    });

    it('should fallback to basic pricing for unknown model', () => {
      const cost = estimateCost('unknown-model', 1000, 500);
      expect(cost).toBeCloseTo(0.000875, 6);
    });
  });
});
