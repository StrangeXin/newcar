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
import { PublishService, publishService } from '../src/services/publish.service';

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
    vi.spyOn(publishService, 'generatePublishSummary').mockResolvedValue('测试摘要');

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

  it('should throw when journey not found', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(null);
    await expect(
      publishService.publishJourney('nonexistent', {
        title: '标题',
        publishedFormats: ['story'],
        visibility: 'PUBLIC',
      })
    ).rejects.toThrow('Journey not found');
  });

  it('should reject invalid format in publishedFormats', async () => {
    await expect(
      publishService.publishJourney('journey-1', {
        title: '标题',
        publishedFormats: ['story', 'invalid_format'],
        visibility: 'PUBLIC',
      })
    ).rejects.toThrow('Invalid publishedFormats: invalid_format');
  });

  it('should update existing published journey (upsert)', async () => {
    vi.spyOn(moderationService, 'preReview').mockResolvedValue({ passed: true });
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'published-1',
      journeyId: 'journey-1',
      contentVersion: 2,
      storyContent: '{"old":"data"}',
      reportData: null,
      templateData: null,
    });
    mockedPrisma.publishedJourney.update.mockImplementation(async ({ data }: any) => ({
      id: 'published-1',
      ...data,
    }));

    const result = (await publishService.publishJourney('journey-1', {
      title: '更新标题',
      publishedFormats: ['story'],
      visibility: 'PUBLIC',
    })) as any;

    expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledOnce();
    expect(mockedPrisma.publishedJourney.create).not.toHaveBeenCalled();
    expect(result.contentVersion).toBe(3);
  });

  it('should build tags from candidate car brands', async () => {
    vi.spyOn(moderationService, 'preReview').mockResolvedValue({ passed: true });

    const result = (await publishService.publishJourney('journey-1', {
      title: '标题',
      publishedFormats: ['story'],
      visibility: 'PUBLIC',
    })) as any;

    expect(result.tags).toEqual(
      expect.objectContaining({
        carIds: ['car-1'],
        candidateNames: ['BYD Seal EV'],
        budgetMin: 20,
        budgetMax: 30,
        useCases: ['family'],
        fuelType: ['BEV'],
      })
    );
  });

  it('should create timeline event after publish', async () => {
    vi.spyOn(moderationService, 'preReview').mockResolvedValue({ passed: true });

    await publishService.publishJourney('journey-1', {
      title: '发布标题',
      publishedFormats: ['story'],
      visibility: 'PUBLIC',
    });

    expect(mockedPrisma.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journeyId: 'journey-1',
          type: 'JOURNEY_PUBLISHED',
        }),
      })
    );
  });
});

describe('PublishService.generatePublishSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeCandidateWithCar(overrides: Record<string, any> = {}) {
    return {
      id: 'cand-1',
      carId: 'car-1',
      status: 'ACTIVE',
      recommendReason: '空间大',
      relevantDimensions: ['空间'],
      car: {
        brand: 'BYD',
        model: 'Seal',
        variant: 'EV',
        fuelType: 'BEV',
        type: 'SEDAN',
        msrp: 230000,
        baseSpecs: null,
      },
      ...overrides,
    };
  }

  it('returns winner-based summary when WINNER exists', async () => {
    const winner = makeCandidateWithCar({ status: 'WINNER', car: { brand: '理想', model: 'L6', variant: null } });
    const journey = {
      ...buildJourney(),
      candidates: [winner],
    } as any;
    const snapshot = { narrativeSummary: '总结文本' } as any;

    // Mock the AI client to return a summary
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '从对比中选择了理想L6' }],
    });
    vi.spyOn(publishService as any, 'getClient').mockReturnValue({
      messages: { create: mockCreate },
    });

    const result = await publishService.generatePublishSummary(journey, [winner], snapshot);
    expect(result).toBe('从对比中选择了理想L6');
  });

  it('returns fallback with winner info when AI fails', async () => {
    const winner = makeCandidateWithCar({
      status: 'WINNER',
      recommendReason: '性价比高',
      car: { brand: '比亚迪', model: '海豹', variant: null },
    });
    const journey = {
      ...buildJourney(),
      title: '我的选车之旅',
      candidates: [winner],
    } as any;

    vi.spyOn(publishService as any, 'getClient').mockReturnValue({
      messages: { create: vi.fn().mockRejectedValue(new Error('API error')) },
    });

    const result = await publishService.generatePublishSummary(journey, [winner], null);
    expect(result).toContain('比亚迪 海豹');
    expect(result).toContain('性价比高');
  });

  it('returns fallback text when no candidates', async () => {
    const journey = {
      ...buildJourney(),
      title: '购车历程',
      candidates: [],
    } as any;
    const snapshot = { narrativeSummary: '探索阶段' } as any;

    vi.spyOn(publishService as any, 'getClient').mockReturnValue({
      messages: { create: vi.fn().mockRejectedValue(new Error('API error')) },
    });

    const result = await publishService.generatePublishSummary(journey, [], snapshot);
    // With no candidates and no winner, fallback uses snapshot summary
    expect(result).toBe('探索阶段');
  });
});

describe('PublishService.withSingleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('first attempt succeeds, no retry', async () => {
    const task = vi.fn().mockResolvedValue('success');
    const result = await (publishService as any).withSingleRetry('test', task);
    expect(result).toBe('success');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('first attempt fails, retry succeeds', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce('retry-success');
    const result = await (publishService as any).withSingleRetry('test', task);
    expect(result).toBe('retry-success');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('both attempts fail, throws error', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'));
    await expect(
      (publishService as any).withSingleRetry('test', task)
    ).rejects.toThrow('fail-2');
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe('PublishService.parseJsonBlock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts JSON from markdown code block', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = (publishService as any).parseJsonBlock(input, {});
    expect(result).toEqual({ key: 'value' });
  });

  it('handles raw JSON string', () => {
    const input = '{"name": "test", "count": 42}';
    const result = (publishService as any).parseJsonBlock(input, {});
    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('returns fallback on invalid JSON', () => {
    const fallback = { default: true };
    const result = (publishService as any).parseJsonBlock('not json at all', fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback when no JSON object found', () => {
    const fallback = { empty: true };
    const result = (publishService as any).parseJsonBlock('just plain text', fallback);
    expect(result).toEqual(fallback);
  });

  it('extracts JSON embedded in surrounding text', () => {
    const input = 'Here is the result:\n{"stages": [{"stage": "AWARENESS"}]}\nDone.';
    const result = (publishService as any).parseJsonBlock(input, {});
    expect(result).toEqual({ stages: [{ stage: 'AWARENESS' }] });
  });
});

describe('PublishService.regeneratePublishedContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedPrisma.publishedJourney.findUnique.mockReset();
    mockedPrisma.publishedJourney.update.mockReset();
  });

  it('regenerates story format', async () => {
    const journey = buildJourney();
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-1',
      journey: {
        ...journey,
        snapshots: journey.snapshots,
        candidates: journey.candidates,
      },
    });

    vi.spyOn(publishService, 'generateStory').mockResolvedValue({
      stages: [{ stage: 'AWARENESS', headline: '新故事', narrative: '新内容' }],
    });

    mockedPrisma.publishedJourney.update.mockImplementation(async ({ data }: any) => ({
      id: 'pub-1',
      ...data,
    }));

    const result = await publishService.regeneratePublishedContent('pub-1', 'story');
    expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pub-1' },
        data: expect.objectContaining({
          storyContent: expect.any(String),
        }),
      })
    );
    expect(publishService.generateStory).toHaveBeenCalled();
  });

  it('throws error when published journey not found', async () => {
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue(null);
    await expect(
      publishService.regeneratePublishedContent('nonexistent', 'story')
    ).rejects.toThrow('Published journey not found');
  });

  it('regenerates report format', async () => {
    const journey = buildJourney();
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-1',
      journey: {
        ...journey,
        snapshots: journey.snapshots,
        candidates: journey.candidates,
      },
    });

    vi.spyOn(publishService, 'generateReport').mockResolvedValue({
      userProfile: { budget: '20-30万', fuelPreference: '纯电', useCases: [], coreDimensions: [] },
      comparison: [],
      recommendation: { carName: '测试', reasoning: '理由' },
    });

    mockedPrisma.publishedJourney.update.mockImplementation(async ({ data }: any) => ({
      id: 'pub-1',
      ...data,
    }));

    await publishService.regeneratePublishedContent('pub-1', 'report');
    expect(publishService.generateReport).toHaveBeenCalled();
    expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportData: expect.any(Object),
        }),
      })
    );
  });

  it('regenerates summary format', async () => {
    const journey = buildJourney();
    mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
      id: 'pub-1',
      journeyId: 'journey-1',
      journey: {
        ...journey,
        snapshots: journey.snapshots,
        candidates: journey.candidates,
      },
    });

    vi.spyOn(publishService, 'generatePublishSummary').mockResolvedValue('新摘要');

    mockedPrisma.publishedJourney.update.mockImplementation(async ({ data }: any) => ({
      id: 'pub-1',
      ...data,
    }));

    await publishService.regeneratePublishedContent('pub-1', 'summary');
    expect(publishService.generatePublishSummary).toHaveBeenCalled();
    expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishSummary: '新摘要',
        }),
      })
    );
  });
});
