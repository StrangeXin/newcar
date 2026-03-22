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
      model: 'MiniMax-M2.7',
      maxTokens: 1024,
    },
  },
}));

vi.mock('../src/lib/i18n', () => ({
  DEFAULT_LOCALE: 'zh-CN',
  resolveLocaleFromUserSettings: vi.fn().mockReturnValue('zh-CN'),
  t: vi.fn((_: string, key: string) => key),
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
import { snapshotService } from '../src/services/snapshot.service';

const mockedPrisma = prisma as any;
const mockedRedis = redis as any;

const aiJsonResponse = {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        narrative_summary: 'summary',
        key_insights: [],
        top_recommendation: null,
        recommendation_reasoning: 'reason',
        attention_signals: [],
        next_suggested_actions: [],
        tokens_used: 123,
      }),
    },
  ],
};

function setupBaseMocks() {
  mockedPrisma.journeySnapshot.findFirst.mockResolvedValue(null);
  mockedPrisma.journey.findUnique.mockResolvedValue({
    id: 'journey-1',
    userId: 'user-1',
    title: '我的旅程',
    stage: 'PLAN',
    requirements: {},
    user: { city: '上海', notificationSettings: {} },
    candidates: [],
    behaviorEvents: [],
    conversations: [],
  });
  mockedPrisma.carPriceSnapshot.findMany.mockResolvedValue([]);
  mockedPrisma.journey.update.mockResolvedValue({ id: 'journey-1' });
  mockedPrisma.journeySnapshot.create.mockImplementation(async ({ data }: any) => ({
    id: 'snapshot-1',
    ...data,
  }));
  mockedRedis.del.mockResolvedValue(1);
}

describe('SnapshotService concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    setupBaseMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when lock is already held for same journey', async () => {
    createMessageMock.mockResolvedValue(aiJsonResponse);
    mockedRedis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    const firstCall = snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);
    const secondCall = await snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);

    expect(secondCall).toBeNull();

    const firstResult = await firstCall;
    expect(firstResult?.id).toBe('snapshot-1');
    expect(mockedRedis.del).toHaveBeenCalledWith('snapshot_lock:journey-1');
  });

  it('writes fallback snapshot with fallback-timeout when AI call times out', async () => {
    vi.useFakeTimers();
    mockedRedis.set.mockResolvedValue('OK');
    createMessageMock.mockImplementation(
      () => new Promise(() => {
      })
    );

    const snapshotPromise = snapshotService.generateSnapshot('journey-1', SnapshotTrigger.MANUAL);
    await vi.advanceTimersByTimeAsync(30_000);

    const snapshot = await snapshotPromise;

    expect(snapshot?.id).toBe('snapshot-1');
    expect(mockedPrisma.journeySnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelUsed: 'fallback-timeout',
        }),
      })
    );
  });
});
