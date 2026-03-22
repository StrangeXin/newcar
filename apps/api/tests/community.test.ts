import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    publishedJourney: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    journey: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    carCandidate: {
      createMany: vi.fn(),
    },
    journeyFork: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../src/lib/prisma';
import { communityService } from '../src/services/community.service';
import { forkService } from '../src/services/fork.service';

const mockedPrisma = prisma as any;

describe('CommunityService', () => {
  it('should calculate relevance_boost formula correctly', () => {
    const boost = communityService.calcRelevanceBoost(
      {
        budgetMin: 20,
        budgetMax: 30,
        useCases: ['family', 'commute'],
        fuelTypePreference: ['BEV', 'PHEV'],
      },
      {
        budgetMin: 25,
        budgetMax: 35,
        useCases: ['family'],
        fuelType: ['PHEV'],
      }
    );

    // budget overlap=1, use_case_overlap=0.5, fuel_overlap=0.5
    // boost = 1 + 0.4 + 0.2 + 0.1 = 1.7
    expect(boost).toBe(1.7);
  });
});

describe('ForkService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedPrisma.journey.create.mockResolvedValue({ id: 'journey-new' } as any);
    mockedPrisma.carCandidate.createMany.mockResolvedValue({ count: 1 } as any);
    mockedPrisma.journeyFork.create.mockResolvedValue({ id: 'fork-1' } as any);
    mockedPrisma.publishedJourney.update.mockResolvedValue({ id: 'pub-1', forkCount: 2 } as any);
  });

  it('should reject fork when source has no template format', async () => {
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-source',
      title: 'source',
      contentStatus: 'LIVE',
      publishedFormats: ['story'],
      templateData: {},
      tags: {},
      journey: { id: 'journey-source' },
    } as any);

    await expect(forkService.forkJourney('pub-1', 'user-1')).rejects.toThrow(
      'This journey does not provide reusable template'
    );
  });

  it('should reject fork when user already has ACTIVE journey', async () => {
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-source',
      title: 'source',
      contentStatus: 'LIVE',
      publishedFormats: ['template'],
      templateData: { candidateCarIds: ['car-1'] },
      tags: {},
      journey: { id: 'journey-source' },
    } as any);
    mockedPrisma.journey.findFirst.mockResolvedValue({ id: 'active-1' } as any);

    await expect(forkService.forkJourney('pub-1', 'user-1')).rejects.toThrow(
      'User already has an active journey'
    );
  });

  it('should increment fork_count after successful fork', async () => {
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-source',
      title: 'source',
      contentStatus: 'LIVE',
      publishedFormats: ['template'],
      templateData: { candidateCarIds: ['car-1'] },
      tags: {},
      journey: { id: 'journey-source' },
    } as any);
    mockedPrisma.journey.findFirst.mockResolvedValue(null);

    const result = await forkService.forkJourney('pub-1', 'user-1');

    expect(result).toEqual({ journeyId: 'journey-new' });
    expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
      where: { id: 'pub-1' },
      data: { forkCount: { increment: 1 } },
    });
  });
});
