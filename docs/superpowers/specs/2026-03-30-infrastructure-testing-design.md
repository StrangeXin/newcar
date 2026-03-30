# 基础设施测试设计 Spec

> 子项目 5/5：基础设施测试。删除镜像测试，补充 auth middleware、notification service、OTP service 单元测试。

## 目标

清理基础设施层 5 个镜像测试文件（api.test.ts、auth.test.ts、session.test.ts、logger.test.ts、pipeline.test.ts），保留已有高质量测试不动（device、push、i18n、validate、rate-limit、car、cors），补充 3 个缺失的关键单元测试。

## 现有测试盘点

### 保留不动

| 文件 | 测试数 | 说明 |
|------|--------|------|
| device.test.ts | 2 | DeviceController mock Prisma 测试 |
| push.test.ts | 4 | PushService 完整 mock 测试（推送、限流、幂等、设备过滤） |
| i18n.test.ts | 3 | i18n 模块真实函数测试 |
| validate.test.ts | 5 | validateBody middleware 测试 |
| rate-limit.test.ts | 5 | createRateLimit middleware + Redis mock 测试 |
| car.test.ts | 4 | toYuanFromWan + buildCarSearchWhere 测试 |
| cors.test.ts | 5 | createApp + CORS 真实 supertest 测试 |
| auth.integration.test.ts | 4 | 真实 DB + JWT 集成测试 |

### 删除的镜像测试

| 文件 | 测试数 | 原因 |
|------|--------|------|
| api.test.ts | 2 | 硬编码 health check 格式 + UUID regex |
| auth.test.ts | 3 | 硬编码 OTP regex + WeChat code regex + JWT 静态结构 |
| session.test.ts | 2 | 硬编码 UUID 生成 + session 结构断言 |
| logger.test.ts | 2 | 检查 logger 导出函数是否存在（无逻辑） |
| pipeline.test.ts | 5 | 纯数学/数组操作（流程数组相等、日期比较、通知计数、评分归一化、事件过滤） |

## 测试范围

### 新增单元测试

#### 1. `tests/auth.middleware.test.ts`（新建，替换 auth.test.ts）

Mock: `vi.mock('../src/services/auth.service')`，使用 Express mock req/res/next。

源文件：`src/middleware/auth.ts`（51 行），导出 `authMiddleware` 和 `optionalAuth`。

| 测试组 | 测试用例 | 期望 |
|--------|---------|------|
| authMiddleware | 无 Authorization header | 401 Unauthorized |
| authMiddleware | Authorization 不以 Bearer 开头 | 401 Unauthorized |
| authMiddleware | token type 不是 access | 401 Invalid token type |
| authMiddleware | token 验证失败（verifyToken 抛错） | 401 Invalid token |
| authMiddleware | 合法 access token | 设置 req.userId/sessionId/userRole，调用 next() |
| optionalAuth | 无 Authorization header | 不设置 userId，调用 next() |
| optionalAuth | 合法 token | 设置 req.userId/sessionId/userRole，调用 next() |
| optionalAuth | 非法 token（verifyToken 抛错） | 不设置 userId，静默调用 next() |

#### 2. `tests/notification.service.test.ts`（新建）

Mock: `vi.mock('../src/lib/prisma')` + `vi.mock('../src/lib/i18n')`

源文件：`src/services/notification.service.ts`（109 行），导出 `notificationService`。

| 测试组 | 测试用例 | 期望 |
|--------|---------|------|
| createNotification | 正常创建通知 | prisma.notificationFeed.create 被调用 |
| createNotification | 当日已达 3 条限流 | 返回 null，不调用 create |
| createNotificationsFromSignals | 多个 signal 转 notification | 遍历 signal 数组，每个调用 createNotification |
| createNotificationsFromSignals | signal.carId='all' 时 relatedCarId 为 undefined | createNotification 参数中无 relatedCarId |
| buildNotificationTitle | PRICE_DROP 类型 | 返回 t(locale, 'notification.title.PRICE_DROP') |
| buildNotificationTitle | 未知类型 | 返回 t(locale, 'notification.title.dynamic') |
| getUserNotifications | 返回用户通知列表 | prisma.notificationFeed.findMany 被调用，take=20 |
| markAsRead | 标记已读 | prisma.notificationFeed.updateMany 被调用 |

#### 3. `tests/otp.service.test.ts`（新建）

Mock: `vi.mock('ioredis')`

源文件：`src/services/otp.service.ts`（34 行），导出 `otpService`。

| 测试组 | 测试用例 | 期望 |
|--------|---------|------|
| generateOtp | 生成 6 位数字并存入 Redis | redis.setex 被调用，key=`otp:${phone}`，ttl=300，值为 6 位数字 |
| verifyOtp | 验证成功后删除 key | redis.get 返回匹配 OTP → 返回 true + redis.del 被调用 |
| verifyOtp | OTP 不匹配 | redis.get 返回不匹配值 → 返回 false，不调用 del |
| verifyOtp | Redis 中无 OTP（过期） | redis.get 返回 null → 返回 false |

## 删除的文件

- `tests/api.test.ts` — 纯硬编码断言
- `tests/auth.test.ts` — 被 `auth.middleware.test.ts` 替代
- `tests/session.test.ts` — 纯硬编码断言
- `tests/logger.test.ts` — 仅检查导出存在性
- `tests/pipeline.test.ts` — 纯数学/数组操作

## 技术约束

- 单元测试用 `vi.mock()` mock 依赖，遵循现有 push.test.ts / rate-limit.test.ts 模式
- auth middleware 测试使用 Express mock req/res/next（参考 quota.middleware.test.ts 模式）
- notification service 的 `buildNotificationTitle` 是 private 方法，通过 `createNotificationsFromSignals` 间接测试
- otp service 需要 mock ioredis Constructor，确保 mock 实例被测试使用

## 预估

| 文件 | 类型 | 变更 | 测试数 |
|------|------|------|--------|
| api.test.ts | — | 删除 | 0（-2） |
| auth.test.ts | — | 删除 | 0（-3） |
| session.test.ts | — | 删除 | 0（-2） |
| logger.test.ts | — | 删除 | 0（-2） |
| pipeline.test.ts | — | 删除 | 0（-5） |
| auth.middleware.test.ts | Unit | 新建 | 8 |
| notification.service.test.ts | Unit | 新建 | 8 |
| otp.service.test.ts | Unit | 新建 | 4 |
| **净变动** | | | **-14 镜像 +20 真实 = +6 总数，质量大幅提升** |
