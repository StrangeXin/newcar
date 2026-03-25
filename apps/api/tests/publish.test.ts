import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    timelineEvent: {
      create: vi.fn().mockResolvedValue({ id: 'te-1', type: 'JOURNEY_PUBLISHED' }),
    },
  },
}));

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
import { moderationService } from '../src/services/moderation.service';
import { publishService } from '../src/services/publish.service';

const mockedPrisma = prisma as any;

function buildJourney() {
  return {
    id: 'journey-1',
    userId: 'user-1',
    title: '我的购车旅程',
    stage: 'DECISION',
    requirements: {
      budgetMin: 20,
      budgetMax: 30,
      useCases: ['family'],
    },
    user: { id: 'user-1' },
    snapshots: [{ id: 'snapshot-1', narrativeSummary: '旅程总结' }],
    candidates: [
      {
        id: 'cand-1',
        carId: 'car-1',
        status: 'ACTIVE',
        car: {
          brand: 'BYD',
          model: 'Seal',
          variant: 'EV',
          fuelType: 'BEV',
          type: 'SEDAN',
          msrp: 230000,
        },
      },
    ],
  };
}

describe('PublishService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedPrisma.journey.findUnique.mockReset();
    mockedPrisma.publishedJourney.findUnique.mockReset();
    mockedPrisma.publishedJourney.create.mockReset();
    mockedPrisma.publishedJourney.update.mockReset();

    vi.spyOn(publishService, 'generateStory').mockResolvedValue({ stages: [{ stage: 'AWARENESS', headline: '明确需求', narrative: '故事内容' }] });
    vi.spyOn(publishService, 'generateReport').mockResolvedValue({ userProfile: { budget: '20-30万', fuelPreference: '纯电', useCases: ['family'], coreDimensions: ['空间'] }, comparison: [], recommendation: { carName: '测试车', reasoning: '测试理由' } });
    vi.spyOn(publishService, 'generateTemplate').mockResolvedValue({ dimensions: [], weights: {}, keyQuestions: [], candidateCarIds: ['car-1'], candidateNames: ['测试车'] });

    mockedPrisma.journey.findUnique.mockResolvedValue(buildJourney() as any);
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue(null);
    mockedPrisma.publishedJourney.create.mockImplementation(async ({ data }: any) => ({
      id: 'published-1',
      ...data,
    }));
  });

  it('should reject when publishedFormats is empty', async () => {
    await expect(
      publishService.publishJourney('journey-1', {
        title: '发布标题',
        publishedFormats: [],
        visibility: 'PUBLIC',
      })
    ).rejects.toThrow('publishedFormats must include at least one format');
  });

  it('should set contentStatus=LIVE when moderation passed', async () => {
    vi.spyOn(moderationService, 'preReview').mockResolvedValue({ passed: true });

    const result = (await publishService.publishJourney('journey-1', {
      title: '发布标题',
      publishedFormats: ['story', 'report'],
      visibility: 'PUBLIC',
    })) as any;

    expect(result.contentStatus).toBe('LIVE');
    expect(mockedPrisma.publishedJourney.create).toHaveBeenCalledOnce();
  });

  it('should set contentStatus=PENDING_REVIEW when moderation flagged', async () => {
    vi.spyOn(moderationService, 'preReview').mockResolvedValue({
      passed: false,
      reason: '疑似广告',
    });

    const result = (await publishService.publishJourney('journey-1', {
      title: '发布标题',
      publishedFormats: ['story'],
      visibility: 'PUBLIC',
    })) as any;

    expect(result.contentStatus).toBe('PENDING_REVIEW');
    expect(mockedPrisma.publishedJourney.create).toHaveBeenCalledOnce();
  });
});
