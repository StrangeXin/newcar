import Anthropic from '@anthropic-ai/sdk';
import { AttentionSignal, KeyInsight, SnapshotTrigger } from '@newcar/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { attentionSignalService } from './attention-signal.service';
import { notificationService } from './notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const EFFECTIVE_EVENT_DAYS = 7;

interface SnapshotAiResponse {
  narrative_summary?: string;
  key_insights?: KeyInsight[];
  top_recommendation?: string | null;
  recommendation_reasoning?: string;
  attention_signals?: AttentionSignal[];
  next_suggested_actions?: string[];
  tokens_used?: number;
}

export class SnapshotService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async generateSnapshot(journeyId: string, trigger: SnapshotTrigger = SnapshotTrigger.DAILY) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingToday = await prisma.journeySnapshot.findFirst({
      where: {
        journeyId,
        generatedAt: { gte: today },
      },
    });

    if (existingToday && trigger === SnapshotTrigger.DAILY) {
      return existingToday;
    }

    const inputs = await this.aggregateInputs(journeyId);
    const prompt = this.buildSnapshotPrompt(inputs);

    const client = this.getClient();
    let aiResponse: SnapshotAiResponse;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens * 2,
        system: '你是购车AI助手，负责生成用户的购车旅程摘要。',
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content[0];
      aiResponse = block.type === 'text' ? (JSON.parse(block.text) as SnapshotAiResponse) : this.generateFallbackSnapshot(inputs);
    } catch (err: any) {
      console.error('Snapshot AI error:', err?.message || err);
      aiResponse = this.generateFallbackSnapshot(inputs);
    }

    const snapshot = await prisma.journeySnapshot.create({
      data: {
        journeyId,
        trigger,
        narrativeSummary: aiResponse.narrative_summary,
        keyInsights: aiResponse.key_insights || [],
        topRecommendation: aiResponse.top_recommendation,
        recommendationReasoning: aiResponse.recommendation_reasoning,
        attentionSignals: aiResponse.attention_signals || [],
        nextSuggestedActions: aiResponse.next_suggested_actions || [],
        modelUsed: config.ai.model,
        promptVersion: '1.0',
        tokensUsed: aiResponse.tokens_used || 0,
      },
    });

    const signals = await attentionSignalService.getAttentionSignals(
      journeyId,
      inputs.journey.user?.city || undefined
    );

    if (signals.length > 0) {
      await notificationService.createNotificationsFromSignals(inputs.journey.userId, journeyId, signals);
    }

    await prisma.journey.update({
      where: { id: journeyId },
      data: { lastActivityAt: new Date() },
    });

    return snapshot;
  }

  private async aggregateInputs(journeyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
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

    if (!journey) {
      throw new Error('Journey not found');
    }

    const allSignals: any[] = [];
    for (const conv of journey.conversations) {
      const signals = Array.isArray(conv.extractedSignals) ? (conv.extractedSignals as any[]) : [];
      allSignals.push(...signals);
    }

    const cutoffDate = new Date(Date.now() - EFFECTIVE_EVENT_DAYS * DAY_MS);
    const recentEvents = journey.behaviorEvents.filter((event) => new Date(event.timestamp) >= cutoffDate);

    const latestSnapshot = await prisma.journeySnapshot.findFirst({
      where: { journeyId },
      orderBy: { generatedAt: 'desc' },
    });

    const candidateCarIds = journey.candidates.map((candidate) => candidate.carId);
    const todayPriceSnapshots = candidateCarIds.length
      ? await prisma.carPriceSnapshot.findMany({
          where: {
            carId: { in: candidateCarIds },
            capturedAt: { gte: today },
          },
        })
      : [];

    return {
      journey,
      recentBehaviorEvents: recentEvents,
      allExtractedSignals: allSignals.slice(0, 50),
      candidates: journey.candidates,
      latestSnapshot,
      todayPriceSnapshots,
    };
  }

  private buildSnapshotPrompt(inputs: any): string {
    const { journey, recentBehaviorEvents, allExtractedSignals, candidates, latestSnapshot } = inputs;

    const eventSummary = this.summarizeBehaviorEvents(recentBehaviorEvents);

    const candidateSummary = candidates
      .map((candidate: any) => {
        return `${candidate.car.brand} ${candidate.car.model}: status=${candidate.status}, aiMatchScore=${candidate.aiMatchScore}`;
      })
      .join('\n');

    const signalSummary = allExtractedSignals
      .slice(0, 20)
      .map((signal: any) => `[${signal.type}] ${signal.value} (confidence: ${signal.confidence})`)
      .join('\n');

    const latestInsights = latestSnapshot?.keyInsights ? JSON.parse(JSON.stringify(latestSnapshot.keyInsights)) : [];

    return `生成购车旅程快照。

用户信息：
- 旅程ID: ${journey.id}
- 当前阶段: ${journey.stage}
- 旅程标题: ${journey.title}
- 需求: ${JSON.stringify(journey.requirements)}

近期行为（近${EFFECTIVE_EVENT_DAYS}天）：
${eventSummary}

用户表达过的偏好/需求（结构化信号）：
${signalSummary || '暂无'}

候选车型：
${candidateSummary || '暂无候选车型'}

上一次快照的关键洞察（如有）：
${latestInsights.length > 0 ? latestInsights.map((insight: any) => `- ${insight.insight}`).join('\n') : '无'}

请生成JSON格式的快照，包含：
{
  "narrative_summary": "100-200字的用户购车进展叙述",
  "key_insights": [{"insight": "洞察内容", "evidence": "支持证据", "confidence": 0.0-1.0}],
  "top_recommendation": "推荐车型ID或null",
  "recommendation_reasoning": "推荐理由",
  "attention_signals": [{"carId": "车型ID", "signalType": "信号类型", "description": "描述", "delta": 数值}],
  "next_suggested_actions": ["下一步建议1", "下一步建议2"]
}`;
  }

  private summarizeBehaviorEvents(events: any[]): string {
    if (events.length === 0) {
      return '暂无行为记录';
    }

    const byType: Record<string, number> = {};
    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    return Object.entries(byType)
      .map(([type, count]) => `${type}: ${count}次`)
      .join(', ');
  }

  private generateFallbackSnapshot(inputs: any): SnapshotAiResponse {
    return {
      narrative_summary: `你正在${inputs.journey.stage}阶段，已有${inputs.candidates.length}个候选车型。`,
      key_insights: [],
      top_recommendation: inputs.candidates[0]?.carId || null,
      recommendation_reasoning: '基于当前候选列表推荐',
      attention_signals: [],
      next_suggested_actions: ['继续与AI助手对话，明确你的需求'],
      tokens_used: 0,
    };
  }
}

export const snapshotService = new SnapshotService();
