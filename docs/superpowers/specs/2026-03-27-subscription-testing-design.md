# 订阅计费系统测试设计 Spec

> 子项目 1/5：订阅计费系统测试。后续子项目覆盖 AI 对话、Journey 核心、社区发布、基础设施。

## 目标

用真实代码路径替换现有"镜像逻辑"测试，补充集成测试覆盖端到端流程。采用**薄单元 + 厚集成**策略：单元测试 mock Prisma 测 service/middleware 分支逻辑，集成测试走真实 DB + HTTP 测 API 端到端行为。

## 测试范围

### 单元测试

#### 1. `tests/subscription.service.test.ts`（新建，替换 subscription.test.ts）

Mock: `vi.mock('../src/lib/prisma')` + `vi.mock('../src/lib/logger')`

| 测试组 | 测试用例 |
|--------|---------|
| getActivePlans | 返回 isActive=true 的 plans，按 sortOrder 排序 |
| getUserSubscription | 有 ACTIVE 订阅时返回含 plan 的对象 |
| getUserSubscription | 无订阅时返回 null |
| getUserSubscription | monthlyResetAt 已过期时触发惰性重置（清零 used，更新 resetAt） |
| createFreeSubscription | 正常创建：查 FREE plan → create 订阅 |
| createFreeSubscription | FREE plan 不存在时 return null，不抛错 |
| upgradePlan | 正常升级：deactivate 旧订阅 + create 新订阅（事务内），保留已用量 |
| upgradePlan | 降级请求抛 Error |
| upgradePlan | 目标 plan 不存在抛 Error |
| upgradePlan | 无当前订阅时直接创建 |
| getQuotaStatus | 正常计算 remaining = max(0, limit - used) |
| getQuotaStatus | 无订阅返回 null |
| incrementConversationUsage | 调用 updateMany with increment: 1 |
| incrementTokenUsage | 调用 updateMany with increment: tokens |

#### 2. `tests/quota.middleware.test.ts`（新建，替换 quota-middleware.test.ts）

Mock: `vi.mock('../src/services/subscription.service')`，使用 Express mock req/res/next。

| 测试用例 | 期望 |
|---------|------|
| conversationQuota: 无 userId | 401 Unauthorized |
| conversationQuota: 无订阅 | 403 NO_SUBSCRIPTION |
| conversationQuota: 额度未满 | 调用 next() |
| conversationQuota: used >= limit | 403 CONVERSATION_QUOTA_EXCEEDED + quota 详情 |
| reportQuota: limit=0（FREE plan） | 403 REPORT_NOT_AVAILABLE |
| reportQuota: used >= limit | 403 REPORT_QUOTA_EXCEEDED + quota 详情 |

#### 3. `tests/ai-usage.test.ts`（保留，不改动）

已有 3 个 estimateCost 纯函数测试，保持原样。

### 集成测试

#### 前置：seed-test.ts 改动

在 `TEST_IDS` 中新增：

```typescript
freePlanId: 'test-plan-free',
proPlanId: 'test-plan-pro',
premiumPlanId: 'test-plan-premium',
memberSubscriptionId: 'test-sub-member',
adminSubscriptionId: 'test-sub-admin',
```

在 `seedTestData` 中新增：
- upsert 3 个 SubscriptionPlan（FREE/PRO/PREMIUM），数据与 seed.ts 一致
- 给 member 创建 FREE 订阅（monthlyResetAt 设为未来 30 天）
- 给 admin 创建 PRO 订阅
- memberNoActive 不创建订阅

#### 4. `tests/integration/subscription-api.integration.test.ts`

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 获取套餐列表 | GET /subscription/plans | 200，返回 3 个 plan，sortOrder 正确 |
| 获取当前订阅（有订阅） | GET /subscription/current (member) | 200，返回 FREE 订阅 + quota 结构 |
| 获取当前订阅（无订阅） | GET /subscription/current (memberNoActive) | 404 |
| 升级到 PRO | POST /subscription/upgrade (member, {planName:'PRO'}) | 200，旧订阅 EXPIRED，新订阅 ACTIVE，已用量保留 |
| 降级被拒 | POST /subscription/upgrade (admin PRO→FREE) | 400 |
| 无效 planName | POST /subscription/upgrade (member, {planName:'INVALID'}) | 400 validation error |
| 未认证 | GET /subscription/current (no token) | 401 |

#### 5. `tests/integration/quota-enforcement.integration.test.ts`

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 对话额度用完被拦截 | 设 used=20 后 POST /:journeyId/chat | 403 CONVERSATION_QUOTA_EXCEEDED |
| 对话额度未满放行 | used < limit 时 POST /:journeyId/chat | 非 403（可能 500，但不是额度拦截） |
| FREE 用户报告不可用 | POST /:journeyId/snapshot (member FREE) | 403 REPORT_NOT_AVAILABLE |
| 惰性重置后恢复 | 设 resetAt 为过去 + used=20，请求后检查 DB：used 重置为 0 |
| 无订阅用户被拦截 | POST /:journeyId/chat (memberNoActive) | 403 NO_SUBSCRIPTION |

#### 6. `tests/integration/admin-usage-api.integration.test.ts`

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| admin 查用量摘要 | GET /admin/usage/summary (admin) | 200 + {totalRequests, totalInputTokens, ...} |
| admin 查用量明细 | GET /admin/usage/details (admin) | 200 + {logs: [...]} |
| admin 查订阅分布 | GET /admin/usage/subscriptions (admin) | 200 + {distribution: [...]} |
| 非 admin 被拒 | GET /admin/usage/summary (member) | 403 |

## 删除的文件

- `tests/subscription.test.ts` — 被 `subscription.service.test.ts` 替代
- `tests/quota-middleware.test.ts` — 被 `quota.middleware.test.ts` 替代

## 技术约束

- 单元测试用 `vi.mock()` mock Prisma，遵循 publish.test.ts 模式
- 集成测试用 supertest + 真实 DB，遵循 auth.integration.test.ts 模式
- 集成测试 seed 数据用 `TEST_IDS` 常量确保可复现
- 集成测试 setup 中 mock 外部依赖（Anthropic SDK、axios），不 mock Prisma
- 所有测试必须可重复运行（beforeEach 重置状态）

## 预估

| 文件 | 类型 | 测试数 |
|------|------|--------|
| subscription.service.test.ts | Unit | ~14 |
| quota.middleware.test.ts | Unit | ~6 |
| ai-usage.test.ts（保留） | Unit | 3 |
| subscription-api.integration.test.ts | Integration | ~7 |
| quota-enforcement.integration.test.ts | Integration | ~5 |
| admin-usage-api.integration.test.ts | Integration | ~4 |
| **合计** | | **~39** |

净增 ~27 个测试（替换 12 个镜像测试，新增 39 个真实测试）。
