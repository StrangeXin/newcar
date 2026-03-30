# 基础设施测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 5 个基础设施镜像测试文件，新增 auth middleware、notification service、OTP service 共 20 个真实单元测试。

**Architecture:** 删除 api.test.ts / auth.test.ts / session.test.ts / logger.test.ts / pipeline.test.ts（14 个镜像测试），新增 3 个测试文件使用 vi.mock 隔离依赖。auth.middleware.test.ts 用 Express mock req/res/next 测试中间件分支，notification.service.test.ts 用 mock Prisma 测试限流和 signal 转换，otp.service.test.ts 用 mock Redis 测试 OTP 生命周期。

**Tech Stack:** Vitest, vi.mock, Express mock req/res/next

---

### Task 1: 删除 5 个镜像测试文件

**Files:**
- Delete: `apps/api/tests/api.test.ts`
- Delete: `apps/api/tests/auth.test.ts`
- Delete: `apps/api/tests/session.test.ts`
- Delete: `apps/api/tests/logger.test.ts`
- Delete: `apps/api/tests/pipeline.test.ts`

- [ ] **Step 1: 删除文件**

```bash
rm apps/api/tests/api.test.ts
rm apps/api/tests/auth.test.ts
rm apps/api/tests/session.test.ts
rm apps/api/tests/logger.test.ts
rm apps/api/tests/pipeline.test.ts
```

- [ ] **Step 2: 运行单元测试确认无破坏**

Run: `cd apps/api && npx vitest run --reporter=verbose 2>&1 | tail -10`
Expected: 全部通过，测试总数减少 14（从 308 降到 294）

- [ ] **Step 3: Commit**

```bash
git add -A apps/api/tests/api.test.ts apps/api/tests/auth.test.ts apps/api/tests/session.test.ts apps/api/tests/logger.test.ts apps/api/tests/pipeline.test.ts
git commit -m "test: remove 5 infrastructure mirror test files (14 tests)"
```

---

### Task 2: 新增 auth.middleware.test.ts

**Files:**
- Create: `apps/api/tests/auth.middleware.test.ts`
- Reference: `apps/api/src/middleware/auth.ts`

auth middleware 导出 `authMiddleware` 和 `optionalAuth`。`authMiddleware` 从 Bearer token 解析 userId/sessionId/userRole，调用 `authService.verifyToken`。`optionalAuth` 静默处理无效 token。

Mock 模式参考 `tests/quota.middleware.test.ts`：mock service → import middleware → 用 mockReqResNext helper 测试。

- [ ] **Step 1: 编写测试文件**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/auth.service', () => ({
  authService: {
    verifyToken: vi.fn(),
  },
}));

import { authService } from '../src/services/auth.service';
import { authMiddleware, optionalAuth } from '../src/middleware/auth';

const mockedAuthService = authService as any;

function mockReqResNext(headers: Record<string, string> = {}) {
  const req = { headers, userId: undefined, sessionId: undefined, userRole: undefined } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authMiddleware', () => {
  it('should return 401 when no Authorization header', () => {
    const { req, res, next } = mockReqResNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization does not start with Bearer', () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Basic abc123' });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token type is not access', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', type: 'refresh',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when verifyToken throws', () => {
    mockedAuthService.verifyToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer bad-token' });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set userId/sessionId/userRole and call next() for valid access token', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', role: 'MEMBER', type: 'access',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });

    authMiddleware(req, res, next);

    expect(req.userId).toBe('u1');
    expect(req.sessionId).toBe('s1');
    expect(req.userRole).toBe('MEMBER');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('should call next() without setting userId when no header', () => {
    const { req, res, next } = mockReqResNext();

    optionalAuth(req, res, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('should set userId and call next() for valid token', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', role: 'ADMIN',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });

    optionalAuth(req, res, next);

    expect(req.userId).toBe('u1');
    expect(req.userRole).toBe('ADMIN');
    expect(next).toHaveBeenCalled();
  });

  it('should silently call next() when verifyToken throws', () => {
    mockedAuthService.verifyToken.mockImplementation(() => {
      throw new Error('expired');
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer expired-token' });

    optionalAuth(req, res, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/auth.middleware.test.ts --reporter=verbose 2>&1 | tail -15`
Expected: 8 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/auth.middleware.test.ts
git commit -m "test: add auth middleware unit tests (8 cases)"
```

---

### Task 3: 新增 notification.service.test.ts

**Files:**
- Create: `apps/api/tests/notification.service.test.ts`
- Reference: `apps/api/src/services/notification.service.ts`

NotificationService 有 5 个方法：createNotification（含每日限流）、createNotificationsFromSignals（遍历 signal 数组）、buildNotificationTitle（private，通过间接测试）、getUserNotifications、markAsRead。

Mock Prisma 的 `notificationFeed` 和 i18n 的 `t` 函数。

- [ ] **Step 1: 编写测试文件**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttentionSignalType } from '@newcar/shared';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    notificationFeed: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/i18n', () => ({
  DEFAULT_LOCALE: 'zh-CN',
  t: vi.fn((_locale: string, key: string) => `[${key}]`),
}));

import { prisma } from '../src/lib/prisma';
import { notificationService } from '../src/services/notification.service';

const mockedPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationService', () => {
  describe('createNotification', () => {
    it('should create notification when under daily limit', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(2);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const result = await notificationService.createNotification({
        userId: 'u1',
        journeyId: 'j1',
        type: AttentionSignalType.PRICE_DROP,
        title: '价格变动',
      });

      expect(result).toEqual({ id: 'n1' });
      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          journeyId: 'j1',
          type: AttentionSignalType.PRICE_DROP,
          title: '价格变动',
        }),
      });
    });

    it('should return null when daily limit (3) is reached', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(3);

      const result = await notificationService.createNotification({
        userId: 'u1',
        journeyId: 'j1',
        type: AttentionSignalType.PRICE_DROP,
        title: '价格变动',
      });

      expect(result).toBeNull();
      expect(mockedPrisma.notificationFeed.create).not.toHaveBeenCalled();
    });
  });

  describe('createNotificationsFromSignals', () => {
    it('should create notification for each signal', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create
        .mockResolvedValueOnce({ id: 'n1' })
        .mockResolvedValueOnce({ id: 'n2' });

      const signals = [
        {
          signalType: AttentionSignalType.PRICE_DROP,
          carId: 'car-1',
          description: '降价 5000',
          delta: -5000,
        },
        {
          signalType: AttentionSignalType.NEW_VARIANT,
          carId: 'car-2',
          description: '新版本',
        },
      ] as any[];

      const result = await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(result).toHaveLength(2);
      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledTimes(2);
    });

    it('should set relatedCarId to undefined when carId is "all"', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const signals = [
        {
          signalType: AttentionSignalType.POLICY_UPDATE,
          carId: 'all',
          description: '政策更新',
        },
      ] as any[];

      await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          relatedCarId: undefined,
        }),
      });
    });

    it('should use i18n t() for notification title based on signal type', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const signals = [
        {
          signalType: AttentionSignalType.PRICE_DROP,
          carId: 'car-1',
          description: 'desc',
        },
      ] as any[];

      await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '[notification.title.PRICE_DROP]',
        }),
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should query notifications with limit', async () => {
      mockedPrisma.notificationFeed.findMany.mockResolvedValue([]);

      await notificationService.getUserNotifications('u1', 10);

      expect(mockedPrisma.notificationFeed.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('markAsRead', () => {
    it('should update notification isRead to true', async () => {
      mockedPrisma.notificationFeed.updateMany.mockResolvedValue({ count: 1 });

      await notificationService.markAsRead('n1', 'u1');

      expect(mockedPrisma.notificationFeed.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
        data: { isRead: true },
      });
    });
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/notification.service.test.ts --reporter=verbose 2>&1 | tail -15`
Expected: 8 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/notification.service.test.ts
git commit -m "test: add notification service unit tests (8 cases)"
```

---

### Task 4: 新增 otp.service.test.ts

**Files:**
- Create: `apps/api/tests/otp.service.test.ts`
- Reference: `apps/api/src/services/otp.service.ts`

OtpService 在 constructor 中 new Redis，需要 mock ioredis 让 mock 实例注入到 service 中。generateOtp 生成 6 位随机数存入 Redis（TTL 300s），verifyOtp 验证并删除。

- [ ] **Step 1: 编写测试文件**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
}));

import { OtpService } from '../src/services/otp.service';

let otpService: OtpService;

beforeEach(() => {
  vi.clearAllMocks();
  otpService = new OtpService();
});

describe('OtpService', () => {
  describe('generateOtp', () => {
    it('should generate 6-digit OTP and store in Redis with TTL 300', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const otp = await otpService.generateOtp('13800138000');

      expect(otp).toMatch(/^\d{6}$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'otp:13800138000',
        300,
        otp,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should return true and delete key when OTP matches', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.del.mockResolvedValue(1);

      const result = await otpService.verifyOtp('13800138000', '123456');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('otp:13800138000');
    });

    it('should return false and not delete when OTP does not match', async () => {
      mockRedis.get.mockResolvedValue('123456');

      const result = await otpService.verifyOtp('13800138000', '999999');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false when OTP expired (null from Redis)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await otpService.verifyOtp('13800138000', '123456');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/otp.service.test.ts --reporter=verbose 2>&1 | tail -15`
Expected: 4 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/otp.service.test.ts
git commit -m "test: add OTP service unit tests (4 cases)"
```

---

### Task 5: 全量验证

- [ ] **Step 1: 运行所有单元测试**

Run: `cd apps/api && npx vitest run --reporter=verbose 2>&1 | tail -15`
Expected: 全部通过，总数约 314（294 - 14 删除 + 20 新增 = 300... 实际以运行结果为准）

- [ ] **Step 2: 确认测试计数**

预期结果：
- 删除：14 个镜像测试（2+3+2+2+5）
- 新增：20 个真实测试（8+8+4）
- 净变动：+6 总数，质量大幅提升

- [ ] **Step 3: 最终 Commit（仅当需要修复时）**

如果全量验证发现问题，修复后提交。
