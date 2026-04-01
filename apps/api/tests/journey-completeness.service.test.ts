import { describe, it, expect } from 'vitest';
import { calculateCompleteness } from '../src/services/journey-completeness.service';

function makeJourney(overrides: Record<string, unknown> = {}) {
  return {
    id: 'j1',
    stage: 'AWARENESS',
    requirements: {},
    ...overrides,
  };
}

function makeCandidate(
  status: 'ACTIVE' | 'ELIMINATED' | 'WINNER' = 'ACTIVE',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    status,
    userNotes: null as string | null,
    car: { id: 'car1', brand: '理想', model: 'L6' },
    ...overrides,
  };
}

function makeSignal(type: string = 'PREFERENCE', value: string = 'test') {
  return { type, value, confidence: 0.8 };
}

function makeSnapshot() {
  return { id: 's1', journeyId: 'j1', trigger: 'DAILY' };
}

describe('calculateCompleteness', () => {
  // ─── AWARENESS ───
  describe('AWARENESS stage', () => {
    it('requirements 全空 → score=0, 4 个缺失项', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'AWARENESS', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.stage).toBe('AWARENESS');
      expect(result.score).toBe(0);
      expect(result.missingItems).toHaveLength(4);
    });

    it('budgetMin+budgetMax 已填 → score=25', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: { budgetMin: 20, budgetMax: 30 },
        }),
        [],
        [],
        [],
      );
      expect(result.score).toBe(25);
      expect(result.missingItems).toHaveLength(3);
    });

    it('全部已填 → score=100, missingItems 为空', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [],
        [],
        [],
      );
      expect(result.score).toBe(100);
      expect(result.missingItems).toHaveLength(0);
    });
  });

  // ─── CONSIDERATION ───
  describe('CONSIDERATION stage', () => {
    it('0 个候选 → score 低, missingItems 含"候选车"', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'CONSIDERATION', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.score).toBeLessThan(50);
      expect(result.missingItems).toEqual(
        expect.arrayContaining([expect.stringContaining('候选车')]),
      );
    });

    it('2 候选 + signals + 完整 awareness → score 高', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'CONSIDERATION',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [makeCandidate(), makeCandidate()],
        [makeSignal(), makeSignal()],
        [],
      );
      expect(result.score).toBeGreaterThanOrEqual(75);
    });
  });

  // ─── COMPARISON ───
  describe('COMPARISON stage', () => {
    it('2 ACTIVE + 1 ELIMINATED + snapshot → score >= 80', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [makeSignal('PREFERENCE')],
        [makeSnapshot()],
      );
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('用户换车后只剩 1 ACTIVE → score 下降', () => {
      const full = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [makeSignal('PREFERENCE')],
        [makeSnapshot()],
      );
      const reduced = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [],
        [],
      );
      expect(reduced.score).toBeLessThan(full.score);
    });
  });

  // ─── DECISION ───
  describe('DECISION stage', () => {
    it('有 WINNER + notes → score >= 70', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'DECISION' }),
        [makeCandidate('WINNER', { userNotes: '空间大，适合家用' })],
        [],
        [],
      );
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('WINNER 被取消 → score 下降到 0-30', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'DECISION' }),
        [makeCandidate('ELIMINATED')],
        [],
        [],
      );
      expect(result.score).toBeLessThanOrEqual(30);
    });
  });

  // ─── PURCHASE ───
  describe('PURCHASE stage', () => {
    it('WINNER 确认 + 可发布 → score=100', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'PURCHASE' }),
        [makeCandidate('WINNER', { userNotes: '最终选择' }), makeCandidate('ELIMINATED')],
        [makeSignal(), makeSignal(), makeSignal()],
        [makeSnapshot()],
      );
      expect(result.score).toBe(100);
    });
  });

  // ─── suggestions ───
  describe('suggestions', () => {
    it('总是返回非空 suggestions 数组（当有缺失项时）', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'AWARENESS', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('满分时 suggestions 为空', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [],
        [],
        [],
      );
      expect(result.suggestions).toHaveLength(0);
    });
  });
});
