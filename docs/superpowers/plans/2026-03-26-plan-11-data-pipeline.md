# Plan 11: 数据链路补全 + 实时更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全数据链路（AI tool → DB → WS → 前端），让用户在聊天中感受到"产品在陪我做决策"的实时获得感。

**Architecture:** 扩展 CarCandidate 字段 + 新增 TimelineEvent 模型 → 增强 AI tool call 输出 → 统一 side effect 推送格式 → 前端 store 响应新事件类型 → Mock 模式改为环境变量控制。

**Tech Stack:** Prisma (PostgreSQL), Express.js, WebSocket (ws), Zustand, Next.js, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-25-journey-data-flow-design.md` (Parts 1 + 5)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/types/timeline.ts` | TimelineEvent 类型定义和枚举 |
| `apps/api/src/services/timeline.service.ts` | TimelineEvent CRUD + 创建逻辑 |
| `apps/api/src/routes/timeline.ts` | 时间线 REST API 路由 |
| `apps/api/src/controllers/timeline.controller.ts` | 时间线 HTTP 控制器 |
| `apps/api/tests/timeline.test.ts` | 时间线服务单元测试 |
| `apps/api/tests/add-candidate-enhanced.test.ts` | 增强后的 add_candidate 工具测试 |

### Modified Files

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | CarCandidate 新增 4 字段 + 新增 TimelineEvent 模型 |
| `packages/shared/src/types/timeline.ts` | 新增 TimelineEventType 枚举 |
| `packages/shared/src/index.ts` | 导出 timeline 类型 |
| `apps/api/src/tools/add-candidate.tool.ts` | 输出增加 matchTags/recommendReason/relevantDimensions |
| `apps/api/src/tools/chat-tools.ts` | ChatSideEffect 扩展新事件类型 |
| `apps/api/src/services/car-candidate.service.ts` | addCandidate 接受新字段 |
| `apps/api/src/services/candidate-scoring.service.ts` | 新增 updateRankScore 方法 |
| `apps/api/src/services/ai-chat.service.ts` | tool 执行后写入 TimelineEvent |
| `apps/api/src/app.ts` | 注册 timeline 路由 |
| `apps/web/src/types/api.ts` | Candidate 类型扩展新字段 + TimelineEvent 类型 |
| `apps/web/src/store/chat.store.ts` | 处理新 side effect 事件类型 + 断连重连 |
| `apps/web/src/lib/api.ts` | MOCK_MODE 改为环境变量 |
| `apps/web/src/lib/mock-data.ts` | 新增 timeline mock 数据 |
| `apps/web/src/lib/journey-workspace-events.ts` | 扩展 JourneySideEffectEvent 类型 |
| `apps/api/src/controllers/car-candidate.controller.ts` | 淘汰/选定操作发出 side effect |

---

## Task 1: Prisma Schema — CarCandidate 扩展 + TimelineEvent 模型

**Files:**
- Modify: `apps/api/prisma/schema.prisma:114-132` (CarCandidate)
- Modify: `apps/api/prisma/schema.prisma` (新增 TimelineEvent 模型，在 CarCandidate 之后)

- [ ] **Step 1: 给 CarCandidate 新增 4 个字段**

在 `apps/api/prisma/schema.prisma` 的 CarCandidate 模型中，`userNotes` 后面加：

```prisma
  matchTags          Json     @default("[]")
  recommendReason    String?
  relevantDimensions Json     @default("[]")
  candidateRankScore Float?
```

- [ ] **Step 2: 新增 TimelineEvent 模型**

在 CarCandidate 模型之后、JourneySnapshot 模型之前添加：

```prisma
model TimelineEvent {
  id        String   @id @default(cuid())
  journeyId String
  type      String
  content   String
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  journey Journey @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@index([journeyId, createdAt])
  @@map("timeline_events")
}
```

同时在 Journey 模型中添加关联：

```prisma
  timelineEvents TimelineEvent[]
```

在 Journey 模型的 relations 部分（`publishedJourney` 之后）加上这行。

- [ ] **Step 3: 生成并应用 migration**

Run: `cd apps/api && npx prisma migrate dev --name add-timeline-and-candidate-fields`

Expected: Migration 成功，新表 `timeline_events` 创建，`car_candidates` 表新增 4 列。

- [ ] **Step 4: 验证 Prisma client 生成**

Run: `cd apps/api && npx prisma generate`

Expected: 无错误，PrismaClient 包含 TimelineEvent 模型和 CarCandidate 新字段。

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add TimelineEvent model and CarCandidate enhanced fields"
```

---

## Task 2: Shared Types — TimelineEventType 枚举

**Files:**
- Create: `packages/shared/src/types/timeline.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建 timeline 类型文件**

```typescript
// packages/shared/src/types/timeline.ts

export enum TimelineEventType {
  CANDIDATE_ADDED = 'CANDIDATE_ADDED',
  CANDIDATE_ELIMINATED = 'CANDIDATE_ELIMINATED',
  CANDIDATE_WINNER = 'CANDIDATE_WINNER',
  STAGE_CHANGED = 'STAGE_CHANGED',
  REQUIREMENT_UPDATED = 'REQUIREMENT_UPDATED',
  AI_INSIGHT = 'AI_INSIGHT',
  PRICE_CHANGE = 'PRICE_CHANGE',
  USER_ACTION = 'USER_ACTION',
  PUBLISH_SUGGESTION = 'PUBLISH_SUGGESTION',
  JOURNEY_PUBLISHED = 'JOURNEY_PUBLISHED',
}

export interface TimelineEventData {
  id: string;
  journeyId: string;
  type: TimelineEventType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

- [ ] **Step 2: 导出 timeline 类型**

在 `packages/shared/src/index.ts` 末尾添加：

```typescript
export * from './types/timeline';
```

- [ ] **Step 3: 验证构建**

Run: `cd packages/shared && npm run build 2>/dev/null || npx tsc --noEmit`

Expected: 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/timeline.ts packages/shared/src/index.ts
git commit -m "feat: add TimelineEventType enum and shared types"
```

---

## Task 3: Timeline Service — CRUD + 事件创建

**Files:**
- Create: `apps/api/src/services/timeline.service.ts`
- Create: `apps/api/tests/timeline.test.ts`

- [ ] **Step 1: 写 timeline service 测试**

```typescript
// apps/api/tests/timeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    timelineEvent: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { timelineService } from '../src/services/timeline.service';

describe('TimelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a timeline event with correct fields', async () => {
    const mockEvent = {
      id: 'te-1',
      journeyId: 'j-1',
      type: 'CANDIDATE_ADDED',
      content: 'AI 推荐了理想L6',
      metadata: { candidateId: 'c-1', carName: '理想 L6' },
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValue(mockEvent);

    const result = await timelineService.createEvent({
      journeyId: 'j-1',
      type: 'CANDIDATE_ADDED',
      content: 'AI 推荐了理想L6',
      metadata: { candidateId: 'c-1', carName: '理想 L6' },
    });

    expect(result).toEqual(mockEvent);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        journeyId: 'j-1',
        type: 'CANDIDATE_ADDED',
        content: 'AI 推荐了理想L6',
        metadata: { candidateId: 'c-1', carName: '理想 L6' },
      },
    });
  });

  it('lists timeline events ordered by createdAt desc', async () => {
    mockFindMany.mockResolvedValue([]);

    await timelineService.listEvents('j-1', { limit: 50, cursor: undefined });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { journeyId: 'j-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx vitest run tests/timeline.test.ts`

Expected: FAIL — `timeline.service` 模块不存在。

- [ ] **Step 3: 实现 timeline service**

```typescript
// apps/api/src/services/timeline.service.ts
import { prisma } from '../lib/prisma';

export class TimelineService {
  async createEvent(data: {
    journeyId: string;
    type: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.timelineEvent.create({
      data: {
        journeyId: data.journeyId,
        type: data.type,
        content: data.content,
        metadata: data.metadata || {},
      },
    });
  }

  async listEvents(
    journeyId: string,
    options: { limit?: number; cursor?: string }
  ) {
    const { limit = 50, cursor } = options;
    return prisma.timelineEvent.findMany({
      where: { journeyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }
}

export const timelineService = new TimelineService();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/timeline.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/timeline.service.ts apps/api/tests/timeline.test.ts
git commit -m "feat: add TimelineService with create and list operations"
```

---

## Task 4: Timeline REST API — Controller + Routes

**Files:**
- Create: `apps/api/src/controllers/timeline.controller.ts`
- Create: `apps/api/src/routes/timeline.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: 创建 timeline controller**

```typescript
// apps/api/src/controllers/timeline.controller.ts
import { Request, Response, NextFunction } from 'express';
import { timelineService } from '../services/timeline.service';

export class TimelineController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { journeyId } = req.params;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const events = await timelineService.listEvents(journeyId, { limit, cursor });
      res.json({ events });
    } catch (err) {
      next(err);
    }
  }
}

export const timelineController = new TimelineController();
```

- [ ] **Step 2: 创建 timeline 路由**

```typescript
// apps/api/src/routes/timeline.ts
import { Router } from 'express';
import { timelineController } from '../controllers/timeline.controller';

const router = Router();

// GET /journeys/:journeyId/timeline
router.get('/:journeyId/timeline', (req, res, next) => timelineController.list(req, res, next));

export default router;
```

- [ ] **Step 3: 注册路由到 app.ts**

在 `apps/api/src/app.ts` 中，找到 journey 路由注册的位置，在其附近添加：

```typescript
import timelineRoutes from './routes/timeline';
```

然后在路由注册区域添加：

```typescript
app.use('/journeys', timelineRoutes);
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/timeline.controller.ts apps/api/src/routes/timeline.ts apps/api/src/app.ts
git commit -m "feat: add timeline REST API endpoint GET /journeys/:id/timeline"
```

---

## Task 5: 增强 add_candidate tool — 输出 matchTags/recommendReason/relevantDimensions

**Files:**
- Modify: `apps/api/src/tools/add-candidate.tool.ts`
- Modify: `apps/api/src/services/car-candidate.service.ts:6-37`
- Create: `apps/api/tests/add-candidate-enhanced.test.ts`

- [ ] **Step 1: 写增强 add_candidate 的测试**

```typescript
// apps/api/tests/add-candidate-enhanced.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    carCandidate: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

import { carCandidateService } from '../src/services/car-candidate.service';
import { AddedReason } from '@newcar/shared';

describe('CarCandidateService.addCandidate enhanced fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null); // no existing candidate
  });

  it('passes matchTags, recommendReason, relevantDimensions to prisma create', async () => {
    const mockResult = { id: 'c-1', car: { brand: '理想', model: 'L6' } };
    mockCreate.mockResolvedValue(mockResult);

    await carCandidateService.addCandidate({
      journeyId: 'j-1',
      carId: 'car-1',
      addedReason: AddedReason.AI_RECOMMENDED,
      matchTags: ['符合预算', '纯电续航达标'],
      recommendReason: '续航和空间都很突出',
      relevantDimensions: ['续航', '空间', '价格'],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchTags: ['符合预算', '纯电续航达标'],
          recommendReason: '续航和空间都很突出',
          relevantDimensions: ['续航', '空间', '价格'],
        }),
      })
    );
  });

  it('defaults matchTags and relevantDimensions to empty arrays when not provided', async () => {
    const mockResult = { id: 'c-2', car: { brand: '小鹏', model: 'G6' } };
    mockCreate.mockResolvedValue(mockResult);

    await carCandidateService.addCandidate({
      journeyId: 'j-1',
      carId: 'car-2',
      addedReason: AddedReason.USER_SEARCHED,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchTags: [],
          relevantDimensions: [],
        }),
      })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx vitest run tests/add-candidate-enhanced.test.ts`

Expected: FAIL — addCandidate 不接受 matchTags 等参数。

- [ ] **Step 3: 修改 car-candidate.service.ts 接受新字段**

在 `apps/api/src/services/car-candidate.service.ts` 的 `addCandidate` 方法参数中新增：

```typescript
  async addCandidate(data: {
    journeyId: string;
    carId: string;
    addedReason: AddedReason;
    priceAtAdd?: number;
    userNotes?: string;
    matchTags?: string[];
    recommendReason?: string;
    relevantDimensions?: string[];
  }) {
```

在 `prisma.carCandidate.create` 的 `data` 中新增：

```typescript
        matchTags: data.matchTags || [],
        recommendReason: data.recommendReason,
        relevantDimensions: data.relevantDimensions || [],
```

- [ ] **Step 4: 修改 add-candidate.tool.ts 传递新字段**

在 `apps/api/src/tools/add-candidate.tool.ts` 的 `addCandidateTool.input_schema.properties` 中新增：

```typescript
      matchTags: { type: 'array', items: { type: 'string' }, description: '匹配标签，如 ["符合预算", "纯电续航达标"]' },
      recommendReason: { type: 'string', description: '推荐理由，一句话说明为什么推荐' },
      relevantDimensions: { type: 'array', items: { type: 'string' }, description: '用户最关注的维度，如 ["续航", "空间", "价格"]' },
```

在 `runAddCandidate` 函数的 `carCandidateService.addCandidate` 调用中新增：

```typescript
    matchTags: Array.isArray(input.matchTags) ? input.matchTags.map(String) : undefined,
    recommendReason: typeof input.recommendReason === 'string' ? input.recommendReason : undefined,
    relevantDimensions: Array.isArray(input.relevantDimensions) ? input.relevantDimensions.map(String) : undefined,
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/add-candidate-enhanced.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/tools/add-candidate.tool.ts apps/api/src/services/car-candidate.service.ts apps/api/tests/add-candidate-enhanced.test.ts
git commit -m "feat: enhance add_candidate with matchTags, recommendReason, relevantDimensions"
```

---

## Task 6: Tool 执行后写入 TimelineEvent

**Files:**
- Modify: `apps/api/src/services/ai-chat.service.ts`
- Modify: `apps/api/src/tools/chat-tools.ts`

- [ ] **Step 1: 扩展 ChatSideEffect 类型**

在 `apps/api/src/tools/chat-tools.ts` 中修改 `ChatSideEffect` 接口：

```typescript
export interface ChatSideEffect {
  event: 'candidate_added' | 'candidate_eliminated' | 'candidate_winner'
       | 'journey_updated' | 'stage_changed' | 'ai_insight'
       | 'publish_suggestion' | 'journey_published';
  data: unknown;
}
```

同时修改 `ChatToolName`：

```typescript
export type ChatToolName = 'car_search' | 'car_detail' | 'journey_update' | 'add_candidate';
```

（保持不变，但确认类型一致）

- [ ] **Step 2: 在 ai-chat.service.ts 中导入 timelineService**

在文件顶部 import 区添加：

```typescript
import { timelineService } from './timeline.service';
import { TimelineEventType } from '@newcar/shared';
```

- [ ] **Step 3: 在 side_effect 处理后写入 TimelineEvent**

在 `ai-chat.service.ts` 的 `runChat` 方法中，找到处理 side_effect 的代码块（约 244-251 行）：

```typescript
        if (event.type === 'side_effect') {
          this.logChat(data.traceId, 'tool_side_effect', {
            conversationId: conversation.id,
            sideEffect: event.event,
          });
          data.onEvent?.(event);
          return;
        }
```

替换为：

```typescript
        if (event.type === 'side_effect') {
          this.logChat(data.traceId, 'tool_side_effect', {
            conversationId: conversation.id,
            sideEffect: event.event,
          });

          // Write timeline event
          const timelineEvent = await this.createTimelineFromSideEffect(
            data.journeyId,
            event.event as ChatSideEffect['event'],
            event.data
          );

          // Push side effect with timeline event attached
          data.onEvent?.({
            ...event,
            data: {
              ...(typeof event.data === 'object' && event.data !== null ? event.data : {}),
              timelineEvent,
            },
          });
          return;
        }
```

- [ ] **Step 4: 实现 createTimelineFromSideEffect 方法**

在 `AiChatService` 类中添加私有方法：

```typescript
  private async createTimelineFromSideEffect(
    journeyId: string,
    event: ChatSideEffect['event'],
    data: unknown
  ) {
    const eventData = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const car = eventData.car as Record<string, unknown> | undefined;
    const carName = car ? `${car.brand} ${car.model}` : '';

    const eventMap: Record<string, { type: string; content: string }> = {
      candidate_added: {
        type: TimelineEventType.CANDIDATE_ADDED,
        content: `AI 推荐了${carName}`,
      },
      candidate_eliminated: {
        type: TimelineEventType.CANDIDATE_ELIMINATED,
        content: `${carName}已被淘汰`,
      },
      candidate_winner: {
        type: TimelineEventType.CANDIDATE_WINNER,
        content: `${carName}被选为最终车型`,
      },
      journey_updated: {
        type: TimelineEventType.REQUIREMENT_UPDATED,
        content: '需求信息已更新',
      },
      stage_changed: {
        type: TimelineEventType.STAGE_CHANGED,
        content: `旅程进入${(eventData.stage as string) || '新'}阶段`,
      },
      ai_insight: {
        type: TimelineEventType.AI_INSIGHT,
        content: (eventData.insight as string) || 'AI 生成了新洞察',
      },
    };

    const mapped = eventMap[event];
    if (!mapped) return null;

    return timelineService.createEvent({
      journeyId,
      type: mapped.type,
      content: mapped.content,
      metadata: eventData,
    });
  }
```

- [ ] **Step 5: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/ai-chat.service.ts apps/api/src/tools/chat-tools.ts
git commit -m "feat: write TimelineEvent on every tool call side effect"
```

---

## Task 7: 阶段推进时自动生成 PUBLISH_SUGGESTION

**Files:**
- Modify: `apps/api/src/tools/journey-update.tool.ts`

- [ ] **Step 1: 在 stage_changed 时检查是否需要生成 PUBLISH_SUGGESTION**

在 `apps/api/src/tools/journey-update.tool.ts` 中导入：

```typescript
import { JourneyStage, TimelineEventType } from '@newcar/shared';
import { journeyService } from '../services/journey.service';
import { timelineService } from '../services/timeline.service';
```

同时修改 `runJourneyUpdate` 函数的 `sideEffects` 类型声明（约第 30 行）：

```typescript
  const sideEffects: Array<{ event: ChatSideEffect['event']; data: unknown }> = [];
```

需要在文件顶部添加 import：

```typescript
import type { ChatSideEffect } from './chat-tools';
```

在 stage 更新逻辑后面（`sideEffects.push({ event: 'stage_changed' ...})` 之后），添加：

```typescript
    // Auto-generate PUBLISH_SUGGESTION when entering DECISION or PURCHASE
    if (
      typeof input.stage === 'string' &&
      (input.stage === JourneyStage.DECISION || input.stage === JourneyStage.PURCHASE)
    ) {
      await timelineService.createEvent({
        journeyId,
        type: TimelineEventType.PUBLISH_SUGGESTION,
        content: '你的购车旅程已经很完整了，要把你的经历分享给正在纠结的人吗？',
        metadata: { stage: input.stage },
      });
      sideEffects.push({
        event: 'publish_suggestion',
        data: { stage: input.stage },
      });
    }
```

- [ ] **Step 2: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/tools/journey-update.tool.ts
git commit -m "feat: auto-generate PUBLISH_SUGGESTION on DECISION/PURCHASE stage"
```

---

## Task 8: 候选车排序权重计算 (candidateRankScore)

**Files:**
- Modify: `apps/api/src/services/candidate-scoring.service.ts`
- Modify: `apps/api/src/services/ai-chat.service.ts` （在 candidate_added side effect 后调用）

- [ ] **Step 1: 读取现有的 candidate-scoring.service.ts**

先阅读当前文件内容了解已有逻辑。注意 `BehaviorEvent` 模型字段名为 `type`（非 `eventType`）。

- [ ] **Step 2: 添加 candidateRankScore 计算方法（含 5 分钟节流）**

在 `CandidateScoringService` 类中添加：

```typescript
  // 节流：记录上次计算时间，同一候选车 5 分钟内最多重算一次
  private lastRankUpdate = new Map<string, number>();

  async updateRankScore(candidateId: string, journeyId: string) {
    const now = Date.now();
    const lastUpdate = this.lastRankUpdate.get(candidateId) || 0;
    if (now - lastUpdate < 5 * 60 * 1000) return; // 5 分钟节流

    const candidate = await prisma.carCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) return;

    // Base score from AI match
    const baseScore = candidate.aiMatchScore || 0.5;

    // Behavior weight: 查询近 7 天行为事件
    const events = await prisma.behaviorEvent.findMany({
      where: {
        journeyId,
        targetId: candidate.carId,
        timestamp: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    let behaviorBonus = 0;
    for (const event of events) {
      if (event.type === 'CAR_VIEW') behaviorBonus += 0.05;
      if (event.type === 'COMPARISON_OPEN') behaviorBonus += 0.08;
      if (event.type === 'PRICE_CHECK') behaviorBonus += 0.03;
    }

    const rankScore = Math.min(1, baseScore + behaviorBonus);

    await prisma.carCandidate.update({
      where: { id: candidateId },
      data: { candidateRankScore: rankScore },
    });

    this.lastRankUpdate.set(candidateId, now);
    return rankScore;
  }
```

- [ ] **Step 3: 在 ai-chat.service.ts 中接入 rankScore 计算**

在 `ai-chat.service.ts` 的 `createTimelineFromSideEffect` 方法末尾（`return timelineService.createEvent(...)` 之前），当事件为 `candidate_added` 时触发 rankScore 更新：

```typescript
    // Trigger rank score update for candidate events
    if (event === 'candidate_added' && eventData.id) {
      candidateScoringService.updateRankScore(
        String(eventData.id),
        journeyId
      ).catch(() => {}); // fire-and-forget, don't block WS response
    }
```

在 `ai-chat.service.ts` 顶部添加 import：

```typescript
import { candidateScoringService } from './candidate-scoring.service';
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/candidate-scoring.service.ts apps/api/src/services/ai-chat.service.ts
git commit -m "feat: add candidateRankScore calculation with 5-min throttle"
```

---

## Task 9: WebSocket 协议统一 + 断连重连 + 前端类型扩展

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/lib/journey-workspace-events.ts`
- Modify: `apps/web/src/store/chat.store.ts`

- [ ] **Step 1: 在前端类型中添加 TimelineEvent**

在 `apps/web/src/types/api.ts` 中添加：

```typescript
// Timeline
export type TimelineEventType =
  | 'CANDIDATE_ADDED' | 'CANDIDATE_ELIMINATED' | 'CANDIDATE_WINNER'
  | 'STAGE_CHANGED' | 'REQUIREMENT_UPDATED' | 'AI_INSIGHT'
  | 'PRICE_CHANGE' | 'USER_ACTION'
  | 'PUBLISH_SUGGESTION' | 'JOURNEY_PUBLISHED';

export interface TimelineEvent {
  id: string;
  journeyId: string;
  type: TimelineEventType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

在 `Candidate` 接口中新增字段：

```typescript
  matchTags?: string[];
  recommendReason?: string | null;
  relevantDimensions?: string[];
  candidateRankScore?: number | null;
```

- [ ] **Step 2: 扩展 journey-workspace-events.ts 事件类型**

在 `apps/web/src/lib/journey-workspace-events.ts` 中，扩展 `JourneySideEffectEvent` 类型：

```typescript
export type JourneySideEffectEvent =
  | { event: 'candidate_added'; journeyId: string; data: unknown }
  | { event: 'candidate_eliminated'; journeyId: string; data: unknown }
  | { event: 'candidate_winner'; journeyId: string; data: unknown }
  | { event: 'journey_updated'; journeyId: string; data: unknown }
  | { event: 'stage_changed'; journeyId: string; data: unknown }
  | { event: 'ai_insight'; journeyId: string; data: unknown }
  | { event: 'publish_suggestion'; journeyId: string; data: unknown }
  | { event: 'timeline_event'; journeyId: string; data: unknown };
```

- [ ] **Step 3: 扩展 chat store 的 SideEffectEvent 类型**

在 `apps/web/src/store/chat.store.ts` 中修改 `SideEffectEvent`：

```typescript
export type SideEffectEvent =
  | 'candidate_added' | 'candidate_eliminated' | 'candidate_winner'
  | 'journey_updated' | 'stage_changed' | 'ai_insight'
  | 'publish_suggestion' | 'journey_published';
```

- [ ] **Step 4: 在 side_effect 处理中分发 timelineEvent**

在 chat store 的 `side_effect` payload 处理中，在 `dispatchJourneySideEffect` 调用后面添加：

```typescript
        // Dispatch timeline event if present in side effect data
        const timelineEvent = (payload.data as Record<string, unknown>)?.timelineEvent;
        if (timelineEvent) {
          dispatchJourneySideEffect({
            event: 'timeline_event',
            journeyId,
            data: timelineEvent,
          });
        }
```

- [ ] **Step 5: 添加断连提示和重连后补偿**

在 chat store 的 `connect` 方法中，修改 `close` event listener：

```typescript
    nextSocket.addEventListener('close', () => {
      set((state) => ({
        isConnected: false,
        socket: state.socket === nextSocket ? undefined : state.socket,
      }));
      // 断连后 3 秒自动重连
      window.setTimeout(() => {
        const current = getState();
        if (!current.isConnected && current.activeJourneyId === journeyId) {
          current.connect(journeyId);
        }
      }, 3000);
    });
```

在 `open` event listener 中添加重连补偿（refetch timeline + candidates）：

```typescript
    nextSocket.addEventListener('open', () => {
      set({ isConnected: true, activeJourneyId: journeyId });
      // 重连时通知 UI 刷新数据（补偿断连期间的事件）
      dispatchJourneySideEffect({
        event: 'journey_updated',
        journeyId,
        data: { reconnected: true },
      });
    });
```

- [ ] **Step 6: 验证编译**

Run: `cd apps/web && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types/api.ts apps/web/src/store/chat.store.ts apps/web/src/lib/journey-workspace-events.ts
git commit -m "feat: extend WS protocol with timeline events, add reconnect logic"
```

---

## Task 9b: 淘汰/选定操作发出 side effect + 写入 TimelineEvent

**Files:**
- Modify: `apps/api/src/controllers/car-candidate.controller.ts`

目前 `updateStatus`（淘汰）和 `markAsWinner`（选定）只修改数据库，不发出 side effect，不写 TimelineEvent。需要补全。

- [ ] **Step 1: 阅读 car-candidate.controller.ts**

先阅读当前文件了解 `updateStatus` 和 `markAsWinner` 方法的签名和逻辑。

- [ ] **Step 2: 在 updateStatus 方法中写入 TimelineEvent**

在淘汰操作成功后（prisma update 之后），添加：

```typescript
import { timelineService } from '../services/timeline.service';
import { TimelineEventType } from '@newcar/shared';

// 在 updateStatus 方法中，prisma 更新成功后：
if (status === 'ELIMINATED') {
  await timelineService.createEvent({
    journeyId: candidate.journeyId,
    type: TimelineEventType.CANDIDATE_ELIMINATED,
    content: `${candidate.car.brand} ${candidate.car.model}已被淘汰`,
    metadata: { candidateId: candidate.id, carName: `${candidate.car.brand} ${candidate.car.model}` },
  });
}
```

- [ ] **Step 3: 在 markAsWinner 方法中写入 TimelineEvent**

```typescript
// 在 markAsWinner 方法中，prisma 更新成功后：
await timelineService.createEvent({
  journeyId: candidate.journeyId,
  type: TimelineEventType.CANDIDATE_WINNER,
  content: `${candidate.car.brand} ${candidate.car.model}被选为最终车型`,
  metadata: { candidateId: candidate.id, carName: `${candidate.car.brand} ${candidate.car.model}` },
});
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/car-candidate.controller.ts
git commit -m "feat: write TimelineEvent on candidate eliminate/winner operations"
```

---

## Task 10: Mock 模式改为环境变量

**Files:**
- Modify: `apps/web/src/lib/api.ts:12`

- [ ] **Step 1: 修改 MOCK_MODE 为环境变量**

在 `apps/web/src/lib/api.ts` 中替换：

```typescript
export const MOCK_MODE = true; // Set to false to use real API
```

为：

```typescript
export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
```

- [ ] **Step 2: 在 .env.development 中设置默认值**

创建或修改 `apps/web/.env.development`（如果已存在则添加行）：

```
NEXT_PUBLIC_MOCK_MODE=true
```

创建或修改 `apps/web/.env.production`（如果已存在则添加行）：

```
NEXT_PUBLIC_MOCK_MODE=false
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/web && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/.env.development apps/web/.env.production
git commit -m "feat: change MOCK_MODE to NEXT_PUBLIC_MOCK_MODE env variable"
```

---

## Task 11: 前端 Mock 数据扩展 — Timeline Mock

**Files:**
- Modify: `apps/web/src/lib/mock-data.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: 在 mock-data.ts 中添加 timeline mock 数据**

在 `apps/web/src/lib/mock-data.ts` 中添加：

```typescript
export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'te-1',
    journeyId: 'mock-journey',
    type: 'STAGE_CHANGED',
    content: '旅程开始，进入认知期',
    metadata: { stage: 'AWARENESS' },
    createdAt: '2026-03-20T10:00:00Z',
  },
  {
    id: 'te-2',
    journeyId: 'mock-journey',
    type: 'REQUIREMENT_UPDATED',
    content: '需求已更新：预算25-35万，家用SUV',
    metadata: { budgetMin: 25, budgetMax: 35, useCases: ['家用'] },
    createdAt: '2026-03-20T10:30:00Z',
  },
  {
    id: 'te-3',
    journeyId: 'mock-journey',
    type: 'CANDIDATE_ADDED',
    content: 'AI 推荐了理想 L6',
    metadata: { candidateId: 'c-1', carName: '理想 L6', matchTags: ['符合预算', '家用首选'] },
    createdAt: '2026-03-21T09:00:00Z',
  },
  {
    id: 'te-4',
    journeyId: 'mock-journey',
    type: 'CANDIDATE_ADDED',
    content: 'AI 推荐了深蓝 S7',
    metadata: { candidateId: 'c-2', carName: '深蓝 S7', matchTags: ['续航达标'] },
    createdAt: '2026-03-21T14:00:00Z',
  },
  {
    id: 'te-5',
    journeyId: 'mock-journey',
    type: 'STAGE_CHANGED',
    content: '旅程进入对比期',
    metadata: { stage: 'COMPARISON' },
    createdAt: '2026-03-22T10:00:00Z',
  },
  {
    id: 'te-6',
    journeyId: 'mock-journey',
    type: 'AI_INSIGHT',
    content: '你在续航话题上花了最多时间，看来这是你最关注的维度',
    metadata: { dimension: '续航', confidence: 0.85 },
    createdAt: '2026-03-23T15:00:00Z',
  },
];
```

（需要在文件顶部导入 `TimelineEvent` 类型，或直接使用内联类型）

- [ ] **Step 2: 在 api.ts mock 路由中添加 timeline 响应**

在 `getMockResponse` 的 GET 路由区域添加：

```typescript
  if (path.match(/\/journeys\/[^/]+\/timeline/)) {
    return { events: mockTimelineEvents } as T;
  }
```

同时在文件顶部的 import 中添加 `mockTimelineEvents`。

- [ ] **Step 3: 扩展 mockCandidates 数据添加新字段**

在 `mock-data.ts` 中找到 `mockCandidates` 数组的每个元素，添加：

```typescript
    matchTags: ['符合预算', '家用首选'],
    recommendReason: '增程方案兼顾长途和日常，和你说的周末自驾需求很配',
    relevantDimensions: ['续航', '空间', '价格'],
    candidateRankScore: 0.85,
```

（每个候选车可以有不同的值）

- [ ] **Step 4: 验证编译**

Run: `cd apps/web && npx tsc --noEmit`

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mock-data.ts apps/web/src/lib/api.ts
git commit -m "feat: add timeline mock data and extend candidate mock fields"
```

---

## Task 12: 集成验证

- [ ] **Step 1: 运行全量后端测试**

Run: `cd apps/api && npx vitest run`

Expected: 所有测试通过（已有测试 + 新增测试）。

- [ ] **Step 2: 运行前端编译检查**

Run: `cd apps/web && npx next build 2>&1 | tail -20`

Expected: 构建成功或仅有非阻塞性警告。

- [ ] **Step 3: 验证 Prisma migration 状态**

Run: `cd apps/api && npx prisma migrate status`

Expected: 所有 migration 已应用。

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve integration issues from Plan 11"
```
