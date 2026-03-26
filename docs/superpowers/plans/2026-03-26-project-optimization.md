# Project Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面优化 NewCar 项目的安全、工程基建、架构和性能，分 4 个 Phase 独立交付。

**Architecture:** Phase 1 加固安全边界（CORS、WS auth、输入校验、Error Boundary、类型清理）；Phase 2 完善工程基建（CI/CD、结构化日志、差异化限流、Mock 排除）；Phase 3 拆分大文件并加共享 WS 类型；Phase 4 优化性能（React memo、Prisma 查询、Bundle 分析脚本）。

**Tech Stack:** Express, WebSocket (ws), Zod, Pino, Next.js 15, React 19, Zustand, Prisma, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-26-project-optimization-design.md`

**Spec 修正（基于代码探索）：**
- `<img>` 标签：0 处 → Phase 4.1 (next/image 替换) **跳过**
- `@next/bundle-analyzer` 已配置在 `next.config.mjs` → Phase 4.4 只需加 npm script
- `console.log`：实际 ~10 处（非 20）
- `any`：实际 42 处（非 30）
- middleware 路径是 `middleware/` 不是 `middlewares/`

---

## Phase 1: 安全 + 健壮性基础

### Task 1: CORS 限制

**Files:**
- Modify: `apps/api/src/app.ts:20`
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/app.test-cors.test.ts` (或在现有 `api.test.ts` 中追加)

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/cors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CORS configuration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('should reject requests from unauthorized origins', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:3000');
    // re-import to pick up env
    const { createApp } = await import('../src/app');
    const app = createApp();
    const supertest = (await import('supertest')).default;
    const res = await supertest(app)
      .get('/health')
      .set('Origin', 'http://evil.com');
    // CORS should not include Access-Control-Allow-Origin for evil.com
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.com');
  });

  it('should allow requests from configured origins', async () => {
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3101');
    const { createApp } = await import('../src/app');
    const app = createApp();
    const supertest = (await import('supertest')).default;
    const res = await supertest(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/cors.test.ts`
Expected: FAIL — current `cors()` allows all origins

- [ ] **Step 3: Implement CORS restriction**

```ts
// apps/api/src/app.ts — replace line 20
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
```

Update `apps/api/.env.example` — add:
```
CORS_ORIGIN=http://localhost:3000,http://localhost:3101
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/cors.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to ensure no regression**

Run: `cd apps/api && npx vitest run`
Expected: All 274 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/.env.example apps/api/tests/cors.test.ts
git commit -m "feat(security): restrict CORS to configured origins"
```

---

### Task 2: WebSocket 认证改为首条消息

**Files:**
- Modify: `apps/api/src/index.ts` — 移除 token 校验，仅验证路径和 journey 归属延后
- Modify: `apps/api/src/controllers/chat-ws.controller.ts` — 加 auth 状态机
- Modify: `apps/web/src/store/chat.store.ts` — 连接后发 auth 消息
- Modify: `packages/shared/src/types/index.ts` — 可选：WS 消息类型（与 Task 11 合并）

- [ ] **Step 1: Write failing test for WS auth state machine**

```ts
// apps/api/tests/chat-ws-auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatWsController } from '../src/controllers/chat-ws.controller';

function createMockWs() {
  const listeners: Record<string, Function[]> = {};
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, fn: Function) => {
      (listeners[event] ??= []).push(fn);
    }),
    _emit(event: string, ...args: unknown[]) {
      listeners[event]?.forEach(fn => fn(...args));
    },
  };
}

describe('ChatWsController auth state machine', () => {
  let controller: ChatWsController;

  beforeEach(() => {
    controller = new ChatWsController();
  });

  it('should reject messages before auth', () => {
    const ws = createMockWs();
    // handleConnection without pre-authenticated auth context
    controller.handleConnection(ws as any, {} as any, 'j1', undefined as any);

    // Send a chat message without auth
    ws._emit('message', JSON.stringify({ type: 'message', content: 'hello' }));

    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('auth_required')
    );
  });

  it('should close connection after 5s auth timeout', async () => {
    vi.useFakeTimers();
    const ws = createMockWs();
    controller.handleConnection(ws as any, {} as any, 'j1', undefined as any);

    vi.advanceTimersByTime(5001);

    expect(ws.close).toHaveBeenCalledWith(4001, expect.any(String));
    vi.useRealTimers();
  });

  it('should authenticate with valid auth message', () => {
    const ws = createMockWs();
    // Mock authService.verifyToken and journeyService
    controller.handleConnection(ws as any, {} as any, 'j1', undefined as any);

    // This test will need mocked services — expand after implementation
    ws._emit('message', JSON.stringify({ type: 'auth', token: 'valid-token' }));

    // After auth, should send auth_ok or auth_error
    expect(ws.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/chat-ws-auth.test.ts`
Expected: FAIL — current controller expects pre-authenticated `auth` param

- [ ] **Step 3: Implement auth state machine in chat-ws.controller.ts**

Modify `apps/api/src/controllers/chat-ws.controller.ts`:
- Add `pendingAuth` Set to track unauthenticated connections
- `handleConnection` 签名改为 `auth` 可选（`auth?: { userId: string; sessionId?: string }`）
- 如果 `auth` 为空，设置 5 秒超时，等待 `{ type: 'auth', token }` 消息
- 收到 auth 消息后调用 `authService.verifyToken(token)` + 验证 journey 归属
- 成功发 `{ type: 'auth_ok', userId }`,失败发 `{ type: 'auth_error', message }` 后关闭
- 非 auth 消息在未认证时返回 `{ type: 'auth_required' }`

- [ ] **Step 4: Update index.ts — remove token validation from upgrade**

```ts
// apps/api/src/index.ts — simplified upgrade handler
server.on('upgrade', async (req: any, socket: any, head: any) => {
  const pathname = new URL(req.url || '', 'http://localhost').pathname;
  const match = pathname.match(/^\/ws\/journeys\/([^/]+)\/chat$/);

  if (!match) {
    socket.destroy();
    return;
  }

  const journeyId = match[1];

  wss.handleUpgrade(req, socket, head, (ws: any) => {
    // No auth here — controller handles auth via first message
    chatWsController.handleConnection(ws, req, journeyId);
  });
});
```

- [ ] **Step 5: Update frontend chat.store.ts — send auth message after connect**

在 `apps/web/src/store/chat.store.ts` 的 `connect` 方法中：
- 移除 URL 中的 token 拼接（修改 `buildJourneyChatWsUrl` 或在 store 中处理）
- `ws.onopen` 时立即发送 `{ type: 'auth', token: getAccessToken() }`
- 监听 `auth_ok` / `auth_error` 消息，设置 `isConnected` 状态

- [ ] **Step 6: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/controllers/chat-ws.controller.ts apps/web/src/store/chat.store.ts apps/api/tests/chat-ws-auth.test.ts
git commit -m "feat(security): move WS auth from URL query to first message"
```

---

### Task 3: 前端 Error Boundary

**Files:**
- Create: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`
- Create: `apps/web/src/app/journey/error.tsx`
- Create: `apps/web/src/app/community/error.tsx`

- [ ] **Step 1: Create global error boundary**

```tsx
// apps/web/src/app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
        出了点问题
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
        {process.env.NODE_ENV === 'development' ? error.message : '请稍后再试'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: 'var(--space-2) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        重试
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create global-error.tsx (root layout level)**

```tsx
// apps/web/src/app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h2>应用出错了</h2>
        <p>{process.env.NODE_ENV === 'development' ? error.message : '请刷新页面重试'}</p>
        <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          重试
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create journey and community error boundaries**

Copy `error.tsx` to `apps/web/src/app/journey/error.tsx` and `apps/web/src/app/community/error.tsx`，调整文案：
- journey: "购车旅程加载失败"
- community: "社区加载失败"

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/error.tsx apps/web/src/app/global-error.tsx apps/web/src/app/journey/error.tsx apps/web/src/app/community/error.tsx
git commit -m "feat(web): add error boundaries for graceful error handling"
```

---

### Task 4: API 请求校验（Zod）

**Files:**
- Create: `apps/api/src/lib/validate.ts`
- Modify: `apps/api/src/routes/auth.ts` — 挂载 validateBody
- Modify: `apps/api/src/routes/journey.ts` — 挂载 validateBody
- Modify: `apps/api/src/routes/published-journeys.ts` — 挂载 validateBody
- Create: `apps/api/tests/validate.test.ts`

- [ ] **Step 1: Write failing test for validate middleware**

```ts
// apps/api/tests/validate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody } from '../src/lib/validate';

function mockReqResNext(body: unknown) {
  const req = { body } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('validateBody', () => {
  const schema = z.object({ phone: z.string().regex(/^1[3-9]\d{9}$/) });

  it('should call next() for valid body', () => {
    const { req, res, next } = mockReqResNext({ phone: '13800138000' });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ phone: '13800138000' });
  });

  it('should return 400 for invalid body', () => {
    const { req, res, next } = mockReqResNext({ phone: 'invalid' });
    validateBody(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should strip unknown fields', () => {
    const { req, res, next } = mockReqResNext({ phone: '13800138000', extra: 'hack' });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ phone: '13800138000' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/validate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validate.ts**

```ts
// apps/api/src/lib/validate.ts
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/validate.test.ts`
Expected: PASS

- [ ] **Step 5: Define schemas and mount on routes**

在各 route 文件中引入并挂载：

```ts
// apps/api/src/routes/auth.ts — add before route handlers
import { z } from 'zod';
import { validateBody } from '../lib/validate';

const sendOtpSchema = z.object({ phone: z.string().regex(/^1[3-9]\d{9}$/) });
const phoneLoginSchema = z.object({ phone: z.string(), otp: z.string().length(6) });

router.post('/phone/send-otp', validateBody(sendOtpSchema), (req, res) => authController.sendOtp(req, res));
router.post('/phone/login', validateBody(phoneLoginSchema), (req, res) => authController.phoneLogin(req, res));
```

类似地处理 `routes/journey.ts`（POST /journeys, PATCH /:id/stage）和 `routes/published-journeys.ts`（POST /:id/publish）。

- [ ] **Step 6: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/validate.ts apps/api/tests/validate.test.ts apps/api/src/routes/auth.ts apps/api/src/routes/journey.ts apps/api/src/routes/published-journeys.ts
git commit -m "feat(security): add Zod request validation for core API routes"
```

---

### Task 5: 清理 `any` 类型

**Files:**
- Modify: ~18 files with `any` annotations (42 occurrences)
- Key targets: `community.controller.ts` (8), `car.controller.ts` (7), `index.ts` (3), `chat-ws.controller.ts` (2)

- [ ] **Step 1: Fix catch blocks — `error: any` → `error: unknown`**

Pattern across all controllers/routes:
```ts
// Before
} catch (error: any) {
  return res.status(500).json({ error: error.message });
}

// After
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return res.status(500).json({ error: message });
}
```

Apply to all files with `catch (error: any)`.

- [ ] **Step 2: Fix index.ts upgrade handler types**

```ts
// Before
server.on('upgrade', async (req: any, socket: any, head: any) => {

// After
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
```

- [ ] **Step 3: Fix controller parameter types**

For controllers using `req: any` or `res: any`, replace with Express types:
```ts
import { Request, Response } from 'express';
// or for authenticated routes:
import { AuthenticatedRequest } from '../middleware/auth';
```

- [ ] **Step 4: Fix service-specific `any` types**

- `conversation.service.ts` — define `ExtractedSignal` interface
- `weaviate.service.ts` — use proper weaviate client types or define interface
- `chat-ws.controller.ts` — define `WsMessage` interface (ties into Task 11)
- `langchain-shim.ts` — use `unknown` or proper LangChain types

- [ ] **Step 5: Run type check and tests**

Run: `cd apps/api && npx tsc --noEmit && npx vitest run`
Expected: No type errors, all tests PASS

- [ ] **Step 6: Commit**

```bash
git add -u apps/api/src/
git commit -m "fix(types): replace all 'any' with proper types across API"
```

---

## Phase 2: 工程基建

### Task 6: CI/CD 完善

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Expand CI to 4 parallel jobs**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=packages/shared
      - run: npx tsc --noEmit --workspace=apps/api
      - run: cd apps/web && npx tsc --noEmit

  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=packages/shared
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
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=packages/shared
      - run: npx playwright install chromium
      - run: cd apps/api && npx prisma db push
        env:
          DATABASE_URL: postgresql://newcar:newcar_dev@localhost:5433/newcar
      - run: npx playwright test
        env:
          DATABASE_URL: postgresql://newcar:newcar_dev@localhost:5433/newcar
          REDIS_URL: redis://localhost:6379
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
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=packages/shared
      - run: cd apps/web && npx next build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): expand CI to type-check, unit-test, e2e, and build jobs"
```

---

### Task 7: 结构化日志（Pino）

**Files:**
- Create: `apps/api/src/lib/logger.ts`
- Modify: `apps/api/src/app.ts` — 添加 pino-http
- Modify: ~7 files 替换 console.log
- Create: `apps/api/tests/logger.test.ts`

- [ ] **Step 1: Install pino dependencies**

Run: `cd apps/api && npm install pino pino-http && npm install -D pino-pretty`

- [ ] **Step 2: Write failing test**

```ts
// apps/api/tests/logger.test.ts
import { describe, it, expect } from 'vitest';
import { logger } from '../src/lib/logger';

describe('logger', () => {
  it('should export a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should support child loggers with context', () => {
    const child = logger.child({ service: 'test' });
    expect(typeof child.info).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/logger.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement logger.ts**

```ts
// apps/api/src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/logger.test.ts`
Expected: PASS

- [ ] **Step 6: Add pino-http to app.ts**

```ts
// apps/api/src/app.ts — add after cors
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';

app.use(pinoHttp({ logger }));
```

- [ ] **Step 7: Replace all console.log/warn/error with logger calls**

Files to modify:
- `src/index.ts` — `console.log` → `logger.info`
- `src/lib/scheduler.ts` — `console.log/error` → `logger.info/error`
- `src/jobs/daily-snapshot.job.ts` — `console.log` → `logger.info`
- `src/controllers/chat-ws.controller.ts` — replace private `log()` method to use `logger`
- `src/services/journey-deep-agent.service.ts` — `console.log` → `logger.info`
- `src/services/ai-chat.service.ts` — `console.log` → `logger.info`
- `src/services/push.service.ts` — `console.log` → `logger.warn/error`

关键位置加结构化上下文：`logger.info({ journeyId, userId }, 'Journey created')`

- [ ] **Step 8: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lib/logger.ts apps/api/tests/logger.test.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/src/lib/scheduler.ts apps/api/src/jobs/daily-snapshot.job.ts apps/api/src/controllers/chat-ws.controller.ts apps/api/src/services/journey-deep-agent.service.ts apps/api/src/services/ai-chat.service.ts apps/api/src/services/push.service.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(infra): replace console.log with structured pino logging"
```

---

### Task 8: 差异化限流

**Files:**
- Modify: `apps/api/src/middleware/rateLimit.ts` — 重构为工厂函数
- Modify: `apps/api/src/app.ts` — 默认限流
- Modify: `apps/api/src/routes/auth.ts` — auth 限流
- Modify: `apps/api/src/routes/published-journeys.ts` — publish 限流
- Modify: `apps/api/src/controllers/chat-ws.controller.ts` — WS 消息限流
- Create: `apps/api/tests/rate-limit.test.ts`

- [ ] **Step 1: Write failing test for rate limit factory**

```ts
// apps/api/tests/rate-limit.test.ts
import { describe, it, expect, vi } from 'vitest';

// We'll test the factory function in isolation
describe('createRateLimit', () => {
  it('should create a middleware function', async () => {
    const { createRateLimit } = await import('../src/middleware/rateLimit');
    const limiter = createRateLimit({ windowMs: 60000, max: 10 });
    expect(typeof limiter).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/rate-limit.test.ts`
Expected: FAIL — `createRateLimit` not exported

- [ ] **Step 3: Refactor rateLimit.ts to factory pattern**

```ts
// apps/api/src/middleware/rateLimit.ts
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redis.url);

export function createRateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, keyGenerator } = options;

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const keyBase = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const window = Math.floor(Date.now() / windowMs);
    const key = `ratelimit:${keyBase}:${window}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (count > max) {
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
        return res.status(429).json({ error: 'Too many requests' });
      }

      return next();
    } catch {
      return next();
    }
  };
}

// Default global limiter (backwards compatible)
export const rateLimitMiddleware = createRateLimit({ windowMs: 60000, max: 100 });
```

- [ ] **Step 4: Mount per-route limiters**

```ts
// apps/api/src/routes/auth.ts — add at top
import { createRateLimit } from '../middleware/rateLimit';
const authRateLimit = createRateLimit({ windowMs: 60000, max: 10 });

router.post('/phone/send-otp', authRateLimit, validateBody(sendOtpSchema), ...);
router.post('/phone/login', authRateLimit, validateBody(phoneLoginSchema), ...);
```

```ts
// apps/api/src/routes/published-journeys.ts
const publishRateLimit = createRateLimit({ windowMs: 60000, max: 5, keyGenerator: (req) => (req as any).userId || req.ip || 'unknown' });
// mount on publish route
```

WS 消息限流在 `chat-ws.controller.ts`：
```ts
// Simple in-memory counter per userId
private msgCounts = new Map<string, { count: number; resetAt: number }>();

private checkWsRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = this.msgCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    this.msgCounts.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/rateLimit.ts apps/api/src/routes/auth.ts apps/api/src/routes/published-journeys.ts apps/api/src/controllers/chat-ws.controller.ts apps/api/tests/rate-limit.test.ts
git commit -m "feat(infra): differentiated rate limiting per endpoint type"
```

---

### Task 9: Mock 数据生产包排除

**Files:**
- Modify: `apps/web/src/store/chat.store.ts:7` — 动态 import mock-data

- [ ] **Step 1: Convert static import to dynamic import**

```ts
// apps/web/src/store/chat.store.ts
// Before (line 7):
import { mockChatMessages } from '@/lib/mock-data';

// After: remove the static import, use dynamic import where needed
// Find all usages of mockChatMessages in the file and wrap:
// Note: dynamic import requires async context — if the containing function
// is synchronous, convert it to async or use .then() pattern
if (MOCK_MODE) {
  const { mockChatMessages } = await import('@/lib/mock-data');
  // use mockChatMessages
}
```

- [ ] **Step 2: Verify build succeeds and mock-data is tree-shaken**

Run: `cd apps/web && ANALYZE=true npx next build`
Check: mock-data should not appear in production chunks when MOCK_MODE is false.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/chat.store.ts
git commit -m "perf(web): dynamic import mock-data to exclude from production bundle"
```

---

## Phase 3: 架构优化

### Task 10: 大文件拆分 — journey-deep-agent.service.ts

**Files:**
- Create: `apps/api/src/services/agent/agent-context.ts`
- Create: `apps/api/src/services/agent/agent-stream.ts`
- Create: `apps/api/src/services/agent/agent.service.ts` (主入口)
- Modify: `apps/api/src/services/journey-deep-agent.service.ts` → 变为 re-export barrel
- Test: 现有 tests 不需修改（公共 API 不变）

- [ ] **Step 1: Read full file and identify split points**

Read `apps/api/src/services/journey-deep-agent.service.ts` 完整内容，识别：
- Context 构建相关函数 → `agent-context.ts`
- 流式响应处理 → `agent-stream.ts`
- 编排入口 → `agent.service.ts`

- [ ] **Step 2: Create agent-context.ts**

提取 journey 上下文构建、候选车列表、需求摘要相关函数。

- [ ] **Step 3: Create agent-stream.ts**

提取流式响应处理、chunk 解析、事件发射相关函数。

- [ ] **Step 4: Create agent.service.ts**

编排入口，import context + stream 模块，暴露与原文件相同的公共 API。

- [ ] **Step 5: Convert original file to re-export barrel**

```ts
// apps/api/src/services/journey-deep-agent.service.ts
export { journeyDeepAgentService } from './agent/agent.service';
```

- [ ] **Step 6: Run tests to verify no regression**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS — public API unchanged

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/agent/ apps/api/src/services/journey-deep-agent.service.ts
git commit -m "refactor: split journey-deep-agent.service.ts into focused modules"
```

---

### Task 11: 大文件拆分 — ai-chat.service.ts

**Files:**
- Create: `apps/api/src/services/chat/signal-extraction.ts`
- Create: `apps/api/src/services/chat/chat-side-effects.ts`
- Create: `apps/api/src/services/chat/chat.service.ts`
- Modify: `apps/api/src/services/ai-chat.service.ts` → re-export barrel

- [ ] **Step 1: Read full file and identify split points**

Read `apps/api/src/services/ai-chat.service.ts`，识别：
- `buildSignals` / `estimateConfidenceScore` → `signal-extraction.ts`
- `createTimelineEventForSideEffect` / 副作用分发 → `chat-side-effects.ts`
- `streamChat` / `runChat` 主流程 → `chat.service.ts`

- [ ] **Step 2: Create signal-extraction.ts**
- [ ] **Step 3: Create chat-side-effects.ts**
- [ ] **Step 4: Create chat.service.ts**

- [ ] **Step 5: Convert original file to re-export barrel**

```ts
export { aiChatService } from './chat/chat.service';
```

- [ ] **Step 6: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/chat/ apps/api/src/services/ai-chat.service.ts
git commit -m "refactor: split ai-chat.service.ts into focused modules"
```

---

### Task 12: 大文件拆分 — publish.service.ts

**Files:**
- Create: `apps/api/src/services/publish/content-generator.ts`
- Create: `apps/api/src/services/publish/publish.service.ts`
- Modify: `apps/api/src/services/publish.service.ts` → re-export barrel

- [ ] **Step 1: Read full file and identify split points**

- `generateStory/Report/Template/Summary` + `withSingleRetry` + `parseJsonBlock` → `content-generator.ts`
- `publishJourney/regenerate/preview` → `publish.service.ts`

- [ ] **Step 2: Create content-generator.ts**
- [ ] **Step 3: Create publish.service.ts**

- [ ] **Step 4: Convert original file to re-export barrel**

```ts
export { publishService } from './publish/publish.service';
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/publish/ apps/api/src/services/publish.service.ts
git commit -m "refactor: split publish.service.ts into focused modules"
```

---

### Task 13: 大文件拆分 — chat.store.ts

**Files:**
- Create: `apps/web/src/store/chat/ws-connection.ts`
- Create: `apps/web/src/store/chat/message-store.ts`
- Create: `apps/web/src/store/chat/chat.store.ts`
- Modify: `apps/web/src/store/chat.store.ts` → re-export barrel

- [ ] **Step 1: Read full file and plan split**

- WebSocket 连接管理、重连、auth → `ws-connection.ts`
- 消息列表状态、追加、清空 → `message-store.ts`
- 组合入口，暴露统一 API → `chat.store.ts`

- [ ] **Step 2: Create ws-connection.ts**
- [ ] **Step 3: Create message-store.ts**
- [ ] **Step 4: Create chat.store.ts (组合入口)**

- [ ] **Step 5: Convert original file to re-export barrel**

```ts
export { useChatStore } from './chat/chat.store';
export type { ChatMessage, TextChatMessage, ToolChatMessage, SideEffectChatMessage, CarResultChatMessage } from './chat/chat.store';
```

- [ ] **Step 6: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/store/chat/ apps/web/src/store/chat.store.ts
git commit -m "refactor: split chat.store.ts into focused modules"
```

---

### Task 14: 前端 Store 测试

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/store/chat/__tests__/ws-connection.test.ts`
- Create: `apps/web/src/store/chat/__tests__/message-store.test.ts`

- [ ] **Step 1: Configure vitest for web app**

```ts
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`

Install: `cd apps/web && npm install -D vitest jsdom`

- [ ] **Step 2: Write ws-connection tests**

```ts
// apps/web/src/store/chat/__tests__/ws-connection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ws-connection', () => {
  it('should establish connection to correct URL');
  it('should send auth message on open');
  it('should handle auth_ok response');
  it('should handle auth_error and close');
  it('should reconnect on unexpected close');
});
```

- [ ] **Step 3: Write message-store tests**

```ts
// apps/web/src/store/chat/__tests__/message-store.test.ts
import { describe, it, expect } from 'vitest';

describe('message-store', () => {
  it('should append text messages');
  it('should update streaming message content');
  it('should handle tool status messages');
  it('should handle side effect messages');
  it('should clear messages');
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/src/store/chat/__tests__/
git commit -m "test(web): add vitest config and chat store unit tests"
```

---

### Task 15: WebSocket 类型安全

**Files:**
- Create: `packages/shared/src/types/ws-messages.ts`
- Modify: `packages/shared/src/types/index.ts` — re-export
- Modify: `apps/api/src/controllers/chat-ws.controller.ts` — import shared types
- Modify: `apps/web/src/store/chat.store.ts` (or split modules) — import shared types

- [ ] **Step 1: Define shared WS message types**

```ts
// packages/shared/src/types/ws-messages.ts
export type WsClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'message'; content: string }
  | { type: 'ping' };

export type WsServerMessage =
  | { type: 'auth_ok'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'auth_required' }
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string; input: unknown }
  | { type: 'tool_done'; name: string; output: unknown }
  | { type: 'side_effect'; event: string; data: unknown; timelineEvent?: unknown; patch?: unknown }
  | { type: 'done'; messageId: string }
  | { type: 'error'; code?: string; message: string }
  | { type: 'pong' };
```

- [ ] **Step 2: Export from shared package**

```ts
// packages/shared/src/types/index.ts — add
export type { WsClientMessage, WsServerMessage } from './ws-messages';
```

- [ ] **Step 3: Use in backend chat-ws.controller.ts**

Replace inline types with `WsClientMessage` / `WsServerMessage` imports.

- [ ] **Step 4: Use in frontend chat store**

Replace inline WS message shapes with shared types.

- [ ] **Step 5: Build shared package and run all tests**

Run: `npm run build --workspace=packages/shared && cd apps/api && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/ws-messages.ts packages/shared/src/types/index.ts apps/api/src/controllers/chat-ws.controller.ts apps/web/src/store/
git commit -m "feat(types): add shared WebSocket message types for type safety"
```

---

## Phase 4: 性能优化

### Task 16: React Memoization

**Files:**
- Modify: 候选车卡片组件（`CandidateCard` 或等价组件）
- Modify: Timeline 事件卡片组件
- Modify: Journey Feed 卡片组件
- Modify: ComparisonMatrix 组件

- [ ] **Step 1: Identify list-rendered components**

Search `apps/web/src/` for `.map(` patterns in JSX to find list-rendered components that would benefit from `React.memo`.

- [ ] **Step 2: Add React.memo to list item components**

```tsx
// Example pattern:
const CandidateCard = React.memo(function CandidateCard(props: CandidateCardProps) {
  // existing implementation
});
```

For `ComparisonMatrix`, wrap dimension computation in `useMemo`:
```tsx
const dimensions = useMemo(() => computeDimensions(candidates), [candidates]);
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/
git commit -m "perf(web): add React.memo to list-rendered components"
```

---

### Task 17: Prisma 查询优化

**Files:**
- Modify: `apps/api/src/middleware/role.middleware.ts` — JWT role 读取
- Modify: `apps/api/src/services/community.service.ts` — cursor pagination
- Modify: 部分 service 文件 — select 替代 include

- [ ] **Step 1: Optimize role middleware — read from JWT**

```ts
// apps/api/src/middleware/role.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Read role from JWT payload (set by auth middleware)
    // Note: extend AuthenticatedRequest to include `userRole?: string`
    const userRole = req.userRole;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}
```

注意：需要在 `auth.middleware.ts` 中将 JWT 的 `role` 字段也存到 `req.userRole`。

- [ ] **Step 2: Add cursor pagination to community.service.ts**

找到 `findMany` 无分页的查询，改为 cursor-based pagination：
```ts
async listPosts(options: { cursor?: string; limit?: number }) {
  const { cursor, limit = 20 } = options;
  return prisma.publishedJourney.findMany({
    take: limit + 1, // fetch one extra to determine hasMore
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, summary: true, createdAt: true, user: { select: { nickname: true, avatar: true } } },
  });
}
```

- [ ] **Step 3: Optimize over-fetching queries**

Review service files for full `include` that should be `select`. Focus on frequently called endpoints.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/role.middleware.ts apps/api/src/middleware/auth.ts apps/api/src/services/community.service.ts
git commit -m "perf(api): optimize Prisma queries — JWT role, cursor pagination, selective fields"
```

---

### Task 18: Bundle 分析脚本

**Files:**
- Modify: `apps/web/package.json` — add analyze script

- [ ] **Step 1: Add analyze script**

`@next/bundle-analyzer` 已安装，`next.config.mjs` 已配置。只需加 npm script：

```json
// apps/web/package.json — scripts section
"analyze": "ANALYZE=true next build"
```

- [ ] **Step 2: Run analyze to identify issues**

Run: `cd apps/web && npm run analyze`
Review output for large dependencies. Check:
- `lucide-react` 是否全量导入（应按需 import）
- 其他大依赖

- [ ] **Step 3: Fix any identified bundle issues**

Based on analysis results, apply optimizations (e.g., tree-shake lucide icons).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json
git commit -m "perf(web): add bundle analyze script and optimize imports"
```

---

## Execution Order

Phase 间无依赖，Phase 内按 Task 编号顺序执行：

| Phase | Tasks | 预估 |
|-------|-------|------|
| Phase 1: 安全 | Task 1–5 | 中等 |
| Phase 2: 基建 | Task 6–9 | 中等 |
| Phase 3: 架构 | Task 10–15 | 较大 |
| Phase 4: 性能 | Task 16–18 | 较小 |

**建议执行方式：** Phase 1 → Phase 2 → Phase 3 → Phase 4（按 spec 顺序），每个 Phase 完成后跑全量测试确认无回归。
