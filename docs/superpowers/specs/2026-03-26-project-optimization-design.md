# NewCar 项目优化设计

> 状态：Draft
> 日期：2026-03-26
> 背景：Plan 11 数据管道完成后的全面项目优化，覆盖安全、基建、架构、性能四个维度

## 概述

项目处于纯开发阶段，尚未上线。当前已完成 spec 100% 合规、设计系统对齐、274 单元测试 + 11 e2e 测试。本次优化分 4 个 Phase 执行，每个 Phase 独立可交付。

## Phase 1: 安全 + 健壮性基础

### 1.1 CORS 限制

**现状**：`app.ts` 中 `app.use(cors())` 无任何限制，任何域名都能调用 API。

**方案**：

```ts
// app.ts
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
```

**改动文件**：
- `apps/api/src/app.ts` — 加 origin 配置
- `apps/api/.env` — 加 `CORS_ORIGIN=http://localhost:3000,http://localhost:3101`
- `apps/api/.env.example` — 同步更新

### 1.2 WebSocket 认证改为首条消息

**现状**：`index.ts` 从 URL query param 取 token（`url.searchParams.get('token')`），token 暴露在服务器日志和浏览器历史中。

**方案**：

1. 连接时不验证身份，先建立 WebSocket 连接
2. 客户端连接后发送 auth 消息：`{ type: 'auth', token: '...' }`
3. 服务端收到 auth 消息后验证 JWT，绑定 userId 到连接
4. 超时 5 秒未收到 auth 消息则服务端主动断开（code 4001）
5. auth 验证失败发送 `{ type: 'auth_error', message: '...' }` 后断开

**改动文件**：
- `apps/api/src/index.ts` — WebSocket upgrade 逻辑移除 token 校验
- `apps/api/src/controllers/chat-ws.controller.ts` — 加 auth 状态机（PENDING → AUTHENTICATED）
- `apps/web/src/store/chat.store.ts` — 连接后首先发送 auth 消息，移除 URL token 拼接

**协议变更**：

```
# 旧协议
ws://host/ws?token=xxx&journeyId=yyy

# 新协议
ws://host/ws?journeyId=yyy
→ 连接成功后客户端发送: { type: 'auth', token: 'xxx' }
← 服务端返回: { type: 'auth_ok', userId: '...' } 或 { type: 'auth_error', message: '...' }
```

### 1.3 前端 Error Boundary

**现状**：无任何 `error.tsx`，组件崩溃导致整页白屏。

**方案**：创建 Next.js App Router 的错误处理文件。

| 文件 | 作用 |
|------|------|
| `apps/web/src/app/error.tsx` | 全局页面级错误捕获 |
| `apps/web/src/app/global-error.tsx` | root layout 级别错误（含 html/body） |
| `apps/web/src/app/journey/error.tsx` | journey 页面专属错误 |
| `apps/web/src/app/community/error.tsx` | community 页面专属错误 |

每个 error boundary 组件包含：
- 友好的错误提示文案
- 重试按钮（调用 `reset()`）
- 可选的错误详情展开（开发模式）
- 样式使用 CSS 变量，保持设计系统一致

### 1.4 API 请求校验（Zod）

**现状**：API 路由无输入验证，直接从 `req.body` / `req.query` 取值。

**方案**：

1. `zod` 已安装（^3.23.0），无需额外安装
2. 创建 `apps/api/src/lib/validate.ts`：

```ts
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
```

3. 为核心路由定义 schema：

| 路由 | Schema |
|------|--------|
| `POST /auth/phone/send-otp` | `{ phone: z.string().regex(/^1[3-9]\d{9}$/) }` |
| `POST /auth/phone/login` | `{ phone: z.string(), otp: z.string().length(6) }` |
| `POST /journeys` | `{ title: z.string().min(1).max(100) }` |
| `POST /journeys/:id/publish` | `{ title: z.string(), publishedFormats: z.array(z.enum(['story','report','template'])).min(1), visibility: z.enum(['PUBLIC','UNLISTED']) }` |
| `PATCH /journeys/:id/stage` | `{ targetStage: z.enum(['AWARENESS','CONSIDERATION','COMPARISON','DECISION','PURCHASE']) }` |

### 1.5 清理剩余 `any` 类型

**现状**：约 30 处 `any` / `as any` 散布在 controllers、services 中。

**分组处理**：

| 分类 | 文件 | 修复方式 |
|------|------|----------|
| catch error | 多个 controller 和 route 文件 | `catch (error: unknown)` + `error instanceof Error ? error.message : String(error)` |
| conversation signals | `conversation.service.ts` | 定义 `ExtractedSignal` interface |
| weaviate 类型 | `weaviate.service.ts` | 用 weaviate-client 导出的类型或自定义 interface |
| journey metadata | `journey.service.ts` | `Prisma.InputJsonValue` |
| timeline prisma | `timeline.service.ts` | 检查 Prisma schema 是否已生成 `timelineEvent`，若已生成则移除 `as any` |
| ws controller | `chat-ws.controller.ts` | 定义 `WsMessage` 类型 |
| published-journey | `published-journey.controller.ts` | 定义 `UpdatePublishedData` interface |

---

## Phase 2: 工程基建

### 2.1 CI/CD 完善

**现状**：`ci.yml` 仅 25 行，只跑 API vitest，不检查前端类型、不跑 e2e。

**方案**：扩展为 4 个并行 job。

```yaml
name: CI
on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd apps/api && npx tsc --noEmit
      - run: cd apps/web && npx tsc --noEmit

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd apps/api && npx vitest run

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: newcar
          POSTGRES_USER: newcar
          POSTGRES_PASSWORD: newcar_dev
        ports: ['5433:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install chromium
      - run: cd apps/api && npx prisma db push
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: test-results/

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd apps/web && npx next build
```

### 2.2 结构化日志（Pino）

**现状**：全部使用 `console.log`，约 20 处。

**方案**：

1. 安装 `pino` + `pino-pretty`（dev）+ `pino-http`
2. 创建 `src/lib/logger.ts`：

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

3. Express 请求日志：`app.use(pinoHttp({ logger }))`
4. 替换所有 `console.log/warn/error` → `logger.info/warn/error`
5. 关键位置加结构化上下文：`logger.info({ journeyId, userId }, 'Journey created')`

### 2.3 差异化限流

**现状**：全局 100 req/min/IP，AI 聊天等昂贵操作无额外保护。

**方案**：

创建 `src/lib/rate-limit.ts` 工厂函数：

```ts
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) { ... }
```

按路由挂载：

| 端点类型 | 限制 | key |
|----------|------|-----|
| `POST /chat` (WS messages) | 10 msg/min | userId |
| `POST /publish` | 5 req/min | userId |
| `POST /auth/*` | 10 req/min | IP |
| 默认 | 100 req/min | IP |

WebSocket 限流在 `chat-ws.controller.ts` 中实现消息计数器。

### 2.4 Mock 数据生产包排除

**现状**：`mock-data.ts`（496 行）无条件打入生产 bundle。

**方案**：

```ts
// chat.store.ts 改为动态 import
if (MOCK_MODE) {
  const { mockMessages } = await import('@/lib/mock-data');
  // use mockMessages
}
```

Next.js 会在 `MOCK_MODE === false` 时自动 tree-shake 掉动态 import。

---

## Phase 3: 架构优化

### 3.1 大文件拆分

4 个 600+ 行文件按职责拆分：

#### `journey-deep-agent.service.ts` (691 行) → 3 个模块

| 新文件 | 职责 |
|--------|------|
| `agent-context.ts` | 构建 journey 上下文、候选车列表、需求摘要 |
| `agent-stream.ts` | 流式响应处理、chunk 解析、事件发射 |
| `agent.service.ts` | 编排入口，组合 context + stream + tools |

#### `ai-chat.service.ts` (682 行) → 3 个模块

| 新文件 | 职责 |
|--------|------|
| `signal-extraction.ts` | buildSignals、estimateConfidenceScore |
| `chat-side-effects.ts` | createTimelineEventForSideEffect、副作用分发 |
| `chat.service.ts` | chat/streamChat/runChat 主流程 |

#### `publish.service.ts` (634 行) → 2 个模块

| 新文件 | 职责 |
|--------|------|
| `content-generator.ts` | generateStory/Report/Template/Summary + withSingleRetry + parseJsonBlock |
| `publish.service.ts` | publishJourney/regenerate/preview 业务流程 |

#### `chat.store.ts` (628 行) → 3 个模块

| 新文件 | 职责 |
|--------|------|
| `ws-connection.ts` | WebSocket 连接管理、重连、auth |
| `message-store.ts` | 消息列表状态、追加、清空 |
| `chat.store.ts` | 组合入口，暴露统一 API |

**约束**：拆分后公共 API 不变，现有测试和调用方无需修改。

### 3.2 前端 Store 测试

拆分后为 `chat.store` 各模块加测试：

- `ws-connection.ts` — 连接/断连/重连/auth 流程
- `message-store.ts` — 消息追加/状态更新
- Side effect 分发和 timeline 事件处理

使用 `vitest` + 模拟 WebSocket。需要在 `apps/web` 配置 vitest。

### 3.3 WebSocket 类型安全

定义共享类型（放在 `packages/shared/src/types/ws-messages.ts`）：

```ts
// 客户端 → 服务端
type WsClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'chat'; message: string; journeyId: string }
  | { type: 'ping' };

// 服务端 → 客户端
type WsServerMessage =
  | { type: 'auth_ok'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'chat_chunk'; content: string }
  | { type: 'chat_done'; messageId: string }
  | { type: 'side_effect'; event: string; data: unknown; timelineEvent?: unknown; patch?: unknown }
  | { type: 'error'; message: string }
  | { type: 'pong' };
```

前后端共用，消除 WS 层所有 `any`。

---

## Phase 4: 性能优化

### 4.1 next/image 替换

**现状**：0 处使用 `next/image`。

**方案**：

1. 扫描所有 `<img>` 标签，替换为 `<Image>`
2. `next.config.mjs` 配置 `images.remotePatterns`（头像、车型图 CDN）
3. 设置合理的 `sizes` 和 `priority` 属性
4. 静态图片用 `import` 方式引入

### 4.2 React Memoization

在列表渲染的子组件上加 `React.memo`：

| 组件 | 优化 |
|------|------|
| `CandidateCard` | `React.memo` 包裹，按 candidate.id 做浅比较 |
| `TimelineEventCard`（TimelinePanel 内） | `React.memo` |
| `JourneyFeedCard` | `React.memo` |
| `ComparisonMatrix` 行 | 维度数据用 `useMemo` 缓存 |

### 4.3 Prisma 查询优化

| 问题 | 修复 |
|------|------|
| `role.middleware.ts` 每次查库验 role | JWT payload 携带 role 字段，middleware 直接读 token |
| `community.service.ts` findMany 无分页 | 加 cursor pagination |
| 部分查询 over-fetch | 按需 `select` 替代全量 `include` |

### 4.4 Bundle 分析

1. 安装 `@next/bundle-analyzer`
2. 配置 `next.config.mjs`：

```ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

3. `package.json` 加 `"analyze": "ANALYZE=true next build"`
4. 识别大依赖（lucide-react 全量导入？zustand？）并优化

---

## 执行约束

- 每个 Phase 独立可交付，完成后提交
- Phase 内按编号顺序执行，Phase 间无依赖
- 拆分大文件时保持公共 API 不变
- 所有改动必须通过现有 274 单元测试 + 11 e2e 测试
- 新增功能（Zod、pino、error boundary）需配套测试
