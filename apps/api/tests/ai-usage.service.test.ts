import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    aiUsageLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    aiConversationUsage: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    incrementTokenUsage: vi.fn(),
  },
}));

vi.mock('../src/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/lib/prisma';
import { subscriptionService } from '../src/services/subscription.service';
import { AiUsageService } from '../src/services/ai-usage.service';

const mockedPrisma = prisma as any;
const mockedSubService = subscriptionService as any;
let service: AiUsageService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new AiUsageService();
});

describe('AiUsageService', () => {
  describe('logRequest', () => {
    const baseParams = {
      userId: 'user-1',
      conversationId: 'conv-1',
      model: 'basic',
      inputTokens: 1000,
      outputTokens: 500,
    };

    it('should create aiUsageLog with calculated cost', async () => {
      mockedPrisma.aiUsageLog.create.mockResolvedValue({ id: 'log-1' });
      mockedSubService.incrementTokenUsage.mockResolvedValue({});

      await service.logRequest(baseParams);

      expect(mockedPrisma.aiUsageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          conversationId: 'conv-1',
          model: 'basic',
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCostUsd: expect.closeTo(0.000875, 6),
          requestType: 'CHAT',
        }),
      });
    });

    it('should call incrementTokenUsage with total tokens', async () => {
      mockedPrisma.aiUsageLog.create.mockResolvedValue({ id: 'log-1' });
      mockedSubService.incrementTokenUsage.mockResolvedValue({});

      await service.logRequest(baseParams);

      expect(mockedSubService.incrementTokenUsage).toHaveBeenCalledWith('user-1', 1500);
    });

    it('should use default requestType=CHAT when not provided', async () => {
      mockedPrisma.aiUsageLog.create.mockResolvedValue({ id: 'log-1' });
      mockedSubService.incrementTokenUsage.mockResolvedValue({});

      await service.logRequest(baseParams);

      expect(mockedPrisma.aiUsageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ requestType: 'CHAT' }),
      });
    });
  });

  describe('syncConversationUsage', () => {
    it('should aggregate logs and upsert with primaryModel', async () => {
      mockedPrisma.aiUsageLog.findMany.mockResolvedValue([
        { userId: 'user-1', model: 'basic', inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
        { userId: 'user-1', model: 'basic', inputTokens: 200, outputTokens: 100, estimatedCostUsd: 0.002 },
        { userId: 'user-1', model: 'advanced', inputTokens: 300, outputTokens: 150, estimatedCostUsd: 0.01 },
      ]);
      mockedPrisma.aiConversationUsage.upsert.mockResolvedValue({});

      await service.syncConversationUsage('conv-1');

      expect(mockedPrisma.aiConversationUsage.upsert).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        update: expect.objectContaining({
          totalInputTokens: 600,
          totalOutputTokens: 300,
          requestCount: 3,
          primaryModel: 'basic', // appears 2x vs 1x for advanced
        }),
        create: expect.objectContaining({
          conversationId: 'conv-1',
          primaryModel: 'basic',
        }),
      });
    });

    it('should return null when no logs exist', async () => {
      mockedPrisma.aiUsageLog.findMany.mockResolvedValue([]);

      const result = await service.syncConversationUsage('conv-1');

      expect(result).toBeNull();
      expect(mockedPrisma.aiConversationUsage.upsert).not.toHaveBeenCalled();
    });
  });
});
