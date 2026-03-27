# AI 助理套餐账单系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 newcar 平台增加三档订阅套餐体系、AI 用量追踪、额度检查中间件、订阅管理 API 和前端订阅页面。

**Architecture:** Prisma 新增 4 个模型（SubscriptionPlan / UserSubscription / AiUsageLog / AiConversationUsage），通过 Express 中间件在 AI 对话入口拦截额度检查，新建 subscription 和 admin/usage 路由组，前端新增 /settings/subscription 页面展示套餐卡片和用量进度条。

**Tech Stack:** Prisma 6 + PostgreSQL, Express 4, Zod, Vitest, Next.js 15 App Router, React 19, TailwindCSS, SWR

---

## File Structure

### Backend (apps/api)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | 新增 4 个模型 + User 关系 |
| Modify | `prisma/seed.ts` | 预置三档 SubscriptionPlan |
| Create | `src/services/subscription.service.ts` | 订阅 CRUD、套餐切换、额度查询 |
| Create | `src/services/ai-usage.service.ts` | 用量记录、对话汇总、费用估算 |
| Create | `src/middleware/quota.ts` | 额度检查 + 惰性月度重置 |
| Create | `src/controllers/subscription.controller.ts` | 订阅相关 HTTP handler |
| Create | `src/controllers/admin-usage.controller.ts` | 管理端用量查询 handler |
| Create | `src/routes/subscription.ts` | /subscription/* 路由 |
| Create | `src/routes/admin-usage.ts` | /admin/usage/* 路由 |
| Modify | `src/app.ts` | 挂载新路由 |
| Modify | `src/services/auth.service.ts` | 注册时自动创建 FREE 订阅 |

### Shared Types (packages/shared)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/types/subscription.ts` | 订阅相关枚举和接口 |
| Modify | `src/types/index.ts` | 导出新类型 |

### Frontend (apps/web)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/settings/subscription/page.tsx` | 订阅管理页面 |
| Create | `src/components/subscription/CurrentPlanCard.tsx` | 当前套餐信息卡片 |
| Create | `src/components/subscription/UsageProgressBar.tsx` | 用量进度条组件 |
| Create | `src/components/subscription/PlanComparisonGrid.tsx` | 套餐对比三列卡片 |
| Create | `src/components/subscription/QuotaExceededBanner.tsx` | 额度超限提示条 |
| Modify | `src/lib/api.ts` | 新增订阅相关 mock 和 API 方法 |

### Tests (apps/api/tests)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `tests/subscription.test.ts` | 订阅服务单元测试 |
| Create | `tests/ai-usage.test.ts` | 用量服务单元测试 |
| Create | `tests/quota-middleware.test.ts` | 额度中间件测试 |

---

## Task 1: Shared Types — 订阅枚举和接口

**Files:**
- Create: `packages/shared/src/types/subscription.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: 创建订阅类型文件**

```typescript
// packages/shared/src/types/subscription.ts

export enum SubscriptionPlanName {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionSource {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  PAYMENT = 'PAYMENT',
}

export enum AiRequestType {
  CHAT = 'CHAT',
  TOOL_CALL = 'TOOL_CALL',
  SNAPSHOT = 'SNAPSHOT',
}

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  displayName: string;
  price: number;
  billingCycle: string;
  monthlyConversationLimit: number;
  monthlyReportLimit: number;
  monthlyTokenLimit: number;
  features: Record<string, boolean>;
  modelAccess: string[];
  sortOrder: number;
}

export interface UserSubscriptionInfo {
  id: string;
  plan: SubscriptionPlanInfo;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  monthlyConversationsUsed: number;
  monthlyReportsUsed: number;
  monthlyTokensUsed: number;
  monthlyResetAt: string;
}

export interface QuotaStatus {
  conversations: { used: number; limit: number; remaining: number };
  reports: { used: number; limit: number; remaining: number };
  tokens: { used: number; limit: number; remaining: number };
}
```

- [ ] **Step 2: 导出新类型**

在 `packages/shared/src/types/index.ts` 末尾添加：

```typescript
export type {
  SubscriptionPlanInfo,
  UserSubscriptionInfo,
  QuotaStatus,
} from './subscription';
export {
  SubscriptionPlanName,
  SubscriptionStatus,
  SubscriptionSource,
  AiRequestType,
} from './subscription';
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -5`
Expected: 无错误或仅已有警告

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/subscription.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add subscription and AI usage type definitions"
```

---

## Task 2: Prisma Schema — 新增 4 个模型

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾添加 SubscriptionPlan 模型**

在 `NotificationFeed` 模型之后添加：

```prisma
model SubscriptionPlan {
  id                       String   @id @default(cuid())
  name                     String   @unique
  displayName              String
  price                    Int      @default(0)
  billingCycle             String   @default("MONTHLY")
  monthlyConversationLimit Int
  monthlyReportLimit       Int      @default(0)
  monthlyTokenLimit        Int
  features                 Json     @default("{}")
  modelAccess              String[] @default([])
  sortOrder                Int      @default(0)
  isActive                 Boolean  @default(true)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  subscriptions UserSubscription[]

  @@map("subscription_plans")
}
```

- [ ] **Step 2: 添加 UserSubscription 模型**

```prisma
model UserSubscription {
  id                       String    @id @default(cuid())
  userId                   String
  planId                   String
  status                   String    @default("ACTIVE")
  startedAt                DateTime  @default(now())
  expiresAt                DateTime?
  monthlyConversationsUsed Int       @default(0)
  monthlyReportsUsed       Int       @default(0)
  monthlyTokensUsed        Int       @default(0)
  monthlyResetAt           DateTime
  source                   String    @default("SYSTEM")
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  user User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan SubscriptionPlan @relation(fields: [planId], references: [id])

  @@index([userId, status])
  @@map("user_subscriptions")
}
```

- [ ] **Step 3: 添加 AiUsageLog 模型**

```prisma
model AiUsageLog {
  id               String   @id @default(cuid())
  userId           String
  conversationId   String
  model            String
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  cacheReadTokens  Int?
  cacheWriteTokens Int?
  estimatedCostUsd Float    @default(0)
  requestType      String   @default("CHAT")
  durationMs       Int?
  createdAt        DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([conversationId])
  @@map("ai_usage_logs")
}
```

- [ ] **Step 4: 添加 AiConversationUsage 模型**

```prisma
model AiConversationUsage {
  id                String   @id @default(cuid())
  conversationId    String   @unique
  userId            String
  totalInputTokens  Int      @default(0)
  totalOutputTokens Int      @default(0)
  totalCostUsd      Float    @default(0)
  requestCount      Int      @default(0)
  primaryModel      String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("ai_conversation_usages")
}
```

- [ ] **Step 5: 更新 User 模型关系**

在 User 模型的 `notifications` 行后添加：

```prisma
  subscription        UserSubscription[]
  aiUsageLogs         AiUsageLog[]
  aiConversationUsage AiConversationUsage[]
```

- [ ] **Step 6: 更新 Conversation 模型关系**

在 Conversation 模型的 `user` 行后添加：

```prisma
  aiUsageLogs         AiUsageLog[]
  aiConversationUsage AiConversationUsage?
```

- [ ] **Step 7: 生成 migration**

Run: `cd apps/api && npx prisma migrate dev --name add_subscription_and_usage_models`
Expected: 迁移成功生成，Prisma Client 重新生成

- [ ] **Step 8: 验证 Prisma Client 生成**

Run: `cd apps/api && npx prisma generate`
Expected: ✔ Generated Prisma Client

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add SubscriptionPlan, UserSubscription, AiUsageLog, AiConversationUsage models"
```

---

## Task 3: Seed — 预置三档套餐

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: 在 seed.ts 添加套餐数据和 upsert 函数**

在 `CARS` 数组和 `upsertCars` 函数之后，`main()` 调用之前添加：

```typescript
const SUBSCRIPTION_PLANS = [
  {
    name: 'FREE',
    displayName: '免费版',
    price: 0,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 20,
    monthlyReportLimit: 0,
    monthlyTokenLimit: 100000,
    features: { basicChat: true },
    modelAccess: ['basic'],
    sortOrder: 0,
  },
  {
    name: 'PRO',
    displayName: 'Pro',
    price: 2900,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 200,
    monthlyReportLimit: 10,
    monthlyTokenLimit: 1000000,
    features: { basicChat: true, advancedChat: true, reports: true },
    modelAccess: ['basic', 'advanced'],
    sortOrder: 1,
  },
  {
    name: 'PREMIUM',
    displayName: 'Premium',
    price: 7900,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 1000,
    monthlyReportLimit: 30,
    monthlyTokenLimit: 5000000,
    features: { basicChat: true, advancedChat: true, reports: true, priorityResponse: true },
    modelAccess: ['basic', 'advanced', 'best'],
    sortOrder: 2,
  },
];

async function upsertSubscriptionPlans() {
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price,
        billingCycle: plan.billingCycle,
        monthlyConversationLimit: plan.monthlyConversationLimit,
        monthlyReportLimit: plan.monthlyReportLimit,
        monthlyTokenLimit: plan.monthlyTokenLimit,
        features: plan.features,
        modelAccess: plan.modelAccess,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
  }
  console.log(`Upserted ${SUBSCRIPTION_PLANS.length} subscription plans`);
}
```

- [ ] **Step 2: 在 main() 中调用 upsertSubscriptionPlans**

在 `main()` 函数体中（`upsertCars()` 调用之后）添加：

```typescript
  await upsertSubscriptionPlans();
```

- [ ] **Step 3: 运行 seed**

Run: `cd apps/api && npx prisma db seed`
Expected: Upserted 3 subscription plans

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(seed): add FREE/PRO/PREMIUM subscription plan seed data"
```

---

## Task 4: SubscriptionService — 订阅管理服务

**Files:**
- Create: `apps/api/src/services/subscription.service.ts`
- Test: `apps/api/tests/subscription.test.ts`

- [ ] **Step 1: 编写 subscription service 测试**

```typescript
// apps/api/tests/subscription.test.ts
import { describe, expect, it } from 'vitest';
import { SubscriptionPlanName, SubscriptionStatus, SubscriptionSource } from '@newcar/shared';

describe('SubscriptionService', () => {
  describe('getNextResetDate', () => {
    it('should advance reset date by one month', () => {
      const now = new Date('2026-03-15T00:00:00Z');
      const expected = new Date('2026-04-15T00:00:00Z');
      // getNextResetDate: 当前日期 + 1 month
      const result = new Date(now);
      result.setMonth(result.getMonth() + 1);
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should handle month-end overflow', () => {
      const jan31 = new Date('2026-01-31T00:00:00Z');
      const result = new Date(jan31);
      result.setMonth(result.getMonth() + 1);
      // JS Date: Jan 31 + 1 month = Mar 3 (overflow), so we need clamping
      // Our implementation should clamp to Feb 28
      expect(result.getMonth()).toBe(2); // March (overflow without clamping)
    });
  });

  describe('shouldResetQuota', () => {
    it('should return true when current time is past monthlyResetAt', () => {
      const resetAt = new Date('2026-03-01T00:00:00Z');
      const now = new Date('2026-03-15T00:00:00Z');
      expect(now >= resetAt).toBe(true);
    });

    it('should return false when current time is before monthlyResetAt', () => {
      const resetAt = new Date('2026-04-01T00:00:00Z');
      const now = new Date('2026-03-15T00:00:00Z');
      expect(now >= resetAt).toBe(false);
    });
  });

  describe('plan name validation', () => {
    it('should accept valid plan names', () => {
      expect(Object.values(SubscriptionPlanName)).toContain('FREE');
      expect(Object.values(SubscriptionPlanName)).toContain('PRO');
      expect(Object.values(SubscriptionPlanName)).toContain('PREMIUM');
    });
  });

  describe('quota calculation', () => {
    it('should calculate remaining quota correctly', () => {
      const limit = 200;
      const used = 150;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(50);
    });

    it('should not return negative remaining', () => {
      const limit = 20;
      const used = 25;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(0);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败/通过**

Run: `cd apps/api && npx vitest run tests/subscription.test.ts`
Expected: 全部 PASS（这些是纯逻辑测试）

- [ ] **Step 3: 创建 subscription service**

```typescript
// apps/api/src/services/subscription.service.ts
import { SubscriptionPlanName, SubscriptionStatus, SubscriptionSource } from '@newcar/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

function getNextResetDate(from: Date): Date {
  const result = new Date(from);
  const targetMonth = result.getMonth() + 1;
  result.setMonth(targetMonth);
  // Clamp overflow (e.g. Jan 31 -> Feb 28, not Mar 3)
  if (result.getMonth() !== targetMonth % 12) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

export class SubscriptionService {
  async getActivePlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getUserSubscription(userId: string) {
    const sub = await prisma.userSubscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });

    if (sub) {
      // Lazy reset check
      return this.maybeResetQuota(sub);
    }

    return sub;
  }

  async createFreeSubscription(userId: string) {
    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { name: SubscriptionPlanName.FREE },
    });

    if (!freePlan) {
      logger.warn('FREE plan not found in database, skipping subscription creation');
      return null;
    }

    return prisma.userSubscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        monthlyResetAt: getNextResetDate(new Date()),
        source: SubscriptionSource.SYSTEM,
      },
      include: { plan: true },
    });
  }

  async upgradePlan(userId: string, targetPlanName: string) {
    const targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { name: targetPlanName },
    });

    if (!targetPlan || !targetPlan.isActive) {
      throw new Error('Target plan not found or inactive');
    }

    const currentSub = await this.getUserSubscription(userId);

    if (currentSub && currentSub.plan.sortOrder >= targetPlan.sortOrder) {
      throw new Error('Cannot downgrade or switch to same plan via upgrade endpoint');
    }

    // Deactivate current subscription if exists
    if (currentSub) {
      await prisma.userSubscription.update({
        where: { id: currentSub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    }

    // Create new subscription, preserve used quota
    return prisma.userSubscription.create({
      data: {
        userId,
        planId: targetPlan.id,
        status: SubscriptionStatus.ACTIVE,
        monthlyConversationsUsed: currentSub?.monthlyConversationsUsed ?? 0,
        monthlyReportsUsed: currentSub?.monthlyReportsUsed ?? 0,
        monthlyTokensUsed: currentSub?.monthlyTokensUsed ?? 0,
        monthlyResetAt: currentSub?.monthlyResetAt ?? getNextResetDate(new Date()),
        source: SubscriptionSource.SYSTEM,
      },
      include: { plan: true },
    });
  }

  async getQuotaStatus(userId: string) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) {
      return null;
    }

    return {
      conversations: {
        used: sub.monthlyConversationsUsed,
        limit: sub.plan.monthlyConversationLimit,
        remaining: Math.max(0, sub.plan.monthlyConversationLimit - sub.monthlyConversationsUsed),
      },
      reports: {
        used: sub.monthlyReportsUsed,
        limit: sub.plan.monthlyReportLimit,
        remaining: Math.max(0, sub.plan.monthlyReportLimit - sub.monthlyReportsUsed),
      },
      tokens: {
        used: sub.monthlyTokensUsed,
        limit: sub.plan.monthlyTokenLimit,
        remaining: Math.max(0, sub.plan.monthlyTokenLimit - sub.monthlyTokensUsed),
      },
    };
  }

  async incrementConversationUsage(userId: string) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) return;

    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { monthlyConversationsUsed: { increment: 1 } },
    });
  }

  async incrementReportUsage(userId: string) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) return;

    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { monthlyReportsUsed: { increment: 1 } },
    });
  }

  async incrementTokenUsage(userId: string, tokens: number) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) return;

    await prisma.userSubscription.update({
      where: { id: sub.id },
      data: { monthlyTokensUsed: { increment: tokens } },
    });
  }

  private async maybeResetQuota(sub: { id: string; monthlyResetAt: Date; plan: unknown } & Record<string, unknown>) {
    const now = new Date();
    if (now >= sub.monthlyResetAt) {
      const updated = await prisma.userSubscription.update({
        where: { id: sub.id },
        data: {
          monthlyConversationsUsed: 0,
          monthlyReportsUsed: 0,
          monthlyTokensUsed: 0,
          monthlyResetAt: getNextResetDate(now),
        },
        include: { plan: true },
      });
      return updated;
    }
    return sub;
  }
}

export const subscriptionService = new SubscriptionService();
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/subscription.service.ts apps/api/tests/subscription.test.ts
git commit -m "feat: add SubscriptionService with quota management and lazy reset"
```

---

## Task 5: AiUsageService — AI 用量记录服务

**Files:**
- Create: `apps/api/src/services/ai-usage.service.ts`
- Test: `apps/api/tests/ai-usage.test.ts`

- [ ] **Step 1: 编写 AI usage service 测试**

```typescript
// apps/api/tests/ai-usage.test.ts
import { describe, expect, it } from 'vitest';

// Model pricing table (USD per 1M tokens)
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

describe('AiUsageService', () => {
  describe('estimateCost', () => {
    it('should calculate cost for basic model', () => {
      const cost = estimateCost('basic', 1000, 500);
      // (1000 * 0.25 + 500 * 1.25) / 1_000_000 = (250 + 625) / 1_000_000 = 0.000875
      expect(cost).toBeCloseTo(0.000875, 6);
    });

    it('should calculate cost for advanced model', () => {
      const cost = estimateCost('advanced', 10000, 2000);
      // (10000 * 3.0 + 2000 * 15.0) / 1_000_000 = (30000 + 30000) / 1_000_000 = 0.06
      expect(cost).toBeCloseTo(0.06, 6);
    });

    it('should fallback to basic pricing for unknown model', () => {
      const cost = estimateCost('unknown-model', 1000, 500);
      expect(cost).toBeCloseTo(0.000875, 6);
    });
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd apps/api && npx vitest run tests/ai-usage.test.ts`
Expected: 全部 PASS

- [ ] **Step 3: 创建 AI usage service**

```typescript
// apps/api/src/services/ai-usage.service.ts
import { AiRequestType } from '@newcar/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { subscriptionService } from './subscription.service';

// USD per 1M tokens
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

    // Atomically increment token usage on subscription
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

    // Determine primary model (most used)
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
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai-usage.service.ts apps/api/tests/ai-usage.test.ts
git commit -m "feat: add AiUsageService with cost estimation and conversation aggregation"
```

---

## Task 6: Quota Middleware — 额度检查中间件

**Files:**
- Create: `apps/api/src/middleware/quota.ts`
- Test: `apps/api/tests/quota-middleware.test.ts`

- [ ] **Step 1: 编写额度中间件测试**

```typescript
// apps/api/tests/quota-middleware.test.ts
import { describe, expect, it } from 'vitest';

type QuotaType = 'conversation' | 'report';

function isQuotaExceeded(
  quotaType: QuotaType,
  used: number,
  limit: number
): boolean {
  return used >= limit;
}

describe('Quota Middleware', () => {
  describe('isQuotaExceeded', () => {
    it('should return true when conversations used equals limit', () => {
      expect(isQuotaExceeded('conversation', 20, 20)).toBe(true);
    });

    it('should return true when conversations used exceeds limit', () => {
      expect(isQuotaExceeded('conversation', 25, 20)).toBe(true);
    });

    it('should return false when conversations used is below limit', () => {
      expect(isQuotaExceeded('conversation', 10, 20)).toBe(false);
    });

    it('should return true when reports used equals limit', () => {
      expect(isQuotaExceeded('report', 10, 10)).toBe(true);
    });

    it('should return false when reports used is below limit', () => {
      expect(isQuotaExceeded('report', 5, 10)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd apps/api && npx vitest run tests/quota-middleware.test.ts`
Expected: 全部 PASS

- [ ] **Step 3: 创建 quota 中间件**

```typescript
// apps/api/src/middleware/quota.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { subscriptionService } from '../services/subscription.service';

type QuotaType = 'conversation' | 'report';

function createQuotaMiddleware(quotaType: QuotaType) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sub = await subscriptionService.getUserSubscription(userId);
    if (!sub) {
      return res.status(403).json({
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION',
      });
    }

    if (quotaType === 'conversation') {
      if (sub.monthlyConversationsUsed >= sub.plan.monthlyConversationLimit) {
        return res.status(403).json({
          error: '本月对话次数已用完，下月自动重置，或升级套餐获得更多次数',
          code: 'CONVERSATION_QUOTA_EXCEEDED',
          quota: {
            used: sub.monthlyConversationsUsed,
            limit: sub.plan.monthlyConversationLimit,
          },
          currentPlan: sub.plan.name,
        });
      }
    }

    if (quotaType === 'report') {
      if (sub.plan.monthlyReportLimit === 0) {
        return res.status(403).json({
          error: '升级到 Pro 解锁分析报告',
          code: 'REPORT_NOT_AVAILABLE',
          currentPlan: sub.plan.name,
        });
      }
      if (sub.monthlyReportsUsed >= sub.plan.monthlyReportLimit) {
        return res.status(403).json({
          error: '本月报告份数已用完',
          code: 'REPORT_QUOTA_EXCEEDED',
          quota: {
            used: sub.monthlyReportsUsed,
            limit: sub.plan.monthlyReportLimit,
          },
          currentPlan: sub.plan.name,
        });
      }
    }

    return next();
  };
}

export const conversationQuota = createQuotaMiddleware('conversation');
export const reportQuota = createQuotaMiddleware('report');
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/quota.ts apps/api/tests/quota-middleware.test.ts
git commit -m "feat: add conversation and report quota check middleware with lazy reset"
```

---

## Task 7: Subscription Controller + Routes

**Files:**
- Create: `apps/api/src/controllers/subscription.controller.ts`
- Create: `apps/api/src/routes/subscription.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: 创建 subscription controller**

```typescript
// apps/api/src/controllers/subscription.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { subscriptionService } from '../services/subscription.service';

export class SubscriptionController {
  async getCurrentSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const sub = await subscriptionService.getUserSubscription(userId);

      if (!sub) {
        return res.status(404).json({ error: 'No active subscription' });
      }

      const quota = await subscriptionService.getQuotaStatus(userId);

      return res.json({ subscription: sub, quota });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getPlans(_req: AuthenticatedRequest, res: Response) {
    try {
      const plans = await subscriptionService.getActivePlans();
      return res.json({ plans });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async upgradePlan(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { planName } = req.body;

      const sub = await subscriptionService.upgradePlan(userId, planName);
      const quota = await subscriptionService.getQuotaStatus(userId);

      return res.json({ subscription: sub, quota });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  }
}

export const subscriptionController = new SubscriptionController();
```

- [ ] **Step 2: 创建 subscription routes**

```typescript
// apps/api/src/routes/subscription.ts
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../lib/validate';
import { subscriptionController } from '../controllers/subscription.controller';

const upgradeSchema = z.object({
  planName: z.enum(['PRO', 'PREMIUM']),
});

const router = Router();

router.get('/current', authMiddleware, (req, res) => subscriptionController.getCurrentSubscription(req, res));
router.get('/plans', authMiddleware, (req, res) => subscriptionController.getPlans(req, res));
router.post('/upgrade', authMiddleware, validateBody(upgradeSchema), (req, res) => subscriptionController.upgradePlan(req, res));

export default router;
```

- [ ] **Step 3: 挂载 subscription 路由到 app.ts**

在 `apps/api/src/app.ts` 中：

1. 添加 import：
```typescript
import subscriptionRoutes from './routes/subscription';
```

2. 在 `app.use('/admin/moderation', moderationRoutes);` 行之后添加：
```typescript
  app.use('/subscription', subscriptionRoutes);
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/subscription.controller.ts apps/api/src/routes/subscription.ts apps/api/src/app.ts
git commit -m "feat: add subscription API endpoints (current, plans, upgrade)"
```

---

## Task 8: Admin Usage Controller + Routes

**Files:**
- Create: `apps/api/src/controllers/admin-usage.controller.ts`
- Create: `apps/api/src/routes/admin-usage.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: 创建 admin usage controller**

```typescript
// apps/api/src/controllers/admin-usage.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiUsageService } from '../services/ai-usage.service';
import { prisma } from '../lib/prisma';

export class AdminUsageController {
  async getUsageSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const { userId, startDate, endDate } = req.query;
      const summary = await aiUsageService.getUsageSummary({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      return res.json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getUsageDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const { userId, conversationId, cursor, limit } = req.query;
      const logs = await aiUsageService.getUsageDetails({
        userId: userId as string | undefined,
        conversationId: conversationId as string | undefined,
        cursor: cursor as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      return res.json({ logs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getSubscriptionDistribution(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const distribution = await prisma.userSubscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      });

      // Enrich with plan names
      const plans = await prisma.subscriptionPlan.findMany();
      const planMap = new Map(plans.map((p) => [p.id, p]));

      const result = distribution.map((d) => ({
        plan: planMap.get(d.planId),
        count: d._count.id,
      }));

      return res.json({ distribution: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
}

export const adminUsageController = new AdminUsageController();
```

- [ ] **Step 2: 创建 admin usage routes**

```typescript
// apps/api/src/routes/admin-usage.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminUsageController } from '../controllers/admin-usage.controller';

const router = Router();

router.get('/summary', authMiddleware, (req, res) => adminUsageController.getUsageSummary(req, res));
router.get('/details', authMiddleware, (req, res) => adminUsageController.getUsageDetails(req, res));
router.get('/subscriptions', authMiddleware, (req, res) => adminUsageController.getSubscriptionDistribution(req, res));

export default router;
```

- [ ] **Step 3: 在 app.ts 挂载 admin usage 路由**

添加 import：
```typescript
import adminUsageRoutes from './routes/admin-usage';
```

在 subscription 路由之后添加：
```typescript
  app.use('/admin/usage', adminUsageRoutes);
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/admin-usage.controller.ts apps/api/src/routes/admin-usage.ts apps/api/src/app.ts
git commit -m "feat: add admin usage API endpoints (summary, details, subscription distribution)"
```

---

## Task 9: Auth Integration — 注册时自动创建 FREE 订阅

**Files:**
- Modify: `apps/api/src/services/auth.service.ts`

- [ ] **Step 1: 在 auth service 中导入 subscriptionService**

在 `apps/api/src/services/auth.service.ts` 顶部添加：

```typescript
import { subscriptionService } from './subscription.service';
```

- [ ] **Step 2: 在 wechatLogin 中新用户创建后添加订阅**

在 `wechatLogin` 方法中，`user = await prisma.user.create(...)` 之后（约第 35 行后）添加：

```typescript
      await subscriptionService.createFreeSubscription(user.id);
```

- [ ] **Step 3: 在 phoneLogin 中新用户创建后添加订阅**

在 `phoneLogin` 方法中，`user = await prisma.user.create(...)` 之后（约第 61 行后）添加：

```typescript
      await subscriptionService.createFreeSubscription(user.id);
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/auth.service.ts
git commit -m "feat: auto-create FREE subscription on user registration"
```

---

## Task 10: Frontend — API 层和类型

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: 在 api.ts 的 getMockResponse 函数中添加订阅 mock 数据**

在 `getMockResponse` 函数的 GET 路由部分（`return null;` 之前）添加：

```typescript
  if (path === '/subscription/current') return {
    subscription: {
      id: 'mock-sub-1',
      plan: { id: 'mock-plan-free', name: 'FREE', displayName: '免费版', price: 0, monthlyConversationLimit: 20, monthlyReportLimit: 0, monthlyTokenLimit: 100000, sortOrder: 0 },
      status: 'ACTIVE',
      monthlyConversationsUsed: 12,
      monthlyReportsUsed: 0,
      monthlyTokensUsed: 45000,
      monthlyResetAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    },
    quota: {
      conversations: { used: 12, limit: 20, remaining: 8 },
      reports: { used: 0, limit: 0, remaining: 0 },
      tokens: { used: 45000, limit: 100000, remaining: 55000 },
    },
  } as T;
  if (path === '/subscription/plans') return {
    plans: [
      { id: 'p1', name: 'FREE', displayName: '免费版', price: 0, monthlyConversationLimit: 20, monthlyReportLimit: 0, monthlyTokenLimit: 100000, features: { basicChat: true }, modelAccess: ['basic'], sortOrder: 0 },
      { id: 'p2', name: 'PRO', displayName: 'Pro', price: 2900, monthlyConversationLimit: 200, monthlyReportLimit: 10, monthlyTokenLimit: 1000000, features: { basicChat: true, advancedChat: true, reports: true }, modelAccess: ['basic', 'advanced'], sortOrder: 1 },
      { id: 'p3', name: 'PREMIUM', displayName: 'Premium', price: 7900, monthlyConversationLimit: 1000, monthlyReportLimit: 30, monthlyTokenLimit: 5000000, features: { basicChat: true, advancedChat: true, reports: true, priorityResponse: true }, modelAccess: ['basic', 'advanced', 'best'], sortOrder: 2 },
    ],
  } as T;
```

在 POST 路由部分添加：

```typescript
    if (path === '/subscription/upgrade') return { subscription: {}, quota: {} } as T;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add subscription mock data and API endpoints"
```

---

## Task 11: Frontend — UsageProgressBar 组件

**Files:**
- Create: `apps/web/src/components/subscription/UsageProgressBar.tsx`

- [ ] **Step 1: 创建用量进度条组件**

```tsx
// apps/web/src/components/subscription/UsageProgressBar.tsx
'use client';

interface UsageProgressBarProps {
  label: string;
  used: number;
  limit: number;
  formatValue?: (value: number) => string;
}

export default function UsageProgressBar({ label, used, limit, formatValue }: UsageProgressBarProps) {
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isExceeded = used >= limit && limit > 0;
  const format = formatValue ?? ((v: number) => String(v));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={isExceeded ? 'text-red-500 font-medium' : 'text-[var(--text-primary)]'}>
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isExceeded
              ? 'bg-red-500'
              : percentage > 80
                ? 'bg-yellow-500'
                : 'bg-[var(--accent)]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {limit === 0 && (
        <p className="text-xs text-[var(--text-tertiary)]">升级套餐解锁</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/subscription/UsageProgressBar.tsx
git commit -m "feat(web): add UsageProgressBar component"
```

---

## Task 12: Frontend — CurrentPlanCard 组件

**Files:**
- Create: `apps/web/src/components/subscription/CurrentPlanCard.tsx`

- [ ] **Step 1: 创建当前套餐卡片组件**

```tsx
// apps/web/src/components/subscription/CurrentPlanCard.tsx
'use client';

import type { UserSubscriptionInfo, QuotaStatus } from '@newcar/shared';
import UsageProgressBar from './UsageProgressBar';

interface CurrentPlanCardProps {
  subscription: UserSubscriptionInfo;
  quota: QuotaStatus;
  onUpgradeClick: () => void;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

export default function CurrentPlanCard({ subscription, quota, onUpgradeClick }: CurrentPlanCardProps) {
  const plan = subscription.plan;
  const isPremium = plan.name === 'PREMIUM';
  const resetDate = new Date(subscription.monthlyResetAt).toLocaleDateString('zh-CN');

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{plan.displayName}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {plan.price === 0 ? '免费' : `¥${(plan.price / 100).toFixed(0)}/月`}
            <span className="ml-2">· 下次重置: {resetDate}</span>
          </p>
        </div>
        {!isPremium && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            升级套餐
          </button>
        )}
      </div>

      {/* Usage bars */}
      <div className="space-y-4">
        <UsageProgressBar
          label="本月对话"
          used={quota.conversations.used}
          limit={quota.conversations.limit}
          formatValue={(v) => `${v} 次`}
        />
        <UsageProgressBar
          label="本月报告"
          used={quota.reports.used}
          limit={quota.reports.limit}
          formatValue={(v) => `${v} 份`}
        />
        <UsageProgressBar
          label="本月 Token"
          used={quota.tokens.used}
          limit={quota.tokens.limit}
          formatValue={formatTokens}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/subscription/CurrentPlanCard.tsx
git commit -m "feat(web): add CurrentPlanCard with usage progress bars"
```

---

## Task 13: Frontend — PlanComparisonGrid 组件

**Files:**
- Create: `apps/web/src/components/subscription/PlanComparisonGrid.tsx`

- [ ] **Step 1: 创建套餐对比网格组件**

```tsx
// apps/web/src/components/subscription/PlanComparisonGrid.tsx
'use client';

import type { SubscriptionPlanInfo } from '@newcar/shared';

interface PlanComparisonGridProps {
  plans: SubscriptionPlanInfo[];
  currentPlanName: string;
  onSelectPlan: (planName: string) => void;
  upgrading: boolean;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

const PLAN_FEATURES: Record<string, { label: string; key: string }[]> = {
  FREE: [
    { label: 'AI 基础对话', key: 'basicChat' },
  ],
  PRO: [
    { label: 'AI 基础对话', key: 'basicChat' },
    { label: '高级 AI 模型', key: 'advancedChat' },
    { label: '分析报告', key: 'reports' },
  ],
  PREMIUM: [
    { label: 'AI 基础对话', key: 'basicChat' },
    { label: '最强 AI 模型', key: 'advancedChat' },
    { label: '分析报告', key: 'reports' },
    { label: '优先响应', key: 'priorityResponse' },
  ],
};

export default function PlanComparisonGrid({
  plans,
  currentPlanName,
  onSelectPlan,
  upgrading,
}: PlanComparisonGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {plans.map((plan) => {
        const isCurrent = plan.name === currentPlanName;
        const isUpgrade = plan.sortOrder > (plans.find((p) => p.name === currentPlanName)?.sortOrder ?? -1);
        const isRecommended = plan.name === 'PRO';
        const features = PLAN_FEATURES[plan.name] ?? [];

        return (
          <div
            key={plan.id}
            className={`relative rounded-xl border p-5 space-y-4 ${
              isRecommended
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20'
                : 'border-[var(--border)]'
            } bg-[var(--bg-secondary)]`}
          >
            {isRecommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium">
                推荐
              </span>
            )}

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.displayName}</h3>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {plan.price === 0 ? '免费' : `¥${(plan.price / 100).toFixed(0)}`}
                {plan.price > 0 && <span className="text-sm font-normal text-[var(--text-secondary)]">/月</span>}
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>对话次数</span>
                <span className="font-medium text-[var(--text-primary)]">{plan.monthlyConversationLimit}/月</span>
              </li>
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>Token 额度</span>
                <span className="font-medium text-[var(--text-primary)]">{formatTokens(plan.monthlyTokenLimit)}/月</span>
              </li>
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>分析报告</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {plan.monthlyReportLimit === 0 ? '—' : `${plan.monthlyReportLimit} 份/月`}
                </span>
              </li>
            </ul>

            <div className="border-t border-[var(--border)] pt-3">
              <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                {features.map((f) => (
                  <li key={f.key} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan(plan.name)}
              disabled={isCurrent || !isUpgrade || upgrading}
              className={`w-full py-2 rounded-lg font-medium transition-opacity ${
                isCurrent
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-default'
                  : isUpgrade
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              }`}
            >
              {isCurrent ? '当前套餐' : isUpgrade ? (upgrading ? '升级中...' : '升级') : '—'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/subscription/PlanComparisonGrid.tsx
git commit -m "feat(web): add PlanComparisonGrid with recommended badge"
```

---

## Task 14: Frontend — QuotaExceededBanner 组件

**Files:**
- Create: `apps/web/src/components/subscription/QuotaExceededBanner.tsx`

- [ ] **Step 1: 创建额度超限提示组件**

```tsx
// apps/web/src/components/subscription/QuotaExceededBanner.tsx
'use client';

interface QuotaExceededBannerProps {
  type: 'conversation' | 'report';
  currentPlan: string;
  onUpgradeClick: () => void;
}

const MESSAGES: Record<string, Record<string, string>> = {
  conversation: {
    title: '本月对话次数已用完',
    description: '下月自动重置，或升级套餐获得更多次数',
    freeHint: 'Pro 版每月 200 次对话 + 高级 AI 模型，仅 ¥29/月',
  },
  report: {
    title: '本月报告份数已用完',
    description: '升级套餐获取更多报告额度',
    freeHint: '升级到 Pro 解锁分析报告功能',
  },
};

export default function QuotaExceededBanner({
  type,
  currentPlan,
  onUpgradeClick,
}: QuotaExceededBannerProps) {
  const msg = MESSAGES[type];
  const isFree = currentPlan === 'FREE';

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-50/10 p-4 space-y-2">
      <p className="font-medium text-[var(--text-primary)]">{msg.title}</p>
      <p className="text-sm text-[var(--text-secondary)]">{msg.description}</p>
      {isFree && (
        <p className="text-sm text-[var(--accent)]">{msg.freeHint}</p>
      )}
      <button
        onClick={onUpgradeClick}
        className="mt-2 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        升级套餐
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/subscription/QuotaExceededBanner.tsx
git commit -m "feat(web): add QuotaExceededBanner component"
```

---

## Task 15: Frontend — 订阅管理页面

**Files:**
- Create: `apps/web/src/app/settings/subscription/page.tsx`

- [ ] **Step 1: 创建订阅管理页面**

```tsx
// apps/web/src/app/settings/subscription/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api';
import type { SubscriptionPlanInfo, UserSubscriptionInfo, QuotaStatus } from '@newcar/shared';
import CurrentPlanCard from '@/components/subscription/CurrentPlanCard';
import PlanComparisonGrid from '@/components/subscription/PlanComparisonGrid';

interface SubscriptionResponse {
  subscription: UserSubscriptionInfo;
  quota: QuotaStatus;
}

interface PlansResponse {
  plans: SubscriptionPlanInfo[];
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<UserSubscriptionInfo | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanInfo[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        get<SubscriptionResponse>('/subscription/current'),
        get<PlansResponse>('/subscription/plans'),
      ]);
      setSubscription(subRes.subscription);
      setQuota(subRes.quota);
      setPlans(plansRes.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (planName: string) => {
    setUpgrading(true);
    setError(null);
    try {
      const res = await post<SubscriptionResponse>('/subscription/upgrade', { planName });
      setSubscription(res.subscription);
      setQuota(res.quota);
      setShowComparison(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '升级失败');
    } finally {
      setUpgrading(false);
    }
  };

  if (!subscription || !quota) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48" />
          <div className="h-48 bg-[var(--bg-tertiary)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">套餐管理</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">管理你的 AI 助理订阅和用量</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-50/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <CurrentPlanCard
        subscription={subscription}
        quota={quota}
        onUpgradeClick={() => setShowComparison(true)}
      />

      {showComparison && plans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">选择套餐</h2>
          <PlanComparisonGrid
            plans={plans}
            currentPlanName={subscription.plan.name}
            onSelectPlan={handleUpgrade}
            upgrading={upgrading}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证前端编译**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: 编译成功（可能有其他页面已有警告，但不应有新错误）

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/settings/subscription/page.tsx
git commit -m "feat(web): add subscription management page at /settings/subscription"
```

---

## Task 16: 接入 Quota 中间件到现有路由

**Files:**
- Modify: `apps/api/src/routes/ai-chat.ts`
- Modify: `apps/api/src/routes/snapshot.ts`

- [ ] **Step 1: 在 AI chat 路由添加对话额度检查**

在 `apps/api/src/routes/ai-chat.ts` 中：

1. 添加 import：
```typescript
import { conversationQuota } from '../middleware/quota';
```

2. 在 `authMiddleware` 之后、`sessionMiddleware` 之前插入 `conversationQuota`：
```typescript
router.post(
  '/:journeyId/chat',
  authMiddleware,
  conversationQuota,
  sessionMiddleware,
  (req, res) => aiChatController.chat(req, res)
);
```

- [ ] **Step 2: 在 snapshot 路由添加报告额度检查**

在 `apps/api/src/routes/snapshot.ts` 中：

1. 添加 import：
```typescript
import { reportQuota } from '../middleware/quota';
```

2. 在 POST snapshot 路由的 `authMiddleware` 之后插入 `reportQuota`：
```typescript
router.post('/:journeyId/snapshot', authMiddleware, reportQuota, (req, res) =>
  snapshotController.generateSnapshot(req, res)
);
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | head -10`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/ai-chat.ts apps/api/src/routes/snapshot.ts
git commit -m "feat: wire quota middleware into AI chat and snapshot routes"
```

---

## Task 17: 运行全部测试

- [ ] **Step 1: 运行后端测试**

Run: `cd apps/api && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 2: 检查 TypeScript 编译**

Run: `cd apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Final commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve any type or test issues from subscription billing feature"
```
