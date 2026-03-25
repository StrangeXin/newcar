import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddedReason, CandidateStatus } from '@newcar/shared';

const mockedPrisma = {
  carCandidate: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../src/lib/prisma', () => ({
  prisma: mockedPrisma,
}));

vi.mock('../src/services/candidate-scoring.service', () => ({
  candidateScoringService: {
    updateRankScore: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('CarCandidateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Existing tests ──

  it('returns existing active candidate instead of throwing when adding duplicate', async () => {
    const existingCandidate = {
      id: 'candidate-1',
      journeyId: 'journey-1',
      carId: 'car-1',
      status: CandidateStatus.ACTIVE,
      matchTags: [],
      recommendReason: null,
      priceAtAdd: null,
      userNotes: null,
      relevantDimensions: [],
      car: { id: 'car-1', brand: '理想', model: 'L6' },
    };

    mockedPrisma.carCandidate.findFirst.mockResolvedValue(existingCandidate);

    const { carCandidateService } = await import('../src/services/car-candidate.service');
    const result = await carCandidateService.addCandidate({
      journeyId: 'journey-1',
      carId: 'car-1',
      addedReason: AddedReason.AI_RECOMMENDED,
    });

    expect(result).toEqual(existingCandidate);
    expect(mockedPrisma.carCandidate.create).not.toHaveBeenCalled();
  });

  it('creates candidate when no active duplicate exists', async () => {
    mockedPrisma.carCandidate.findFirst.mockResolvedValue(null);
    mockedPrisma.carCandidate.create.mockResolvedValue({
      id: 'candidate-2',
      journeyId: 'journey-1',
      carId: 'car-2',
      status: CandidateStatus.ACTIVE,
    });

    const { carCandidateService } = await import('../src/services/car-candidate.service');
    const result = await carCandidateService.addCandidate({
      journeyId: 'journey-1',
      carId: 'car-2',
      addedReason: AddedReason.AI_RECOMMENDED,
      userNotes: 'test',
    });

    expect(mockedPrisma.carCandidate.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'candidate-2',
      carId: 'car-2',
    });
  });

  // ── addCandidate merge logic ──

  describe('addCandidate merge logic', () => {
    it('merges matchTags with deduplication on existing candidate', async () => {
      const existing = {
        id: 'c1',
        journeyId: 'j1',
        carId: 'car1',
        status: CandidateStatus.ACTIVE,
        matchTags: ['tag1', 'tag2'],
        recommendReason: 'existing reason',
        priceAtAdd: 200000,
        userNotes: 'existing notes',
        relevantDimensions: [],
        car: { id: 'car1' },
      };
      mockedPrisma.carCandidate.findFirst.mockResolvedValue(existing);
      mockedPrisma.carCandidate.update.mockResolvedValue({ ...existing, matchTags: ['tag1', 'tag2', 'tag3'] });

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      await carCandidateService.addCandidate({
        journeyId: 'j1',
        carId: 'car1',
        addedReason: AddedReason.AI_RECOMMENDED,
        matchTags: ['tag2', 'tag3'],
      });

      expect(mockedPrisma.carCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            matchTags: ['tag1', 'tag2', 'tag3'],
          }),
        })
      );
    });

    it('updates recommendReason when existing has none', async () => {
      const existing = {
        id: 'c1',
        journeyId: 'j1',
        carId: 'car1',
        status: CandidateStatus.ACTIVE,
        matchTags: [],
        recommendReason: null,
        priceAtAdd: null,
        userNotes: null,
        relevantDimensions: [],
        car: { id: 'car1' },
      };
      mockedPrisma.carCandidate.findFirst.mockResolvedValue(existing);
      mockedPrisma.carCandidate.update.mockResolvedValue({ ...existing, recommendReason: 'new reason' });

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      await carCandidateService.addCandidate({
        journeyId: 'j1',
        carId: 'car1',
        addedReason: AddedReason.AI_RECOMMENDED,
        recommendReason: 'new reason',
      });

      expect(mockedPrisma.carCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recommendReason: 'new reason',
          }),
        })
      );
    });

    it('keeps original recommendReason when existing already has one', async () => {
      const existing = {
        id: 'c1',
        journeyId: 'j1',
        carId: 'car1',
        status: CandidateStatus.ACTIVE,
        matchTags: [],
        recommendReason: 'original reason',
        priceAtAdd: null,
        userNotes: null,
        relevantDimensions: [],
        car: { id: 'car1' },
      };
      mockedPrisma.carCandidate.findFirst.mockResolvedValue(existing);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      const result = await carCandidateService.addCandidate({
        journeyId: 'j1',
        carId: 'car1',
        addedReason: AddedReason.AI_RECOMMENDED,
        recommendReason: 'try to overwrite',
      });

      // No update should be called since there's nothing new to merge
      expect(mockedPrisma.carCandidate.update).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('returns existing without update when nextData is empty', async () => {
      const existing = {
        id: 'c1',
        journeyId: 'j1',
        carId: 'car1',
        status: CandidateStatus.ACTIVE,
        matchTags: [],
        recommendReason: 'reason',
        priceAtAdd: 200000,
        userNotes: 'notes',
        relevantDimensions: ['dim1'],
        car: { id: 'car1' },
      };
      mockedPrisma.carCandidate.findFirst.mockResolvedValue(existing);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      const result = await carCandidateService.addCandidate({
        journeyId: 'j1',
        carId: 'car1',
        addedReason: AddedReason.AI_RECOMMENDED,
        // no new data fields
      });

      expect(mockedPrisma.carCandidate.update).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });
  });

  // ── getCandidatesByJourney ──

  describe('getCandidatesByJourney', () => {
    it('returns sorted by status (WINNER > ACTIVE > ELIMINATED)', async () => {
      const candidates = [
        { id: 'c1', status: 'ELIMINATED', candidateRankScore: 0, aiMatchScore: 0.3, addedAt: new Date('2026-01-01') },
        { id: 'c2', status: 'ACTIVE', candidateRankScore: 0.5, aiMatchScore: 0.5, addedAt: new Date('2026-01-02') },
        { id: 'c3', status: 'WINNER', candidateRankScore: 1, aiMatchScore: 0.9, addedAt: new Date('2026-01-03') },
      ];
      mockedPrisma.carCandidate.findMany.mockResolvedValue(candidates);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      const result = await carCandidateService.getCandidatesByJourney('j1');

      expect(result[0].id).toBe('c3'); // WINNER first
      expect(result[1].id).toBe('c2'); // ACTIVE second
      expect(result[2].id).toBe('c1'); // ELIMINATED last
    });

    it('sorts ACTIVE candidates by candidateRankScore descending', async () => {
      const candidates = [
        { id: 'c1', status: 'ACTIVE', candidateRankScore: 0.3, aiMatchScore: 0.3, addedAt: new Date('2026-01-01') },
        { id: 'c2', status: 'ACTIVE', candidateRankScore: 0.9, aiMatchScore: 0.9, addedAt: new Date('2026-01-02') },
        { id: 'c3', status: 'ACTIVE', candidateRankScore: 0.6, aiMatchScore: 0.6, addedAt: new Date('2026-01-03') },
      ];
      mockedPrisma.carCandidate.findMany.mockResolvedValue(candidates);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      const result = await carCandidateService.getCandidatesByJourney('j1');

      expect(result[0].id).toBe('c2'); // highest score
      expect(result[1].id).toBe('c3');
      expect(result[2].id).toBe('c1'); // lowest score
    });
  });

  // ── updateStatus ──

  describe('updateStatus', () => {
    it('ELIMINATED sets candidateRankScore to 0 and adds eliminationReason', async () => {
      mockedPrisma.carCandidate.update.mockResolvedValue({
        id: 'c1',
        journeyId: 'j1',
        status: CandidateStatus.ELIMINATED,
        candidateRankScore: 0,
        eliminationReason: 'too expensive',
      });

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      await carCandidateService.updateStatus('c1', CandidateStatus.ELIMINATED, 'too expensive');

      expect(mockedPrisma.carCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: {
            status: CandidateStatus.ELIMINATED,
            eliminationReason: 'too expensive',
            candidateRankScore: 0,
          },
          include: { car: true },
        })
      );
    });

    it('non-ELIMINATED clears eliminationReason', async () => {
      mockedPrisma.carCandidate.update.mockResolvedValue({
        id: 'c1',
        journeyId: 'j1',
        status: CandidateStatus.ACTIVE,
        candidateRankScore: undefined,
        eliminationReason: null,
      });

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      await carCandidateService.updateStatus('c1', CandidateStatus.ACTIVE);

      expect(mockedPrisma.carCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: CandidateStatus.ACTIVE,
            eliminationReason: null,
            candidateRankScore: undefined,
          },
        })
      );
    });
  });

  // ── markAsWinner ──

  describe('markAsWinner', () => {
    it('sets winner candidateRankScore to 1 and eliminates other ACTIVE candidates', async () => {
      mockedPrisma.carCandidate.findUnique.mockResolvedValue({
        id: 'c1',
        journeyId: 'j1',
        status: CandidateStatus.ACTIVE,
      });

      const winnerResult = {
        id: 'c1',
        journeyId: 'j1',
        status: CandidateStatus.WINNER,
        candidateRankScore: 1,
        car: { id: 'car1' },
      };

      mockedPrisma.$transaction.mockResolvedValue([{ count: 2 }, winnerResult]);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      const result = await carCandidateService.markAsWinner('c1');

      expect(result).toEqual(winnerResult);
      // Verify $transaction was called
      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
      // The argument is an array of two PrismaPromise-like items
      const txArg = mockedPrisma.$transaction.mock.calls[0][0];
      expect(txArg).toHaveLength(2);
    });

    it('throws when candidate not found', async () => {
      mockedPrisma.carCandidate.findUnique.mockResolvedValue(null);

      const { carCandidateService } = await import('../src/services/car-candidate.service');
      await expect(carCandidateService.markAsWinner('nonexistent')).rejects.toThrow('Candidate not found');
    });
  });
});
