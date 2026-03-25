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
