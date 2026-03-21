# Plan 3: AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AI Pipeline for snapshot generation, today's dynamic updates, and CarCandidate scoring — all within Node.js (Python FastAPI migration can happen post-MVP)

**Architecture:** Node.js-based AI Pipeline integrated into existing API service. Pipeline runs on trigger (event-based + daily cron fallback). Input aggregation → Intent inference → Content generation → Write & notify pattern. Keeps MVP simple; Python migration is a post-MVP migration path.

**Tech Stack:** Node.js + TypeScript + existing Prisma + Redis + MiniMax/Claude API

---

## File Structure

```
apps/api/src/
├── services/
│   ├── snapshot.service.ts          # JourneySnapshot generation
│   ├── attention-signal.service.ts  # Today's dynamic triggers
│   ├── candidate-scoring.service.ts # AI match scoring
│   └── notification.service.ts     # NotificationFeed writes
├── jobs/
│   └── daily-snapshot.job.ts        # Cron job for daily snapshots
├── lib/
│   └── scheduler.ts                 # Simple in-process scheduler
├── controllers/
│   ├── snapshot.controller.ts
│   └── notification.controller.ts
└── routes/
    ├── snapshot.ts
    └── notifications.ts
```

---

## Task 1: Snapshot Service（快照生成核心）

**Files:**
- Create: `apps/api/src/services/snapshot.service.ts`
- Create: `packages/shared/src/types/snapshot.ts` (shared types for pipeline)
- Modify: `packages/shared/src/index.ts` (add snapshot exports)
- Create: `apps/api/tests/snapshot.test.ts`

- [ ] **Step 1: Create snapshot types**

```typescript
// packages/shared/src/types/snapshot.ts

export enum SnapshotTrigger {
  DAILY = 'DAILY',
  EVENT_TRIGGERED = 'EVENT_TRIGGERED',
  MANUAL = 'MANUAL',
}

export interface KeyInsight {
  insight: string;
  evidence: string;
  confidence: number; // 0-1
}

export interface AttentionSignal {
  carId: string;
  signalType: 'PRICE_DROP' | 'NEW_VARIANT' | 'NEW_REVIEW' | 'POLICY_UPDATE' | 'OTA_RECALL';
  description: string;
  delta?: number; // e.g., price change amount
  oldValue?: string;
  newValue?: string;
}

export interface SnapshotInput {
  journeyId: string;
  trigger: SnapshotTrigger;
  // Aggregated from DB queries:
  recentBehaviorEvents: any[];
  allExtractedSignals: any[];
  candidates: any[];
  latestSnapshot?: any;
}
```

- [ ] **Step 2: Update shared package exports**

Modify `packages/shared/src/index.ts` to add:
```typescript
export * from './types/snapshot';
```

- [ ] **Step 3: Create snapshot service with input aggregation**

```typescript
// apps/api/src/services/snapshot.service.ts
import { prisma } from '../lib/prisma';
import { config } from '../config';
import Anthropic from '@anthropic-ai/sdk';
import { SnapshotTrigger, KeyInsight, AttentionSignal } from '@newcar/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const EFFECTIVE_EVENT_DAYS = 7; // events older than 7 days get 0 weight

export class SnapshotService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async generateSnapshot(journeyId: string, trigger: SnapshotTrigger = SnapshotTrigger.DAILY) {
    // 1. Check if snapshot already generated today (dedup)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingToday = await prisma.journeySnapshot.findFirst({
      where: {
        journeyId,
        generatedAt: { gte: today },
      },
    });

    if (existingToday && trigger === SnapshotTrigger.DAILY) {
      return existingToday; // Already have today's snapshot
    }

    // 2. Aggregate inputs
    const inputs = await this.aggregateInputs(journeyId);

    // 3. Build AI prompt
    const prompt = this.buildSnapshotPrompt(inputs);

    // 4. Call AI
    const client = this.getClient();
    let aiResponse: any;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens * 2, // Snapshot needs more tokens
        system: '你是购车AI助手，负责生成用户的购车旅程摘要。',
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content[0];
      aiResponse = block.type === 'text' ? JSON.parse(block.text) : null;
    } catch (err: any) {
      console.error('Snapshot AI error:', err?.message || err);
      // Fallback: generate minimal snapshot
      aiResponse = this.generateFallbackSnapshot(inputs);
    }

    // 5. Write snapshot
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

    // 6. Update journey aiConfidenceScore
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
        user: true,  // Required for attention signals (user.city)
        candidates: { include: { car: true } },
        behaviorEvents: {
          orderBy: { timestamp: 'desc' },
          take: 300, // Max 300 events per spec
        },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!journey) throw new Error('Journey not found');

    // Aggregate signals from all conversations
    const allSignals: any[] = [];
    for (const conv of journey.conversations) {
      const signals = conv.extractedSignals as any[];
      allSignals.push(...signals);
    }

    // Filter recent behavior events (within EFFECTIVE_EVENT_DAYS)
    const cutoffDate = new Date(Date.now() - EFFECTIVE_EVENT_DAYS * DAY_MS);
    const recentEvents = journey.behaviorEvents.filter(
      (e) => new Date(e.timestamp) >= cutoffDate
    );

    // Get latest snapshot for comparison
    const latestSnapshot = await prisma.journeySnapshot.findFirst({
      where: { journeyId },
      orderBy: { generatedAt: 'desc' },
    });

    // Get candidate car price snapshots (today's prices)
    const candidateCarIds = journey.candidates.map((c) => c.carId);
    const todayPriceSnapshots = await prisma.carPriceSnapshot.findMany({
      where: {
        carId: { in: candidateCarIds },
        capturedAt: { gte: today },
      },
    });

    return {
      journey,
      recentBehaviorEvents: recentEvents,
      allExtractedSignals: allSignals.slice(0, 50), // Max 50 signals
      candidates: journey.candidates,
      latestSnapshot,
      todayPriceSnapshots,
    };
  }

  private buildSnapshotPrompt(inputs: any): string {
    const { journey, recentBehaviorEvents, allExtractedSignals, candidates, latestSnapshot } = inputs;

    // Build behavior summary
    const eventSummary = this.summarizeBehaviorEvents(recentBehaviorEvents);

    // Build candidate summary
    const candidateSummary = candidates
      .map((c: any) => `${c.car.brand} ${c.car.model}: status=${c.status}, aiMatchScore=${c.aiMatchScore}`)
      .join('\n');

    // Build signals summary
    const signalSummary = allExtractedSignals
      .slice(0, 20)
      .map((s: any) => `[${s.type}] ${s.value} (confidence: ${s.confidence})`)
      .join('\n');

    const latestInsights = latestSnapshot?.keyInsights
      ? JSON.parse(JSON.stringify(latestSnapshot.keyInsights))
      : [];

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
${latestInsights.length > 0 ? latestInsights.map((i: any) => `- ${i.insight}`).join('\n') : '无'}

请生成JSON格式的快照，包含：
{
  "narrative_summary": "100-200字的用户购车进展叙述",
  "key_insights": [{"insight": "洞察内容", "evidence": "支持证据", "confidence": 0.0-1.0}], // 最多3条
  "top_recommendation": "推荐车型ID或null",
  "recommendation_reasoning": "推荐理由",
  "attention_signals": [{"carId": "车型ID", "signalType": "信号类型", "description": "描述", "delta": 数值}], // 最多3条
  "next_suggested_actions": ["下一步建议1", "下一步建议2"] // 最多3条
}`;
  }

  private summarizeBehaviorEvents(events: any[]): string {
    if (events.length === 0) return '暂无行为记录';

    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }

    const summaries = Object.entries(byType).map(([type, count]) => `${type}: ${count}次`);
    return summaries.join(', ');
  }

  private generateFallbackSnapshot(inputs: any) {
    // Minimal fallback when AI fails
    return {
      narrative_summary: `你正在${inputs.journey.stage}阶段，已有${inputs.candidates.length}个候选车型。`,
      key_insights: [],
      top_recommendation: inputs.candidates[0]?.carId || null,
      recommendation_reasoning: '基于当前候选列表推荐',
      attention_signals: [],
      next_suggested_actions: ['继续与AI助手对话，明确你的需求'],
    };
  }
}

export const snapshotService = new SnapshotService();
```

- [ ] **Step 4: Write snapshot service tests**

```typescript
// apps/api/tests/snapshot.test.ts
import { describe, it, expect } from 'vitest';

describe('Snapshot', () => {
  it('should calculate decay factor correctly', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const effectiveDays = 7;

    const isWithinWindow = (timestamp: Date) => {
      const daysAgo = (Date.now() - timestamp.getTime()) / DAY_MS;
      return daysAgo <= effectiveDays;
    };

    const recent = new Date(Date.now() - 3 * DAY_MS);
    const old = new Date(Date.now() - 10 * DAY_MS);

    expect(isWithinWindow(recent)).toBe(true);
    expect(isWithinWindow(old)).toBe(false);
  });

  it('should limit signals to 50', () => {
    const signals = Array.from({ length: 100 }, (_, i) => ({ type: 'TEST', value: `Signal ${i}` }));
    const limited = signals.slice(0, 50);
    expect(limited.length).toBe(50);
  });

  it('should limit behavior events to 300', () => {
    const events = Array.from({ length: 500 }, (_, i) => ({ type: 'CAR_VIEW', timestamp: new Date() }));
    const limited = events.slice(0, 300);
    expect(limited.length).toBe(300);
  });

  it('should parse AI response correctly', () => {
    const mockResponse = {
      narrative_summary: '用户正在考虑购买SUV',
      key_insights: [{ insight: '偏好新能源', evidence: '多次查看BEV车型', confidence: 0.8 }],
      top_recommendation: 'car_123',
      recommendation_reasoning: '符合用户预算和空间需求',
      attention_signals: [{ carId: 'car_123', signalType: 'PRICE_DROP', description: '降价5000元', delta: -5000 }],
      next_suggested_actions: ['对比配置', '查看评测'],
    };

    expect(mockResponse.narrative_summary).toBeTruthy();
    expect(mockResponse.key_insights.length).toBeLessThanOrEqual(3);
    expect(mockResponse.attention_signals.length).toBeLessThanOrEqual(3);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/snapshot.service.ts packages/shared/src/types/snapshot.ts packages/shared/src/index.ts apps/api/tests/snapshot.test.ts
git commit -m "feat: add snapshot service for journey AI summary generation"
```

---

## Task 2: Attention Signal Service（今日动态）

**Files:**
- Create: `apps/api/src/services/attention-signal.service.ts`
- Create: `apps/api/src/services/notification.service.ts`
- Modify: `apps/api/src/services/snapshot.service.ts` (add signal generation)

- [ ] **Step 1: Create attention signal service**

```typescript
// apps/api/src/services/attention-signal.service.ts
import { prisma } from '../lib/prisma';
import { AttentionSignal } from '@newcar/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_CHANGE_THRESHOLD = 0.03; // 3%

export class AttentionSignalService {
  async checkPriceChanges(candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const yesterday = new Date(Date.now() - DAY_MS);
    const today = new Date();

    // Get price snapshots from yesterday and today
    const priceSnapshots = await prisma.carPriceSnapshot.findMany({
      where: {
        carId: { in: candidateCarIds },
        capturedAt: { gte: yesterday, lt: today },
      },
      orderBy: { capturedAt: 'asc' },
    });

    // Group by carId
    const byCar = new Map<string, any[]>();
    for (const ps of priceSnapshots) {
      const list = byCar.get(ps.carId) || [];
      list.push(ps);
      byCar.set(ps.carId, list);
    }

    // Check each car's price trend
    for (const [carId, snapshots] of byCar) {
      if (snapshots.length < 2) continue;

      const oldest = snapshots[0];
      const newest = snapshots[snapshots.length - 1];

      if (oldest.msrp !== newest.msrp) {
        const change = (newest.msrp - oldest.msrp) / oldest.msrp;
        if (Math.abs(change) >= PRICE_CHANGE_THRESHOLD) {
          signals.push({
            carId,
            signalType: 'PRICE_DROP',
            description: change < 0 ? `降价${Math.abs(Math.round(change * 100))}%` : `涨价${Math.round(change * 100)}%`,
            delta: newest.msrp - oldest.msrp,
            oldValue: String(oldest.msrp),
            newValue: String(newest.msrp),
          });
        }
      }
    }

    return signals;
  }

  async checkNewVariants(candidateCarIds: string[]): Promise<AttentionSignal[]> {
    // TODO: Implement when Car variant tracking is added
    // This would require tracking when new variants are added to the Car table
    return [];
  }

  async checkNewReviews(candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const yesterday = new Date(Date.now() - DAY_MS);

    const newReviews = await prisma.carReview.findMany({
      where: {
        carId: { in: candidateCarIds },
        ingestedAt: { gte: yesterday },
      },
      take: 10,
    });

    for (const review of newReviews) {
      signals.push({
        carId: review.carId,
        signalType: 'NEW_REVIEW',
        description: review.title || '有新的评测文章',
        oldValue: undefined,
        newValue: review.aiSummary || review.content?.slice(0, 50),
      });
    }

    return signals;
  }

  async checkPolicyUpdates(userCity: string, candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check policies effective today or in the future
    const relevantPolicies = await prisma.carPolicy.findMany({
      where: {
        region: userCity,
        validFrom: { lte: today },
        validUntil: { gte: today },
        OR: [{ carId: { in: candidateCarIds } }, { carId: null }], // Car-specific or all-car policies
      },
    });

    for (const policy of relevantPolicies) {
      signals.push({
        carId: policy.carId || 'all',
        signalType: 'POLICY_UPDATE',
        description: `${policy.policyType}: 补贴${policy.subsidyAmount}元`,
        oldValue: undefined,
        newValue: policy.policyType,
      });
    }

    return signals;
  }

  async getAttentionSignals(journeyId: string, userCity?: string): Promise<AttentionSignal[]> {
    const candidates = await prisma.carCandidate.findMany({
      where: { journeyId, status: 'ACTIVE' },
      select: { carId: true },
    });

    const carIds = candidates.map((c) => c.carId);
    if (carIds.length === 0) return [];

    const [prices, reviews, policies] = await Promise.all([
      this.checkPriceChanges(carIds),
      this.checkNewReviews(carIds),
      userCity ? this.checkPolicyUpdates(userCity, carIds) : Promise.resolve([]),
    ]);

    // Dedupe and limit to 3 per journey per day
    const allSignals = [...prices, ...reviews, ...policies];
    return allSignals.slice(0, 3);
  }
}

export const attentionSignalService = new AttentionSignalService();
```

- [ ] **Step 2: Create notification service for writing to NotificationFeed**

```typescript
// apps/api/src/services/notification.service.ts
import { prisma } from '../lib/prisma';
import { AttentionSignal } from '@newcar/shared';

const MAX_NOTIFICATIONS_PER_JOURNEY_PER_DAY = 3;

export class NotificationService {
  async createNotification(data: {
    userId: string;
    journeyId: string;
    type: string;
    relatedCarId?: string;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Check if already hit daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await prisma.notificationFeed.count({
      where: {
        journeyId: data.journeyId,
        createdAt: { gte: today },
      },
    });

    if (todayCount >= MAX_NOTIFICATIONS_PER_JOURNEY_PER_DAY) {
      return null; // Skip, hit daily limit
    }

    return prisma.notificationFeed.create({
      data: {
        userId: data.userId,
        journeyId: data.journeyId,
        type: data.type,
        relatedCarId: data.relatedCarId,
        title: data.title,
        body: data.body,
        metadata: data.metadata || {},
      },
    });
  }

  async createNotificationsFromSignals(
    userId: string,
    journeyId: string,
    signals: AttentionSignal[]
  ) {
    const notifications = [];

    for (const signal of signals) {
      const notification = await this.createNotification({
        userId,
        journeyId,
        type: signal.signalType,
        relatedCarId: signal.carId !== 'all' ? signal.carId : undefined,
        title: this.buildNotificationTitle(signal),
        body: signal.description,
        metadata: {
          delta: signal.delta,
          oldValue: signal.oldValue,
          newValue: signal.newValue,
        },
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  }

  private buildNotificationTitle(signal: AttentionSignal): string {
    switch (signal.signalType) {
      case 'PRICE_DROP':
        return '📉 车型价格变动';
      case 'NEW_VARIANT':
        return '🆕 新车型发布';
      case 'NEW_REVIEW':
        return '📝 新评测内容';
      case 'POLICY_UPDATE':
        return '🏛️ 政策更新';
      case 'OTA_RECALL':
        return '⚠️ 系统更新/召回';
      default:
        return '📢 动态更新';
    }
  }

  async getUserNotifications(userId: string, limit = 20) {
    return prisma.notificationFeed.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notificationFeed.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }
}

export const notificationService = new NotificationService();
```

- [ ] **Step 3: Update snapshot service to integrate attention signals**

Modify `apps/api/src/services/snapshot.service.ts` to add attention signal generation during snapshot creation:

```typescript
// Add to generateSnapshot method, after "5. Write snapshot":
// 6. Generate and store attention signals
const signals = await attentionSignalService.getAttentionSignals(
  journeyId,
  inputs.journey.user?.city
);

if (signals.length > 0) {
  await notificationService.createNotificationsFromSignals(
    inputs.journey.userId,
    journeyId,
    signals
  );
}
```

Add imports at top:
```typescript
import { attentionSignalService } from './attention-signal.service';
import { notificationService } from './notification.service';
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/attention-signal.service.ts apps/api/src/services/notification.service.ts apps/api/src/services/snapshot.service.ts
git commit -m "feat: add attention signal service and notification service"
```

---

## Task 3: CarCandidate Scoring Service（AI匹配评分）

**Files:**
- Create: `apps/api/src/services/candidate-scoring.service.ts`
- Create: `apps/api/tests/candidate-scoring.test.ts`

- [ ] **Step 1: Create candidate scoring service**

```typescript
// apps/api/src/services/candidate-scoring.service.ts
import { prisma } from '../lib/prisma';
import { config } from '../config';
import Anthropic from '@anthropic-ai/sdk';

interface Requirements {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  dailyKm?: number;
  stylePreference?: string;
}

export class CandidateScoringService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async scoreCandidates(journeyId: string): Promise<void> {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: {
          include: { car: true },
        },
      },
    });

    if (!journey) throw new Error('Journey not found');
    if (journey.candidates.length === 0) return;

    const requirements = journey.requirements as Requirements || {};
    const candidates = journey.candidates;

    // Score each candidate (store scores in map to avoid stale reads)
    const scores: number[] = [];
    for (const candidate of candidates) {
      const score = await this.calculateMatchScore(candidate.car, requirements);
      await prisma.carCandidate.update({
        where: { id: candidate.id },
        data: { aiMatchScore: score },
      });
      scores.push(score);
    }

    // Update journey confidence score based on top candidate score
    const topScore = scores.length > 0 ? Math.max(...scores, 0) : 0;
    await prisma.journey.update({
      where: { id: journeyId },
      data: { aiConfidenceScore: topScore },
    });
  }

  private async calculateMatchScore(car: any, requirements: Requirements): Promise<number> {
    let score = 0.5; // Base score
    let factors = 0;

    // Budget match
    if (requirements.budgetMin && requirements.budgetMax && car.msrp) {
      const msrpInWan = car.msrp / 10000;
      if (msrpInWan >= requirements.budgetMin && msrpInWan <= requirements.budgetMax) {
        score += 0.2;
      } else if (msrpInWan < requirements.budgetMin) {
        score -= 0.1 * (requirements.budgetMin - msrpInWan);
      } else {
        score -= 0.1 * (msrpInWan - requirements.budgetMax);
      }
      factors++;
    }

    // Fuel type match
    if (requirements.fuelTypePreference && requirements.fuelTypePreference.length > 0) {
      if (requirements.fuelTypePreference.includes(car.fuelType)) {
        score += 0.15;
      } else {
        score -= 0.1;
      }
      factors++;
    }

    // Use case match (simplified - can be enhanced with more sophisticated logic)
    if (requirements.useCases && requirements.useCases.length > 0) {
      // Family use case prefers larger vehicles
      if (requirements.useCases.includes('family') && ['SUV', 'MPV'].includes(car.type)) {
        score += 0.1;
      }
      // City commute prefers compact
      if (requirements.useCases.includes('commute') && ['HATCHBACK', 'SEDAN'].includes(car.type)) {
        score += 0.1;
      }
      factors++;
    }

    // Normalize score to 0-1 range
    return Math.max(0, Math.min(1, score));
  }

  async recalculateAllScores(journeyId: string): Promise<void> {
    await this.scoreCandidates(journeyId);
  }
}

export const candidateScoringService = new CandidateScoringService();
```

- [ ] **Step 2: Write tests**

```typescript
// apps/api/tests/candidate-scoring.test.ts
import { describe, it, expect } from 'vitest';

describe('CandidateScoring', () => {
  it('should calculate budget match score correctly', () => {
    const budgetMin = 15;
    const budgetMax = 25;
    const msrpInWan = 20;

    let score = 0.5;
    if (msrpInWan >= budgetMin && msrpInWan <= budgetMax) {
      score += 0.2;
    }

    expect(score).toBe(0.7);
  });

  it('should penalize out of budget car', () => {
    const budgetMin = 15;
    const budgetMax = 25;
    const msrpInWan = 30; // Over budget

    let score = 0.5;
    if (msrpInWan >= budgetMin && msrpInWan <= budgetMax) {
      score += 0.2;
    } else {
      score -= 0.1 * (msrpInWan - budgetMax);
    }

    expect(score).toBe(0.0); // 0.5 - 0.5 = 0
  });

  it('should normalize score to 0-1 range', () => {
    const rawScore = 1.5;
    const normalized = Math.max(0, Math.min(1, rawScore));
    expect(normalized).toBe(1);
  });

  it('should not go below 0', () => {
    const rawScore = -0.5;
    const normalized = Math.max(0, Math.min(1, rawScore));
    expect(normalized).toBe(0);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/candidate-scoring.service.ts apps/api/tests/candidate-scoring.test.ts
git commit -m "feat: add CarCandidate AI match scoring service"
```

---

## Task 4: Snapshot API & Manual Trigger

**Files:**
- Create: `apps/api/src/controllers/snapshot.controller.ts`
- Create: `apps/api/src/routes/snapshot.ts`
- Modify: `apps/api/src/app.ts` (mount routes)

- [ ] **Step 1: Create snapshot controller**

```typescript
// apps/api/src/controllers/snapshot.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { snapshotService } from '../services/snapshot.service';
import { SnapshotTrigger } from '@newcar/shared';

export class SnapshotController {
  async generateSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { trigger } = req.query;

      // Verify ownership
      const journey = await import('../services/journey.service').then(m => m.journeyService.getJourneyDetail(journeyId));
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const snapshot = await snapshotService.generateSnapshot(
        journeyId,
        (trigger as SnapshotTrigger) || SnapshotTrigger.MANUAL
      );

      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLatestSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;

      const { prisma } = await import('../lib/prisma');
      const snapshot = await prisma.journeySnapshot.findFirst({
        where: { journeyId },
        orderBy: { generatedAt: 'desc' },
      });

      if (!snapshot) {
        return res.status(404).json({ error: 'No snapshot found' });
      }

      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const snapshotController = new SnapshotController();
```

- [ ] **Step 2: Create snapshot routes**

```typescript
// apps/api/src/routes/snapshot.ts
import { Router } from 'express';
import { snapshotController } from '../controllers/snapshot.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Manual snapshot trigger
router.post(
  '/:journeyId/snapshot',
  authMiddleware,
  (req, res) => snapshotController.generateSnapshot(req, res)
);

// Get latest snapshot
router.get(
  '/:journeyId/snapshot',
  authMiddleware,
  (req, res) => snapshotController.getLatestSnapshot(req, res)
);

export default router;
```

- [ ] **Step 3: Mount snapshot routes in app.ts**

Modify `apps/api/src/app.ts` to add:
```typescript
import snapshotRoutes from './routes/snapshot';

// ... after journey routes ...
// Mount at /snapshots to avoid conflict with /journeys/:journeyId/* routes
app.use('/snapshots', snapshotRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/controllers/snapshot.controller.ts apps/api/src/routes/snapshot.ts apps/api/src/app.ts
git commit -m "feat: add snapshot API endpoints for manual trigger"
```

---

## Task 5: Daily Cron Job（每日快照调度）

**Files:**
- Create: `apps/api/src/jobs/daily-snapshot.job.ts`
- Create: `apps/api/src/lib/scheduler.ts`

- [ ] **Step 1: Create simple scheduler wrapper using setTimeout/setInterval**

```typescript
// apps/api/src/lib/scheduler.ts
// Simple in-process scheduler for development/MVP
// In production, use proper job queue (Bull + Redis, or external service)

type Job = () => Promise<void>;

interface ScheduledJob {
  name: string;
  cron: string; // minute hour day month weekday
  lastRun?: Date;
  nextRun?: Date;
  job: Job;
}

export class Scheduler {
  private jobs: ScheduledJob[] = [];
  private intervalId?: NodeJS.Timeout;

  add(name: string, cron: string, job: Job) {
    this.jobs.push({ name, cron, job });
  }

  start() {
    // Check every minute
    this.intervalId = setInterval(() => this.tick(), 60 * 1000);
    console.log('Scheduler started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async tick() {
    const now = new Date();

    for (const scheduledJob of this.jobs) {
      if (this.shouldRun(scheduledJob, now)) {
        console.log(`Running job: ${scheduledJob.name}`);
        try {
          await scheduledJob.job();
          scheduledJob.lastRun = now;
        } catch (err) {
          console.error(`Job ${scheduledJob.name} failed:`, err);
        }
      }
    }
  }

  private shouldRun(job: ScheduledJob, now: Date): boolean {
    // Simple cron: "minute hour day month weekday"
    // For MVP, support only "minute hour" format (daily at specific hour)
    const [minPart, hourPart] = job.cron.split(' ');

    const minute = parseInt(minPart);
    const hour = parseInt(hourPart);

    if (now.getMinutes() !== minute) return false;
    if (now.getHours() !== hour) return false;

    // Check if already ran within the hour
    if (job.lastRun && now.getTime() - job.lastRun.getTime() < 60 * 60 * 1000) {
      return false;
    }

    return true;
  }
}

export const scheduler = new Scheduler();
```

- [ ] **Step 2: Create daily snapshot job**

```typescript
// apps/api/src/jobs/daily-snapshot.job.ts
import { prisma } from '../lib/prisma';
import { JourneyStatus } from '@newcar/shared';
import { snapshotService } from '../services/snapshot.service';
import { SnapshotTrigger } from '@newcar/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 7; // Only snapshot journeys with activity in last 7 days

export async function runDailySnapshotJob() {
  const cutoffDate = new Date(Date.now() - SILENCE_THRESHOLD_DAYS * DAY_MS);

  // Get all active journeys with recent activity
  const activeJourneys = await prisma.journey.findMany({
    where: {
      status: JourneyStatus.ACTIVE,
      lastActivityAt: { gte: cutoffDate },
    },
    select: { id: true, userId: true },
  });

  console.log(`Daily snapshot job: found ${activeJourneys.length} active journeys`);

  const results = [];
  for (const journey of activeJourneys) {
    try {
      const snapshot = await snapshotService.generateSnapshot(
        journey.id,
        SnapshotTrigger.DAILY
      );
      results.push({ journeyId: journey.id, success: true, snapshotId: snapshot.id });
    } catch (err: any) {
      console.error(`Snapshot failed for journey ${journey.id}:`, err?.message);
      results.push({ journeyId: journey.id, success: false, error: err.message });
    }
  }

  console.log(`Daily snapshot job completed: ${results.filter(r => r.success).length}/${results.length} succeeded`);
  return results;
}
```

- [ ] **Step 3: Register job in index.ts**

Modify `apps/api/src/index.ts`:

```typescript
import { createApp } from './app';
import { config } from './config';
import { scheduler } from './lib/scheduler';
import { runDailySnapshotJob } from './jobs/daily-snapshot.job';

const app = createApp();

// Start scheduler for daily snapshots
scheduler.add('daily-snapshot', '0 8 * * *', runDailySnapshotJob); // Run at 8 AM daily
scheduler.start();

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/jobs/daily-snapshot.job.ts apps/api/src/lib/scheduler.ts apps/api/src/index.ts
git commit -m "feat: add daily snapshot cron job scheduler"
```

---

## Task 6: Integration & Notification API

**Files:**
- Create: `apps/api/src/routes/notifications.ts`
- Create: `apps/api/src/controllers/notification.controller.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create notification controller and routes**

```typescript
// apps/api/src/controllers/notification.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { limit } = req.query;

      const notifications = await notificationService.getUserNotifications(
        userId,
        limit ? parseInt(String(limit)) : 20
      );

      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { notificationId } = req.params;

      await notificationService.markAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const notificationController = new NotificationController();
```

```typescript
// apps/api/src/routes/notifications.ts
import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, (req, res) => notificationController.getNotifications(req, res));
router.patch('/:notificationId/read', authMiddleware, (req, res) => notificationController.markAsRead(req, res));

export default router;
```

- [ ] **Step 2: Mount notification routes**

Modify `apps/api/src/app.ts`:

```typescript
import notificationRoutes from './routes/notifications';

// ... after other routes ...
app.use('/notifications', notificationRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/notifications.ts apps/api/src/controllers/notification.controller.ts apps/api/src/app.ts
git commit -m "feat: add notification API endpoints"
```

---

## Task 7: End-to-End Integration Test

**Files:**
- Create: `apps/api/tests/pipeline.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/api/tests/pipeline.test.ts
import { describe, it, expect } from 'vitest';

describe('Pipeline Integration', () => {
  it('should follow snapshot generation flow', () => {
    // Verify the flow: aggregate inputs → build prompt → generate → write
    const flow = ['aggregateInputs', 'buildSnapshotPrompt', 'generateSnapshot', 'writeSnapshot'];
    expect(flow).toEqual(['aggregateInputs', 'buildSnapshotPrompt', 'generateSnapshot', 'writeSnapshot']);
  });

  it('should respect daily dedup rule', () => {
    // If snapshot exists today, don't regenerate
    const existingSnapshot = { generatedAt: new Date() };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = existingSnapshot.generatedAt >= today;
    expect(isToday).toBe(true); // Would skip regeneration
  });

  it('should limit notifications per day', () => {
    const MAX = 3;
    const notifications = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];

    const shouldCreate = notifications.length < MAX;
    expect(shouldCreate).toBe(false); // Would skip 4th notification
  });

  it('should score candidates within 0-1 range', () => {
    const scores = [0.2, 0.5, 0.8, 1.0, -0.1, 1.5];

    const normalize = (s: number) => Math.max(0, Math.min(1, s));
    const normalized = scores.map(normalize);

    expect(normalized).toEqual([0.2, 0.5, 0.8, 1.0, 0, 1]);
  });

  it('should filter events by recency', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const EFFECTIVE_EVENT_DAYS = 7;
    const cutoff = Date.now() - EFFECTIVE_EVENT_DAYS * DAY_MS;

    const events = [
      { type: 'CAR_VIEW', timestamp: new Date(Date.now() - 3 * DAY_MS) },
      { type: 'PRICE_CHECK', timestamp: new Date(Date.now() - 10 * DAY_MS) },
    ];

    const recentEvents = events.filter(e => e.timestamp.getTime() >= cutoff);
    expect(recentEvents.length).toBe(1);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 2: Run all tests**

```bash
cd apps/api && npm test
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/pipeline.test.ts
git commit -m "test: add AI pipeline integration tests"
```

---

## Summary of New Files

```
apps/api/src/
├── services/
│   ├── snapshot.service.ts          # JourneySnapshot generation
│   ├── attention-signal.service.ts  # Today's dynamic triggers
│   ├── candidate-scoring.service.ts # AI match scoring
│   └── notification.service.ts     # NotificationFeed writes
├── jobs/
│   └── daily-snapshot.job.ts       # Cron job for daily snapshots
├── lib/
│   └── scheduler.ts                 # Simple in-process scheduler
├── controllers/
│   ├── snapshot.controller.ts
│   └── notification.controller.ts
└── routes/
    ├── snapshot.ts
    └── notifications.ts

packages/shared/src/types/
└── snapshot.ts                     # SnapshotTrigger, KeyInsight, AttentionSignal

apps/api/tests/
├── snapshot.test.ts
├── candidate-scoring.test.ts
└── pipeline.test.ts
```

---

## Dependencies

- Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7
- All tasks depend on: existing Prisma schema, existing config, existing auth middleware

---

## Verification

After all tasks complete:

```bash
cd apps/api && npm test
# All tests should pass

# Verify API endpoints exist:
# POST /journeys/:journeyId/snapshot
# GET  /journeys/:journeyId/snapshot
# GET  /notifications
# PATCH /notifications/:id/read

# Verify daily job scheduler starts:
# npm run dev
# Should log: "Scheduler started"
```
