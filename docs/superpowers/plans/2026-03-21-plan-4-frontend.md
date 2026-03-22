# Plan 4: 前端工作台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 Next.js 前端应用（`apps/web/`），实现旅程工作台（Journey Canvas）核心功能，包含 PC 三栏布局、移动端四底栏导航、AI 对话区、候选车型管理，并对接已有 API（port 3000）。

**Tech Stack:** Next.js 14 (App Router) + TypeScript + TailwindCSS + ShadcnUI（可选）

---

## 架构说明

### 技术选型决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Router | App Router | 支持 Server Components，利于 SEO |
| 状态管理 | Zustand | 轻量，适合旅程状态 + 对话状态 |
| API 请求 | SWR + fetch | 自动缓存 + 失效，适合实时数据 |
| 样式 | TailwindCSS | 与设计稿对齐快，响应式友好 |
| 认证 | JWT Cookie | 与 API 的 JWT 认证对齐，存 httpOnly cookie |

### 页面结构

```
/                   → 落地页 / 旅程引导（游客可访问）
/login              → 登录页（手机OTP + 微信OAuth入口）
/journey            → 旅程工作台（需登录）
/community          → 社区广场（Plan 6，本计划仅占位）
/profile            → 我的（Plan 6，本计划仅占位）
```

### API 客户端约定

所有请求通过 `src/lib/api.ts` 封装，统一处理：
- Base URL：`NEXT_PUBLIC_API_URL`（开发环境默认 `http://localhost:3000`）
- 认证：从 Cookie 读取 JWT，附加到 `Authorization: Bearer` header
- 错误处理：401 → 跳转 `/login`，其他错误显示 toast

---

## 文件结构

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 根布局，全局 providers
│   │   ├── page.tsx                    # 落地页
│   │   ├── login/
│   │   │   └── page.tsx                # 登录页
│   │   └── journey/
│   │       ├── layout.tsx              # 三栏布局（PC）/ 底栏导航（移动端）
│   │       └── page.tsx                # 旅程工作台主页
│   ├── components/
│   │   ├── journey/
│   │   │   ├── StageProgress.tsx       # 左栏：5阶段进度
│   │   │   ├── Kanban.tsx              # 中栏：看板主体
│   │   │   ├── TodayUpdates.tsx        # 今日新动态卡片列表
│   │   │   ├── AiSummary.tsx           # AI历程摘要
│   │   │   ├── CandidateList.tsx       # 候选车型卡片列表
│   │   │   ├── CandidateCard.tsx       # 单个候选车型卡片
│   │   │   └── ComparisonMatrix.tsx    # 对比矩阵（≥2候选时展示）
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx           # 右栏：AI对话面板
│   │   │   ├── MessageList.tsx         # 消息列表
│   │   │   ├── MessageBubble.tsx       # 单条消息气泡
│   │   │   └── ChatInput.tsx           # 输入框 + 发送
│   │   ├── auth/
│   │   │   ├── OtpForm.tsx             # 手机OTP表单
│   │   │   └── WechatLoginButton.tsx   # 微信OAuth按钮（占位）
│   │   └── ui/
│   │       ├── LoadingSpinner.tsx
│   │       └── Toast.tsx
│   ├── lib/
│   │   ├── api.ts                      # API 客户端封装
│   │   ├── auth.ts                     # JWT 读写 Cookie 工具
│   │   └── behavior.ts                 # 行为事件埋点工具
│   ├── store/
│   │   ├── journey.store.ts            # Zustand: 旅程状态
│   │   └── chat.store.ts               # Zustand: 对话状态
│   ├── hooks/
│   │   ├── useJourney.ts               # SWR hook: 获取当前旅程
│   │   ├── useSnapshot.ts              # SWR hook: 获取最新快照
│   │   ├── useNotifications.ts         # SWR hook: 获取通知列表
│   │   └── useCandidates.ts            # SWR hook: 获取候选车型
│   └── types/
│       └── api.ts                      # API 响应类型定义
├── public/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Task 1: 项目初始化

**目标：** 在 `apps/web/` 创建 Next.js 项目，配置开发环境和基础依赖。

**Files:**
- Create: `apps/web/`（整个 Next.js 项目）
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/auth.ts`

**步骤：**

- [ ] **Step 1:** 在 `apps/web/` 目录创建 Next.js 项目：
  - 框架：Next.js 14，App Router
  - 语言：TypeScript
  - 样式：TailwindCSS
  - 清理默认模板内容

- [ ] **Step 2:** 安装额外依赖：
  - `zustand` — 状态管理
  - `swr` — 数据请求
  - `js-cookie` — Cookie 读写
  - `@types/js-cookie`

- [ ] **Step 3:** 创建 `src/lib/api.ts`，封装 API 客户端：
  - 读取 `NEXT_PUBLIC_API_URL` 环境变量（开发默认 `http://localhost:3000`）
  - 自动附加 `Authorization: Bearer <token>` header
  - 统一错误处理（401 跳转登录，其他抛出错误）
  - 导出 `get()`, `post()`, `patch()`, `del()` 方法

- [ ] **Step 4:** 创建 `src/lib/auth.ts`，处理 JWT token 的存储（Cookie，key: `newcar_token`）和读取。

- [ ] **Step 5:** 创建 `.env.local.example`，列出所需环境变量：
  - `NEXT_PUBLIC_API_URL=http://localhost:3000`

- [ ] **Step 6:** 验证：`npm run dev` 启动无报错，访问 `http://localhost:3001`（端口可自定义）返回页面。

- [ ] **Step 7:** Commit

```
git commit -m "feat: initialize Next.js frontend app"
```

---

## Task 2: 认证页面

**目标：** 实现手机 OTP 登录页，登录后跳转旅程工作台。

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/components/auth/OtpForm.tsx`
- Create: `apps/web/src/components/auth/WechatLoginButton.tsx`

**步骤：**

- [ ] **Step 1:** 创建登录页 `app/login/page.tsx`，包含 OTP 表单和微信 OAuth 按钮区域。

- [ ] **Step 2:** 创建 `OtpForm.tsx`，实现两步交互：
  - 第一步：输入手机号 → 调用 `POST /auth/otp/send`
  - 第二步：输入6位验证码 → 调用 `POST /auth/otp/verify`
  - 登录成功后将 JWT token 写入 Cookie，跳转 `/journey`

- [ ] **Step 3:** 创建 `WechatLoginButton.tsx`（占位），展示按钮但显示"暂不支持"提示（微信 OAuth 需要小程序环境）。

- [ ] **Step 4:** 在 `apps/web/src/app/journey/layout.tsx` 中添加认证守卫：未登录时重定向到 `/login`。

- [ ] **Step 5:** 验证：访问 `/login` → 输入手机号 → 发送验证码 → 输入验证码 → 跳转 `/journey`。

- [ ] **Step 6:** Commit

```
git commit -m "feat: add OTP login page and auth guard"
```

---

## Task 3: 旅程工作台布局

**目标：** 实现 PC 三栏布局（左：阶段进度，中：看板，右：AI对话）和移动端四底栏导航。

**Files:**
- Create: `apps/web/src/app/journey/layout.tsx`
- Create: `apps/web/src/app/journey/page.tsx`
- Create: `apps/web/src/components/journey/StageProgress.tsx`
- Create: `apps/web/src/components/chat/ChatPanel.tsx`

**布局规格：**

```
PC（≥1024px）：
┌─────────────┬──────────────────────┬──────────────┐
│  左栏 240px  │     中栏 flex-1      │  右栏 360px  │
│ StageProgress│       Kanban         │  ChatPanel   │
└─────────────┴──────────────────────┴──────────────┘

移动端（<1024px）：
┌──────────────────────────────────┐
│        主内容区（全宽）          │
│（旅程/AI/社区/我的，按底栏切换）  │
└──────────────────────────────────┘
│ 我的旅程 │ AI助手 │  社区  │  我的 │ ← 四底栏导航
```

**步骤：**

- [ ] **Step 1:** 在 `apps/web/src/app/journey/layout.tsx` 中实现响应式三栏/底栏布局结构，使用 TailwindCSS 的 `lg:flex` 实现 PC 三栏，移动端底栏使用固定定位 `fixed bottom-0`。

- [ ] **Step 2:** 创建 `StageProgress.tsx`（左栏），展示5个旅程阶段：
  - 阶段图标 + 名称（需求确认 / 候选筛选 / 深度对比 / 决策强化 / 购买执行）
  - 当前阶段高亮，已完成阶段显示对勾
  - 底部：「发布历程」按钮（暂时点击无反应，Plan 6 实现）
  - 数据来源：`Journey.stage`

- [ ] **Step 3:** 创建 `ChatPanel.tsx`（右栏），框架结构：
  - 顶部：标题「AI 购车助手」
  - 中部：消息列表区域（Task 5 填充）
  - 底部：输入框（Task 5 填充）
  - 移动端：作为「AI助手」底栏 Tab 的内容

- [ ] **Step 4:** 创建 `apps/web/src/app/journey/page.tsx`（中栏 Kanban 入口），引用各看板模块（Task 4 填充）。

- [ ] **Step 5:** 验证：PC 浏览器打开 `/journey` 能看到三栏布局，移动端能看到底栏导航。

- [ ] **Step 6:** Commit

```
git commit -m "feat: add journey workspace three-panel layout"
```

---

## Task 4: 看板主体（Kanban）

**目标：** 实现中栏四个模块：今日新动态、AI历程摘要、候选车型卡片列表、对比矩阵。

**Files:**
- Create: `apps/web/src/components/journey/Kanban.tsx`
- Create: `apps/web/src/components/journey/TodayUpdates.tsx`
- Create: `apps/web/src/components/journey/AiSummary.tsx`
- Create: `apps/web/src/components/journey/CandidateList.tsx`
- Create: `apps/web/src/components/journey/CandidateCard.tsx`
- Create: `apps/web/src/components/journey/ComparisonMatrix.tsx`
- Create: `apps/web/src/hooks/useJourney.ts`
- Create: `apps/web/src/hooks/useSnapshot.ts`
- Create: `apps/web/src/hooks/useNotifications.ts`
- Create: `apps/web/src/hooks/useCandidates.ts`

**数据 Hooks：**

| Hook | API | 刷新策略 |
|------|-----|--------|
| `useJourney()` | `GET /journeys`（取第一条 ACTIVE） | 手动刷新 |
| `useSnapshot(journeyId)` | `GET /snapshots/:id/snapshot` | 每5分钟 |
| `useNotifications()` | `GET /notifications` | 每2分钟 |
| `useCandidates(journeyId)` | `GET /journeys/:id/candidates` | 手动刷新 |

**组件规格：**

**TodayUpdates.tsx**
- 展示来自 `NotificationFeed` 的未读通知
- 每条通知：图标（按 type 区分）+ 标题 + 描述 + 时间
- 点击标记已读（调用 `PATCH /notifications/:id/read`）
- 无通知时显示「今日暂无新动态」

**AiSummary.tsx**
- 展示最新 `JourneySnapshot.narrativeSummary`（100-200字自然语言）
- 展示 `key_insights`（最多3条，带置信度标签）
- 展示 `next_suggested_actions`（最多3条建议操作）
- 右上角：「刷新快照」按钮（调用 `POST /snapshots/:id/snapshot?trigger=MANUAL`）
- 无快照时显示「正在生成首次旅程摘要...」

**CandidateCard.tsx**
- 展示：品牌 + 车型 + 价格 + 状态标签（活跃/淘汰/已选）
- 操作按钮：「淘汰」（调用 `PATCH .../candidates/:id`，status=ELIMINATED）/ 「选定」（调用 markAsWinner）
- aiMatchScore 进度条（0-100%）
- 点击展开用户备注（可编辑）

**ComparisonMatrix.tsx**
- 候选车型 ≥ 2 时展示
- 列：每个 ACTIVE 候选车型
- 行：价格 / 车型类别 / 燃油类型 / AI匹配分 / 用户评分
- 数据来源：候选车型的 car 基础信息

**步骤：**

- [ ] **Step 1:** 创建 4 个数据 Hooks（使用 SWR），封装对应 API 调用。

- [ ] **Step 2:** 创建 `TodayUpdates.tsx`，对接 `useNotifications()`。

- [ ] **Step 3:** 创建 `AiSummary.tsx`，对接 `useSnapshot(journeyId)`。

- [ ] **Step 4:** 创建 `CandidateCard.tsx` 和 `CandidateList.tsx`，对接 `useCandidates(journeyId)`。

- [ ] **Step 5:** 创建 `ComparisonMatrix.tsx`，从 candidates 中提取 car 字段渲染对比表格。

- [ ] **Step 6:** 创建 `Kanban.tsx`，按顺序组合四个模块（TodayUpdates → AiSummary → CandidateList/ComparisonMatrix）。

- [ ] **Step 7:** 在 `journey/page.tsx` 引用 Kanban。

- [ ] **Step 8:** 验证：工作台中栏能显示动态、摘要、候选车型卡片。

- [ ] **Step 9:** Commit

```
git commit -m "feat: add journey kanban with updates, snapshot, and candidates"
```

---

## Task 5: AI 对话区

**目标：** 实现右栏 AI 对话面板，支持多轮对话，显示历史消息，实时发送/接收。

**Files:**
- Create: `apps/web/src/components/chat/MessageList.tsx`
- Create: `apps/web/src/components/chat/MessageBubble.tsx`
- Create: `apps/web/src/components/chat/ChatInput.tsx`
- Create: `apps/web/src/store/chat.store.ts`
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`

**对话流程：**

1. 页面加载时，调用 `GET /journeys/:id/conversations` 获取最近一条 Conversation
2. 将 `Conversation.messages` 渲染为消息列表
3. 用户输入消息，调用 `POST /journeys/:id/chat`（AI对话接口）
4. 收到响应后，将新消息追加到列表
5. AI 回复中如有工具调用结果（如车型推荐），展示为结构化卡片

**Zustand Store（chat.store.ts）：**
- `messages[]` — 当前对话消息列表
- `conversationId` — 当前 Conversation ID
- `isLoading` — 是否等待 AI 回复
- `addMessage(msg)` — 追加消息
- `setLoading(bool)` — 设置加载状态
- `loadHistory(journeyId)` — 加载历史消息

**步骤：**

- [ ] **Step 1:** 创建 `chat.store.ts`（Zustand），定义 messages 状态和操作方法。

- [ ] **Step 2:** 创建 `MessageBubble.tsx`，区分 user / assistant 消息样式（用户靠右，AI靠左）。

- [ ] **Step 3:** 创建 `MessageList.tsx`，渲染消息列表，自动滚动到底部，显示加载中状态。

- [ ] **Step 4:** 创建 `ChatInput.tsx`，支持：
  - 多行文本输入（Shift+Enter 换行，Enter 发送）
  - 发送时禁用输入框（loading 状态）
  - 发送逻辑：调用 `POST /journeys/:id/chat`，写入 store

- [ ] **Step 5:** 更新 `ChatPanel.tsx`，组合 MessageList + ChatInput，页面加载时调用 `loadHistory(journeyId)`。

- [ ] **Step 6:** 验证：能发消息，AI 能回复，消息显示在对话区。

- [ ] **Step 7:** Commit

```
git commit -m "feat: add AI chat panel with message history"
```

---

## Task 6: 行为事件埋点

**目标：** 在用户浏览行为发生时，自动上报 BehaviorEvent，支持 AI Pipeline 的行为信号采集。

**Files:**
- Create: `apps/web/src/lib/behavior.ts`

**需要埋点的行为：**

| 事件类型 | 触发时机 | metadata |
|----------|---------|---------|
| `PAGE_VIEW` | 进入旅程工作台 | `{ page: 'journey' }` |
| `CAR_VIEW` | 展开/点击候选车型卡片 | `{ carId, duration_sec }` |
| `COMPARISON_OPEN` | 打开对比矩阵 | `{ candidateCount }` |
| `PRICE_CHECK` | 查看价格详情 | `{ carId }` |

**埋点工具（behavior.ts）：**
- `trackEvent(type, targetType, targetId, metadata)` — 发送 `POST /journeys/:id/events`
- 使用 `sessionId`（从 localStorage 读取，不存在则生成 UUID 并存入）
- 异步发送，失败静默忽略（不影响用户体验）

**步骤：**

- [ ] **Step 1:** 创建 `src/lib/behavior.ts`，封装埋点工具，管理 sessionId。

- [ ] **Step 2:** 在 `CandidateCard.tsx` 中，组件挂载时调用 `trackEvent('CAR_VIEW', 'CAR', carId)`。

- [ ] **Step 3:** 在 `ComparisonMatrix.tsx` 中，展示时调用 `trackEvent('COMPARISON_OPEN', ...)`。

- [ ] **Step 4:** 在 `journey/page.tsx` 中，页面加载时调用 `trackEvent('PAGE_VIEW', ...)`。

- [ ] **Step 5:** 验证：操作后在 API 端能看到 `/journeys/:id/events` 有新记录写入。

- [ ] **Step 6:** Commit

```
git commit -m "feat: add behavior event tracking for AI pipeline"
```

---

## Task 7: 新建旅程流程

**目标：** 用户首次进入（无 ACTIVE 旅程时）展示新建旅程引导，通过 AI 对话收集需求创建旅程。

**Files:**
- Create: `apps/web/src/components/journey/NewJourneyWizard.tsx`
- Modify: `apps/web/src/app/journey/page.tsx`

**流程：**

1. 进入 `/journey`，调用 `GET /journeys` 检查是否有 ACTIVE 旅程
2. 有旅程 → 直接展示工作台
3. 无旅程 → 展示 `NewJourneyWizard`
4. Wizard 通过对话收集：旅程标题（用车需求一句话概括）、预算、用车场景、燃油偏好
5. 表单提交调用 `POST /journeys`（requirements 字段）
6. 创建成功后跳转到工作台

**步骤：**

- [ ] **Step 1:** 创建 `NewJourneyWizard.tsx`，展示简单的表单引导（非对话式，保持简单）：
  - 标题：「开始你的购车旅程」
  - 字段：旅程标题（文本）、预算范围（滑动器或下拉）、用车场景（多选标签）、燃油类型偏好（多选标签）
  - 提交按钮：「开始旅程」

- [ ] **Step 2:** 在 `journey/page.tsx` 中根据旅程状态条件渲染 Wizard 或工作台。

- [ ] **Step 3:** 验证：未有旅程时看到 Wizard，填写后创建旅程并进入工作台。

- [ ] **Step 4:** Commit

```
git commit -m "feat: add new journey creation wizard"
```

---

## Dependencies

- Task 1（初始化）→ Task 2（认证）→ Task 3（布局）→ Task 4（看板）→ Task 5（对话）→ Task 6（埋点）
- Task 7 独立于 Task 5/6，依赖 Task 3

---

## Summary of New Files

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   └── journey/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── components/
│   │   ├── auth/OtpForm.tsx
│   │   ├── auth/WechatLoginButton.tsx
│   │   ├── journey/
│   │   │   ├── StageProgress.tsx
│   │   │   ├── Kanban.tsx
│   │   │   ├── TodayUpdates.tsx
│   │   │   ├── AiSummary.tsx
│   │   │   ├── CandidateList.tsx
│   │   │   ├── CandidateCard.tsx
│   │   │   ├── ComparisonMatrix.tsx
│   │   │   └── NewJourneyWizard.tsx
│   │   └── chat/
│   │       ├── ChatPanel.tsx
│   │       ├── MessageList.tsx
│   │       ├── MessageBubble.tsx
│   │       └── ChatInput.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── behavior.ts
│   ├── store/
│   │   ├── journey.store.ts
│   │   └── chat.store.ts
│   └── hooks/
│       ├── useJourney.ts
│       ├── useSnapshot.ts
│       ├── useNotifications.ts
│       └── useCandidates.ts
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Verification

```bash
# 启动 API
cd apps/api && npm run dev

# 启动前端
cd apps/web && npm run dev

# 验证页面
# - /login → 手机OTP登录流程
# - /journey → 三栏布局（PC）/ 底栏导航（移动端）
# - 三栏：阶段进度 | 今日动态+AI摘要+候选车型 | AI对话
# - 候选车型卡片：展示、淘汰、选定操作
# - AI 对话：发消息 → AI 回复
# - 行为埋点：操作后 API 有 BehaviorEvent 记录
```
