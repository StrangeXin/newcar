import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddedReason, CandidateStatus } from '@newcar/shared';

const mockedPrisma = {
  carCandidate: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../src/lib/prisma', () => ({
  prisma: mockedPrisma,
}));

describe('CarCandidateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing active candidate instead of throwing when adding duplicate', async () => {
    const existingCandidate = {
      id: 'candidate-1',
      journeyId: 'journey-1',
      carId: 'car-1',
      status: CandidateStatus.ACTIVE,
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
});
