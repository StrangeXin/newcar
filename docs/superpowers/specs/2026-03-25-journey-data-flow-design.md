# 旅程数据提取、传递与展示 — 设计文档

**日期**: 2026-03-25
**状态**: 已确认
**方案**: 渐进补链（方案 A）

## 背景

核心功能链路（用户聊天 → AI 提取数据 → 结构化展示）存在多处断裂：AI 添加候选车不带标签/理由、行为信号不影响排序、快照不回写评分、side effect 推送不完整、前端 Mock 模式阻止真实体验。用户感受不到"产品在陪我做决策"。

## 设计原则

- **不为 AI 而做 AI**：AI 是手段，用户要的是"这个产品懂我"，不要暴露分数
- **实时获得感**：聊天中 AI 操作立即反映在看板上
- **阶段节奏感**：不同阶段 UI 重点不同，用户感觉旅程在推进
- **个性化视角**：每个人看到的候选车重点维度不一样

---

## Part 1：数据链路补全

### 1.1 AI Tool Call 增强

`add_candidate` 工具输出新增字段：

- `matchTags: string[]` — 如 `["符合预算", "纯电续航达标", "7座满足家用"]`
- `recommendReason: string` — 如 "这款车在你关注的续航和空间上都很突出"
- `relevantDimensions: string[]` — AI 认为用户最关注的维度，如 `["续航", "空间", "价格"]`

数据库 `CarCandidate` 表新增字段：

```
matchTags         Json[]    -- 匹配标签
recommendReason   String?   -- 推荐理由
relevantDimensions Json[]   -- 用户关注维度
candidateRankScore Float?   -- 排序权重（不展示）
```

### 1.2 TimelineEvent 模型

每次 tool call 成功后自动写入时间线记录：

```
TimelineEvent {
  id            String   @id
  journeyId     String
  type          String   // 枚举见下
  content       String   // 人类可读描述
  metadata      Json     // 关联数据（carId, candidateId 等）
  createdAt     DateTime
}
```

type 枚举值：

| 类型 | 触发时机 |
|------|---------|
| `CANDIDATE_ADDED` | AI 或用户添加候选车 |
| `CANDIDATE_ELIMINATED` | 候选车被淘汰 |
| `CANDIDATE_WINNER` | 候选车被选定 |
| `STAGE_CHANGED` | 阶段推进 |
| `REQUIREMENT_UPDATED` | 需求更新 |
| `AI_INSIGHT` | AI 生成洞察 |
| `PRICE_CHANGE` | 价格变动 |
| `USER_ACTION` | 用户主动操作（浏览、对比等） |
| `PUBLISH_SUGGESTION` | 阶段推进至 DECISION/PURCHASE 时自动生成 |
| `JOURNEY_PUBLISHED` | 旅程发布成功 |

### 1.3 行为信号 → 排序权重

`candidateRankScore` 计算规则：

- 基础分：AI 推荐时给定（0-1）
- 行为加权：浏览时长、对比次数、价格查看次数，按已有 `calculateAiWeight()` 逻辑加权
- 节流：同一候选车 5 分钟内最多重算一次
- 该分数仅用于排序，不展示

### 1.4 Side Effect 推送补全

所有 tool call side effect 统一推送到前端：

- `candidate_added` → 刷新候选车列表 + 追加时间线
- `candidate_eliminated` → 同上
- `journey_updated` → 刷新需求摘要 + 追加时间线
- `stage_changed` → 触发阶段 UI 切换 + 追加时间线
- `ai_insight` → 追加时间线

---

## Part 2：时间线主轴

### 2.1 布局

主区域从 Kanban 三栏改为：**左侧时间线（主轴）+ 右侧候选车面板**。

```
┌─────────────────────────────────┬──────────────────┐
│          时间线 (主轴)            │   候选车面板      │
│                                 │                  │
│ ● 3月25日                       │  理想L6          │
│   AI 推荐了理想L6               │   符合预算·家用   │
│   "符合你25-35万预算，增程..."    │                  │
│                                 │  深蓝S7          │
│ ● 你浏览了深蓝S7 详情 (3分钟)    │   续航达标       │
│                                 │                  │
│ ● AI 洞察                       │  小鹏G6          │
│   "你在续航话题上花了最多时间"    │   待观察         │
│                                 │                  │
│ ● 阶段推进: 考虑期 → 对比期      │                  │
│                                 │                  │
│ ● 每日总结 (3月25日)             │                  │
│   叙事性AI总结...                │                  │
└─────────────────────────────────┴──────────────────┘
```

### 2.2 时间线事件视觉样式

| 类型 | 图标/颜色 | 展示方式 |
|------|----------|---------|
| `CANDIDATE_ADDED` | 车辆图标 | 卡片式，含标签和推荐理由 |
| `CANDIDATE_ELIMINATED` | 淡出样式 | 一行文字 + 淘汰原因 |
| `CANDIDATE_WINNER` | 高亮强调 | 庆祝卡片 |
| `STAGE_CHANGED` | 里程碑标记 | 横跨全宽的分隔条 |
| `REQUIREMENT_UPDATED` | 笔记图标 | 一行文字 |
| `AI_INSIGHT` | AI 气泡 | 带背景色的洞察卡片 |
| `PRICE_CHANGE` | 价格标签 | 一行，含涨跌箭头 |
| `USER_ACTION` | 用户头像 | 一行文字 |

### 2.3 每日总结嵌入时间线

每日快照作为特殊时间线卡片，样式比普通事件更大，含叙事性总结 + 关键洞察 + 下一步建议。

### 2.4 移动端适配

时间线全宽展示，候选车面板变为底部可上拉抽屉（Sheet），通过 tab 切换。

---

## Part 3：候选车个性化展示

### 3.1 卡片改造

```
┌─────────────────────────┐
│ 理想L6  增程 · SUV · 7座  │
│ 29.98万                  │
│                          │
│ 符合预算  家用首选  长续航  │  ← matchTags
│                          │
│ 续航: 1080km ★           │  ← relevantDimensions
│ 空间: 6座独立            │     只展示用户关注的2-3个
│ 能耗: 6.9L/100km         │
│                          │
│ "增程方案兼顾长途和日常，  │  ← recommendReason
│  和你说的周末自驾需求很配" │
│                          │
│ 备注  淘汰  选定           │
└─────────────────────────┘
```

- `matchTags` 标签胶囊展示
- 只展示 `relevantDimensions` 中的 2-3 个参数，从 `car.baseSpecs` 提取
- 维度旁 ★ 标记表示满足需求
- `recommendReason` 引用样式
- 去掉数字进度条

### 3.2 智能排序

1. `WINNER` 置顶
2. `ACTIVE` 按 `candidateRankScore` 降序
3. `ELIMINATED` 折叠收起

### 3.3 对比模式

候选车 ≥ 2 时出现「对比」按钮：

- 只对比 `relevantDimensions` 中的维度
- 每个维度标注哪辆车更优
- AI 生成简短对比总结
- 在候选车面板内切换，不需要新页面

---

## Part 4：阶段驱动 UI

### 4.1 五个阶段的 UI 重点

| 阶段 | 时间线侧重 | 候选车面板侧重 | AI 行为侧重 |
|------|-----------|---------------|-------------|
| AWARENESS 认知期 | 需求澄清事件 | 隐藏或引导语 | 多问需求，少推车 |
| CONSIDERATION 考虑期 | AI 推荐事件增多 | 候选车出现，标签突出 | 主动推荐，解释理由 |
| COMPARISON 对比期 | 对比类洞察 | 对比按钮突出 | 对比分析，帮做取舍 |
| DECISION 决策期 | 决策辅助事件 | 收敛到2-3款 | 明确建议，推动决策 |
| PURCHASE 购买期 | 购买相关事件 | Winner高亮 | 购买指导 |

### 4.2 阶段转换体验

1. 时间线插入里程碑条，横跨全宽
2. 里程碑条含 AI 总结语
3. 候选车面板根据新阶段调整布局

### 4.3 阶段指示器

页面顶部轻量进度条：

```
● 认知 ─── ● 考虑 ─── ◉ 对比 ─── ○ 决策 ─── ○ 购买
```

纯展示，不可点击，阶段由 AI 推进。

---

## Part 5：实时更新机制

### 5.1 对话中实时更新流程

```
用户发消息 → AI 调用 tool → 后端写入数据 → WS 推送 side effect → 前端即时更新
```

用户不需要离开聊天再回看板，看板实时更新。

### 5.2 WebSocket 事件协议

```typescript
interface JourneySideEffect {
  type: 'candidate_added' | 'candidate_eliminated' | 'candidate_winner'
      | 'journey_updated' | 'stage_changed' | 'ai_insight'
      | 'publish_suggestion' | 'journey_published'
  timelineEvent: {
    id: string
    type: TimelineEventType
    content: string
    metadata: Record<string, unknown>
    createdAt: string
  }
  patch?: {
    candidates?: Candidate[]
    stage?: string
    requirements?: Requirements
  }
}
```

前端收到后：追加 timelineEvent + 合并 patch（无需全量 refetch）。

### 5.3 Mock 模式处理

- `MOCK_MODE` 改为环境变量 `NEXT_PUBLIC_MOCK_MODE`，默认 `false`
- 保留 mock 数据文件用于开发/测试
- E2E 测试通过 `AI_E2E_MOCK=1` 启用

### 5.4 断连处理

- 断连时显示轻提示条
- 重连后 REST API 拉取最新时间线和候选车（补偿断连事件）
- 不做本地消息队列

---

## 改动范围总结

### 数据库变更

- `CarCandidate` 新增 4 字段：matchTags, recommendReason, relevantDimensions, candidateRankScore
- 新增 `TimelineEvent` 模型

### 后端变更

- `add_candidate` tool：输出标签/理由/维度
- `journey_update` tool：生成时间线事件
- 所有 tool：统一 side effect 推送格式
- 行为事件消费：计算 candidateRankScore
- 新增时间线 CRUD API
- WebSocket 协议统一

### 前端变更

- Kanban → 时间线 + 候选车面板布局
- 候选车卡片：个性化维度 + 标签 + 理由
- 阶段指示器 + 阶段驱动 UI 切换
- WebSocket 监听补全
- 关闭 Mock 模式
- 移动端：底部抽屉适配

---

## Part 6：发布旅程体验

### 6.1 发布时机——AI 推荐

当旅程进入 `DECISION` 或 `PURCHASE` 阶段时，AI 在时间线中插入一条特殊事件：

```
┌─────────────────────────────────────────┐
│ AI 建议                                  │
│                                         │
│ 你的购车旅程已经很完整了，对比了3款车，   │
│ 做出了最终选择。要把你的经历分享给        │
│ 正在纠结的人吗？                         │
│                                         │
│       [ 一键发布到社区 ]                  │
└─────────────────────────────────────────┘
```

type 为 `PUBLISH_SUGGESTION`，由阶段推进时自动触发。

### 6.2 一键发布流程

点击"一键发布"后：

1. **自动生成**：后端并行生成 story + report + template 三种格式
2. **发布中状态**：按钮变为"生成中..."，时间线显示进度
3. **发布完成**：时间线追加 `JOURNEY_PUBLISHED` 事件，附带"查看社区页面"链接
4. **默认配置**：title = 旅程标题，visibility = PUBLIC，所有格式都生成

不再需要三步向导。

**错误处理**：任一格式生成失败时重试一次；仍失败则跳过该格式，用已成功的格式发布。用户可通过事后编辑中的"重新生成"补回失败格式。publishSummary 同样支持重新生成。

### 6.3 事后编辑

在社区详情页（作者视角），每个内容区块右上角显示"编辑"按钮：
- 标题/描述：直接 inline 编辑
- 可见性：下拉切换 PUBLIC / UNLISTED
- 内容不满意：点"重新生成"让 AI 重写某个格式
- 可选择隐藏某个格式（比如不想展示模板）

---

## Part 7：社区浏览体验

### 7.1 Feed 卡片改造

改为信息更丰富的决策卡：

```
┌─────────────────────────────────────┐
│ 从理想L6到深蓝S7，我的纯电SUV之路     │  ← 标题
│ 匿名用户 · 已购车                    │
│                                     │
│ 理想L6  vs  深蓝S7  vs  小鹏G6       │  ← 候选车展示
│                                     │
│ "25万预算家用，纠结了续航和空间，      │  ← AI决策摘要
│  最终因为增程无焦虑选了理想"           │     (publishSummary)
│                                     │
│ 25-35万 · 家用 · 纯电                │  ← 标签
│ ❤ 12  Fork 3                        │  ← 互动数据
└─────────────────────────────────────┘
```

**新增字段**：发布时 AI 额外生成 `publishSummary`（一句话决策摘要，50字以内），存入 `PublishedJourney`。

### 7.2 社区详情页——故事（时间线叙事）

复用旅程时间线视觉语言，面向读者简化为阶段叙事：

```
● 认知期
  "想换一台纯电SUV，预算25-35万，主要家用通勤"

● 考虑期
  AI 推荐了 理想L6、深蓝S7、小鹏G6
  "三款车都符合预算，但续航和空间差异明显"

● 对比期
  重点对比：续航 · 空间 · 能耗
  "理想L6增程方案解决了续航焦虑，这是决定性因素"

● 决策期
  最终选择：理想L6
  "试驾后确认空间满足全家出行，增程让长途无压力"
```

每个阶段是一个节点，内容由 AI 从旅程数据中提炼生成，不是原始事件堆砌。

AI 生成时输出结构化 JSON：

```typescript
interface StoryTimeline {
  stages: Array<{
    stage: string        // AWARENESS | CONSIDERATION | COMPARISON | DECISION | PURCHASE
    headline: string     // 阶段标题
    narrative: string    // 叙述内容（50-150字）
    candidates?: string[] // 该阶段涉及的车型
    keyDimension?: string // 该阶段的关键关注点
  }>
}
```

### 7.3 社区详情页——报告（图文报告）

分段呈现，每段有标题和视觉层次：

**第一段：我的需求**
- 预算范围、燃油偏好、使用场景、核心关注维度
- 卡片式布局

**第二段：候选车对比**
- 对比维度来自旅程的 `relevantDimensions`，不是固定字段
- 每个维度用横向进度条可视化
- 每款车一行，维度值直观对比

```
         续航    空间    能耗   价格
理想L6   ████▌  █████  ███▌  ████
深蓝S7   ████   ███▌   ████  ████▌
小鹏G6   ███▌   ███    ████▌ █████
```

**第三段：最终推荐**
- 高亮卡片展示推荐车型
- 推荐理由（一段话）

AI 生成时输出结构化 JSON：

```typescript
interface ReportData {
  userProfile: {
    budget: string
    fuelPreference: string
    useCases: string[]
    coreDimensions: string[]
  }
  comparison: Array<{
    carName: string
    scores: Record<string, number>  // dimension → 0-100
    highlight: string               // 一句话亮点
  }>
  recommendation: {
    carName: string
    reasoning: string
  }
}
```

### 7.4 社区详情页——模板（从此出发）

展示为可操作的决策框架，不再是 JSON 树：

- **对比维度**：标签展示，附权重百分比
- **买车前要想清楚的问题**：编号列表
- **作者的候选车**：车名标签展示
- **底部 CTA**：大按钮"从此出发，开始我的旅程"

### 7.5 分页加载

Feed 列表改为 infinite scroll：
- 每次加载 20 条
- 滚动到底部自动加载下一页
- 筛选条件变化时重置列表

---

## 改动范围总结（更新）

### 数据库变更

- `CarCandidate` 新增 4 字段：matchTags, recommendReason, relevantDimensions, candidateRankScore
- 新增 `TimelineEvent` 模型
- `PublishedJourney` 新增 1 字段：publishSummary (String?, AI 生成的一句话决策摘要)
- `TimelineEvent.type` 新增枚举值：PUBLISH_SUGGESTION, JOURNEY_PUBLISHED
- `PublishedJourney.storyContent` 从纯文本改为结构化 JSON（StoryTimeline）
- `PublishedJourney.reportData` 结构规范化为 ReportData 接口

### 后端变更

- `add_candidate` tool：输出标签/理由/维度
- `journey_update` tool：生成时间线事件
- 所有 tool：统一 side effect 推送格式
- 行为事件消费：计算 candidateRankScore
- 新增时间线 CRUD API
- WebSocket 协议统一
- 阶段推进至 DECISION/PURCHASE 时自动生成 PUBLISH_SUGGESTION 时间线事件
- 发布服务改造：一键发布（并行生成三种格式 + publishSummary）
- story 生成改为输出 StoryTimeline 结构化 JSON
- report 生成改为输出 ReportData 结构化 JSON
- 社区列表 API 返回候选车名称和 publishSummary

### 前端变更

- Kanban → 时间线 + 候选车面板布局
- 候选车卡片：个性化维度 + 标签 + 理由
- 阶段指示器 + 阶段驱动 UI 切换
- WebSocket 监听补全
- 关闭 Mock 模式
- 移动端：底部抽屉适配
- 新增 PUBLISH_SUGGESTION 时间线事件组件（含一键发布按钮）
- 删除 PublishWizard 三步向导，改为一键发布 + 事后编辑
- 社区详情页作者视角：inline 编辑、重新生成、格式显隐
- Feed 卡片改造：候选车展示 + publishSummary 决策摘要
- 故事展示：StoryTimelineView 组件（阶段节点叙事）
- 报告展示：ReportView 组件（需求卡片 + 对比进度条 + 推荐卡片）
- 模板展示：TemplateView 组件（决策框架结构化展示）
- Feed 列表：infinite scroll 分页
