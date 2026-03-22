# Plan 9: 性能优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 针对 newcar 项目的主要性能瓶颈进行系统性优化，覆盖数据库索引、Redis 缓存、AI 并发控制、前端加载四个维度，保证平台在用户规模增长后仍能维持稳定响应时间。

**Tech Stack:** Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + Next.js 14 App Router

---

## 架构说明

### 各优化点的当前问题与预期收益

| 优化点 | 当前问题 | 预期收益 |
|--------|----------|----------|
| 数据库索引 | `journeys`、`published_journeys`、`notification_feeds` 等高频过滤字段无索引，随数据增长全表扫描耗时线性上升 | 高频查询从全表扫描（O(n)）降为索引扫描（O(log n)），预计查询耗时从数百 ms 降至 10ms 以内 |
| Redis 缓存 - 社区广场 | `community.service.ts` 每次请求全量拉取所有 LIVE 内容，在内存中 filter + sort，无任何缓存 | 热门列表命中缓存后响应降至 5ms 以内，数据库负载大幅降低 |
| Redis 缓存 - 车型搜索 | `car.service.ts` 每次调用 Prisma + Weaviate 双查询，车型库更新频率极低但查询频繁 | 缓存命中后消除 Weaviate 网络 RTT，响应从 100-300ms 降至 10ms 以内 |
| AI 快照并发控制 | `daily-snapshot.job.ts` 串行遍历所有活跃旅程，无并发限制；`snapshot.service.ts` 无超时保护；多路触发时同一旅程可能被重复生成 | 防止重复生成浪费 token；全局并发限制避免 AI API 过载；超时 fallback 保证任务不阻塞 |
| 前端性能 | `ComparisonMatrix`、`ReportView` 等大组件随主包加载；`next.config.mjs` 无图片域名配置和 bundle 分析能力 | 动态 import 将大组件从主包分离，首屏 JS 减少；图片域名白名单启用 Next.js Image 优化 |

### 整体优化策略

```
用户请求
    │
    ├── 前端（Next.js）
    │   ├── 动态 import 大组件 → 按需加载，减少首屏 JS
    │   └── next/image 优化 → CDN 图片压缩 + 懒加载
    │
    └── API 层（Express）
        │
        ├── Redis 缓存层（新增）
        │   ├── 社区广场列表缓存（TTL 60s，写操作失效）
        │   └── 车型搜索缓存（TTL 300s，车型更新失效）
        │
        ├── PostgreSQL（已有）
        │   └── @@index 索引覆盖高频查询字段
        │
        └── AI 快照生成（优化）
            ├── Redis 分布式锁（per-journey，防重复）
            ├── 全局并发信号量（最多 N 个并发 AI 调用）
            └── 超时保护（30s timeout + fallback）
```

---

## 文件结构

### API 端（`apps/api/src/`）

```
lib/
└── concurrency.ts          # 新建：并发信号量工具（Semaphore）

services/
├── snapshot.service.ts     # 修改：加入分布式锁 + 超时控制
├── community.service.ts    # 修改：加入 Redis 缓存层
└── car.service.ts          # 修改：加入 Weaviate 结果缓存

jobs/
└── daily-snapshot.job.ts   # 修改：引入并发限制，串行改受控并发
```

### Prisma

```
prisma/
├── schema.prisma           # 修改：为 6 张表添加 @@index 声明
└── migrations/
    └── YYYYMMDD_add_performance_indexes/
        └── migration.sql   # 自动生成（prisma migrate dev）
```

### 前端（`apps/web/`）

```
next.config.mjs             # 修改：添加 images.remotePatterns + bundle-analyzer

src/
└── components/
    └── journey/
        └── Kanban.tsx      # 修改：ComparisonMatrix 改为 dynamic import
    └── community/
        └── [id]/
            └── page.tsx    # 修改：ReportView 改为 dynamic import
```

---

## Task 1: 数据库索引

**目标：** 为高频查询字段添加复合索引，消除全表扫描，覆盖核心业务查询路径。

**高频查询分析：**

| 查询来源 | 过滤/排序字段 | 当前状态 | 建议索引 |
|----------|--------------|----------|---------|
| `daily-snapshot.job.ts` — 查找活跃旅程 | `journeys.status`, `journeys.lastActivityAt` | 无索引 | `@@index([status, lastActivityAt])` |
| `journey.service.ts` — 按用户查询旅程 | `journeys.userId`, `journeys.status` | 无索引 | `@@index([userId, status])` |
| `community.service.ts` — 列表查询 | `published_journeys.contentStatus`, `published_journeys.visibility`, `published_journeys.publishedAt` | 无索引 | `@@index([contentStatus, visibility, publishedAt])` |
| `community.service.ts` — 排序 popular | `published_journeys.forkCount`, `published_journeys.likeCount` | 无索引 | `@@index([contentStatus, visibility, forkCount, likeCount])` |
| `notification.service.ts` — 每日限额计数 | `notification_feeds.journeyId`, `notification_feeds.createdAt` | 无索引 | `@@index([journeyId, createdAt])` |
| `notification.controller.ts` — 用户通知列表 | `notification_feeds.userId`, `notification_feeds.isRead`, `notification_feeds.createdAt` | 无索引 | `@@index([userId, isRead, createdAt])` |
| `snapshot.service.ts` — 查询今日快照 | `journey_snapshots.journeyId`, `journey_snapshots.generatedAt` | 无索引 | `@@index([journeyId, generatedAt])` |
| `car-candidate.service.ts` — 候选车型列表 | `car_candidates.journeyId`, `car_candidates.status` | 无索引 | `@@index([journeyId, status])` |
| `behavior_events` — 快照聚合输入 | `behavior_events.journeyId`, `behavior_events.timestamp` | 无索引 | `@@index([journeyId, timestamp])` |

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Auto-generate: `apps/api/prisma/migrations/<timestamp>_add_performance_indexes/migration.sql`

**Prisma Schema @@index 声明位置：**

在以下 model 中，在 `@@map(...)` 行之前插入对应 `@@index` 声明：

- `Journey` model: 添加 `@@index([userId, status])` 和 `@@index([status, lastActivityAt])`
- `PublishedJourney` model: 添加 `@@index([contentStatus, visibility, publishedAt])` 和 `@@index([contentStatus, visibility, forkCount, likeCount])`
- `NotificationFeed` model: 添加 `@@index([userId, isRead, createdAt])` 和 `@@index([journeyId, createdAt])`
- `JourneySnapshot` model: 添加 `@@index([journeyId, generatedAt])`
- `CarCandidate` model: 添加 `@@index([journeyId, status])`
- `BehaviorEvent` model: 添加 `@@index([journeyId, timestamp])`

**步骤：**

- [ ] **Step 1:** 打开 `apps/api/prisma/schema.prisma`，在上述 6 个 model 中各自的 `@@map(...)` 行前添加对应的 `@@index` 声明。每个 index 名称遵循 Prisma 自动命名规则（无需手动指定 `name`）。

- [ ] **Step 2:** 在 `apps/api/` 目录下运行 `npx prisma migrate dev --name add_performance_indexes`，自动生成并应用迁移文件。确认 migration.sql 中包含预期的 `CREATE INDEX` 语句（9 条索引）。

- [ ] **Step 3:** 使用 `EXPLAIN ANALYZE` 验证以下三条关键查询使用了索引扫描：
  - `SELECT * FROM journeys WHERE status = 'ACTIVE' AND "lastActivityAt" >= $1`（期望：Index Scan on journeys，不出现 Seq Scan）
  - `SELECT * FROM published_journeys WHERE "contentStatus" = 'LIVE' AND visibility = 'PUBLIC' ORDER BY "publishedAt" DESC`（期望：Index Scan）
  - `SELECT COUNT(*) FROM notification_feeds WHERE "journeyId" = $1 AND "createdAt" >= $2`（期望：Index Scan）

- [ ] **Step 4:** Commit

```
git commit -m "perf: add database indexes for high-frequency query fields"
```

**验证方式：** `EXPLAIN ANALYZE` 输出中 `journeys` 日快照查询由 Seq Scan 变为 Index Scan，查询耗时从数百 ms 降至 10ms 以内。

---

## Task 2: Redis 缓存层

**目标：** 为社区广场列表和车型搜索结果添加 Redis 缓存，减少 PostgreSQL 和 Weaviate 的重复查询压力。

### 缓存设计

**社区广场列表缓存**

| 要素 | 设计 |
|------|------|
| Key 格式 | `community:list:{hash(params)}` — 将请求参数（sort、fuelType、budgetMin、budgetMax、useCases、hasTemplate、result、limit、offset）序列化后取 sha256 hex 前 16 位作为 hash |
| TTL | 60 秒 |
| 缓存粒度 | 序列化整个响应体（`{ items, total, limit, offset }`） |
| 主动失效时机 | 发布新历程（`POST /journeys/:id/publish`）、点赞/取消点赞（`POST/DELETE /community/:id/like`）、fork 成功（`POST /community/:id/fork`）时，调用 `invalidateCommunityCache()` 批量删除 `community:list:*` 键 |
| 冷启动策略 | 缓存未命中时正常走 DB 查询，结果写入缓存 |

**车型搜索缓存**

| 要素 | 设计 |
|------|------|
| Key 格式 | `cars:search:{hash(params)}` — 将 brand、fuelType、carType、budgetMin、budgetMax、q 序列化后 hash |
| TTL | 300 秒（车型库更新频率低） |
| 额外 key | `cars:weaviate:{hash(query+filters)}` — Weaviate 语义搜索结果独立缓存，TTL 300 秒 |
| 主动失效时机 | 车型数据更新接口（若存在 admin 写车型接口）时调用 `invalidateCarCache()`。当前 MVP 阶段依赖 TTL 自然过期即可 |

**Files:**
- Modify: `apps/api/src/services/community.service.ts`
- Modify: `apps/api/src/services/car.service.ts`
- Modify: `apps/api/src/controllers/community.controller.ts`（在写操作后调用缓存失效）
- Modify: `apps/api/src/controllers/published-journey.controller.ts`（发布成功后调用缓存失效）

**接口约定（在各 service 内部实现的缓存辅助方法）：**

`community.service.ts` 内新增两个私有方法：
- `buildCacheKey(params: ListCommunityParams): string` — 序列化参数并生成缓存 key
- `invalidateCommunityListCache(): Promise<void>` — 使用 Redis `SCAN` + `DEL` 批量删除 `community:list:*` 所有键；**注意：** 不使用 `KEYS *` 以避免阻塞生产 Redis

`car.service.ts` 内新增一个私有方法：
- `buildCarSearchCacheKey(params: CarSearchParams): string` — 序列化参数生成 key

**步骤：**

- [ ] **Step 1:** 修改 `apps/api/src/services/community.service.ts`，在 `listJourneys()` 方法入口处添加 Redis 缓存读取逻辑：先查 `community:list:{key}` 是否存在，命中则直接返回解析后的 JSON；未命中则走原有 DB 查询逻辑，查询完成后将结果序列化写入 Redis（SET … EX 60）。

- [ ] **Step 2:** 在 `community.service.ts` 中实现 `invalidateCommunityListCache()` 方法，使用 Redis `SCAN` 遍历 `community:list:*` 键并批量 `DEL`。将此方法导出为 public。

- [ ] **Step 3:** 修改 `apps/api/src/controllers/community.controller.ts`，在点赞、取消点赞、fork 等写操作成功响应后（await 之后），调用 `communityService.invalidateCommunityListCache()`（使用 `void` 不等待，避免增加响应延迟）。

- [ ] **Step 4:** 修改 `apps/api/src/controllers/published-journey.controller.ts`，在发布历程成功后（`POST /journeys/:id/publish` 成功响应后），调用 `communityService.invalidateCommunityListCache()`。

- [ ] **Step 5:** 修改 `apps/api/src/services/car.service.ts`，在 `searchCars()` 方法中添加 Redis 缓存逻辑（key = `cars:search:{hash}`，TTL = 300s）；在 `weaviate.service.ts` 的 `searchCars()` 调用处（位于 `car.controller.ts` 或 `car.service.ts` 聚合层）添加 Weaviate 结果缓存（key = `cars:weaviate:{hash}`，TTL = 300s）。

- [ ] **Step 6:** 写测试 `apps/api/tests/cache.test.ts`：
  - 验证 `listJourneys()` 第二次调用时返回缓存结果（mock Redis 命中）
  - 验证 `invalidateCommunityListCache()` 调用后下次查询重新走 DB

- [ ] **Step 7:** Commit

```
git commit -m "perf: add Redis cache for community list and car search"
```

**验证方式：** 用 Redis CLI 执行 `KEYS community:list:*` 确认缓存写入；重复请求相同参数的 `GET /community` 接口，第二次响应时间降至 5ms 以内；点赞后缓存键被清除（`KEYS` 命令不再返回对应 key）。

---

## Task 3: AI 快照并发控制

**目标：** 防止同一旅程并发重复生成快照（分布式锁）；控制全局并发 AI 调用数量（信号量）；为单次快照添加超时保护（30s timeout）。

### 并发控制设计

**分布式锁（防单旅程重复生成）**

| 要素 | 设计 |
|------|------|
| Redis Key | `snapshot_lock:{journeyId}` |
| 获取方式 | `SET snapshot_lock:{journeyId} 1 NX EX 120` — NX 保证原子性，120s 过期防止锁泄露 |
| 持有方 | `snapshotService.generateSnapshot()` 入口处获取，方法返回或抛出后释放（`DEL`） |
| 已锁时行为 | 锁获取失败时直接返回 `null`（不报错），表示「本次调用被跳过，已有任务在处理」|

**全局并发信号量（防 AI API 过载）**

| 要素 | 设计 |
|------|------|
| 实现位置 | `apps/api/src/lib/concurrency.ts` — 新建 `Semaphore` 类 |
| 并发数 | 最大 5 个并发 AI 调用（`MAX_CONCURRENT_SNAPSHOTS = 5`），可通过环境变量 `SNAPSHOT_CONCURRENCY` 覆盖 |
| 机制 | 内存信号量（单进程场景）；单机 API 时使用内存即可，多实例时替换为 Redis 计数器（留注释说明扩展点） |
| 获取/释放 | `await semaphore.acquire()` 和 `semaphore.release()`，在 `finally` 块中 release 保证不泄露 |

**超时保护**

| 要素 | 设计 |
|------|------|
| 超时时间 | 30 秒 |
| 实现方式 | 在 `snapshotService.generateSnapshot()` 中，将 `client.messages.create()` 调用包装在 `Promise.race([aiCallPromise, timeoutPromise])` 中；timeout promise 在 30s 后 reject 并触发现有 fallback 路径 |
| Fallback 行为 | 超时后记录 error log，调用现有 `generateFallbackSnapshot()`，写入 snapshot（标记 `modelUsed = 'fallback'`）|

**Daily Job 受控并发**

当前 `daily-snapshot.job.ts` 是纯串行（for 循环 await）。在旅程数量大时效率极低。优化后改为受控并发批次执行：每批 N 个（`SNAPSHOT_CONCURRENCY`，与信号量上限一致），批次间不等待（由信号量自动控制），整体用 `Promise.allSettled` 收集结果。

**Files:**
- Create: `apps/api/src/lib/concurrency.ts`
- Modify: `apps/api/src/services/snapshot.service.ts`
- Modify: `apps/api/src/jobs/daily-snapshot.job.ts`

**接口约定：**

`apps/api/src/lib/concurrency.ts` 导出：
- `class Semaphore` — 构造函数接收 `maxConcurrent: number`，提供 `acquire(): Promise<void>` 和 `release(): void`
- `snapshotSemaphore` — 单例，使用 `SNAPSHOT_CONCURRENCY` 环境变量（默认 5）初始化

`snapshot.service.ts` 中 `generateSnapshot()` 方法的执行顺序：
1. 获取 Redis 分布式锁（`SET NX EX`）→ 锁已存在则返回 null
2. 执行内存信号量 `acquire()`
3. 在 `try/finally` 中：执行原有逻辑（含 30s timeout 保护的 AI 调用）
4. `finally`：释放信号量，删除 Redis 锁

**步骤：**

- [ ] **Step 1:** 创建 `apps/api/src/lib/concurrency.ts`，实现 `Semaphore` 类（基于 Promise 队列），导出 `snapshotSemaphore` 单例。

- [ ] **Step 2:** 修改 `apps/api/src/services/snapshot.service.ts`：
  - 在 `generateSnapshot()` 方法入口添加 Redis 分布式锁获取逻辑（`SET snapshot_lock:{journeyId} 1 NX EX 120`）；锁获取失败时 return null
  - 在 AI 调用（`client.messages.create()`）外层包装 `Promise.race` 超时（30s）；超时触发 fallback，在 fallback snapshot 的 `modelUsed` 字段标记 `'fallback-timeout'`
  - 用 `snapshotSemaphore.acquire()` + `finally { snapshotSemaphore.release() }` 包裹整个生成流程（锁获取成功之后）
  - 在 `finally` 块末尾释放 Redis 锁（`DEL snapshot_lock:{journeyId}`）

- [ ] **Step 3:** 修改 `apps/api/src/jobs/daily-snapshot.job.ts`，将串行 for 循环改为受控并发：将 `activeJourneys` 分成批次，使用 `Promise.allSettled` 并发触发，由 `snapshotSemaphore` 自动控制实际并发数。保持原有的成功/失败结果统计日志。

- [ ] **Step 4:** 写测试 `apps/api/tests/snapshot-concurrency.test.ts`：
  - 验证同一 journeyId 并发调用两次 `generateSnapshot()` 时，第二次因锁竞争返回 null（mock Redis）
  - 验证超时场景：mock AI 调用延迟 35s，确认 fallback snapshot 被写入且 `modelUsed = 'fallback-timeout'`

- [ ] **Step 5:** Commit

```
git commit -m "perf: add distributed lock and concurrency control for AI snapshot generation"
```

**验证方式：** 在测试环境并发触发 10 个相同旅程的快照生成，Redis 中 `snapshot_lock:{journeyId}` 键只存在一个；同时触发 20 个不同旅程的快照生成，查看 AI API 调用日志确认并发数不超过 5；mock 超时场景确认 30s 后写入 fallback snapshot。

---

## Task 4: 前端性能

**目标：** 将大组件从主 bundle 分离（动态 import），配置 Next.js 图片优化，添加 bundle 分析能力。

### 前端优化设计

**动态 import 目标组件**

| 组件 | 当前路径 | 懒加载理由 |
|------|---------|------------|
| `ComparisonMatrix` | `apps/web/src/components/journey/ComparisonMatrix.tsx` | 仅在有 2+ 候选车时渲染，非首屏必需；含表格渲染逻辑 |
| `ReportView` | `apps/web/src/components/community/JourneyDetail/ReportView.tsx` | 仅在历程详情 Report Tab 被点击时渲染，非首屏 |

动态 import 在各自的**调用处**（而非组件文件内部）使用 `next/dynamic` 替换静态 import，并配置适当的 `loading` 占位。

**next.config.mjs 图片域名白名单**

当前 `next.config.mjs` 没有 `images` 配置，导致无法使用 `<Image>` 组件加载外部图片（CDN、微信头像等）。需添加 `images.remotePatterns`，覆盖：
- 微信头像域名（`thirdwx.qlogo.cn`、`wx.qlogo.cn`）
- 项目自用 CDN 域名（通过环境变量 `NEXT_PUBLIC_CDN_HOST` 配置，占位符形式）

**Bundle 分析**

添加 `@next/bundle-analyzer` 配置（开发依赖），通过环境变量 `ANALYZE=true` 启用，不影响正常构建流程。

**Files:**
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/web/src/components/journey/Kanban.tsx`（ComparisonMatrix 动态 import）
- Modify: `apps/web/src/app/community/[id]/page.tsx`（ReportView 动态 import）
- Install (devDependency): `@next/bundle-analyzer`

**接口约定：**

`next.config.mjs` 修改后需导出的结构：
- `images.remotePatterns`：数组，包含微信头像域名和 CDN 域名条目，每条含 `protocol`、`hostname` 字段
- 顶层用 `withBundleAnalyzer` 包裹 `nextConfig`，当 `process.env.ANALYZE === 'true'` 时启用，否则透传

调用处动态 import 写法约定：
- 使用 `import dynamic from 'next/dynamic'`
- `loading` prop 统一使用行内骨架占位（简单的 `<div className="animate-pulse ..." />`）
- `ssr: false`（两个目标组件均为 `'use client'` 组件，无 SSR 需求）

**步骤：**

- [ ] **Step 1:** 在 `apps/web/` 目录下安装开发依赖 `@next/bundle-analyzer`。

- [ ] **Step 2:** 修改 `apps/web/next.config.mjs`：
  - 引入 `@next/bundle-analyzer`，用 `withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })` 包裹 `nextConfig`
  - 在 `nextConfig` 中添加 `images.remotePatterns` 配置，覆盖微信头像域名和 CDN 域名

- [ ] **Step 3:** 修改 `apps/web/src/components/journey/Kanban.tsx`（或 `ComparisonMatrix` 的实际使用位置），将 `import { ComparisonMatrix }` 的静态 import 替换为 `dynamic(() => import('./ComparisonMatrix'), { ssr: false, loading: () => <div> ... </div> })`。

- [ ] **Step 4:** 修改 `apps/web/src/app/community/[id]/page.tsx`，将 `import { ReportView }` 的静态 import 替换为 `dynamic(() => import('@/components/community/JourneyDetail/ReportView'), { ssr: false, loading: () => <div> ... </div> })`。

- [ ] **Step 5:** 在本地运行 `ANALYZE=true npm run build`，打开 bundle 分析报告，确认 `ComparisonMatrix` 和 `ReportView` 不再出现在主 bundle（`_app` chunk）中，而是作为独立 chunk。

- [ ] **Step 6:** Commit

```
git commit -m "perf: add dynamic imports for large components and configure Next.js image optimization"
```

**验证方式：** `ANALYZE=true npm run build` 生成的报告中 ComparisonMatrix 和 ReportView 出现在独立 chunk；使用 `next/image` 加载微信头像不再报 `Invalid src` 错误；Lighthouse 首屏 FCP 有改善（减少 JS parse 耗时）。

---

## Dependencies

- Task 1（数据库索引）独立，无依赖，**优先执行**
- Task 2（Redis 缓存）依赖 Task 1（索引优化后缓存命中率测量更准确），可并行开始但建议顺序执行
- Task 3（AI 并发控制）独立，与 Task 1/2 无依赖，可并行
- Task 4（前端性能）完全独立，与后端任务无依赖，可并行

推荐执行顺序：Task 1 → Task 3（高风险低依赖）→ Task 2 → Task 4

---

## Summary

**修改的 API 文件：**

```
apps/api/prisma/schema.prisma                     # 添加 9 条 @@index
apps/api/prisma/migrations/<ts>_add_indexes/      # 自动生成

apps/api/src/lib/concurrency.ts                   # 新建：Semaphore 工具
apps/api/src/services/snapshot.service.ts         # 分布式锁 + 超时
apps/api/src/services/community.service.ts        # Redis 缓存层
apps/api/src/services/car.service.ts              # Redis 缓存层
apps/api/src/controllers/community.controller.ts  # 写操作后失效缓存
apps/api/src/controllers/published-journey.controller.ts  # 发布后失效缓存
apps/api/src/jobs/daily-snapshot.job.ts           # 串行改受控并发
```

**修改的前端文件：**

```
apps/web/next.config.mjs                          # bundle-analyzer + images
apps/web/src/components/journey/Kanban.tsx        # ComparisonMatrix dynamic import
apps/web/src/app/community/[id]/page.tsx          # ReportView dynamic import
```

**新增测试文件：**

```
apps/api/tests/cache.test.ts
apps/api/tests/snapshot-concurrency.test.ts
```

---

## Verification

```bash
# Task 1 验证
cd apps/api
npx prisma migrate deploy
psql $DATABASE_URL -c "\d journeys"   # 检查索引存在

# 用 EXPLAIN ANALYZE 验证关键查询
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT id FROM journeys WHERE status = 'ACTIVE' AND \"lastActivityAt\" >= NOW() - INTERVAL '7 days';"
# 期望输出包含: Index Scan using journeys_status_lastActivityAt_idx

# Task 2 验证
# 第一次请求（未命中缓存）
curl "http://localhost:3000/community?sort=popular" -w "\nTime: %{time_total}s\n"
# 第二次请求（命中缓存）
curl "http://localhost:3000/community?sort=popular" -w "\nTime: %{time_total}s\n"
# 期望：第二次响应时间 < 0.01s

# 验证点赞后缓存失效
redis-cli KEYS "community:list:*"    # 点赞前有缓存键
curl -X POST "http://localhost:3000/community/:id/like" -H "Authorization: Bearer $TOKEN"
redis-cli KEYS "community:list:*"    # 期望：键已被清除

# Task 3 验证
cd apps/api && npm test -- --testPathPattern snapshot-concurrency
# 期望：2 tests pass（重复锁测试 + 超时 fallback 测试）

# Task 4 验证
cd apps/web
ANALYZE=true npm run build
# 打开 .next/analyze/client.html，确认 ComparisonMatrix 出现在独立 chunk 而非主 bundle
```

**性能基准目标：**

| 指标 | 优化前（估算） | 优化后目标 |
|------|--------------|------------|
| `GET /community`（冷 DB） | 200-500ms | < 50ms（含索引优化） |
| `GET /community`（热缓存） | 200-500ms | < 10ms |
| `GET /community`（冷缓存） | 200-500ms | < 80ms |
| 日快照 Job（100 旅程，串行） | ~100 × 单次延迟 | 受控并发后 ~20 × 单次延迟 |
| 单次快照超时保护 | 无上限 | 最长 30s，fallback 兜底 |
| 首屏 JS（主 bundle） | 含 ComparisonMatrix + ReportView | 减少约 10-20KB parsed JS |
