# Plan 8: 联调测试实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 验证 Plan 1-7 各模块集成工作正常——运行并修复全部现有单元测试、补充覆盖核心用户流程的 API 集成测试、执行数据一致性验证脚本、完成手动前端冒烟测试清单，确保系统可交付。

**Tech Stack:** vitest + supertest（API集成测试）、Prisma migrate + seed（测试数据库）、Node.js 脚本（数据一致性检查）

---

## 测试策略

### 三层测试边界

| 层级 | 工具 | 边界定义 | 运行时机 |
|------|------|---------|---------|
| **单元测试** | vitest + vi.mock | 单个 service/controller 逻辑，外部依赖（Prisma、Redis、AI）全部 mock，不需要真实 DB | 每次 commit，CI 必跑 |
| **API 集成测试** | vitest + supertest | 完整 HTTP 调用链，使用真实测试 DB（TEST_DATABASE_URL），不 mock Prisma，但 mock 外部 HTTP 调用（AI API、微信 API） | Plan 完成后、上线前手动触发 |
| **手动冒烟测试** | 浏览器 + 真实环境 | 前端 UI 交互、端到端业务流程，无法自动化的视觉和状态验证 | 每个 Plan 合并后人工执行 |

### 核心原则

- **单元测试不依赖环境：** 任何单元测试文件不得连接真实数据库或外部服务，必须通过 `vi.mock` 隔离。
- **集成测试使用独立测试库：** 测试库与开发库完全隔离（`TEST_DATABASE_URL`），每次测试前 migrate + seed，测试后不清理（保留最后一次状态便于调试）。
- **AI 调用不走真实 API：** 集成测试中所有 AI 接口通过 `vi.mock` 返回固定响应，避免成本和不确定性。
- **微信 API 不走真实接口：** 集成测试中 wechat-push.service 返回 mock 成功响应。

---

## 测试数据库策略

### 环境变量约定

```
TEST_DATABASE_URL=postgresql://newcar:newcar_dev@localhost:5433/newcar_test
DATABASE_URL=postgresql://newcar:newcar_dev@localhost:5433/newcar         # 开发库，不受影响
```

### 测试 DB 初始化流程（集成测试前执行一次）

```
1. 创建 newcar_test 数据库（若不存在）
2. DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
3. DATABASE_URL=$TEST_DATABASE_URL npx prisma db seed
4. 运行集成测试套件
```

### 测试数据 seed 范围

集成测试 seed 脚本（`apps/api/prisma/seed-test.ts`）需要预置：
- 1 个 ADMIN 用户 + 1 个 MEMBER 用户（含有效 JWT token 生成方式）
- 3 条 Car 记录（覆盖 BEV / PHEV / ICE 燃料类型）
- 1 条 ACTIVE Journey（属于 MEMBER 用户）
- 1 条 LIVE PublishedJourney（含 template 形式，属于 ADMIN 用户的旅程）
- 1 条 UserDevice（WECHAT_MINIAPP，属于 MEMBER 用户）

---

## 文件结构

```
apps/api/
├── tests/
│   ├── (现有 18 个单元测试文件，不修改文件名)
│   ├── integration/                         # 新建目录
│   │   ├── setup.ts                         # 新建：测试 DB 连接、全局 beforeAll/afterAll
│   │   ├── helpers.ts                       # 新建：token 生成、请求封装工具
│   │   ├── auth.integration.test.ts         # 新建：认证流程集成测试
│   │   ├── journey-lifecycle.integration.test.ts  # 新建：旅程完整生命周期
│   │   ├── community-flow.integration.test.ts     # 新建：社区广场流程
│   │   └── moderation-flow.integration.test.ts    # 新建：内容审核流程
│   └── data-consistency/                    # 新建目录
│       └── check.ts                         # 新建：数据一致性验证脚本（独立 Node.js 脚本）
├── prisma/
│   └── seed-test.ts                         # 新建：集成测试专用 seed
└── vitest.config.integration.ts             # 新建：集成测试专用 vitest 配置（区分 unit/integration）
```

**前端测试清单（文档形式）：**

```
docs/superpowers/plans/
└── 2026-03-22-plan-8-frontend-checklist.md  # 新建：手动前端测试清单（Markdown checklist）
```

---

## Task 1: 运行现有单元测试 + 修复失败

**目标：** 确保 18 个现有单元测试文件全部通过，无跳过（skip）、无超时失败。

**Files:**
- 现有 18 个测试文件（`apps/api/tests/*.test.ts`）
- 对应 service/controller 源文件（按失败情况修改）

### 步骤

- [ ] **Step 1:** 在 `apps/api/` 目录运行完整测试套件，记录所有失败用例：
  ```
  cd apps/api && npm test 2>&1 | tee /tmp/test-run-1.log
  ```
  记录：通过数 / 失败数 / 报错摘要。

- [ ] **Step 2:** 对每个失败用例，定位根因。常见失败模式：
  - TypeScript 编译错误（类型不匹配、缺少导出）
  - Mock 结构与实际服务接口不一致（服务重构后 mock 未同步）
  - 断言值与实现逻辑不匹配（计算公式或状态枚举变更）

- [ ] **Step 3:** 修复失败的源文件或测试文件。修复原则：
  - 优先修改测试文件（若测试断言本身有误）
  - 若源文件逻辑有 bug，修改源文件并更新对应测试
  - 不得为了让测试通过而删除或注释断言

- [ ] **Step 4:** 再次运行完整测试套件，验证全部通过：
  ```
  cd apps/api && npm test
  ```
  期望：18 个测试文件，全部 PASS，0 FAIL，0 SKIP。

- [ ] **Step 5:** Commit

```
git commit -m "fix: resolve all unit test failures"
```

### 验证方式

```
cd apps/api && npm test
# 期望输出：Test Files  18 passed (18)
```

---

## Task 2: API 集成测试

**目标：** 使用 supertest + 真实测试 DB，覆盖 4 条核心用户流程的完整 HTTP 调用链。

**Files:**
- Create: `apps/api/prisma/seed-test.ts`
- Create: `apps/api/vitest.config.integration.ts`
- Create: `apps/api/tests/integration/setup.ts`
- Create: `apps/api/tests/integration/helpers.ts`
- Create: `apps/api/tests/integration/auth.integration.test.ts`
- Create: `apps/api/tests/integration/journey-lifecycle.integration.test.ts`
- Create: `apps/api/tests/integration/community-flow.integration.test.ts`
- Create: `apps/api/tests/integration/moderation-flow.integration.test.ts`

### 前置条件：安装 supertest

检查 `apps/api/package.json` 是否已有 `supertest` 及 `@types/supertest`。若无，安装：

```
cd apps/api && npm install --save-dev supertest @types/supertest
```

### vitest.config.integration.ts 规格

集成测试配置与单元测试配置分开，关键差异：
- `include`：仅匹配 `tests/integration/**/*.test.ts`
- `testTimeout`：15000ms（AI mock 返回仍需给出合理时间上限）
- `globalSetup`：指向 `tests/integration/setup.ts`
- 环境变量加载：从 `.env.test` 读取，或通过 shell 注入 `TEST_DATABASE_URL`

### tests/integration/setup.ts 规格

- `beforeAll`：
  1. 验证 `TEST_DATABASE_URL` 环境变量存在，不存在则跳过全部集成测试并打印明确提示
  2. 初始化 Prisma Client（连接测试 DB）
  3. 运行 `seed-test.ts`（清空相关表，重新写入测试数据）
  4. 启动 Express app 实例（`createApp()`）
- `afterAll`：关闭 Prisma 连接，释放 Express 服务器

### tests/integration/helpers.ts 规格

提供以下工具函数，供各测试文件复用：

| 函数 | 说明 |
|------|------|
| `getTestApp()` | 返回 supertest 包装的 app 实例 |
| `getMemberToken()` | 返回 MEMBER 用户的有效 Bearer token（由 setup 预生成） |
| `getAdminToken()` | 返回 ADMIN 用户的有效 Bearer token |
| `authHeader(token)` | 返回 `{ Authorization: 'Bearer <token>' }` 对象 |
| `seedJourney(userId)` | 在测试 DB 中快速创建一条 ACTIVE Journey，返回其 id |
| `seedPublishedJourney(journeyId, formats)` | 创建一条 LIVE PublishedJourney，返回其 id |

---

### Task 2.1: 认证流程集成测试

**File:** `apps/api/tests/integration/auth.integration.test.ts`

**覆盖接口：**
- `POST /auth/otp/request` — 请求 OTP
- `POST /auth/otp/verify` — 验证 OTP 并获取 token
- `GET /users/me` — 使用 token 获取用户信息
- `POST /auth/refresh` — 刷新 token

**测试用例：**

- [ ] **Case 1:** 请求 OTP：`POST /auth/otp/request { phone: "13800138000" }` → 200 OK，响应体含 `{ requestId: string }`。（OTP 发送 mock，不触发真实短信）
- [ ] **Case 2:** 使用错误 OTP 验证：`POST /auth/otp/verify { requestId, phone, otp: "000000" }` → 401，响应体含 `error` 字段。
- [ ] **Case 3:** 使用正确 OTP 验证：mock OTP service 返回 valid，`POST /auth/otp/verify` → 200，响应体含 `{ accessToken, refreshToken, user }`，`user.phone` 与请求匹配。
- [ ] **Case 4:** 使用 accessToken 访问 `GET /users/me` → 200，返回用户信息。
- [ ] **Case 5:** 无 token 访问受保护接口 `GET /users/me` → 401。
- [ ] **Case 6:** 使用无效 token → 401。

**步骤：**

- [ ] **Step 1:** 创建 `auth.integration.test.ts`，实现 Case 1-6。
- [ ] **Step 2:** 运行：`npm run test:integration -- auth`，验证全部通过。

---

### Task 2.2: 旅程完整生命周期集成测试

**File:** `apps/api/tests/integration/journey-lifecycle.integration.test.ts`

**覆盖接口（按流程顺序）：**

```
POST /journeys                          创建旅程
GET  /journeys/:id                      获取旅程详情
POST /conversations                     发起 AI 对话（mock AI）
POST /journeys/:id/events               提交行为事件
POST /snapshots/:id/snapshot            触发快照生成（mock AI）
GET  /snapshots/:id                     获取快照
POST /journeys/:id/publish              发布旅程（mock AI 内容生成和审核）
GET  /published-journeys/:id            获取已发布旅程详情
```

**测试用例：**

- [ ] **Case 1:** 创建旅程：`POST /journeys { title: "购车旅程", requirements: {...} }` → 201，返回 `{ id, status: "ACTIVE", stage: "AWARENESS" }`。
- [ ] **Case 2:** 重复创建旅程（已有 ACTIVE）→ 409，提示用户已有活跃旅程。
- [ ] **Case 3:** 发起 AI 对话（mock Anthropic/AI SDK 返回固定内容）：`POST /conversations { journeyId, message: "我想买30万的SUV" }` → 200，响应体含 `{ reply: string, conversationId }`。
- [ ] **Case 4:** 提交行为埋点事件：`POST /journeys/:id/events { type: "CAR_VIEW", carId, duration: 120 }` → 201，返回 event 记录。
- [ ] **Case 5:** 触发快照生成（mock AI 返回快照数据）：`POST /snapshots/:journeyId/snapshot` → 202 或 200，响应体含 `{ snapshotId }`。
- [ ] **Case 6:** 获取快照详情：`GET /snapshots/:snapshotId` → 200，返回 `{ attentionSignals, narrativeSummary, candidateRankings }`。
- [ ] **Case 7:** 发布旅程（mock publish.service 的 AI 生成和 moderation）：`POST /journeys/:id/publish { title, publishedFormats: ["story", "template"], visibility: "PUBLIC" }` → 201，返回 `{ id, contentStatus: "LIVE" }`。
- [ ] **Case 8:** 获取已发布旅程详情：`GET /published-journeys/:id` → 200，返回含 `storyContent`、`templateData` 字段。

**步骤：**

- [ ] **Step 1:** 在 `helpers.ts` 中确认 mock AI 的 setup 方式（`vi.mock('@anthropic-ai/sdk')` 或 `vi.mock('../src/services/ai-chat.service')`）。
- [ ] **Step 2:** 创建 `journey-lifecycle.integration.test.ts`，实现 Case 1-8，按顺序执行（后续 case 依赖前序 case 的返回 id，使用 `let` 变量跨 case 传递）。
- [ ] **Step 3:** 运行验证。

---

### Task 2.3: 社区广场流程集成测试

**File:** `apps/api/tests/integration/community-flow.integration.test.ts`

**覆盖接口：**

```
GET  /community                         列表（含筛选/排序）
GET  /community/:id                     详情（增加 view_count）
POST /community/:id/like                点赞
DELETE /community/:id/like              取消点赞
POST /community/:id/fork                「从此出发」
GET  /community/:id/comments            评论列表
POST /community/:id/comments            发表评论
```

**前置数据：** 使用 `setup.ts` 中 seed 的 LIVE PublishedJourney（含 template 形式）。

**测试用例：**

- [ ] **Case 1:** 游客访问社区列表（无 token）：`GET /community` → 200，返回 `{ items: [...], total: number }`，每条 item 含 `id`、`title`、`publishedFormats`、`likeCount`、`forkCount`。
- [ ] **Case 2:** 按燃油类型筛选：`GET /community?fuel_type=BEV` → 200，返回结果的 `tags.fuelTypes` 全部包含 BEV（或为空列表，不返回 ICE 车型主导的旅程）。
- [ ] **Case 3:** 按排序方式：`GET /community?sort=latest` → 200，验证返回结果按 `publishedAt` 降序排列。
- [ ] **Case 4:** 获取详情并验证 view_count 增加：连续调用 `GET /community/:id` 两次，第二次调用后，通过 DB 或再次 GET 确认 `viewCount` 比初始值增加了 1（幂等性：同一用户同一条目同一会话不重复计数可不要求，此处简单验证调用后 viewCount 至少 ≥ 1）。
- [ ] **Case 5:** 登录用户点赞：`POST /community/:id/like` → 200。再次点赞 → 409 或幂等返回 200（视实现而定）。
- [ ] **Case 6:** 取消点赞：`DELETE /community/:id/like` → 200。确认 likeCount 恢复。
- [ ] **Case 7:** 「从此出发」（目标用户无 ACTIVE 旅程）：使用 seed 中另一 MEMBER 用户的 token，`POST /community/:id/fork` → 201，返回 `{ journeyId: string }`，新 Journey `templateSourceId` 指向来源 publishedJourney 的 `journeyId`，`forkCount` +1。
- [ ] **Case 8:** 重复 fork（该用户已有 ACTIVE 旅程）：再次调用 fork → 409，错误信息含 "already has an active journey"。
- [ ] **Case 9:** fork 来源不含 template 形式：seed 一条无 template 的 LIVE 历程，调用 fork → 400，错误信息含 "does not provide reusable template"。
- [ ] **Case 10:** 发表评论：`POST /community/:id/comments { content: "很有参考价值" }` → 201，返回 comment 对象。
- [ ] **Case 11:** 获取评论列表：`GET /community/:id/comments` → 200，包含刚发的评论。

**步骤：**

- [ ] **Step 1:** 创建 `community-flow.integration.test.ts`，实现 Case 1-11。
- [ ] **Step 2:** 运行验证。

---

### Task 2.4: 内容审核流程集成测试

**File:** `apps/api/tests/integration/moderation-flow.integration.test.ts`

**覆盖接口：**

```
GET  /admin/moderation/queue            获取待审核列表（ADMIN 权限）
POST /admin/moderation/:id/approve      审核通过（ADMIN 权限）
POST /admin/moderation/:id/reject       审核拒绝（ADMIN 权限）
POST /admin/moderation/:id/feature      设为精选（ADMIN 权限）
POST /community/:id/report              用户举报（普通用户）
```

**前置数据：** seed 一条 `contentStatus = PENDING_REVIEW` 的 PublishedJourney，用于审核测试。

**测试用例：**

- [ ] **Case 1:** 非管理员访问审核队列：MEMBER token 调用 `GET /admin/moderation/queue` → 403。
- [ ] **Case 2:** ADMIN 获取审核队列：`GET /admin/moderation/queue` → 200，返回 PENDING_REVIEW 的历程列表。
- [ ] **Case 3:** 审核通过：`POST /admin/moderation/:id/approve` → 200，对应 PublishedJourney 的 `contentStatus` 变为 `LIVE`。在 `GET /community` 中可见。
- [ ] **Case 4:** seed 另一条 PENDING_REVIEW 历程，审核拒绝：`POST /admin/moderation/:id/reject { reason: "内容违规" }` → 200，`contentStatus` 变为 `REJECTED`。在 `GET /community` 中不可见。
- [ ] **Case 5:** 设为精选（需 ADMIN）：`POST /admin/moderation/:id/feature` → 200，`featured` 字段为 `true`。
- [ ] **Case 6:** 普通用户举报：`POST /community/:id/report { reason: "广告内容" }` → 201 或 200。举报记录写入（验证响应体含成功标志即可）。
- [ ] **Case 7:** 未登录用户举报 → 401。

**步骤：**

- [ ] **Step 1:** 在 `seed-test.ts` 中添加 PENDING_REVIEW PublishedJourney seed 数据。
- [ ] **Step 2:** 创建 `moderation-flow.integration.test.ts`，实现 Case 1-7。
- [ ] **Step 3:** 运行验证。

---

### Task 2 执行命令与验证方式

**package.json 新增 scripts（Modify: `apps/api/package.json`）：**

```
"test:unit": "vitest run",
"test:integration": "vitest run --config vitest.config.integration.ts",
"test:all": "npm run test:unit && npm run test:integration"
```

**运行方式：**

```bash
# 单独运行集成测试（需要测试 DB 已初始化）
TEST_DATABASE_URL=postgresql://newcar:newcar_dev@localhost:5433/newcar_test \
  cd apps/api && npm run test:integration

# 期望：4 个集成测试文件，全部 PASS
```

**Commit：**

```
git commit -m "test: add API integration tests covering core user flows"
```

---

## Task 3: 数据一致性验证脚本

**目标：** 创建可独立运行的 Node.js 脚本，对生产/开发数据库执行关键业务规则检查，输出违规条目列表。脚本幂等、只读，不修改数据。

**Files:**
- Create: `apps/api/tests/data-consistency/check.ts`

### 脚本规格

脚本从 `DATABASE_URL` 环境变量连接数据库，依次执行以下 3 项检查，每项检查独立报告通过/违规数。

**检查项 1：每用户最多一条 ACTIVE 旅程**

业务规则：同一 `userId`，`status = ACTIVE` 的 Journey 至多 1 条。

验证逻辑：
- 按 `userId` 分组，统计 `status = ACTIVE` 的旅程数量
- 筛选出数量 > 1 的用户
- 报告：违规用户数、各违规用户的 userId 和对应 ACTIVE 旅程 id 列表

输出格式：
```
[CHECK 1] 每用户最多一条 ACTIVE 旅程
  ✓ 通过：无违规用户
  或
  ✗ 违规：3 个用户存在多条 ACTIVE 旅程
    - userId: user_abc → journeys: [j1, j2]
    - ...
```

**检查项 2：fork 只能来自含 template 的已发布历程**

业务规则：`JourneyFork.sourcePublishedJourneyId` 对应的 `PublishedJourney.publishedFormats` 必须包含 `"template"`。

验证逻辑：
- 查询所有 JourneyFork 记录，关联 PublishedJourney
- 筛选出 `publishedFormats` 不含 `"template"` 的记录
- 报告：违规 fork 记录数、forkId、sourcePublishedJourneyId

输出格式：
```
[CHECK 2] fork 必须来自含 template 形式的已发布历程
  ✓ 通过：所有 fork 记录来源合法
  或
  ✗ 违规：2 条 fork 记录来源不含 template
    - forkId: fork_xyz → sourcePublishedJourneyId: pub_abc（formats: ["story"]）
```

**检查项 3：通知每旅程每天最多 3 条**

业务规则：同一 `journeyId`，同一自然日（按 `createdAt` 的日期部分），`NotificationFeed` 记录数不超过 3 条。

验证逻辑：
- 按 `journeyId + date(createdAt)` 分组，统计每组数量
- 筛选数量 > 3 的分组
- 报告：违规分组数、journeyId、日期、实际数量

输出格式：
```
[CHECK 3] 每旅程每天通知不超过 3 条
  ✓ 通过：无违规记录
  或
  ✗ 违规：1 个 journey 在某天通知超限
    - journeyId: j_xyz，日期: 2026-03-15，实际: 5 条
```

**最终汇总：**

```
=== 数据一致性检查结果 ===
检查项目：3
通过：2 / 违规：1
退出码：违规时 exit(1)，全部通过时 exit(0)
```

### 步骤

- [ ] **Step 1:** 创建 `apps/api/tests/data-consistency/check.ts`，实现 3 项检查逻辑，使用 Prisma Client 直连数据库（`new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })`）。

- [ ] **Step 2:** 在 `apps/api/package.json` 添加 script：
  ```
  "check:consistency": "tsx tests/data-consistency/check.ts"
  ```

- [ ] **Step 3:** 针对开发 DB 运行脚本，验证无违规（或修复违规数据）：
  ```
  cd apps/api && npm run check:consistency
  ```
  期望：全部 3 项通过，exit code 0。

- [ ] **Step 4:** 验证违规检测生效（可选，手动）：在开发 DB 直接插入一条违规数据（如第二条 ACTIVE Journey），运行脚本，确认 exit code 为 1 且输出明确错误信息，再删除违规数据。

- [ ] **Step 5:** Commit

```
git commit -m "test: add data consistency validation script"
```

### 验证方式

```bash
cd apps/api && npm run check:consistency
# 期望：3 项全部 ✓ 通过，退出码 0
```

---

## Task 4: 手动前端测试清单

**目标：** 在本地同时启动 API（port 3000）和 Web（port 3001）后，人工验证关键前端页面的功能和交互。

**Files:**
- Create: `docs/superpowers/plans/2026-03-22-plan-8-frontend-checklist.md`

### 测试环境准备

- [ ] **Prep 1:** 启动 API：`cd apps/api && npm run dev`（port 3000，连接开发 DB）
- [ ] **Prep 2:** 启动 Web：`cd apps/web && npm run dev`（port 3001）
- [ ] **Prep 3:** 确认 DB 中有 seed 数据（seed-community.ts 已执行，5 条已发布历程存在）
- [ ] **Prep 4:** 确认 `apps/api/.env` 中 `AI_API_KEY` 和 `JWT_SECRET` 已配置

### 功能区域 A：认证与注册

- [ ] **A1:** 访问 `http://localhost:3001`，页面正常加载，无控制台 Error。
- [ ] **A2:** 进入登录页，输入手机号请求 OTP，页面提示"验证码已发送"。
- [ ] **A3:** 输入错误 OTP，页面提示"验证码错误"。
- [ ] **A4:** 输入正确 OTP（开发环境 mock OTP 或查看 API 日志），登录成功，跳转到旅程工作台。
- [ ] **A5:** 刷新页面后仍保持登录状态（JWT 持久化正常）。
- [ ] **A6:** 登出后，访问受保护页面自动跳转登录页。

### 功能区域 B：旅程工作台

- [ ] **B1:** 登录后首次访问工作台，无旅程时显示"创建旅程"引导。
- [ ] **B2:** 创建旅程：填写标题和基本需求（预算、用车场景），提交后旅程卡片出现在工作台。
- [ ] **B3:** 旅程详情页的 AI 对话框正常加载，输入消息后 AI 返回回复（可能需要1-3秒）。
- [ ] **B4:** AI 对话回复中包含车型建议时，候选车型列表有更新或提示。
- [ ] **B5:** 旅程阶段进度条（AWARENESS → CONSIDERATION → COMPARISON → DECISION）在工作台可见。
- [ ] **B6:** 手动触发快照（若有入口）或等待 AI Pipeline 定时任务，快照卡片出现在工作台。
- [ ] **B7:** 通知 Feed 列表可访问，若有通知记录则正常展示。

### 功能区域 C：发布历程

- [ ] **C1:** 在旅程工作台点击「发布历程」按钮，进入发布向导页面。
- [ ] **C2:** 发布向导 Step 1：勾选发布形式（至少一种），"下一步"按钮可用；全不勾选时按钮 disabled 或提示错误。
- [ ] **C3:** 发布向导 Step 2：AI 内容预览正常生成（加载中状态可见，完成后显示预览文本）。
- [ ] **C4:** 发布向导 Step 3：选择"公开"可见性，点击确认发布，成功后跳转到已发布历程详情页。
- [ ] **C5:** 发布后在社区广场可找到刚发布的历程卡片。

### 功能区域 D：社区广场

- [ ] **D1:** 访问 `http://localhost:3001/community`，页面正常加载，历程卡片列表展示（至少展示 seed 的 5 条）。
- [ ] **D2:** 筛选功能：点击"BEV"筛选标签，列表刷新，仅显示 BEV 相关旅程（或空列表，均可接受）。
- [ ] **D3:** 排序切换：在"最相关 / 最新 / 最受欢迎"之间切换，列表顺序随之变化。
- [ ] **D4:** 点击历程卡片，进入详情页，URL 变为 `/community/:id`。
- [ ] **D5:** 详情页三 Tab（叙事故事 / 结构化报告 / 可复用模板）切换正常，各 Tab 内容各异。
- [ ] **D6:** 点赞按钮：点击后点赞数 +1，按钮状态变为"已赞"，再次点击取消，数量 -1。
- [ ] **D7:** 评论区：提交评论后刷新页面，评论出现在列表。
- [ ] **D8:** 含模板形式的历程卡片上显示「从此出发 →」按钮；不含模板形式的历程不显示该按钮。
- [ ] **D9:** 「从此出发」：点击按钮后跳转新旅程工作台，新旅程候选车型包含来源模板的车型。
- [ ] **D10:** 重复「从此出发」（已有 ACTIVE 旅程）：显示错误提示"您已有进行中的旅程"。

### 功能区域 E：内容审核（管理员）

- [ ] **E1:** 使用 ADMIN 用户登录（需要在 DB 中设置 user.role = 'ADMIN'）。
- [ ] **E2:** 访问审核队列（若有管理后台入口，或直接访问 `/admin/moderation`）。
- [ ] **E3:** 待审核列表显示 `contentStatus = PENDING_REVIEW` 的历程。
- [ ] **E4:** 点击"通过"：历程 contentStatus 变为 LIVE，在社区广场可见。
- [ ] **E5:** 点击"拒绝"（需要填写原因）：历程 contentStatus 变为 REJECTED，社区广场不可见。
- [ ] **E6:** 非管理员访问审核队列入口：不显示或显示 403 提示。

### 功能区域 F：移动端适配（可选，优先级低）

- [ ] **F1:** Chrome DevTools 切换到手机模式（375px 宽），社区广场页面布局正常，无横向溢出。
- [ ] **F2:** 旅程工作台手机视图底部导航栏显示正确的 4 个 Tab。
- [ ] **F3:** AI 对话框在手机视图下键盘弹起时，输入框不被遮挡。

### 验证方式

将此清单中每个通过的项目标记为 `[x]`，记录失败项目的错误现象和浏览器控制台截图，作为后续 bug fix 的输入。

**Commit（仅提交 checklist 文档）：**

```
git commit -m "docs: add manual frontend smoke test checklist"
```

---

## 接口约定汇总

集成测试依赖以下接口约定，若实际实现有差异以实现为准（测试文件相应调整）：

### 认证相关

| 接口 | 请求体 | 成功响应 | 错误响应 |
|------|--------|---------|---------|
| POST /auth/otp/request | `{ phone: string }` | 200 `{ requestId }` | 400（格式错误）|
| POST /auth/otp/verify | `{ requestId, phone, otp }` | 200 `{ accessToken, refreshToken, user }` | 401（OTP 错误）|
| GET /users/me | Header: Bearer token | 200 `{ id, phone, role, ... }` | 401 |

### 旅程相关

| 接口 | 请求体 | 成功响应 | 错误响应 |
|------|--------|---------|---------|
| POST /journeys | `{ title, requirements }` | 201 `{ id, status, stage }` | 409（已有 ACTIVE）|
| POST /journeys/:id/publish | `{ title, publishedFormats, visibility }` | 201 `{ id, contentStatus }` | 400（formats 为空）|

### 社区相关

| 接口 | 查询参数 | 成功响应 |
|------|---------|---------|
| GET /community | fuel_type, sort, limit, offset, has_template | 200 `{ items: [...], total }` |
| POST /community/:id/fork | 无 | 201 `{ journeyId }` |

### 错误响应格式约定

所有错误响应统一格式：
```json
{
  "error": "错误描述字符串"
}
```
或带详情：
```json
{
  "error": "错误类型",
  "message": "详细说明"
}
```

集成测试断言时检查 `res.body.error` 是否存在即可，不强求具体字符串（避免文案改动导致测试脆弱）。

---

## Task 依赖关系

```
Task 1（修复单元测试）
    │
    └── Task 2（API 集成测试）
            ├── Task 2.1（认证）  →  独立
            ├── Task 2.2（旅程生命周期）  →  依赖 Task 1 通过
            ├── Task 2.3（社区广场）  →  依赖 Task 2.2 中发布接口
            └── Task 2.4（内容审核）  →  依赖 Task 2.3 seed 数据
    │
    ├── Task 3（数据一致性脚本）  →  可与 Task 2 并行，独立
    └── Task 4（手动前端清单）  →  可与 Task 1-3 并行，最后执行
```

---

## Summary

### 新增文件

```
apps/api/
├── prisma/seed-test.ts
├── vitest.config.integration.ts
└── tests/
    ├── integration/
    │   ├── setup.ts
    │   ├── helpers.ts
    │   ├── auth.integration.test.ts
    │   ├── journey-lifecycle.integration.test.ts
    │   ├── community-flow.integration.test.ts
    │   └── moderation-flow.integration.test.ts
    └── data-consistency/
        └── check.ts

docs/superpowers/plans/
└── 2026-03-22-plan-8-frontend-checklist.md
```

### 修改文件

- `apps/api/package.json` — 添加 `test:unit`、`test:integration`、`test:all`、`check:consistency` scripts，以及 supertest 依赖

### 验收标准

| 项目 | 标准 |
|------|------|
| 单元测试 | 18 个文件，全部 PASS，0 FAIL |
| API 集成测试 | 4 个文件，全部 PASS（需 TEST_DATABASE_URL 已配置）|
| 数据一致性检查 | 3 项全部 ✓ 通过，exit code 0 |
| 手动前端测试 | A1-E6 全部标记 `[x]`，F 系列按需 |
