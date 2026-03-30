import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapshotTrigger } from '@newcar/shared';

const createMessageMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: createMessageMock,
    },
  })),
}));

vi.mock('../src/config', () => ({
  config: {
    ai: {
      apiKey: 'test-key',
      baseURL: 'https://example.com',
      model: 'test-model',
      maxTokens: 1024,
    },
  },
}));

vi.mock('../src/lib/i18n', () => ({
  DEFAULT_LOCALE: 'zh-CN',
  resolveLocaleFromUserSettings: vi.fn().mockReturnValue('zh-CN'),
  t: vi.fn((_locale: string, key: string, params?: Record<string, unknown>) => {
    if (key === 'snapshot.fallback.narrative' && params) {
      return `你正在${params.stage}阶段，已有${params.count}个候选车型。`;
    }
    if (key === 'snapshot.fallback.reasoning') return '基于当前候选列表推荐';
    if (key === 'snapshot.fallback.nextAction') return '继续与AI助手对话，明确你的需求';
    return key;
  }),
}));

vi.mock('../src/services/attention-signal.service', () => ({
  attentionSignalService: {
    getAttentionSignals: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/services/notification.service', () => ({
  notificationService: {
    createNotificationsFromSignals: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/services/push.service', () => ({
  pushService: {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/lib/concurrency', () => ({
  snapshotSemaphore: {
    acquire: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  },
}));

vi.mock('../src/lib/redis', () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    journeySnapshot: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    journey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    carPriceSnapshot: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { SnapshotService, snapshotService } from '../src/services/snapshot.service';

const mockedPrisma = prisma as any;
const mockedRedis = redis as any;

const makeJourney = (overrides: Record<string, unknown> = {}) => ({
  id: 'journey-1',
  userId: 'user-1',
  title: 'My Car Journey',
  stage: 'EXPLORING',
  requirements: { budget: 200000 },
  user: { city: '北京', notificationSettings: null },
  candidates: [
    {
      carId: 'car-1',
      status: 'INTERESTED',
      aiMatchScore: 0.85,
      car: { brand: 'Tesla', model: 'Model Y' },
    },
  ],
  behaviorEvents: [
    { type: 'CAR_VIEW', timestamp: new Date() },
    { type: 'CAR_VIEW', timestamp: new Date() },
    { type: 'COMPARE', timestamp: new Date() },
  ],
  conversations: [
    {
      updatedAt: new Date(),
      extractedSignals: [
        { type: 'BUDGET', value: '20万', confidence: 0.9 },
      ],
    },
  ],
  ...overrides,
});

const aiJsonResponse = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        narrative_summary: 'Test summary',
        key_insights: [{ insight: '偏好新能源', evidence: '查看BEV车型', confidence: 0.8 }],
        top_recommendation: 'car-1',
        recommendation_reasoning: '符合预算',
        attention_signals: [],
        next_suggested_actions: ['对比配置'],
        tokens_used: 200,
      }),
    },
  ],
};

describe('SnapshotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('aggregateInputs (via generateSnapshot)', () => {
    it('collects signals, events, and candidates correctly', async () => {
      const journey = makeJourney();
      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      createMessageMock.mockResolvedValue(aiJsonResponse);

      const createdSnapshot = { id: 'snap-1', journeyId: 'journey-1' };
      mockedPrisma.journeySnapshot.create.mockResolvedValue(createdSnapshot);

      const result = await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      expect(result).toEqual(createdSnapshot);

      // Verify prisma was queried for the journey with includes
      expect(mockedPrisma.journey.findUnique).toHaveBeenCalledWith({
        where: { id: 'journey-1' },
        include: {
          user: true,
          candidates: { include: { car: true } },
          behaviorEvents: {
            orderBy: { timestamp: 'desc' },
            take: 300,
          },
          conversations: {
            orderBy: { updatedAt: 'desc' },
            take: 10,
          },
        },
      });

      // Verify snapshot was created with AI response data
      expect(mockedPrisma.journeySnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          journeyId: 'journey-1',
          trigger: SnapshotTrigger.MANUAL,
          narrativeSummary: 'Test summary',
          topRecommendation: 'car-1',
        }),
      });
    });

    it('extracts signals from conversations', async () => {
      const journey = makeJourney({
        conversations: [
          {
            updatedAt: new Date(),
            extractedSignals: [
              { type: 'BUDGET', value: '20万', confidence: 0.9 },
              { type: 'BODY_TYPE', value: 'SUV', confidence: 0.8 },
            ],
          },
          {
            updatedAt: new Date(),
            extractedSignals: [
              { type: 'FUEL', value: '电动', confidence: 0.95 },
            ],
          },
        ],
      });

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      mockedPrisma.journeySnapshot.create.mockResolvedValue({ id: 'snap-1' });
      createMessageMock.mockResolvedValue(aiJsonResponse);

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      // The AI was called, meaning aggregation completed successfully
      expect(createMessageMock).toHaveBeenCalledOnce();
      // The prompt should contain signal data
      const promptArg = createMessageMock.mock.calls[0][0].messages[0].content;
      expect(promptArg).toContain('BUDGET');
      expect(promptArg).toContain('BODY_TYPE');
      expect(promptArg).toContain('FUEL');
    });

    it('filters behavior events to last 7 days', async () => {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const journey = makeJourney({
        behaviorEvents: [
          { type: 'RECENT_VIEW', timestamp: new Date(Date.now() - 1 * DAY_MS) },
          { type: 'OLD_VIEW', timestamp: new Date(Date.now() - 10 * DAY_MS) },
        ],
      });

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      mockedPrisma.journeySnapshot.create.mockResolvedValue({ id: 'snap-1' });
      createMessageMock.mockResolvedValue(aiJsonResponse);

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      const promptArg = createMessageMock.mock.calls[0][0].messages[0].content;
      expect(promptArg).toContain('RECENT_VIEW');
      expect(promptArg).not.toContain('OLD_VIEW');
    });
  });

  describe('buildSnapshotPrompt', () => {
    it('produces prompt with journey context', async () => {
      const journey = makeJourney();
      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      mockedPrisma.journeySnapshot.create.mockResolvedValue({ id: 'snap-1' });
      createMessageMock.mockResolvedValue(aiJsonResponse);

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      expect(createMessageMock).toHaveBeenCalledOnce();
      const callArgs = createMessageMock.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Journey context
      expect(prompt).toContain('journey-1');
      expect(prompt).toContain('EXPLORING');
      expect(prompt).toContain('My Car Journey');

      // Candidate info
      expect(prompt).toContain('Tesla');
      expect(prompt).toContain('Model Y');
      expect(prompt).toContain('0.85');

      // Signal info
      expect(prompt).toContain('BUDGET');
      expect(prompt).toContain('20万');

      // Behavior event summary
      expect(prompt).toContain('CAR_VIEW');
      expect(prompt).toContain('COMPARE');
    });

    it('handles empty candidates and signals', async () => {
      const journey = makeJourney({
        candidates: [],
        conversations: [],
        behaviorEvents: [],
      });

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      mockedPrisma.journeySnapshot.create.mockResolvedValue({ id: 'snap-1' });
      createMessageMock.mockResolvedValue(aiJsonResponse);

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      const prompt = createMessageMock.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('暂无候选车型');
      expect(prompt).toContain('暂无行为记录');
    });
  });

  describe('generateFallbackSnapshot', () => {
    it('returns fallback with correct structure on AI error', async () => {
      const journey = makeJourney();

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});

      // AI call fails
      createMessageMock.mockRejectedValue(new Error('API unavailable'));

      const createdSnapshot = { id: 'snap-fallback' };
      mockedPrisma.journeySnapshot.create.mockResolvedValue(createdSnapshot);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      // Verify the fallback data was stored
      const createCall = mockedPrisma.journeySnapshot.create.mock.calls[0][0];
      expect(createCall.data.narrativeSummary).toContain('EXPLORING');
      expect(createCall.data.narrativeSummary).toContain('1');
      expect(createCall.data.topRecommendation).toBe('car-1');
      expect(createCall.data.recommendationReasoning).toBe('基于当前候选列表推荐');
      expect(createCall.data.nextSuggestedActions).toEqual(['继续与AI助手对话，明确你的需求']);
      expect(createCall.data.tokensUsed).toBe(0);

      consoleSpy.mockRestore();
    });

    it('returns null top_recommendation when no candidates', async () => {
      const journey = makeJourney({ candidates: [] });

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      createMessageMock.mockRejectedValue(new Error('fail'));
      mockedPrisma.journeySnapshot.create.mockResolvedValue({ id: 'snap-fb' });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      const createCall = mockedPrisma.journeySnapshot.create.mock.calls[0][0];
      expect(createCall.data.topRecommendation).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('generateSnapshot', () => {
    it('calls AI and creates snapshot record', async () => {
      const journey = makeJourney();

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});
      createMessageMock.mockResolvedValue(aiJsonResponse);

      const createdSnapshot = {
        id: 'snap-1',
        journeyId: 'journey-1',
        narrativeSummary: 'Test summary',
      };
      mockedPrisma.journeySnapshot.create.mockResolvedValue(createdSnapshot);

      const result = await snapshotService.generateSnapshot('journey-1');

      expect(result).toEqual(createdSnapshot);
      expect(createMessageMock).toHaveBeenCalledOnce();
      expect(mockedPrisma.journeySnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          journeyId: 'journey-1',
          trigger: SnapshotTrigger.DAILY,
          narrativeSummary: 'Test summary',
          topRecommendation: 'car-1',
          recommendationReasoning: '符合预算',
          modelUsed: 'test-model',
          promptVersion: '1.0',
          tokensUsed: 200,
        }),
      });

      // Should update journey lastActivityAt
      expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
        where: { id: 'journey-1' },
        data: { lastActivityAt: expect.any(Date) },
      });
    });

    it('returns existing snapshot for DAILY trigger if one already exists today', async () => {
      const existingSnapshot = { id: 'snap-existing', generatedAt: new Date() };

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(existingSnapshot);

      const result = await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.DAILY);

      expect(result).toEqual(existingSnapshot);
      expect(createMessageMock).not.toHaveBeenCalled();
      expect(mockedPrisma.journeySnapshot.create).not.toHaveBeenCalled();
    });

    it('returns null when redis lock cannot be acquired', async () => {
      mockedRedis.set.mockResolvedValue(null);

      const result = await snapshotService.generateSnapshot('journey-1');

      expect(result).toBeNull();
      expect(createMessageMock).not.toHaveBeenCalled();
    });

    it('falls back on AI error and still creates snapshot', async () => {
      const journey = makeJourney();

      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(journey);
      mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
      mockedPrisma.journey.update.mockResolvedValue({});

      createMessageMock.mockRejectedValue(new Error('Service unavailable'));

      const fallbackSnapshot = { id: 'snap-fallback' };
      mockedPrisma.journeySnapshot.create.mockResolvedValue(fallbackSnapshot);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

      expect(result).toEqual(fallbackSnapshot);
      // Snapshot should still be created with fallback data
      expect(mockedPrisma.journeySnapshot.create).toHaveBeenCalledOnce();

      const createData = mockedPrisma.journeySnapshot.create.mock.calls[0][0].data;
      expect(createData.tokensUsed).toBe(0);
      expect(createData.modelUsed).toBe('test-model');

      consoleSpy.mockRestore();
    });

    it('releases redis lock even on error', async () => {
      mockedRedis.set.mockResolvedValue('OK');
      mockedRedis.del.mockResolvedValue(1);

      // Journey not found will throw
      mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
      mockedPrisma.journey.findUnique.mockResolvedValue(null);

      await expect(
        snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL)
      ).rejects.toThrow('Journey not found');

      expect(mockedRedis.del).toHaveBeenCalledWith('snapshot_lock:journey-1');
    });
  });
});
