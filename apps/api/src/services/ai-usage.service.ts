import { AiRequestType } from '@newcar/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { subscriptionService } from './subscription.service';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'basic': { input: 0.25, output: 1.25 },
  'advanced': { input: 3.0, output: 15.0 },
  'best': { input: 15.0, output: 75.0 },
  'MiniMax-M2.7': { input: 0.25, output: 1.25 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['basic'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export interface LogRequestParams {
  userId: string;
  conversationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  requestType?: string;
  durationMs?: number;
}

export class AiUsageService {
  async logRequest(params: LogRequestParams) {
    const cost = estimateCost(params.model, params.inputTokens, params.outputTokens);
    const totalTokens = params.inputTokens + params.outputTokens;

    const log = await prisma.aiUsageLog.create({
      data: {
        userId: params.userId,
        conversationId: params.conversationId,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        cacheReadTokens: params.cacheReadTokens,
        cacheWriteTokens: params.cacheWriteTokens,
        estimatedCostUsd: cost,
        requestType: params.requestType ?? AiRequestType.CHAT,
        durationMs: params.durationMs,
      },
    });

    await subscriptionService.incrementTokenUsage(params.userId, totalTokens);

    logger.debug({ logId: log.id, cost, totalTokens }, '[ai-usage] request logged');
    return log;
  }

  async syncConversationUsage(conversationId: string) {
    const logs = await prisma.aiUsageLog.findMany({
      where: { conversationId },
    });

    if (logs.length === 0) return null;

    const totalInputTokens = logs.reduce((sum, l) => sum + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((sum, l) => sum + l.outputTokens, 0);
    const totalCostUsd = logs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);

    const modelCounts: Record<string, number> = {};
    for (const log of logs) {
      modelCounts[log.model] = (modelCounts[log.model] ?? 0) + 1;
    }
    const primaryModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0][0];

    return prisma.aiConversationUsage.upsert({
      where: { conversationId },
      update: {
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        requestCount: logs.length,
        primaryModel,
      },
      create: {
        conversationId,
        userId: logs[0].userId,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        requestCount: logs.length,
        primaryModel,
      },
    });
  }

  async getUsageSummary(filters: { userId?: string; startDate?: Date; endDate?: Date }) {
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    const logs = await prisma.aiUsageLog.findMany({ where });
    const totalCost = logs.reduce((sum, l) => sum + l.estimatedCostUsd, 0);
    const totalInputTokens = logs.reduce((sum, l) => sum + l.inputTokens, 0);
    const totalOutputTokens = logs.reduce((sum, l) => sum + l.outputTokens, 0);

    return {
      totalRequests: logs.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Math.round(totalCost * 100) / 100,
    };
  }

  async getUsageDetails(filters: {
    userId?: string;
    conversationId?: string;
    cursor?: string;
    limit?: number;
  }) {
    const take = filters.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.conversationId) where.conversationId = filters.conversationId;

    return prisma.aiUsageLog.findMany({
      where,
      take,
      ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const aiUsageService = new AiUsageService();
