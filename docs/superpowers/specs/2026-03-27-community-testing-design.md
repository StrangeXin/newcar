# 社区发布系统测试设计 Spec

> 子项目 4/5：社区发布系统测试。

## 目标

现有 publish/community/moderation 的单元测试已较完善（publish.test.ts、published-journey.controller.test.ts、community.test.ts、moderation.test.ts），集成测试也已覆盖基本流程（community-flow、moderation-flow）。本子项目重点修复已有集成测试的 bug、补充缺失的发布+审核完整流程测试。

## 现有测试盘点

### 保留不动

| 文件 | 测试数 | 说明 |
|------|--------|------|
| publish.test.ts | ~18 | PublishService 完整 mock 测试（含 retry、parseJsonBlock、regenerate） |
| published-journey.controller.test.ts | ~10 | Controller 层完整测试 |
| community.test.ts | ~4 | calcRelevanceBoost + ForkService 测试 |
| moderation.test.ts | ~12 | ModerationService: preReview(5) + getReviewQueue(3) + approve(1) + reject(3) |

### 已有集成测试（需修复）

| 文件 | 状态 | 问题 |
|------|------|------|
| community-flow.integration.test.ts | ✅ 通过 | 正常 |
| moderation-flow.integration.test.ts | ❌ 失败 | member 请求 /admin/moderation/queue 期望 403 但返回 401（auth middleware 在 admin middleware 之前拦截） |

## 测试范围

### 修复

#### 1. `tests/integration/moderation-flow.integration.test.ts`（修复）

**问题：** member token 发送到 admin 路由时，auth middleware 通过（token 有效），但 admin middleware 返回 403。当前测试期望 403 但拿到 401 — 说明 member token 可能没带正确的 role 信息，或者 admin middleware 的实现依赖 DB 查询 user.role。

**修复方案：** 检查 admin middleware 实现，确保测试用正确 token 和期望。如果 admin middleware 需要从 DB 查 user.role，则 member token 应该能通过 auth middleware 拿到 403。需要调试具体返回 401 的原因。

### 新增集成测试

#### 2. `tests/integration/publish-flow.integration.test.ts`（新建）

端到端发布流程测试，使用 seed 中已有的 activeJourney。

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 发布 journey（story 格式） | POST /journeys/:activeJourneyId/publish (member) | 201，返回 publishedJourney with contentStatus |
| 重复发布同一 journey（upsert） | POST /journeys/:activeJourneyId/publish (member) 第二次 | 200/201，contentVersion++ |
| 缺少 title | POST /journeys/:id/publish (member) {formats:['story']} | 400 |
| 缺少 formats | POST /journeys/:id/publish (member) {title:'test'} | 400 |
| 未认证 | POST /journeys/:id/publish (no token) | 401 |
| 取消发布 | DELETE /published-journeys/:id (member) | 200，contentStatus=AUTHOR_DELETED |

#### 3. `tests/integration/community-engagement.integration.test.ts`（新建）

使用 seed 中已有的 publishedJourneyId (LIVE)。

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 查看已发布旅程详情 | GET /published-journeys/:id | 200 |
| 已删除内容不可见 | GET /published-journeys/:pendingId | 非 200（PENDING_REVIEW 状态不可公开访问） |
| fork journey | POST /community/:id/fork (admin — 没有 ACTIVE journey 的用户) | 201，返回 journeyId |
| fork 非 template 格式被拒 | POST /community/:storyOnlyId/fork | 400 |

## 技术约束

- 发布路由：POST /journeys/:journeyId/publish（挂在 journeyPublishRoutes）
- 社区路由：/community/...
- published-journeys 路由：/published-journeys/...
- 集成测试 mock Anthropic SDK（setup.ts 已有），AI 内容生成会走 mock 路径
- moderation-flow 修复需先 debug auth/admin middleware 交互

## 预估

| 文件 | 类型 | 变更 | 测试数 |
|------|------|------|--------|
| moderation-flow.integration.test.ts | Integration | 修复 | ~6（现有） |
| publish-flow.integration.test.ts | Integration | 新建 | 6 |
| community-engagement.integration.test.ts | Integration | 新建 | 4 |
| **净增** | | | **+10 新测试 + 修复现有** |
