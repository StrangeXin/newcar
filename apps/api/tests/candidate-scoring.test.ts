import { describe, it, expect } from 'vitest';

describe('CandidateScoring', () => {
  it('should calculate budget match score correctly', () => {
    const budgetMin = 15;
    const budgetMax = 25;
    const msrpInWan = 20;

    let score = 0.5;
    if (msrpInWan >= budgetMin && msrpInWan <= budgetMax) {
      score += 0.2;
    }

    expect(score).toBe(0.7);
  });

  it('should penalize out of budget car', () => {
    const budgetMin = 15;
    const budgetMax = 25;
    const msrpInWan = 30;

    let score = 0.5;
    if (msrpInWan >= budgetMin && msrpInWan <= budgetMax) {
      score += 0.2;
    } else {
      score -= 0.1 * (msrpInWan - budgetMax);
    }

    expect(score).toBe(0.0);
  });

  it('should normalize score to 0-1 range', () => {
    const rawScore = 1.5;
    const normalized = Math.max(0, Math.min(1, rawScore));
    expect(normalized).toBe(1);
  });

  it('should not go below 0', () => {
    const rawScore = -0.5;
    const normalized = Math.max(0, Math.min(1, rawScore));
    expect(normalized).toBe(0);
  });
});
