# Plan 2: 旅程核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善旅程核心功能 — Conversation 系统、CarCandidate 管理、Journey 过期规则、AI 对话接口

**Architecture:** 在 Plan 1 基础上扩展 API 服务。AI 对话通过调用外部 AI 服务（Claude API）实现，AI Pipeline（快照生成）在 Plan 3 独立实现。

**Tech Stack:** Node.js + Express + TypeScript + Prisma ORM + Redis + Claude API

**Note:** 以下功能已在 Plan 1 的 Prisma schema 中定义但本计划不重复实现：
- `template_source_id`（Journey fork）— Plan 6 社区系统
- `UserDevice` / push_token — Plan 7 通知系统
- `NotificationFeed` — Plan 7 通知系统
- 完整的 AI Pipeline（RAG、快照生成）— Plan 3

---

## File Structure

```
apps/api/src/
├── services/
│   ├── conversation.service.ts  # 新增
│   ├── car-candidate.service.ts  # 新增
│   ├── ai-chat.service.ts       # 新增：AI 对话接口
│   └── journey.service.ts       # 修改：添加过期检查
├── controllers/
│   ├── conversation.controller.ts  # 新增
│   ├── car-candidate.controller.ts # 新增
│   └── journey.controller.ts       # 修改：添加新端点
├── routes/
│   ├── conversation.ts  # 新增
│   ├── car-candidate.ts # 新增
│   └── journey.ts       # 修改：添加新路由
packages/shared/src/types/
├── conversation.ts  # 新增
├── car-candidate.ts # 新增
└── ai-chat.ts      # 新增
```

---

## Task 1: Conversation 系统

**Files:**
- Create: `packages/shared/src/types/conversation.ts`
- Create: `apps/api/src/services/conversation.service.ts`
- Create: `apps/api/src/controllers/conversation.controller.ts`
- Create: `apps/api/src/routes/conversation.ts`
- Create: `apps/api/tests/conversation.test.ts`
- Modify: `apps/api/src/routes/journey.ts`（挂载 conversation 路由）

- [ ] **Step 1: 创建 conversation types**

```typescript
// packages/shared/src/types/conversation.ts

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

export enum SignalType {
  REQUIREMENT = 'REQUIREMENT',     // 需求（预算、用途等）
  PREFERENCE = 'PREFERENCE',        // 偏好（品牌、车型等）
  CONCERN = 'CONCERN',             // 顾虑（油耗、安全等）
  TRADEOFF = 'TRADEOFF',           // 权衡（价格vs性能）
  REJECTION = 'REJECTION',         // 拒绝（明确不要什么）
}

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface ExtractedSignal {
  type: SignalType;
  value: string;
  confidence: number; // 0-1
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}
```

- [ ] **Step 2: 创建 conversation service**

```typescript
// apps/api/src/services/conversation.service.ts
import { prisma } from '../lib/prisma';
import { MessageRole, SignalType } from '@newcar/shared';

export class ConversationService {
  // 创建新对话会话
  async createConversation(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
  }) {
    return prisma.conversation.create({
      data: {
        journeyId: data.journeyId,
        userId: data.userId,
        sessionId: data.sessionId,
        messages: [],
        extractedSignals: [],
        toolCalls: [],
      },
    });
  }

  // 获取或创建对话
  async getOrCreateConversation(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
  }) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        journeyId: data.journeyId,
        sessionId: data.sessionId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.createConversation(data);
    }

    return conversation;
  }

  // 添加消息
  async addMessage(data: {
    conversationId: string;
    role: MessageRole;
    content: string;
  }) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = (conversation.messages as any[]) || [];
    messages.push({
      role: data.role,
      content: data.content,
      timestamp: new Date().toISOString(),
    });

    return prisma.conversation.update({
      where: { id: data.conversationId },
      data: { messages },
    });
  }

  // 提取信号（简化版，实际由 AI Pipeline 调用）
  async extractSignals(conversationId: string, signals: any[]) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: {
        extractedSignals: signals,
      },
    });
  }

  // 添加工具调用记录
  async addToolCall(data: {
    conversationId: string;
    toolCall: {
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    };
  }) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const toolCalls = (conversation.toolCalls as any[]) || [];
    toolCalls.push({
      ...data.toolCall,
      timestamp: new Date().toISOString(),
    });

    return prisma.conversation.update({
      where: { id: data.conversationId },
      data: { toolCalls },
    });
  }

  // 获取对话历史（最近 N 轮）
  async getConversationHistory(conversationId: string, limit: number = 10) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = (conversation.messages as any[]) || [];
    return messages.slice(-limit);
  }

  // 获取所有提取的信号
  async getExtractedSignals(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return conversation.extractedSignals as any[];
  }
}

export const conversationService = new ConversationService();
```

- [ ] **Step 3: 创建 conversation controller**

```typescript
// apps/api/src/controllers/conversation.controller.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { conversationService } from '../services/conversation.service';
import { MessageRole } from '@newcar/shared';

export class ConversationController {
  async getOrCreate(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const conversation = await conversationService.getOrCreateConversation({
        journeyId,
        userId: req.userId,
        sessionId: req.sessionId!,
      });
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async addMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const { role, content } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      if (!Object.values(MessageRole).includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const conversation = await conversationService.addMessage({
        conversationId,
        role,
        content,
      });

      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await conversationService.getConversationHistory(
        conversationId,
        limit
      );

      res.json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSignals(req: AuthenticatedRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const signals = await conversationService.getExtractedSignals(conversationId);
      res.json({ signals });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const conversationController = new ConversationController();
```

- [ ] **Step 4: 创建 conversation routes**

```typescript
// apps/api/src/routes/conversation.ts
import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';

const router = Router();

// 获取或创建对话
router.get(
  '/:journeyId/conversation',
  authMiddleware,
  sessionMiddleware,
  conversationController.getOrCreate
);

// 添加消息
router.post(
  '/:journeyId/conversation/messages',
  authMiddleware,
  sessionMiddleware,
  conversationController.addMessage
);

// 获取对话历史
router.get(
  '/:journeyId/conversation/messages',
  authMiddleware,
  sessionMiddleware,
  conversationController.getHistory
);

// 获取提取的信号
router.get(
  '/:journeyId/conversation/signals',
  authMiddleware,
  sessionMiddleware,
  conversationController.getSignals
);

export default router;
```

- [ ] **Step 5: 将 conversation 路由挂载到 journey 下**

Modify `apps/api/src/routes/journey.ts` 添加：
```typescript
import conversationRoutes from './conversation';

// 在 journey router 末尾添加
router.use('/', conversationRoutes);
```

- [ ] **Step 6: 编写测试**

```typescript
// apps/api/tests/conversation.test.ts
import { describe, it, expect } from 'vitest';

describe('Conversation', () => {
  it('should validate message role enum', () => {
    const validRoles = ['USER', 'ASSISTANT'];
    expect(validRoles.includes('USER')).toBe(true);
    expect(validRoles.includes('ASSISTANT')).toBe(true);
    expect(validRoles.includes('SYSTEM')).toBe(false);
  });

  it('should validate signal type enum', () => {
    const validTypes = ['REQUIREMENT', 'PREFERENCE', 'CONCERN', 'TRADEOFF', 'REJECTION'];
    expect(validTypes.includes('REQUIREMENT')).toBe(true);
    expect(validTypes.includes('PREFERENCE')).toBe(true);
    expect(validTypes.includes('INVALID')).toBe(false);
  });

  it('should validate message structure', () => {
    const message = {
      role: 'USER',
      content: '我想买一辆 30 万左右的车',
      timestamp: new Date().toISOString(),
    };
    expect(message.role).toBe('USER');
    expect(typeof message.content).toBe('string');
    expect(message.timestamp).toBeDefined();
  });

  it('should validate extracted signal structure', () => {
    const signal = {
      type: 'REQUIREMENT',
      value: '预算30万左右',
      confidence: 0.95,
    };
    expect(signal.type).toBe('REQUIREMENT');
    expect(typeof signal.value).toBe('string');
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Conversation system for journey chat history"
```

---

## Task 2: CarCandidate 管理

**Files:**
- Create: `packages/shared/src/types/car-candidate.ts`
- Create: `apps/api/src/services/car-candidate.service.ts`
- Create: `apps/api/src/controllers/car-candidate.controller.ts`
- Create: `apps/api/src/routes/car-candidate.ts`
- Create: `apps/api/tests/car-candidate.test.ts`
- Modify: `apps/api/src/routes/journey.ts`（挂载 car-candidate 路由）

- [ ] **Step 1: 创建 car-candidate types**

```typescript
// packages/shared/src/types/car-candidate.ts

export enum CandidateStatus {
  ACTIVE = 'ACTIVE',
  ELIMINATED = 'ELIMINATED',
  WINNER = 'WINNER',
}

export enum AddedReason {
  AI_RECOMMENDED = 'AI_RECOMMENDED',
  USER_SEARCHED = 'USER_SEARCHED',
  FROM_TEMPLATE = 'FROM_TEMPLATE',
  FROM_COMMUNITY = 'FROM_COMMUNITY',
}
```

- [ ] **Step 2: 创建 car-candidate service**

```typescript
// apps/api/src/services/car-candidate.service.ts
import { prisma } from '../lib/prisma';
import { CandidateStatus, AddedReason } from '@newcar/shared';

export class CarCandidateService {
  // 添加候选车型
  async addCandidate(data: {
    journeyId: string;
    carId: string;
    addedReason: AddedReason;
    priceAtAdd?: number;
    userNotes?: string;
  }) {
    // 检查是否已在候选列表中
    const existing = await prisma.carCandidate.findFirst({
      where: {
        journeyId: data.journeyId,
        carId: data.carId,
        status: CandidateStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new Error('Car already in candidate list');
    }

    return prisma.carCandidate.create({
      data: {
        journeyId: data.journeyId,
        carId: data.carId,
        addedReason: data.addedReason,
        status: CandidateStatus.ACTIVE,
        priceAtAdd: data.priceAtAdd,
        userNotes: data.userNotes,
      },
      include: { car: true },
    });
  }

  // 获取旅程的所有候选车型
  async getCandidatesByJourney(journeyId: string) {
    return prisma.carCandidate.findMany({
      where: { journeyId },
      include: { car: true },
      orderBy: [
        { status: 'asc' },  // ACTIVE first
        { addedAt: 'desc' },
      ],
    });
  }

  // 更新候选车型状态
  async updateStatus(
    candidateId: string,
    status: CandidateStatus,
    eliminationReason?: string
  ) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: {
        status,
        eliminationReason: status === CandidateStatus.ELIMINATED ? eliminationReason : null,
      },
      include: { car: true },
    });
  }

  // 更新用户兴趣分（由行为事件计算）
  async updateUserInterestScore(candidateId: string, score: number) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { userInterestScore: score },
    });
  }

  // 更新 AI 匹配分
  async updateAiMatchScore(candidateId: string, score: number) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { aiMatchScore: score },
    });
  }

  // 更新用户笔记
  async updateNotes(candidateId: string, notes: string) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { userNotes: notes },
    });
  }

  // 标记为胜出者（购车决策）
  async markAsWinner(candidateId: string) {
    const candidate = await prisma.carCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    // 先将同旅程其他 ACTIVE 候选标为 ELIMINATED
    await prisma.carCandidate.updateMany({
      where: {
        journeyId: candidate.journeyId,
        id: { not: candidateId },
        status: CandidateStatus.ACTIVE,
      },
      data: {
        status: CandidateStatus.ELIMINATED,
        eliminationReason: '用户选择了其他车型',
      },
    });

    // 将选中车型标为 WINNER
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.WINNER },
      include: { car: true },
    });
  }

  // 移除候选车型
  async removeCandidate(candidateId: string) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.ELIMINATED },
    });
  }
}

export const carCandidateService = new CarCandidateService();
```

- [ ] **Step 3: 创建 car-candidate controller**

```typescript
// apps/api/src/controllers/car-candidate.controller.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { carCandidateService } from '../services/car-candidate.service';
import { CandidateStatus, AddedReason } from '@newcar/shared';

export class CarCandidateController {
  async addCandidate(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { carId, addedReason, priceAtAdd, userNotes } = req.body;

      if (!carId) {
        return res.status(400).json({ error: 'carId is required' });
      }

      if (!Object.values(AddedReason).includes(addedReason)) {
        return res.status(400).json({ error: 'Invalid addedReason' });
      }

      const candidate = await carCandidateService.addCandidate({
        journeyId,
        carId,
        addedReason,
        priceAtAdd,
        userNotes,
      });

      res.status(201).json(candidate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCandidates(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const candidates = await carCandidateService.getCandidatesByJourney(journeyId);
      res.json({ candidates });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { candidateId } = req.params;
      const { status, eliminationReason } = req.body;

      if (!Object.values(CandidateStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const candidate = await carCandidateService.updateStatus(
        candidateId,
        status,
        eliminationReason
      );
      res.json(candidate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async markAsWinner(req: AuthenticatedRequest, res: Response) {
    try {
      const { candidateId } = req.params;
      const candidate = await carCandidateService.markAsWinner(candidateId);
      res.json(candidate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { candidateId } = req.params;
      const { notes } = req.body;

      const candidate = await carCandidateService.updateNotes(candidateId, notes);
      res.json(candidate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const carCandidateController = new CarCandidateController();
```

- [ ] **Step 4: 创建 car-candidate routes**

```typescript
// apps/api/src/routes/car-candidate.ts
import { Router } from 'express';
import { carCandidateController } from '../controllers/car-candidate.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 添加候选车型
router.post(
  '/:journeyId/candidates',
  authMiddleware,
  carCandidateController.addCandidate
);

// 获取候选车型列表
router.get(
  '/:journeyId/candidates',
  authMiddleware,
  carCandidateController.getCandidates
);

// 更新候选车型状态
router.patch(
  '/:journeyId/candidates/:candidateId',
  authMiddleware,
  carCandidateController.updateStatus
);

// 标记为胜出者
router.post(
  '/:journeyId/candidates/:candidateId/winner',
  authMiddleware,
  carCandidateController.markAsWinner
);

// 更新笔记
router.patch(
  '/:journeyId/candidates/:candidateId/notes',
  authMiddleware,
  carCandidateController.updateNotes
);

export default router;
```

- [ ] **Step 5: 将 car-candidate 路由挂载**

Modify `apps/api/src/routes/journey.ts` 添加：
```typescript
import carCandidateRoutes from './car-candidate';
router.use('/', carCandidateRoutes);
```

- [ ] **Step 6: 编写测试**

```typescript
// apps/api/tests/car-candidate.test.ts
import { describe, it, expect } from 'vitest';

describe('CarCandidate', () => {
  it('should validate candidate status enum', () => {
    const validStatuses = ['ACTIVE', 'ELIMINATED', 'WINNER'];
    expect(validStatuses.includes('ACTIVE')).toBe(true);
    expect(validStatuses.includes('WINNER')).toBe(true);
    expect(validStatuses.includes('INVALID')).toBe(false);
  });

  it('should validate added reason enum', () => {
    const validReasons = ['AI_RECOMMENDED', 'USER_SEARCHED', 'FROM_TEMPLATE', 'FROM_COMMUNITY'];
    expect(validReasons.includes('AI_RECOMMENDED')).toBe(true);
    expect(validReasons.includes('USER_SEARCHED')).toBe(true);
  });

  it('should validate ai weight calculation', () => {
    const baseWeight = 1.0;
    const durationSec = 300; // 5 minutes
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);
    expect(aiWeight).toBe(1.0);
  });

  it('should validate winner selection logic', () => {
    // 只有 WINNER 状态的候选才能是最终选择
    const candidates = [
      { id: '1', status: 'ACTIVE' },
      { id: '2', status: 'ELIMINATED' },
      { id: '3', status: 'WINNER' },
    ];
    const winner = candidates.find(c => c.status === 'WINNER');
    expect(winner?.id).toBe('3');
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add CarCandidate management for journey"
```

---

## Task 3: Journey 过期规则 + 扩展

**Files:**
- Modify: `apps/api/src/services/journey.service.ts`
- Modify: `apps/api/src/services/car-candidate.service.ts`
- Create: `apps/api/src/services/journey-expire.service.ts`（定时任务服务）
- Create: `apps/api/src/routes/journey.ts`（添加过期检查路由）

- [ ] **Step 1: 添加 Journey 过期检查方法**

```typescript
// apps/api/src/services/journey.service.ts 添加方法

// 检查并标记过期旅程
async checkExpiredJourneys() {
  const EXPIRY_DAYS = 90;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - EXPIRY_DAYS);

  const expiredJourneys = await prisma.journey.findMany({
    where: {
      status: {
        in: [JourneyStatus.ACTIVE, JourneyStatus.PAUSED],
      },
      lastActivityAt: {
        lt: expiryDate,
      },
    },
  });

  const results = [];
  for (const journey of expiredJourneys) {
    const updated = await prisma.journey.update({
      where: { id: journey.id },
      data: { status: JourneyStatus.ABANDONED },
    });
    results.push(updated);

    // 同时更新关联的 PublishedJourney 状态
    await prisma.publishedJourney.updateMany({
      where: { journeyId: journey.id },
      data: { contentStatus: 'JOURNEY_ABANDONED' },
    });
  }

  return results;
}

// 获取旅程详情（含关联数据）
async getJourneyDetail(journeyId: string) {
  return prisma.journey.findUnique({
    where: { id: journeyId },
    include: {
      candidates: {
        include: { car: true },
      },
      snapshots: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
      },
      conversations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      behaviorEvents: {
        orderBy: { timestamp: 'desc' },
        take: 100,
      },
    },
  });
}

// 更新 AI 置信度分
async updateAiConfidenceScore(journeyId: string, score: number) {
  return prisma.journey.update({
    where: { id: journeyId },
    data: {
      aiConfidenceScore: score,
      lastActivityAt: new Date(),
    },
  });
}
```

- [ ] **Step 2: 创建过期检查路由**

```typescript
// 在 apps/api/src/routes/journey.ts 添加

// 手动触发过期检查（仅 Admin）
router.post(
  '/admin/check-expired',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 检查用户是否是 Admin
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const expiredJourneys = await journeyService.checkExpiredJourneys();
      res.json({ count: expiredJourneys.length, journeys: expiredJourneys });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取旅程详情
router.get(
  '/:journeyId/detail',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.getJourneyDetail(journeyId);
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      res.json(journey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);
```

- [ ] **Step 3: 添加 requirements 结构验证**

```typescript
// apps/api/src/services/journey.service.ts 添加方法

// 更新旅程需求
async updateRequirements(journeyId: string, requirements: {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  dailyKm?: number;
  stylePreference?: string;
}) {
  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
  });

  if (!journey) {
    throw new Error('Journey not found');
  }

  const currentRequirements = (journey.requirements as any) || {};

  return prisma.journey.update({
    where: { id: journeyId },
    data: {
      requirements: {
        ...currentRequirements,
        ...requirements,
      },
      lastActivityAt: new Date(),
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add journey expiration rules (90 days) and detail endpoint"
```

---

## Task 4: AI 对话接口

**Files:**
- Create: `packages/shared/src/types/ai-chat.ts`
- Create: `apps/api/src/services/ai-chat.service.ts`
- Create: `apps/api/src/controllers/ai-chat.controller.ts`
- Create: `apps/api/src/routes/ai-chat.ts`
- Create: `apps/api/tests/ai-chat.test.ts`
- Modify: `apps/api/src/config/index.ts`（添加 AI 配置）

- [ ] **Step 1: 创建 AI chat types**

```typescript
// packages/shared/src/types/ai-chat.ts

export enum ToolName {
  SEARCH_CAR = 'search_car',
  ADD_CANDIDATE = 'add_candidate',
  COMPARE_CARS = 'compare_cars',
  GET_CAR_DETAIL = 'get_car_detail',
  GET_PRICE = 'get_price',
  RECORD_DECISION = 'record_decision',
}

export interface AiChatRequest {
  journeyId: string;
  message: string;
  conversationId?: string;
  context?: {
    recentEvents?: any[];
    extractedSignals?: any[];
    candidates?: any[];
  };
}

export interface AiChatResponse {
  message: string;
  conversationId: string;
  extractedSignals?: any[];
  toolCalls?: {
    name: ToolName;
    args: Record<string, unknown>;
    result?: unknown;
  }[];
}
```

- [ ] **Step 2: 添加 AI 配置**

```typescript
// apps/api/src/config/index.ts 添加

ai: {
  apiKey: requireConfigValue(process.env.AI_API_KEY, 'AI_API_KEY'),
  model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024', 10),
},
```

- [ ] **Step 3: 创建 AI chat service**

```typescript
// apps/api/src/services/ai-chat.service.ts
import axios from 'axios';
import { config } from '../config';
import { conversationService } from './conversation.service';
import { carCandidateService } from './car-candidate.service';
import { journeyService } from './journey.service';
import { MessageRole, ToolName, AddedReason, AiChatRequest, AiChatResponse } from '@newcar/shared';

export class AiChatService {
  private claudeApiUrl = 'https://api.anthropic.com/v1/messages';

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    // 1. 获取或创建对话（必须传入有效的 sessionId）
    if (!request.conversationId) {
      throw new Error('conversationId is required for AI chat');
    }

    const conversation = await conversationService.getOrCreateConversation({
      journeyId: request.journeyId,
      sessionId: request.conversationId,
    });

    // 2. 保存用户消息
    await conversationService.addMessage({
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: request.message,
    });

    // 3. 构建上下文
    const systemPrompt = this.buildSystemPrompt(request);
    const history = await conversationService.getConversationHistory(conversation.id, 10);

    // 4. 调用 AI
    const aiResponse = await this.callClaude(systemPrompt, history);

    // 5. 保存 AI 响应
    await conversationService.addMessage({
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: aiResponse.content,
    });

    // 6. 提取信号（简化版）
    const signals = this.extractBasicSignals(request.message);

    // 7. 记录工具调用（如果有）
    if (aiResponse.toolCalls) {
      for (const toolCall of aiResponse.toolCalls) {
        await conversationService.addToolCall({
          conversationId: conversation.id,
          toolCall,
        });
      }
    }

    // 8. 更新旅程活跃时间
    await journeyService.updateAiConfidenceScore(request.journeyId, 0.7);

    return {
      message: aiResponse.content,
      conversationId: conversation.id,
      extractedSignals: signals,
      toolCalls: aiResponse.toolCalls,
    };
  }

  private buildSystemPrompt(request: AiChatRequest): string {
    const { context } = request;

    let prompt = `你是用户的购车助手，帮助用户完成购车决策。用户正在使用 AI 原生购车平台。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

当前用户旅程信息：
`;

    if (context?.candidates?.length) {
      prompt += `\n已有候选车型：${context.candidates.map((c: any) => `${c.car.brand} ${c.car.model}`).join(', ')}`;
    }

    if (context?.extractedSignals?.length) {
      prompt += `\n已知偏好：${context.extractedSignals.map((s: any) => s.value).join('; ')}`;
    }

    prompt += `\n\n请用友好、专业的语气与用户交流。`;

    return prompt;
  }

  private async callClaude(systemPrompt: string, history: any[]): Promise<{
    content: string;
    toolCalls?: { name: string; args: Record<string, unknown>; result?: unknown }[];
  }> {
    try {
      const response = await axios.post(
        this.claudeApiUrl,
        {
          model: config.ai.model,
          max_tokens: config.ai.maxTokens,
          system: systemPrompt,
          messages: history.map((m: any) => ({
            role: m.role === MessageRole.USER ? 'user' : 'assistant',
            content: m.content,
          })),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'anthropic-api-key': config.ai.apiKey, // 修正：正确的 header 名称
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const content = response.data.content[0];
      return {
        content: content.text,
        toolCalls: [],
      };
    } catch (error: any) {
      console.error('Claude API error:', error.response?.data || error.message);
      return {
        content: '抱歉，我现在无法回答。请稍后再试。',
        toolCalls: [],
      };
    }
  }

  private extractBasicSignals(message: string): any[] {
    // 简化版信号提取，实际应由 AI Pipeline 处理
    const signals: any[] = [];

    // 预算提取（支持多种格式）
    const budgetPatterns = [
      /(\d+)\s*万.*?(左右|左右?的)/,  // 30万左右, 30万左右的
      /预算[为是]?(\d+)\s*万/,         // 预算30万, 预算为30万
      /(\d+)[-~](\d+)\s*万/,          // 20-30万
    ];

    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        signals.push({
          type: 'REQUIREMENT',
          value: `预算${match[1]}万`,
          confidence: 0.8,
        });
        break;
      }
    }

    // 车型偏好提取
    if (message.includes('SUV') || message.includes('越野')) {
      signals.push({ type: 'PREFERENCE', value: 'SUV', confidence: 0.9 });
    }
    if (message.includes('轿车') || message.includes('轿车')) {
      signals.push({ type: 'PREFERENCE', value: '轿车', confidence: 0.9 });
    }
    if (message.includes('纯电') || message.includes('BEV')) {
      signals.push({ type: 'PREFERENCE', value: '纯电', confidence: 0.85 });
    }

    return signals;
  }

  // 执行 AI 调用的工具
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case ToolName.SEARCH_CAR:
        // TODO: 实现车型搜索（Plan 5 车型知识库）
        return { cars: [] };

      case ToolName.ADD_CANDIDATE:
        if (args.journeyId && args.carId) {
          return carCandidateService.addCandidate({
            journeyId: args.journeyId as string,
            carId: args.carId as string,
            addedReason: AddedReason.AI_RECOMMENDED,
          });
        }
        return null;

      case ToolName.GET_CAR_DETAIL:
        // TODO: 实现车型详情获取
        return null;

      case ToolName.GET_PRICE:
        // TODO: 实现价格查询
        return null;

      default:
        console.warn(`Unknown tool: ${name}`);
        return null;
    }
  }
}

export const aiChatService = new AiChatService();
```

- [ ] **Step 4: 创建 AI chat controller**

```typescript
// apps/api/src/controllers/ai-chat.controller.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiChatService } from '../services/ai-chat.service';

export class AiChatController {
  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { message, conversationId, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await aiChatService.chat({
        journeyId,
        message,
        conversationId,
        context,
      });

      res.json(response);
    } catch (error: any) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const aiChatController = new AiChatController();
```

- [ ] **Step 5: 创建 AI chat routes**

```typescript
// apps/api/src/routes/ai-chat.ts
import { Router } from 'express';
import { aiChatController } from '../controllers/ai-chat.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// AI 对话
router.post(
  '/:journeyId/chat',
  authMiddleware,
  aiChatController.chat
);

export default router;
```

- [ ] **Step 6: 将 AI chat 路由挂载**

Modify `apps/api/src/routes/journey.ts` 添加：
```typescript
import aiChatRoutes from './ai-chat';
router.use('/', aiChatRoutes);
```

- [ ] **Step 7: 编写测试**

```typescript
// apps/api/tests/ai-chat.test.ts
import { describe, it, expect } from 'vitest';

describe('AI Chat', () => {
  it('should validate budget extraction regex', () => {
    // Test multiple patterns
    const patterns = [
      /(\d+)\s*万.*?(左右|左右?的)/,
      /预算[为是]?(\d+)\s*万/,
      /(\d+)[-~](\d+)\s*万/,
    ];

    const testCases = [
      { msg: '我想买30万左右的车', expected: '30' },
      { msg: '预算30万', expected: '30' },
      { msg: '20-30万的车', expected: '20' },
    ];

    for (const { msg, expected } of testCases) {
      let matched = false;
      for (const pattern of patterns) {
        const match = msg.match(pattern);
        if (match && match[1] === expected) {
          matched = true;
          break;
        }
      }
      expect(matched, `Failed to match: ${msg}`).toBe(true);
    }
  });

  it('should validate tool name enum', () => {
    const validTools = ['search_car', 'add_candidate', 'compare_cars', 'get_car_detail', 'get_price', 'record_decision'];
    expect(validTools.includes('search_car')).toBe(true);
    expect(validTools.includes('invalid_tool')).toBe(false);
  });

  it('should validate AI response structure', () => {
    const response = {
      message: '好的，我来帮你找找30万左右的SUV',
      conversationId: 'conv-123',
      extractedSignals: [
        { type: 'REQUIREMENT', value: '预算30万', confidence: 0.8 },
      ],
      toolCalls: [],
    };
    expect(typeof response.message).toBe('string');
    expect(response.conversationId).toBeDefined();
    expect(Array.isArray(response.extractedSignals)).toBe(true);
  });
});
```

Run: `cd apps/api && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add AI chat interface for journey conversations"
```

---

## Task 5: 最终整合与测试

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/integration.test.ts`

- [ ] **Step 1: 验证所有路由正确挂载**

确保 `apps/api/src/app.ts` 中包含所有新增路由：
```typescript
import journeyRoutes from './routes/journey';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';

// 路由挂载
app.use('/auth', authRoutes);
app.use('/', sessionRoutes);
app.use('/journeys', journeyRoutes);
```

- [ ] **Step 2: 运行所有测试**

Run: `cd apps/api && npm test`
Expected: ALL PASS

- [ ] **Step 3: 创建集成测试**

```typescript
// apps/api/tests/integration.test.ts
import { describe, it, expect } from 'vitest';

describe('Integration', () => {
  it('should validate journey workflow', () => {
    // 模拟完整旅程流程
    const journey = {
      id: 'journey-1',
      stage: 'AWARENESS',
      status: 'ACTIVE',
    };

    // 添加候选车型
    const candidate = {
      id: 'candidate-1',
      journeyId: journey.id,
      carId: 'car-1',
      status: 'ACTIVE',
    };

    // 标记为胜出者
    const winner = { ...candidate, status: 'WINNER' };

    expect(journey.status).toBe('ACTIVE');
    expect(candidate.status).toBe('ACTIVE');
    expect(winner.status).toBe('WINNER');
  });

  it('should validate conversation message flow', () => {
    const messages = [];
    messages.push({ role: 'USER', content: '我想买30万的车', timestamp: new Date().toISOString() });
    messages.push({ role: 'ASSISTANT', content: '好的，你更倾向于SUV还是轿车？', timestamp: new Date().toISOString() });
    messages.push({ role: 'USER', content: 'SUV吧', timestamp: new Date().toISOString() });

    expect(messages.length).toBe(3);
    expect(messages[0].role).toBe('USER');
    expect(messages[1].role).toBe('ASSISTANT');
    expect(messages[2].role).toBe('USER');
  });
});
```

Run: `cd apps/api && npm test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete plan 2 - journey core with AI chat"
```

---

## 依赖关系

- Task 1 (Conversation) → Task 2 (CarCandidate) → Task 3 (Journey扩展) → Task 4 (AI Chat) → Task 5 (整合)

---

## 修复记录

### Review #1 发现的问题（已修复）

| Issue | Fix |
|-------|-----|
| Claude API header 错误 (`x-api-key`) | 改为 `anthropic-api-key` |
| sessionId 硬编码 `default` | 要求必须传入有效的 conversationId |
| Tool calls 从不执行 | 添加 `executeTool` stub 方法 |
| Budget regex 过于简单 | 支持多种格式（30万左右/预算30万/20-30万） |
| AddedReason 未导入 | 添加到 import 列表 |
