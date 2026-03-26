# AI 助理套餐账单系统设计

## 概述

为 newcar 平台增加用户订阅套餐体系和内部 AI 成本追踪系统。套餐面向用户（三档订阅制），成本追踪面向运营（对话级 + 请求级）。本阶段不接入真实支付。

## 套餐体系

### 三档定义

| | 免费版 | Pro | Premium |
|---|---|---|---|
| 价格 | ¥0 | ¥29/月 | ¥79/月 |
| 每月对话次数 | 20 | 200 | 1000 |
| 分析报告 | 无 | 10 份/月 | 30 份/月 |
| AI 模型 | 基础 | 高级 | 最强 |
| 优先响应 | 否 | 否 | 是 |

套餐配置存储在 `SubscriptionPlan` 表中，运营可配置，不硬编码。

### 用户订阅规则

- 新用户注册时自动分配 FREE 套餐
- 每用户同时只有一条 ACTIVE 订阅记录
- 升级立即生效，已用量保持不变
- 降级当前周期结束后生效（本阶段简化为立即生效）

## 数据模型

### 套餐订阅层

**SubscriptionPlan（套餐定义）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String @id | |
| name | String | FREE / PRO / PREMIUM |
| displayName | String | "免费版" / "Pro" / "Premium" |
| price | Int | 单位：分，0 = 免费 |
| billingCycle | String | MONTHLY / YEARLY |
| monthlyConversationLimit | Int | 每月对话次数上限 |
| monthlyReportLimit | Int | 每月报告份数上限，0 = 不可用 |
| monthlyTokenLimit | Int | 每月 token 上限 |
| features | Json | 功能开关列表 |
| modelAccess | String[] | 可用 AI 模型列表 |
| sortOrder | Int | 展示排序 |
| isActive | Boolean | 是否上架 |

**UserSubscription（用户订阅状态）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String @id | |
| userId | String → User | |
| planId | String → SubscriptionPlan | |
| status | String | ACTIVE / EXPIRED / CANCELLED |
| startedAt | DateTime | |
| expiresAt | DateTime? | |
| monthlyConversationsUsed | Int | 本月已用对话次数 |
| monthlyReportsUsed | Int | 本月已用报告份数 |
| monthlyTokensUsed | Int | 本月已用 token 数 |
| monthlyResetAt | DateTime | 下次月度重置时间 |
| source | String | SYSTEM / ADMIN / PAYMENT |

每用户一条 ACTIVE 记录。

### AI 用量追踪层

**AiUsageLog（请求级日志）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String @id | |
| userId | String → User | |
| conversationId | String → Conversation | |
| model | String | 使用的模型名称 |
| inputTokens | Int | |
| outputTokens | Int | |
| cacheReadTokens | Int? | |
| cacheWriteTokens | Int? | |
| estimatedCostUsd | Float | 估算费用（美元） |
| requestType | String | CHAT / TOOL_CALL / SNAPSHOT |
| durationMs | Int? | 请求耗时 |
| createdAt | DateTime | |

每次 API 请求一条记录。

**AiConversationUsage（对话级汇总）**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String @id | |
| conversationId | String @unique → Conversation | |
| userId | String → User | |
| totalInputTokens | Int | |
| totalOutputTokens | Int | |
| totalCostUsd | Float | |
| requestCount | Int | |
| primaryModel | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

对话结束或更新时聚合写入。

### 关系

- User 1:1 UserSubscription（ACTIVE）
- UserSubscription N:1 SubscriptionPlan
- User 1:N AiUsageLog
- Conversation 1:N AiUsageLog
- Conversation 1:1 AiConversationUsage

## 后端 API

### 用量记录服务（AiUsageService）

- `logRequest(userId, conversationId, apiResponse)` — 从 Anthropic API 响应提取 token 用量，写入 `AiUsageLog`，原子递增 `UserSubscription` 计数器
- `syncConversationUsage(conversationId)` — 聚合对话下所有 `AiUsageLog`，upsert 到 `AiConversationUsage`
- 费用估算使用硬编码的模型价格表，后续可改为配置

### 额度检查中间件

在 AI 对话和报告生成入口前拦截：
- 查询用户 `UserSubscription`，检查对应额度是否超限
- 惰性重置：每次请求比对 `monthlyResetAt`，过期则归零计数器并推进重置时间
- 超限返回 `403` + 升级提示信息
- 额度扣减使用 Prisma `increment` 原子操作，避免并发超发

### API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/subscription/current` | GET | 当前套餐 + 剩余额度 |
| `/api/subscription/plans` | GET | 所有可用套餐列表 |
| `/api/subscription/upgrade` | POST | 升级套餐（本阶段不涉及支付） |
| `/api/admin/usage/summary` | GET | 按用户/日期的成本汇总 |
| `/api/admin/usage/details` | GET | 请求级明细查询 |
| `/api/admin/subscriptions` | GET | 用户套餐分布 |

### 套餐初始化

通过数据库 seed 预置三档 `SubscriptionPlan` 记录。新用户注册流程中自动创建 `UserSubscription` 关联到 FREE 套餐。

## 前端设计

### 页面入口

`/settings/subscription`，作为个人中心的子页面。

### 套餐信息卡片

- 顶部：当前套餐名称、状态、有效期（渐变色卡片）
- 中部：三栏进度条 — 本月对话（X / N 次）、本月报告（X / N 份）、本月 Token（XK / NK）
- 底部：升级按钮（已是最高档则不显示）

### 套餐对比

升级时展示三列对比卡片，每列包含价格、功能列表、操作按钮。Pro 标记「推荐」徽章。

## 额度超限处理

### 对话额度用尽

- 对话入口禁用
- 内联提示「本月对话次数已用完，下月自动重置，或升级套餐获得更多次数」+ 升级按钮
- 免费版用户额外提示 Pro 核心卖点

### 报告额度用尽

- 报告按钮置灰
- 提示「本月报告份数已用完」+ 升级入口
- 免费版点击报告功能提示「升级到 Pro 解锁分析报告」

### 月度重置

- 请求时惰性重置，不依赖 cron job
- 比对 `monthlyResetAt`，过期则归零 `monthlyConversationsUsed`、`monthlyReportsUsed`、`monthlyTokensUsed`，推进到下月同日

## 不在本期范围

- 真实支付对接（微信支付/支付宝/Stripe）
- 运营管理后台 UI
- 年付套餐
- 退款逻辑
- 发票生成
