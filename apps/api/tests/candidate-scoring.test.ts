import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- mock prisma ---
const mockedPrisma = vi.hoisted(() => ({
  journey: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  carCandidate: {
    update: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: mockedPrisma,
}));

import { CandidateScoringService } from '../src/services/candidate-scoring.service';

function createService() {
  return new CandidateScoringService();
}

describe('CandidateScoring', () => {
  // ── Existing tests (kept as-is, pure math) ──
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

// ── calculateRankScore ──
describe('CandidateScoringService.calculateRankScore', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // Access private method via bracket notation
  function callRankScore(
    candidate: Record<string, unknown>,
    requirements: Record<string, unknown>,
    behaviorEvents: Array<Record<string, unknown>>
  ): number {
    return (service as any)['calculateRankScore'](candidate, requirements, behaviorEvents);
  }

  it('returns 1 for WINNER status', () => {
    const score = callRankScore(
      { id: 'c1', carId: 'car1', status: 'WINNER', car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' } },
      {},
      []
    );
    expect(score).toBe(1);
  });

  it('returns 0 for ELIMINATED status', () => {
    const score = callRankScore(
      { id: 'c1', carId: 'car1', status: 'ELIMINATED', car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' } },
      {},
      []
    );
    expect(score).toBe(0);
  });

  it('computes score for ACTIVE candidate with behavior events targeting by targetId', () => {
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.8,
        userInterestScore: 0.5,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      [
        { targetId: 'c1', aiWeight: 2 },
        { targetId: 'c1', aiWeight: 3 },
      ]
    );
    // aiScore=0.8, interestScore=0.5, behaviorScore=5, behaviorBoost=min(0.25,5/20)=0.25
    // raw = 0.8*0.6 + 0.5*0.2 + 0.25 + 0.1 = 0.48+0.1+0.25+0.1=0.93
    expect(score).toBeCloseTo(0.93, 5);
  });

  it('computes score for ACTIVE candidate with behavior events targeting by metadata.candidateId', () => {
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.6,
        userInterestScore: 0,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      [
        { targetId: null, metadata: { candidateId: 'c1' }, aiWeight: 1 },
      ]
    );
    // aiScore=0.6, interestScore=0, behaviorScore=1, behaviorBoost=min(0.25,1/20)=0.05
    // raw = 0.6*0.6 + 0*0.2 + 0.05 + 0.1 = 0.36+0+0.05+0.1=0.51
    expect(score).toBeCloseTo(0.51, 5);
  });

  it('computes score for ACTIVE candidate with behavior events targeting by metadata.carId', () => {
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.5,
        userInterestScore: 0.5,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      [
        { targetId: null, metadata: { carId: 'car1' }, aiWeight: 4 },
      ]
    );
    // behaviorScore=4, behaviorBoost=min(0.25,4/20)=0.2
    // raw = 0.5*0.6+0.5*0.2+0.2+0.1 = 0.3+0.1+0.2+0.1=0.7
    expect(score).toBeCloseTo(0.7, 5);
  });

  it('caps behavior boost at 0.25', () => {
    // Create many high-weight events
    const events = Array.from({ length: 20 }, () => ({ targetId: 'c1', aiWeight: 10 }));
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.5,
        userInterestScore: 0.5,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      events
    );
    // behaviorScore=200, behaviorBoost=min(0.25,200/20)=0.25
    // raw = 0.5*0.6+0.5*0.2+0.25+0.1 = 0.3+0.1+0.25+0.1=0.75
    expect(score).toBeCloseTo(0.75, 5);
  });

  it('handles empty behavior events array', () => {
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.5,
        userInterestScore: 0.5,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      []
    );
    // behaviorBoost=0, raw=0.5*0.6+0.5*0.2+0+0.1=0.3+0.1+0+0.1=0.5
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('handles NaN via clamp01 (null aiMatchScore and no requirements)', () => {
    const score = callRankScore(
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: null,
        userInterestScore: null,
        car: { msrp: null, fuelType: 'BEV', type: 'SUV' },
      },
      {},
      []
    );
    // aiMatchScore is null → falls back to calculateMatchScore with empty requirements → 0.5
    // clamp01(0.5)=0.5, interestScore=clamp01(0)=0
    // raw=0.5*0.6+0*0.2+0+0.1=0.3+0+0+0.1=0.4
    expect(score).toBeCloseTo(0.4, 5);
  });
});

// ── calculateMatchScore (additional cases) ──
describe('CandidateScoringService.calculateMatchScore', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  function callMatchScore(car: Record<string, unknown>, requirements: Record<string, unknown>): number {
    return (service as any)['calculateMatchScore'](car, requirements);
  }

  it('adds 0.15 when fuelType matches fuelTypePreference', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'SEDAN' },
      { fuelTypePreference: ['BEV', 'PHEV'] }
    );
    // base 0.5 + 0.15 = 0.65
    expect(score).toBeCloseTo(0.65, 5);
  });

  it('subtracts 0.1 when fuelType does not match fuelTypePreference', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'ICE', type: 'SEDAN' },
      { fuelTypePreference: ['BEV', 'PHEV'] }
    );
    // base 0.5 - 0.1 = 0.4
    expect(score).toBeCloseTo(0.4, 5);
  });

  it('adds 0.1 for family useCase when car type is SUV', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'SUV' },
      { useCases: ['family'] }
    );
    // base 0.5 + 0.1 = 0.6
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('adds 0.1 for family useCase when car type is MPV', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'MPV' },
      { useCases: ['family'] }
    );
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('adds 0.1 for commute useCase when car type is SEDAN', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'SEDAN' },
      { useCases: ['commute'] }
    );
    // base 0.5 + 0.1 = 0.6
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('adds 0.1 for commute useCase when car type is HATCHBACK', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'HATCHBACK' },
      { useCases: ['commute'] }
    );
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('combines multiple scoring factors correctly', () => {
    const score = callMatchScore(
      { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      {
        budgetMin: 15,
        budgetMax: 25,
        fuelTypePreference: ['BEV'],
        useCases: ['family'],
      }
    );
    // base 0.5, budget in range +0.2, fuelType match +0.15, family SUV +0.1 = 0.95
    expect(score).toBeCloseTo(0.95, 5);
  });

  it('returns base score 0.5 when all requirements are null/undefined', () => {
    const score = callMatchScore(
      { msrp: null, fuelType: 'BEV', type: 'SEDAN' },
      {}
    );
    expect(score).toBe(0.5);
  });
});

// ── updateRankScore (mocked prisma) ──
describe('CandidateScoringService.updateRankScore', () => {
  let service: ReturnType<typeof createService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  const baseJourney = {
    id: 'j1',
    requirements: {},
    candidates: [
      {
        id: 'c1',
        carId: 'car1',
        status: 'ACTIVE',
        aiMatchScore: 0.7,
        userInterestScore: 0.3,
        car: { msrp: 200000, fuelType: 'BEV', type: 'SUV' },
      },
      {
        id: 'c2',
        carId: 'car2',
        status: 'ACTIVE',
        aiMatchScore: 0.5,
        userInterestScore: 0.5,
        car: { msrp: 150000, fuelType: 'ICE', type: 'SEDAN' },
      },
    ],
    behaviorEvents: [],
  };

  it('updates rank scores for all candidates', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);
    mockedPrisma.carCandidate.update.mockResolvedValue({});

    await service.updateRankScore('j1', undefined, { force: true });

    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledTimes(2);
  });

  it('throttles recalc within 5 minutes', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);
    mockedPrisma.carCandidate.update.mockResolvedValue({});

    // First call with force
    await service.updateRankScore('j1', 'c1', { force: true });
    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);

    // Second call without force → throttled
    await service.updateRankScore('j1', 'c1');
    expect(mockedPrisma.carCandidate.update).not.toHaveBeenCalled();
  });

  it('force=true bypasses throttle', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);
    mockedPrisma.carCandidate.update.mockResolvedValue({});

    // First call
    await service.updateRankScore('j1', 'c1', { force: true });
    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);
    mockedPrisma.carCandidate.update.mockResolvedValue({});

    // Second call with force
    await service.updateRankScore('j1', 'c1', { force: true });
    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledTimes(1);
  });

  it('filters to single candidate when candidateId provided', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(baseJourney);
    mockedPrisma.carCandidate.update.mockResolvedValue({});

    await service.updateRankScore('j1', 'c1', { force: true });

    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.carCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } })
    );
  });

  it('throws when journey not found', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(null);

    await expect(service.updateRankScore('nonexistent')).rejects.toThrow('Journey not found');
  });
});
