# Plan 7: 通知推送系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现通知推送的"发送端"——包括设备注册 API、微信服务消息推送服务、推送与快照流程集成、用户通知设置管理，确保 AI Pipeline 生成快照后能将 AttentionSignal 推送到用户微信。

**Tech Stack:** Node.js + TypeScript + existing Prisma + Redis（access_token 缓存）+ 微信服务消息 API

---

## 架构说明

### 推送全链路流程

```
快照生成（snapshot.service.ts）
    │
    ├── 写入 NotificationFeed（已有）
    │
    └── 异步触发推送（fire-and-forget）
            │
         push.service.ts
            │
            ├── 查询用户 notificationSettings（检查 push_enabled、max_per_day）
            ├── 查询 UserDevice（按 platform 分组）
            └── 按平台分发
                    ├── WECHAT_MINIAPP → wechat-push.service.ts
                    ├── WEB → 跳过（浏览器推送暂不实现）
                    └── IOS/ANDROID → 预留接口（暂不实现）
```

### 微信服务消息集成

- **access_token 获取：** POST `https://api.weixin.qq.com/cgi-bin/token`（每次有效期 7200 秒）
- **access_token 缓存：** 写入 Redis，TTL = 7000 秒（预留 200 秒 buffer 避免临界过期）
- **发送接口：** POST `https://api.weixin.qq.com/cgi-bin/message/subscribe/send`
- **前提条件：** 用户需要在小程序内授权订阅消息模板（UserDevice.pushToken 存储用户 openid）

### 消息模板映射

每种通知类型映射一个微信订阅消息模板：

| NotificationType | 模板说明 | 主要字段 |
|-----------------|---------|---------|
| PRICE_DROP | 车型价格变动提醒 | 车型名称、变动金额、当前价格 |
| NEW_REVIEW | 新评测内容提醒 | 车型名称、评测来源 |
| POLICY_UPDATE | 政策补贴更新提醒 | 政策类型、补贴金额、有效期 |
| OTA_RECALL | 系统更新/召回提醒 | 车型名称、事件描述 |

> **注：** 微信订阅消息模板 ID 需要在微信公众平台申请，配置到环境变量中（`WECHAT_TEMPLATE_IDS`）。

### 幂等性与速率限制

| 层级 | 机制 |
|------|------|
| NotificationFeed 层 | 已有每旅程每天 ≤ 3 条限制（notification.service.ts） |
| 推送层 | Redis 计数器：`push_count:{userId}:{date}`，每天重置，上限 = `User.notificationSettings.max_per_day`（默认3） |
| 去重层 | Redis SET：`pushed_notification:{notificationId}`，TTL 24小时，避免同一条通知重复推送 |

---

## 文件结构

```
apps/api/src/
├── lib/
│   └── redis.ts                        # 新建：Redis 客户端单例
├── services/
│   ├── wechat-push.service.ts          # 新建：微信服务消息推送
│   └── push.service.ts                 # 新建：推送分发服务（平台路由）
├── controllers/
│   └── device.controller.ts            # 新建：设备注册
├── routes/
│   └── devices.ts                      # 新建：设备注册路由
└── app.ts                              # 修改：挂载 devices 路由
```

**修改文件：**
- `apps/api/src/config/index.ts` — 添加 Redis URL 配置（已有）、微信模板 ID 配置
- `apps/api/src/services/snapshot.service.ts` — 集成推送触发
- `apps/api/src/routes/auth.ts` — 添加 PATCH /users/me/notification-settings

---

## Task 1: Redis 客户端 + 配置扩展

**目标：** 创建 Redis 客户端单例，扩展 config 添加微信模板 ID 配置。

**Files:**
- Create: `apps/api/src/lib/redis.ts`
- Modify: `apps/api/src/config/index.ts`

**Redis 客户端规格：**
- 使用 `ioredis` 库（检查是否已安装，否则 `npm install ioredis`）
- 连接地址来自 `config.redis.url`（已有，默认 `redis://localhost:6379`）
- 导出单例 `redis` 对象
- 封装工具方法：`incrWithTTL(key, ttlSeconds)` — 原子 incr + 设置 TTL（如 key 不存在则设置）

**Config 扩展（添加到 wechat 配置块）：**
```
wechat: {
  appId,
  appSecret,
  templateIds: {
    PRICE_DROP: env WECHAT_TEMPLATE_PRICE_DROP,
    NEW_REVIEW: env WECHAT_TEMPLATE_NEW_REVIEW,
    POLICY_UPDATE: env WECHAT_TEMPLATE_POLICY_UPDATE,
    OTA_RECALL: env WECHAT_TEMPLATE_OTA_RECALL,
  }
}
```

**步骤：**

- [ ] **Step 1:** 检查 `package.json` 是否已有 `ioredis`，若无则安装。

- [ ] **Step 2:** 创建 `apps/api/src/lib/redis.ts`，初始化 ioredis 客户端，实现 `incrWithTTL` 工具方法。

- [ ] **Step 3:** 修改 `apps/api/src/config/index.ts`，添加微信模板 ID 配置（非必填，缺失时推送功能静默跳过）。

- [ ] **Step 4:** Commit

```
git commit -m "feat: add Redis client and WeChat template config"
```

---

## Task 2: 微信推送客户端

**目标：** 封装微信服务消息 API，实现 access_token 缓存管理和消息发送。

**Files:**
- Create: `apps/api/src/services/wechat-push.service.ts`

**WechatPushService 方法：**

| 方法 | 说明 |
|------|------|
| `getAccessToken()` | 获取 access_token（优先从 Redis 取缓存） |
| `sendSubscribeMessage(openid, templateId, data, page?)` | 发送订阅消息 |
| `sendNotification(openid, notification)` | 高层接口：根据 notification.type 映射模板并发送 |
| `buildTemplateData(notification)` | 将 NotificationFeed 转换为微信模板数据格式 |

**access_token 缓存逻辑：**
1. 读取 Redis key `wechat:access_token`
2. 命中 → 直接返回
3. 未命中 → 调用微信 API 获取新 token → 写入 Redis（TTL = 7000s）→ 返回

**错误处理：**

| 错误码 | 处理方式 |
|--------|---------|
| 40001 (token 失效) | 删除 Redis 缓存，重新获取，重试一次 |
| 43004 (用户未订阅模板) | 静默忽略，记录日志 |
| 网络错误 | 抛出错误，由 push.service.ts 捕获 |
| 模板 ID 未配置 | 静默跳过，记录 warn 日志 |

**步骤：**

- [ ] **Step 1:** 创建 `wechat-push.service.ts`，实现 `getAccessToken()`（含 Redis 缓存逻辑）。

- [ ] **Step 2:** 实现 `sendSubscribeMessage()`，调用微信 API（使用 node 内置 `fetch` 或 `axios`，检查项目已有依赖）。

- [ ] **Step 3:** 实现 `buildTemplateData(notification)`，将各类型 notification 转换为微信模板数据结构。

- [ ] **Step 4:** 实现 `sendNotification(openid, notification)` 高层接口，组合上述方法。

- [ ] **Step 5:** Commit

```
git commit -m "feat: add WeChat subscribe message push service"
```

---

## Task 3: 推送分发服务

**目标：** 创建 `push.service.ts`，负责从 NotificationFeed 数据触发多平台推送，并实施幂等和速率限制。

**Files:**
- Create: `apps/api/src/services/push.service.ts`

**PushService.sendNotification(notificationId) 处理逻辑：**

1. 从 DB 读取 NotificationFeed（含 userId、type、title、body）
2. 检查 Redis 去重：`pushed_notification:{notificationId}` 是否存在 → 存在则跳过
3. 读取 `User.notificationSettings`：`push_enabled` 为 false → 跳过
4. 检查 Redis 计数器：`push_count:{userId}:{today}` ≥ `max_per_day`（默认3） → 跳过
5. 查询 `UserDevice`（userId，按 platform 分组）
6. 对每个 WECHAT_MINIAPP 设备：调用 `wechatPushService.sendNotification(pushToken, notification)`
7. 成功后：Redis SET `pushed_notification:{notificationId}`（TTL 24h）+ 计数器 +1
8. 失败：记录错误日志，不重试（避免重试风暴）

**步骤：**

- [ ] **Step 1:** 创建 `push.service.ts`，实现 `sendNotification(notificationId)` 方法，包含完整的7步逻辑。

- [ ] **Step 2:** 实现 `sendBatchNotifications(notificationIds[])` 方法，串行发送（避免并发打微信 API 限流）。

- [ ] **Step 3:** Commit

```
git commit -m "feat: add push dispatch service with idempotency"
```

---

## Task 4: 集成推送到快照流程

**目标：** 在 `snapshot.service.ts` 生成快照并写入 NotificationFeed 后，异步触发推送。

**Files:**
- Modify: `apps/api/src/services/snapshot.service.ts`

**集成位置：** 在 `generateSnapshot()` 方法中，写入 NotificationFeed 的代码之后。

**集成方式：** Fire-and-forget（异步触发，不 await，不影响快照生成的响应时间）：

```
// 伪代码说明（不含实际代码）
notifications = await notificationService.createNotificationsFromSignals(...)
// 异步推送，失败不影响主流程
notifications.forEach(n => pushService.sendNotification(n.id).catch(err => console.error(err)))
```

**步骤：**

- [ ] **Step 1:** 在 `snapshot.service.ts` 顶部导入 `pushService`。

- [ ] **Step 2:** 在 NotificationFeed 写入完成后，添加异步推送调用（fire-and-forget 模式）。

- [ ] **Step 3:** 验证：手动触发快照（`POST /snapshots/:id/snapshot`），确认日志中有推送触发记录（即使微信 API 未配置，也应看到"pushToken 为空，跳过"或"模板 ID 未配置，跳过"日志）。

- [ ] **Step 4:** Commit

```
git commit -m "feat: integrate push notification into snapshot pipeline"
```

---

## Task 5: 设备注册 API

**目标：** 提供设备注册/注销接口，让前端（小程序/App）在登录后注册 pushToken。

**Files:**
- Create: `apps/api/src/controllers/device.controller.ts`
- Create: `apps/api/src/routes/devices.ts`
- Modify: `apps/api/src/app.ts`

**API 接口：**

| Method | Path | 认证 | 描述 |
|--------|------|------|------|
| POST | `/devices` | 需要 | 注册/更新设备 pushToken |
| DELETE | `/devices/:deviceId` | 需要 | 注销设备（退出登录时调用） |
| GET | `/devices` | 需要 | 获取当前用户的设备列表 |

**POST /devices Request Body：**
```json
{
  "platform": "WECHAT_MINIAPP | WEB | IOS | ANDROID",
  "pushToken": "string（微信为 openid，App 为 APNs/FCM token）",
  "deviceFingerprint": "string（可选，设备唯一标识）"
}
```

**POST /devices 行为：**
- 按 `userId + deviceFingerprint`（或 `userId + platform + pushToken`）做 upsert
- 更新 `lastSeenAt`
- 同一用户同一设备重复注册时更新 pushToken（用户换机不换号场景）

**步骤：**

- [ ] **Step 1:** 创建 `device.controller.ts`，实现 register（upsert）、unregister（delete）、list 三个方法。

- [ ] **Step 2:** 创建 `devices.ts` 路由，注册上述三个接口，全部需要 `authMiddleware`。

- [ ] **Step 3:** 修改 `app.ts`，挂载 `app.use('/devices', deviceRoutes)`。

- [ ] **Step 4:** 写测试：验证 upsert 逻辑（同一设备多次注册只保留一条记录，pushToken 被更新）。

- [ ] **Step 5:** Commit

```
git commit -m "feat: add device registration API for push tokens"
```

---

## Task 6: 通知设置 API

**目标：** 允许用户更新自己的推送偏好（每日上限、降价阈值、推送渠道）。

**Files:**
- Modify: `apps/api/src/routes/auth.ts`（或新建 `users.ts` 路由）

**API 接口：**

| Method | Path | 认证 | 描述 |
|--------|------|------|------|
| GET | `/users/me` | 需要 | 获取当前用户信息（含 notificationSettings） |
| PATCH | `/users/me/notification-settings` | 需要 | 更新通知设置 |

**PATCH /users/me/notification-settings Request Body（所有字段可选）：**
```json
{
  "push_enabled": true,
  "push_channel": "WECHAT | APP | BOTH",
  "daily_digest": false,
  "price_drop_threshold_pct": 0.03,
  "max_per_day": 3
}
```

**步骤：**

- [ ] **Step 1:** 在现有路由中添加 `GET /users/me` 和 `PATCH /users/me/notification-settings` 接口（若已有 `/users/me` 则只添加 notification-settings 子路由）。

- [ ] **Step 2:** 实现部分更新逻辑：读取现有 `notificationSettings` JSON，与请求体深度合并后写回。

- [ ] **Step 3:** Commit

```
git commit -m "feat: add notification settings update API"
```

---

## Task 7: 测试

**Files:**
- Create: `apps/api/tests/push.test.ts`
- Create: `apps/api/tests/device.test.ts`

**push.test.ts 测试用例：**
- 验证速率限制：超过 max_per_day 后不推送
- 验证幂等性：同一 notificationId 第二次调用不触发推送
- 验证 push_enabled=false 时跳过推送
- 验证无 UserDevice 时跳过（不报错）

**device.test.ts 测试用例：**
- 验证 upsert：同平台同设备再次注册更新 pushToken
- 验证注销：DELETE 后设备记录不存在

**步骤：**

- [ ] **Step 1:** 创建 `push.test.ts`，使用 vitest + mock（mock wechatPushService 和 redis）。

- [ ] **Step 2:** 创建 `device.test.ts`，测试 controller 逻辑（不需要真实 DB，mock prisma）。

- [ ] **Step 3:** 运行 `cd apps/api && npm test`，确认 PASS。

- [ ] **Step 4:** Commit

```
git commit -m "test: add push service and device registration tests"
```

---

## Dependencies

- Task 1（Redis + Config）→ Task 2（微信客户端）→ Task 3（推送分发）→ Task 4（集成快照）
- Task 5（设备注册）独立于 Task 1-4，可与 Task 2 并行
- Task 6（通知设置）独立，可任意时序
- Task 7 依赖 Task 1-6

---

## Summary

**新增文件：**
```
apps/api/src/
├── lib/redis.ts
├── services/
│   ├── wechat-push.service.ts
│   └── push.service.ts
├── controllers/device.controller.ts
└── routes/devices.ts

apps/api/tests/
├── push.test.ts
└── device.test.ts
```

**修改文件：**
- `apps/api/src/config/index.ts` — 添加微信模板 ID 配置
- `apps/api/src/services/snapshot.service.ts` — 集成推送触发
- `apps/api/src/app.ts` — 挂载 devices 路由
- `apps/api/src/routes/auth.ts` — 添加通知设置接口

**新增 API 端点：**

| Method | Path | 说明 |
|--------|------|------|
| POST | `/devices` | 注册设备 pushToken |
| DELETE | `/devices/:deviceId` | 注销设备 |
| GET | `/devices` | 获取设备列表 |
| GET | `/users/me` | 获取用户信息 |
| PATCH | `/users/me/notification-settings` | 更新通知设置 |

---

## Verification

```bash
cd apps/api && npm test
# 期望: push.test.ts 和 device.test.ts 全部 PASS

# 验证设备注册
# POST /devices { platform: "WECHAT_MINIAPP", pushToken: "test_openid" }
# 期望: 创建/更新 UserDevice 记录

# 验证通知设置
# PATCH /users/me/notification-settings { max_per_day: 5 }
# 期望: User.notificationSettings 更新成功

# 验证推送集成
# POST /snapshots/:id/snapshot（手动触发快照）
# 期望: 日志中有推送触发记录
# 若未配置 WECHAT_TEMPLATE_IDS，应看到 "skip: template ID not configured" 日志
```
