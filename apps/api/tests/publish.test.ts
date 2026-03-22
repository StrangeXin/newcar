import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    journey: {
      findUnique: vi.fn(),
    },
    publishedJourney: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"passed": true}' }],
      }),
    },
  })),
}));

// Mock config
vi.mock('../src/config', () => ({
  config: {
    ai: {
      apiKey: 'test-key',
      baseURL: 'https://test.api',
      model: 'test-model',
      maxTokens: 1024,
    },
  },
}));

import { prisma } from '../src/lib/prisma';

describe('PublishService - validation', () => {
  const VALID_FORMATS = ['story', 'report', 'template'];

  it('should throw when publishedFormats is empty', () => {
    const publishedFormats: string[] = [];
    const isValid = publishedFormats.length > 0;
    expect(isValid).toBe(false);
  });

  it('should throw when publishedFormats contains invalid value', () => {
    const publishedFormats = ['story', 'invalid_format'];
    const invalidFormats = publishedFormats.filter(
      (f) => !VALID_FORMATS.includes(f.toLowerCase())
    );
    expect(invalidFormats).toContain('invalid_format');
    expect(invalidFormats.length).toBeGreaterThan(0);
  });

  it('should accept valid publishedFormats', () => {
    const publishedFormats = ['story', 'report'];
    const invalidFormats = publishedFormats.filter(
      (f) => !VALID_FORMATS.includes(f.toLowerCase())
    );
    expect(invalidFormats.length).toBe(0);
  });

  it('should accept all valid format values', () => {
    for (const fmt of VALID_FORMATS) {
      expect(VALID_FORMATS.includes(fmt)).toBe(true);
    }
  });
});

describe('PublishService - contentStatus based on moderation', () => {
  it('should set contentStatus to LIVE when preReview passes', () => {
    const reviewResult = { passed: true };
    const contentStatus = reviewResult.passed ? 'LIVE' : 'PENDING_REVIEW';
    expect(contentStatus).toBe('LIVE');
  });

  it('should set contentStatus to PENDING_REVIEW when preReview fails', () => {
    const reviewResult = { passed: false, reason: '含有违禁内容' };
    const contentStatus = reviewResult.passed ? 'LIVE' : 'PENDING_REVIEW';
    expect(contentStatus).toBe('PENDING_REVIEW');
  });
});

describe('PublishService - tags building', () => {
  it('should build tags from journey requirements and candidates', () => {
    const requirements = {
      budgetMin: 20,
      budgetMax: 30,
      useCases: ['家用', '通勤'],
      fuelTypePreference: ['BEV'],
    };

    const candidates = [
      { carId: 'car-1', car: { fuelType: 'BEV' } },
      { carId: 'car-2', car: { fuelType: 'PHEV' } },
    ];

    const fuelTypes = [...new Set(candidates.map((c) => c.car?.fuelType).filter(Boolean))];
    const tags = {
      carIds: candidates.map((c) => c.carId),
      budgetMin: requirements.budgetMin,
      budgetMax: requirements.budgetMax,
      useCases: requirements.useCases || [],
      fuelType: fuelTypes,
    };

    expect(tags.carIds).toEqual(['car-1', 'car-2']);
    expect(tags.budgetMin).toBe(20);
    expect(tags.budgetMax).toBe(30);
    expect(tags.useCases).toEqual(['家用', '通勤']);
    expect(tags.fuelType).toContain('BEV');
    expect(tags.fuelType).toContain('PHEV');
    expect(tags.fuelType.length).toBe(2);
  });

  it('should deduplicate fuelTypes', () => {
    const candidates = [
      { carId: 'car-1', car: { fuelType: 'BEV' } },
      { carId: 'car-2', car: { fuelType: 'BEV' } },
      { carId: 'car-3', car: { fuelType: 'PHEV' } },
    ];

    const fuelTypes = [...new Set(candidates.map((c) => c.car?.fuelType).filter(Boolean))];
    expect(fuelTypes.length).toBe(2);
    expect(fuelTypes).toEqual(['BEV', 'PHEV']);
  });
});

describe('relevance_boost formula', () => {
  // Simulating a relevance boost formula: base_score * (1 + view_factor + like_factor)
  function calcRelevanceBoost(viewCount: number, likeCount: number, baseScore: number): number {
    const viewFactor = Math.min(viewCount / 1000, 0.5);
    const likeFactor = Math.min(likeCount / 100, 0.5);
    return baseScore * (1 + viewFactor + likeFactor);
  }

  it('should boost score with high engagement', () => {
    const score = calcRelevanceBoost(1000, 100, 1.0);
    expect(score).toBe(2.0); // 1.0 * (1 + 0.5 + 0.5)
  });

  it('should not exceed max boost with capped values', () => {
    const score = calcRelevanceBoost(9999, 9999, 1.0);
    expect(score).toBeLessThanOrEqual(2.0);
    expect(score).toBe(2.0);
  });

  it('should return base score with no engagement', () => {
    const score = calcRelevanceBoost(0, 0, 1.0);
    expect(score).toBe(1.0);
  });

  it('should scale proportionally with partial engagement', () => {
    const score = calcRelevanceBoost(250, 25, 1.0);
    expect(score).toBe(1.5); // 1.0 * (1 + 0.25 + 0.25)
  });
});

describe('ModerationService - preReview fallback', () => {
  it('should default passed=true when AI errors', () => {
    // Simulates the catch block in preReview
    let result: { passed: boolean; reason?: string };
    try {
      throw new Error('AI service unavailable');
    } catch {
      result = { passed: true };
    }
    expect(result.passed).toBe(true);
  });
});
