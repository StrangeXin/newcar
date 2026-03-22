# Plan 6: 社区系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现社区系统全链路——旅程发布（AI生成三种呈现形式）、社区广场（浏览/筛选/排序）、「从此出发」（继承模板创建新旅程）、互动功能（点赞/评论/收藏）、内容审核（AI预审 + 人工队列）。

**Tech Stack:** Node.js API + Next.js 前端 + existing Prisma（PublishedJourney、JourneyFork 表已就绪）

---

## 架构说明

### 社区内容生命周期

```
旅程（Journey）
    │
    └─ 用户点击「发布历程」
            │
            ├── AI 生成三种形式（story / report / template）
            │       └── AI 预审（检测违禁词、虚假信息、广告）
            │               ├── 通过 → 直接发布（PublishedJourney.contentStatus = LIVE）
            │               └── 标记 → 进入人工审核队列
            │
            └── PublishedJourney 写入（visibility = PUBLIC / UNLISTED）
```

### 三种呈现形式

| 形式 | 字段 | 说明 |
|------|------|------|
| `story` | `storyContent` | AI第一人称叙事文章（情感化，适合分享） |
| `report` | `reportData` | 结构化对比报告（用户画像+车型矩阵+评分） |
| `template` | `templateData` | 可复用框架（对比维度+权重+候选池+必问清单） |

用户可选择发布哪些形式（至少一种），存入 `publishedFormats`。

### 排序公式

```
score = (fork_count × 3.0 + like_count × 1.0 + comment_count × 1.5 + view_count × 0.1)
        × relevance_boost(viewer_journey)

relevance_boost（有活跃旅程时）=
  budget_overlap × 0.4 + use_case_overlap × 0.4 + fuel_type_overlap × 0.2 + 1.0
  最大值 2.0
```

冷启动期（内容 < 500 条）：按发布时间倒序兜底，`relevance_boost` 保留。

### 内容审核流程

```
AI 预审 → 通过 → 直接发布
         → 标记 → 人工队列（contentStatus = PENDING_REVIEW）
                    → 管理员审核 → 通过（LIVE）/ 拒绝（REJECTED）
```

---

## 文件结构

### API 端（`apps/api/src/`）

```
controllers/
├── published-journey.controller.ts   # 新建
├── community.controller.ts           # 新建（广场列表、排序）
└── moderation.controller.ts          # 新建（审核队列）

routes/
├── published-journeys.ts             # 新建
├── community.ts                      # 新建
└── moderation.ts                     # 新建

services/
├── publish.service.ts                # 新建（发布流程 + AI内容生成）
├── community.service.ts              # 新建（排序、筛选、relevance_boost）
├── moderation.service.ts             # 新建（AI预审、人工队列）
└── fork.service.ts                   # 新建（「从此出发」逻辑）
```

### 前端端（`apps/web/src/`）

```
app/
├── community/
│   ├── page.tsx                      # 社区广场列表页
│   └── [id]/
│       └── page.tsx                  # 历程详情页（三种形式 Tab）
└── journey/
    └── (existing)/
        └── publish/
            └── page.tsx              # 发布历程页

components/
├── community/
│   ├── JourneyFeedList.tsx           # 历程卡片列表
│   ├── JourneyFeedCard.tsx           # 单张历程卡片
│   ├── FeedFilters.tsx               # 筛选栏
│   ├── JourneyDetail/
│   │   ├── StoryView.tsx             # 叙事故事视图
│   │   ├── ReportView.tsx            # 结构化报告视图
│   │   └── TemplateView.tsx          # 可复用模板视图
│   └── ForkButton.tsx                # 「从此出发」按钮
└── publish/
    ├── PublishWizard.tsx             # 发布向导（选择形式 + 预览）
    └── FormatSelector.tsx            # 三种形式选择器

hooks/
├── useCommunity.ts                   # SWR: 社区列表
└── usePublishedJourney.ts            # SWR: 历程详情
```

---

## Task 1: 发布历程 API（后端）

**目标：** 实现「发布历程」后端流程——AI 生成三种呈现形式内容、AI 预审、写入 PublishedJourney。

**Files:**
- Create: `apps/api/src/services/publish.service.ts`
- Create: `apps/api/src/services/moderation.service.ts`
- Create: `apps/api/src/controllers/published-journey.controller.ts`
- Create: `apps/api/src/routes/published-journeys.ts`
- Modify: `apps/api/src/app.ts`

**API 接口：**

| Method | Path | 认证 | 描述 |
|--------|------|------|------|
| POST | `/journeys/:id/publish` | 需要 | 发布旅程（AI生成内容 + 审核） |
| GET | `/journeys/:id/publish/preview` | 需要 | 预览生成内容（不写入） |
| PATCH | `/published-journeys/:id` | 需要 | 更新发布设置（visibility、publishedFormats） |
| DELETE | `/published-journeys/:id` | 需要 | 下架历程 |
| GET | `/published-journeys/:id` | 公开 | 获取已发布历程详情 |

**POST /journeys/:id/publish Request Body：**
```json
{
  "title": "string",
  "description": "string（可选）",
  "publishedFormats": ["story", "report", "template"],  // 至少一种
  "visibility": "PUBLIC | UNLISTED"
}
```

**publish.service.ts 核心方法：**

| 方法 | 说明 |
|------|------|
| `generateStory(journey, snapshot)` | AI生成第一人称叙事（500-1000字）|
| `generateReport(journey, candidates)` | AI生成结构化报告（用户画像+对比矩阵）|
| `generateTemplate(journey, candidates)` | 提取可复用框架（不含个人判断）|
| `publishJourney(journeyId, options)` | 主流程：生成 → 审核 → 写入 |

**AI 提示词要点（不含具体提示词，只写约束）：**
- story：第一人称、有情感弧线、不超过 1000 字、结尾包含购买结论
- report：结构化 JSON、包含决策置信度（float 0-1）、对比维度客观中立
- template：只保留通用框架，剔除"我觉得"等主观判断

**moderation.service.ts 核心方法：**

| 方法 | 说明 |
|------|------|
| `preReview(content)` | AI预审：检测违禁词、虚假信息模式、商业推广 |
| `getReviewQueue(page, limit)` | 获取待人工审核列表 |
| `approveContent(publishedJourneyId)` | 审核通过 → status = LIVE |
| `rejectContent(publishedJourneyId, reason)` | 审核拒绝 → status = REJECTED |

**步骤：**

- [ ] **Step 1:** 创建 `moderation.service.ts`，实现 `preReview(content)` 方法：调用 AI 检测内容合规性，返回 `{ passed: bool, reason?: string }`。

- [ ] **Step 2:** 创建 `publish.service.ts`，实现三种内容生成方法（各调用一次 AI），以及 `publishJourney()` 主流程：生成所选形式内容 → 调用 `preReview` → 写入 PublishedJourney（通过则 LIVE，否则 PENDING_REVIEW）。

- [ ] **Step 3:** 创建 `published-journey.controller.ts`，处理发布、预览、更新、下架等接口。

- [ ] **Step 4:** 创建 `published-journeys.ts` 路由，注册接口，并在 `app.ts` 挂载。

- [ ] **Step 5:** 写测试 `apps/api/tests/publish.test.ts`：
  - 验证 publishedFormats 至少一种
  - 验证 AI 预审通过时 contentStatus = LIVE
  - 验证 AI 预审标记时 contentStatus = PENDING_REVIEW

- [ ] **Step 6:** Commit

```
git commit -m "feat: add journey publish service with AI content generation"
```

---

## Task 2: 社区广场 API（后端）

**目标：** 实现社区列表查询，支持筛选、排序（含 relevance_boost）、分页，以及「从此出发」接口。

**Files:**
- Create: `apps/api/src/services/community.service.ts`
- Create: `apps/api/src/services/fork.service.ts`
- Create: `apps/api/src/controllers/community.controller.ts`
- Create: `apps/api/src/routes/community.ts`
- Modify: `apps/api/src/app.ts`

**API 接口：**

| Method | Path | 认证 | 描述 |
|--------|------|------|------|
| GET | `/community` | 公开 | 社区广场列表（筛选+排序+分页） |
| GET | `/community/:id` | 公开 | 历程详情（增加 view_count） |
| POST | `/community/:id/like` | 需要 | 点赞 |
| DELETE | `/community/:id/like` | 需要 | 取消点赞 |
| POST | `/community/:id/fork` | 需要 | 「从此出发」 |
| GET | `/community/:id/comments` | 公开 | 评论列表 |
| POST | `/community/:id/comments` | 需要 | 发表评论 |

**GET /community 查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `car_ids` | string[] | 包含指定车型 |
| `budget_min` / `budget_max` | number | 预算范围（万元） |
| `fuel_type` | string | BEV/PHEV/HEV/ICE |
| `use_cases` | string[] | 用车场景 |
| `result` | string | purchased / in_progress |
| `has_template` | bool | 仅展示有模板形式的历程（可「从此出发」） |
| `sort` | relevance / latest / popular | 排序方式（默认 relevance） |
| `limit` / `offset` | number | 分页 |

**community.service.ts 排序逻辑：**
- `sort=relevance`：计算 relevance_boost（需传入 viewer 的 journey requirements），按 score 降序
- `sort=latest`：按 publishedAt 降序
- `sort=popular`：按 fork×3 + like×1 + comment×1.5 + view×0.1 降序
- 冷启动判断：总内容 < 500 条时，relevance 排序回退到 latest

**fork.service.ts 核心逻辑（「从此出发」）：**

1. 验证：来源 PublishedJourney 的 `publishedFormats` 包含 `template`
2. 验证：当前用户无 ACTIVE 旅程（每用户同时只能有一条 ACTIVE 旅程）
3. 创建新 Journey，设置 `templateSourceId`，从 template 继承 `requirements` 框架
4. 批量创建 CarCandidate（从 `templateData.candidate_car_ids` 导入，addedReason = FROM_TEMPLATE）
5. 写入 JourneyFork 记录
6. `PublishedJourney.fork_count` +1
7. 返回新 Journey ID

**步骤：**

- [ ] **Step 1:** 创建 `community.service.ts`，实现 `listJourneys(params, viewerJourneyId?)` 和 `getJourneyDetail(id)` 方法，包含完整排序和筛选逻辑。

- [ ] **Step 2:** 创建 `fork.service.ts`，实现 `forkJourney(sourcePublishedJourneyId, userId)` 方法，包含所有验证和创建步骤。

- [ ] **Step 3:** 创建 `community.controller.ts` 和 `community.ts` 路由，注册所有接口。

- [ ] **Step 4:** 写测试 `apps/api/tests/community.test.ts`：
  - 验证 relevance_boost 计算公式
  - 验证 fork 时的验证逻辑（非 template 形式不可 fork，有 ACTIVE 旅程不可 fork）
  - 验证 fork 后 fork_count +1

- [ ] **Step 5:** Commit

```
git commit -m "feat: add community feed API with relevance sorting and fork"
```

---

## Task 3: 内容审核管理 API（后端）

**目标：** 提供管理员操作审核队列的接口。

**Files:**
- Create: `apps/api/src/controllers/moderation.controller.ts`
- Create: `apps/api/src/routes/moderation.ts`
- Modify: `apps/api/src/app.ts`

**API 接口（需要 ADMIN 或 EDITOR 角色）：**

| Method | Path | 角色 | 描述 |
|--------|------|------|------|
| GET | `/admin/moderation/queue` | ADMIN/EDITOR | 获取待审核列表 |
| POST | `/admin/moderation/:id/approve` | ADMIN/EDITOR | 审核通过 |
| POST | `/admin/moderation/:id/reject` | ADMIN/EDITOR | 审核拒绝 |
| POST | `/admin/moderation/:id/feature` | ADMIN | 设为精选（featured=true） |
| POST | `/community/:id/report` | 需要登录 | 用户举报 |

**角色检查中间件：** 在 `authMiddleware` 基础上，新增 `requireRole(roles[])` 中间件，读取 `User.role` 验证权限。

**步骤：**

- [ ] **Step 1:** 在 `apps/api/src/middleware/` 创建 `role.middleware.ts`，实现 `requireRole(['ADMIN', 'EDITOR'])` 中间件。

- [ ] **Step 2:** 创建 `moderation.controller.ts` 和 `moderation.ts` 路由，注册审核接口（使用 `requireRole` 中间件保护）。

- [ ] **Step 3:** 在 `community.ts` 路由中添加 `POST /community/:id/report` 接口（普通用户可用），写入举报记录（暂存 `NotificationFeed`，type = `USER_REPORT`）。

- [ ] **Step 4:** Commit

```
git commit -m "feat: add content moderation API with role-based access"
```

---

## Task 4: 发布历程前端

**目标：** 在旅程工作台添加「发布历程」入口，引导用户选择发布形式、预览生成内容、确认发布。

**Files:**
- Create: `apps/web/src/app/journey/publish/page.tsx`
- Create: `apps/web/src/components/publish/PublishWizard.tsx`
- Create: `apps/web/src/components/publish/FormatSelector.tsx`
- Modify: `apps/web/src/components/journey/StageProgress.tsx`（激活「发布历程」按钮）

**发布向导流程（3步）：**

```
Step 1: 选择发布形式
  ☑ 叙事故事（Narrative Story）— 适合分享朋友圈
  ☑ 结构化报告（Structured Report）— 适合有同类需求的人参考
  ☐ 可复用模板（Reusable Template）— 他人可「从此出发」

Step 2: 预览生成内容
  → 调用 GET /journeys/:id/publish/preview
  → 展示各选中形式的预览（AI生成）
  → 用户可修改标题和简介

Step 3: 选择可见性并确认发布
  → PUBLIC（所有人可见）/ UNLISTED（仅有链接可见）
  → 确认 → 调用 POST /journeys/:id/publish
  → 成功后跳转到已发布页面
```

**步骤：**

- [ ] **Step 1:** 激活 `StageProgress.tsx` 中的「发布历程」按钮，点击跳转 `/journey/publish`。

- [ ] **Step 2:** 创建 `FormatSelector.tsx`，展示三种形式的说明卡片（可勾选，至少选一个）。

- [ ] **Step 3:** 创建 `PublishWizard.tsx`，实现三步向导，包含预览加载状态（AI 生成可能需要几秒）。

- [ ] **Step 4:** 创建 `app/journey/publish/page.tsx`，挂载 `PublishWizard`。

- [ ] **Step 5:** 验证：点击「发布历程」→ 选择形式 → 看到预览 → 确认发布 → 跳转到社区页面。

- [ ] **Step 6:** Commit

```
git commit -m "feat: add journey publish wizard in frontend"
```

---

## Task 5: 社区广场前端

**目标：** 实现社区广场页面，包含历程卡片列表、筛选栏、「从此出发」按钮，以及历程详情页的三种 Tab 视图。

**Files:**
- Create: `apps/web/src/app/community/page.tsx`
- Create: `apps/web/src/app/community/[id]/page.tsx`
- Create: `apps/web/src/components/community/JourneyFeedList.tsx`
- Create: `apps/web/src/components/community/JourneyFeedCard.tsx`
- Create: `apps/web/src/components/community/FeedFilters.tsx`
- Create: `apps/web/src/components/community/JourneyDetail/StoryView.tsx`
- Create: `apps/web/src/components/community/JourneyDetail/ReportView.tsx`
- Create: `apps/web/src/components/community/JourneyDetail/TemplateView.tsx`
- Create: `apps/web/src/components/community/ForkButton.tsx`
- Create: `apps/web/src/hooks/useCommunity.ts`

**JourneyFeedCard 包含：**
- 用户昵称 + 纠结时长（startedAt → completedAt/now）+ 最终结果标签
- AI 一句话摘要（`description`）
- 车型/预算/场景标签
- 互动数据：👍 赞数 / 💬 评论数 / 🔀 从此出发次数
- 状态标签：「已购车」或「进行中」
- 「从此出发 →」按钮（仅当 `publishedFormats` 包含 `template` 时显示）

**FeedFilters 筛选维度：**
- 燃油类型（BEV / PHEV / HEV / ICE 多选标签）
- 预算范围（15万以下 / 15-25万 / 25-35万 / 35万以上）
- 用车场景（家用 / 通勤 / 越野 等多选）
- 购车结果（已购车 / 进行中）
- 仅看可「从此出发」的历程（开关）
- 排序：最相关 / 最新 / 最受欢迎

**历程详情页三 Tab：**

| Tab | 组件 | 内容 |
|-----|------|------|
| 叙事故事 | `StoryView` | 渲染 `storyContent` Markdown/富文本 |
| 结构化报告 | `ReportView` | 渲染 `reportData`：用户画像 + 对比矩阵表格 + 评分 |
| 可复用模板 | `TemplateView` | 渲染 `templateData`：维度框架 + 候选车型列表 + 必问清单，底部「从此出发」按钮 |

**步骤：**

- [ ] **Step 1:** 创建 `useCommunity.ts` Hook，封装 `GET /community` 请求（支持筛选参数）。

- [ ] **Step 2:** 创建 `JourneyFeedCard.tsx` 和 `JourneyFeedList.tsx`。

- [ ] **Step 3:** 创建 `FeedFilters.tsx`，状态用 URL query params 管理（支持分享链接带筛选条件）。

- [ ] **Step 4:** 创建 `app/community/page.tsx`，组合 FeedFilters + JourneyFeedList，支持无限滚动或分页。

- [ ] **Step 5:** 创建三种详情视图组件（StoryView / ReportView / TemplateView）。

- [ ] **Step 6:** 创建 `ForkButton.tsx`，点击调用 `POST /community/:id/fork`，成功后跳转新旅程工作台。

- [ ] **Step 7:** 创建 `app/community/[id]/page.tsx`，展示三 Tab 详情，右上角点赞按钮。

- [ ] **Step 8:** 激活 `apps/web/src/app/journey/layout.tsx` 底栏「社区」Tab，跳转 `/community`。

- [ ] **Step 9:** 验证：
  - 社区广场能展示历程卡片列表（需要先有种子发布内容）
  - 筛选功能正常
  - 点击卡片进入详情页，三 Tab 切换正常
  - 「从此出发」按钮创建新旅程并跳转工作台

- [ ] **Step 10:** Commit

```
git commit -m "feat: add community feed and journey detail pages"
```

---

## Task 6: 种子发布内容

**目标：** 初始化 3-5 条已发布历程（含三种形式），确保社区广场不为空，覆盖主流场景。

**Files:**
- Create: `apps/api/prisma/seed-community.ts`

**种子内容清单（5条）：**

| 场景 | 预算 | 最终选择 | 发布形式 |
|------|------|---------|---------|
| 家用 SUV，二孩家庭 | 25-30万 | 理想 L6 | story + report + template |
| 城市通勤，首购新能源 | 15-20万 | 比亚迪海豹 | story + report |
| 换购，从燃油到纯电 | 20-25万 | 小鹏 G6 | story + template |
| 商务出行，MPV | 30-40万 | 问界 M9 | report + template |
| 农村用车，兼顾越野 | 15万以内 | 比亚迪宋 Pro DM-i | story |

每条种子包含：完整 Journey → PublishedJourney，`contentStatus = LIVE`，`visibility = PUBLIC`。

**步骤：**

- [ ] **Step 1:** 创建 `apps/api/prisma/seed-community.ts`，使用真实 car seed 数据的 carId，创建 5 条完整的 User → Journey → PublishedJourney 记录。

- [ ] **Step 2:** 运行 `ts-node prisma/seed-community.ts`，验证社区广场有内容。

- [ ] **Step 3:** Commit

```
git commit -m "feat: add community seed data with 5 published journeys"
```

---

## Dependencies

- Task 1（发布API）→ Task 4（发布前端）
- Task 2（社区API）→ Task 5（社区前端）
- Task 3（审核API）独立，可与 Task 4/5 并行
- Task 6（种子数据）依赖 Task 1 和 Plan 5 的种子车型数据
- Task 5 前端依赖 Task 6（需要有内容才能验证）

---

## Summary

**新增 API 文件：**
```
apps/api/src/
├── services/
│   ├── publish.service.ts
│   ├── community.service.ts
│   ├── moderation.service.ts
│   └── fork.service.ts
├── controllers/
│   ├── published-journey.controller.ts
│   ├── community.controller.ts
│   └── moderation.controller.ts
├── routes/
│   ├── published-journeys.ts
│   ├── community.ts
│   └── moderation.ts
└── middleware/role.middleware.ts

apps/api/prisma/seed-community.ts
apps/api/tests/publish.test.ts
apps/api/tests/community.test.ts
```

**新增前端文件：**
```
apps/web/src/
├── app/
│   ├── community/page.tsx
│   ├── community/[id]/page.tsx
│   └── journey/publish/page.tsx
├── components/
│   ├── community/
│   │   ├── JourneyFeedList.tsx
│   │   ├── JourneyFeedCard.tsx
│   │   ├── FeedFilters.tsx
│   │   ├── ForkButton.tsx
│   │   └── JourneyDetail/
│   │       ├── StoryView.tsx
│   │       ├── ReportView.tsx
│   │       └── TemplateView.tsx
│   └── publish/
│       ├── PublishWizard.tsx
│       └── FormatSelector.tsx
└── hooks/
    ├── useCommunity.ts
    └── usePublishedJourney.ts
```

**新增 API 端点：**

| Method | Path | 说明 |
|--------|------|------|
| POST | `/journeys/:id/publish` | 发布旅程 |
| GET | `/journeys/:id/publish/preview` | 预览生成内容 |
| PATCH | `/published-journeys/:id` | 更新发布设置 |
| DELETE | `/published-journeys/:id` | 下架历程 |
| GET | `/community` | 社区广场列表 |
| GET | `/community/:id` | 历程详情 |
| POST | `/community/:id/like` | 点赞 |
| DELETE | `/community/:id/like` | 取消点赞 |
| POST | `/community/:id/fork` | 「从此出发」|
| GET | `/community/:id/comments` | 评论列表 |
| POST | `/community/:id/comments` | 发表评论 |
| POST | `/community/:id/report` | 用户举报 |
| GET | `/admin/moderation/queue` | 审核队列 |
| POST | `/admin/moderation/:id/approve` | 审核通过 |
| POST | `/admin/moderation/:id/reject` | 审核拒绝 |
| POST | `/admin/moderation/:id/feature` | 设为精选 |

---

## Verification

```bash
# 运行测试
cd apps/api && npm test

# 验证发布流程
# POST /journeys/:id/publish { publishedFormats: ["story", "template"], visibility: "PUBLIC" }
# 期望: PublishedJourney 写入，contentStatus = LIVE 或 PENDING_REVIEW

# 验证社区广场
# GET /community?fuel_type=BEV&sort=relevance
# 期望: 返回筛选后的历程列表，relevance_boost 正确计算

# 验证「从此出发」
# POST /community/:id/fork
# 期望: 创建新 Journey，CarCandidate 从 template 继承，JourneyFork 记录写入，fork_count +1

# 验证审核
# POST /admin/moderation/:id/approve（需要 ADMIN 角色）
# 期望: contentStatus 更新为 LIVE
```
