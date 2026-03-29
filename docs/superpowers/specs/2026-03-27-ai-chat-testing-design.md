# AI 对话系统测试设计 Spec

> 子项目 2/5：AI 对话系统测试。

## 目标

清理 ai-chat.test.ts 中 3 个镜像测试，补充 AiUsageService 单元测试（logRequest/syncConversationUsage），新增 AI 对话 REST API 集成测试。保留已有高质量的 buildSignals / estimateConfidenceScore / createTimelineEventForSideEffect / runMockChat / ChatWsController 测试不动。

## 测试范围

### 单元测试

#### 1. `tests/ai-chat.test.ts`（修改）

**删除 3 个镜像测试：**
- "should validate budget extraction regex" — 重复 buildSignals 已覆盖的逻辑
- "should validate tool name enum" — 硬编码数组比对
- "should validate AI response structure" — 静态对象断言

**保留不动（22 个）：**
- createTimelineEventForSideEffect: 6 个
- buildSignals: 5 个
- estimateConfidenceScore: 7 个
- runMockChat: 4 个

**新增 shouldSuggestPublish 测试（纯函数，导入自 chat-side-effects.ts）：**

| 测试用例 | 期望 |
|---------|------|
| stage=DECISION → true | shouldSuggestPublish('DECISION') === true |
| stage=PURCHASE → true | shouldSuggestPublish('PURCHASE') === true |
| stage=AWARENESS → false | shouldSuggestPublish('AWARENESS') === false |
| stage=undefined → false | shouldSuggestPublish(undefined) === false |

#### 2. `tests/ai-usage.service.test.ts`（新建）

Mock: `vi.mock('../src/lib/prisma')` + `vi.mock('../src/services/subscription.service')` + `vi.mock('../src/lib/logger')`

| 测试组 | 测试用例 | 期望 |
|--------|---------|------|
| logRequest | 创建 aiUsageLog 并计算 cost | prisma.aiUsageLog.create 被调用，estimatedCostUsd 正确 |
| logRequest | 调用 incrementTokenUsage | subscriptionService.incrementTokenUsage(userId, totalTokens) |
| logRequest | 使用默认 requestType=CHAT | data.requestType === 'CHAT' when not provided |
| syncConversationUsage | 聚合多条 log，找到 primaryModel | upsert 被调用，primaryModel 为出现次数最多的 model |
| syncConversationUsage | 无 log 返回 null | findMany 返回 [] 时直接返回 null |

#### 3. `tests/chat-ws-auth.test.ts`（保留不动）

已有 10 个高质量测试，全部保留。

### 集成测试

#### 4. `tests/integration/ai-chat-api.integration.test.ts`（新建）

前置：seed-test.ts 已有 journey + subscription 数据，mock Anthropic SDK 已在 setup.ts 中完成。

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 正常对话 | POST /journeys/:activeJourneyId/chat (member) body:{message:'30万SUV'} | 200，返回 {message, conversationId, extractedSignals} |
| 缺少 message | POST /journeys/:activeJourneyId/chat (member) body:{} | 400 'Message is required' |
| journey 不存在 | POST /journeys/nonexistent/chat (member) | 404 'Journey not found' |
| 无权访问他人 journey | POST /journeys/:activeJourneyId/chat (admin) | 403 'Forbidden'（journey 属于 member） |
| 未认证 | POST /journeys/:activeJourneyId/chat (no token) | 401 |
| 额度用完 | 设 used=20 后 POST chat | 403 CONVERSATION_QUOTA_EXCEEDED |

## 删除的代码

- `ai-chat.test.ts` 中前 3 个 describe('AI Chat') 下的测试（保留 describe 块或删除整个块）

## 技术约束

- 单元测试遵循现有 ai-chat.test.ts mock 模式
- 集成测试使用 e2eMock=true（setup.ts 中已 mock Anthropic SDK）
- shouldSuggestPublish 直接从 chat-side-effects.ts 导入测试（纯函数，无需 mock）

## 预估

| 文件 | 类型 | 变更 | 测试数 |
|------|------|------|--------|
| ai-chat.test.ts | Unit | 删 3 + 加 4 | 26（净+1） |
| ai-usage.service.test.ts | Unit | 新建 | 5 |
| chat-ws-auth.test.ts | Unit | 不动 | 10 |
| ai-usage.test.ts | Unit | 不动 | 3 |
| ai-chat-api.integration.test.ts | Integration | 新建 | 6 |
| **合计** | | | **50** |

净增 ~12 个真实测试，删除 3 个镜像测试。
