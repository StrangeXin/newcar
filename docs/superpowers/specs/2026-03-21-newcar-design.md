# AI原生购车社区产品设计文档

**版本：** v1.0
**日期：** 2026-03-21
**状态：** 设计完成，待实现

---

## 一、产品定位

### 核心理念

> 用户在平台上的一切行为——浏览、对话、对比、停留——都是购车决策的一部分。AI实时感知这些信号，自动构建结构化的"购车旅程"，用户可以将旅程发布为社区内容，其他人可以阅读、借鉴，甚至"从此出发"继承对比框架，开始自己的旅程。

### 与现有平台的本质区别

| 维度 | 汽车之家/懂车帝 | 小红书 | **本产品** |
|------|---------------|--------|-----------|
| 核心内容 | 车型参数/评测文章 | 种草笔记 | **完整决策历程** |
| AI角色 | 搜索增强 | 内容推荐 | **全程决策引擎** |
| 用户产出 | 评论/评分 | 图文/视频 | **AI结构化历程** |
| 复用性 | 无 | 收藏 | **「从此出发」继承框架** |
| 时效性 | 静态内容 | 实时发布 | **每日与用户需求相关的动态** |

### 目标用户

处于购车决策周期（通常1-3个月）内的用户，特征：
- 已有大致预算和用车场景
- 面临多车型选择，信息过载
- 需要持续跟踪价格、政策、新车型变化
- 希望参考真实用户的完整决策逻辑，而非碎片化评价

---

## 二、产品架构

### 两个世界

**私人空间（旅程工作台）**
- AI对话全程引导
- 旅程看板可视化进度
- 跨会话持久记忆
- 实时数据推送（价格/库存/补贴）
- 一键发布历程

**社区空间（历程广场）**
- 他人历程浏览与检索
- 三种阅读模式（故事/报告/模板）
- 「从此出发」继承对比框架
- 按车型/预算/场景/燃油类型筛选
- 互动（点赞/评论/收藏）

### 核心用户流程

```
① 进入平台，描述需求
      ↓
② AI推荐候选车型，加入看板
      ↓
③ 浏览/对话/对比（行为持续被记录）
      ↓（每天）
④ AI生成今日动态 + 更新历程摘要
      ↓（循环，持续1-3个月）
⑤ 做出购买决策
      ↓
⑥ 发布历程（三种形式）
      ↓
⑦ 历程进入社区，他人「从此出发」
```

### 目标平台

Web（PC/平板）+ Mobile（H5/小程序），响应式设计。

---

## 三、核心界面设计

### 3.1 旅程工作台（主界面）

**PC三栏布局：**

```
┌──────────────┬──────────────────────────────┬──────────────┐
│  旅程阶段    │         看板主体             │  AI 对话     │
│  进度（左）  │                              │  （右）      │
│              │  ① 今日新动态（常看常新）    │              │
│  ✓ 需求确认  │  ② AI历程摘要（自动更新）   │  多轮对话    │
│  → 候选筛选  │  ③ 候选车型卡片             │  实时数据    │
│  ○ 深度对比  │  ④ 对比矩阵                │  工具调用    │
│  ○ 决策强化  │                              │              │
│  ○ 购买执行  │                              │              │
│              │                              │              │
│  [发布历程]  │                              │              │
└──────────────┴──────────────────────────────┴──────────────┘
```

**今日新动态**是「常看常新」的核心机制：每天根据用户关注的车型推送相关变动（降价/新配色/新评测/政策更新），让用户每天都有理由回来。

**AI历程摘要**自动整合三类信号（行为 + 对话 + 外部动态），用自然语言叙述"你目前的状态"，无需用户主动记录。

**旅程阶段（5阶段）：**
1. AWARENESS — 需求确认（预算/场景/家庭情况）
2. CONSIDERATION — 候选筛选（AI推荐 + 用户搜索）
3. COMPARISON — 深度对比（多维度 + 口碑整合）
4. DECISION — 决策强化（价格谈判/政策确认）
5. PURCHASE — 购买执行（经销商/贷款/交付）

### 3.2 移动端

四底栏导航：「我的旅程 / AI助手 / 社区 / 我的」

首屏直接展示：
- 今日新动态卡片
- AI一句话今日解读
- 旅程进度条（5阶段可视化）

### 3.3 社区广场

**历程卡片包含：**
- 用户昵称 + 纠结时长 + 最终结果
- 一句话摘要（AI生成）
- 车型/预算/场景标签
- 互动数据（赞/评/「从此出发」次数）
- 状态标签：「已购车」或「进行中」（进行中的历程同样可发布）
- **「从此出发 →」** 按钮（最核心差异化功能）

**筛选维度：**车型 / 预算区间 / 燃油类型 / 用车场景 / 购车结果

**排序公式：**
```
score = (fork_count × 3.0 + like_count × 1.0 + comment_count × 1.5 + view_count × 0.1)
        × time_decay(published_at)
        × relevance_boost(当前用户需求匹配度)
```
`fork_count` 权重最高，因为「从此出发」是最高价值的用户行为。

### 3.4 历程发布 — 三种呈现形式

同一段旅程由AI自动生成三种版本，用户可选择发布全部或部分：

**① 叙事故事（Narrative Story）**
- AI以第一人称将决策过程写成有情感的文章
- 包含关键转折点、心路历程、最终结论
- 适合分享朋友圈/社区

**② 结构化报告（Structured Report）**
- 用户画像 + 车型对比矩阵 + 加权评分
- AI评估「决策置信度」（float 0-1）
- 适合有同类需求的人参考

**③ 可复用模板（Reusable Template）**
- 对比维度框架 + 候选车型池 + 必问问题清单 + 评估权重
- 「从此出发」继承的底层数据结构
- 显示「已有N人从此出发，平均节省X周」

---

## 四、数据架构

### 4.1 核心实体（11个）

#### User
```
id, email, phone, avatar
city, has_garage: bool
charging_situation: HOME | PUBLIC | NONE
family_size: int
privacy_default: PRIVATE | FRIENDS | PUBLIC
notification_settings: {}
created_at, last_active_at
```

#### Journey（核心实体）
```
id, user_id, title
stage: AWARENESS | CONSIDERATION | COMPARISON | DECISION | PURCHASE
status: ACTIVE | PAUSED | COMPLETED | ABANDONED
requirements: {
  budget_min, budget_max,
  use_cases: string[],
  fuel_type_preference: string[],
  daily_km: int,
  style_preference: string
}
ai_confidence_score: float      # AI对当前推荐的置信度
template_source_id: JourneyID?  # 从哪个历程「从此出发」
started_at, completed_at
```

#### BehaviorEvent（行为信号）
```
id, journey_id, user_id, session_id
type: PAGE_VIEW | CAR_VIEW | SPEC_TAB | REVIEW_READ
    | COMPARISON_OPEN | PRICE_CHECK | VIDEO_WATCH
    | DEALER_LOCATE | COMMUNITY_POST_VIEW
target_type: CAR | ARTICLE | COMMUNITY_POST | DEALER
target_id
metadata: {
  duration_sec: int,
  scroll_depth: float,
  tab_name: string,     # 哪个规格标签
  ...
}
ai_weight: float        # 计算字段：该事件对AI信号的贡献权重
timestamp
```

#### Conversation（对话记录）
```
id, journey_id, user_id, session_id
messages: [{
  role: USER | ASSISTANT,
  content: string,
  timestamp: datetime
}]
extracted_signals: [{
  type: REQUIREMENT | PREFERENCE | CONCERN | TRADEOFF | REJECTION,
  value: string,
  confidence: float
}]
tool_calls: [{           # AI调用实时数据工具的记录
  name: string,
  args: {},
  result: {}
}]
created_at, updated_at
```

#### CarCandidate（候选车型）
```
id, journey_id, car_id
status: ACTIVE | ELIMINATED | WINNER
added_reason: AI_RECOMMENDED | USER_SEARCHED | FROM_TEMPLATE | FROM_COMMUNITY
user_interest_score: float    # 由行为事件计算（浏览时长/次数/深度）
ai_match_score: float         # 需求匹配度（AI计算）
price_at_add: int             # 加入时的价格快照
elimination_reason: string?   # 被淘汰的原因
user_notes: text
added_at
```

#### JourneySnapshot（AI每日快照）
```
id, journey_id
trigger: DAILY | EVENT_TRIGGERED | MANUAL
narrative_summary: text        # 「AI今日解读」展示内容
key_insights: [{
  insight: string,
  evidence: string,
  confidence: float
}]
top_recommendation: car_id
recommendation_reasoning: text
attention_signals: [{           # 「今日动态」的来源
  car_id,
  signal_type: PRICE_DROP | NEW_VARIANT | NEW_REVIEW | POLICY_UPDATE,
  description: string
}]
next_suggested_actions: string[]
model_used: string
prompt_version: string
tokens_used: int
generated_at
```

#### Car（车型基础数据）
```
id, brand, model, variant, year
type: SEDAN | SUV | MPV | HATCHBACK | PICKUP
fuel_type: BEV | PHEV | HEV | ICE
base_specs: {}    # 静态参数，批量更新
msrp: int
updated_at
```

#### CarPriceSnapshot（实时价格）
```
id, car_id, region
msrp: int
dealer_discount: int
subsidy_national: int
subsidy_local: int
effective_price: int    # = msrp - dealer_discount - subsidies
source: string
captured_at             # 实时API拉取时间
```

#### CarReview（评测与口碑）
```
id, car_id
source: MEDIA | USER_GENERATED
platform: string        # 汽车之家/懂车帝/小红书/...
title, content
ai_summary: text        # AI提炼的摘要，进入RAG知识库
sentiment_scores: {
  overall, space, technology, reliability, value
}
published_at, ingested_at
```

#### PublishedJourney（发布历程）
```
id, journey_id, user_id
title, description
tags: {
  car_ids: int[],
  budget_range: string,
  use_cases: string[],
  fuel_type: string
}
story_content: text       # 叙事故事
report_data: json         # 结构化报告数据
template_data: {          # 可复用模板
  dimensions: string[],
  weights: {},
  candidate_car_ids: int[],
  key_questions: string[]
}
visibility: PUBLIC | UNLISTED
view_count, like_count, comment_count, fork_count: int
featured: bool            # 编辑精选
published_at
```

#### JourneyFork（「从此出发」记录）
```
id
source_published_journey_id
new_journey_id
user_id
inherited_candidates: car_id[]
inherited_framework: {
  dimensions: string[],
  weights: {}
}
inherited_requirements: {}    # 部分继承，用户可自定义覆盖
forked_at
```

#### NotificationFeed（今日动态通知）
```
id, user_id, journey_id
type: PRICE_DROP | NEW_VARIANT | NEW_REVIEW | POLICY_UPDATE | OTA_RECALL
related_car_id
title, body
metadata: {delta, old_value, new_value, ...}
is_read: bool
created_at
```

### 4.2 数据分层

**静态知识层（批量更新，进RAG知识库）**
- 车型基础参数（Car.base_specs）
- 媒体评测文章（CarReview，来源：汽车之家/懂车帝/Car and Driver）
- 车主口碑（小红书/汽车论坛爬取，经AI情感分析）
- 历史价格走势

**动态数据层（实时API，不进RAG）**
- 当前终端价格/优惠（CarPriceSnapshot）
- 经销商库存/等待周期
- 地方政府补贴政策（CarPolicy）
- 新车发布/OTA/召回公告

**用户行为层（实时写入，触发AI Pipeline）**
- BehaviorEvent（每次用户操作）
- Conversation（每次AI对话）

### 4.3 AI Pipeline — 快照生成流程

```
输入聚合
  ├── 近7天 BehaviorEvent（按 ai_weight 加权）
  ├── 全量 extracted_signals（来自 Conversation）
  ├── 当前 CarCandidate 列表（user_interest_score + ai_match_score）
  ├── 今日 CarPriceSnapshot（候选车型）
  └── 近期 CarReview（候选车型相关）
       ↓
意图推断
  ├── 用户当前核心纠结是什么？
  ├── 需求权重是否发生变化？
  └── 对哪款车的情感倾向（偏向/抗拒）？
       ↓
内容生成
  ├── narrative_summary（今日AI解读，100-200字）
  ├── key_insights（最多3条，每条含evidence和confidence）
  ├── top_recommendation + reasoning
  └── attention_signals（今日动态来源，最多3条）
       ↓
写入 & 推送
  ├── 存储 JourneySnapshot
  ├── 更新 CarCandidate 排序（重排推荐权重）
  ├── 写入 NotificationFeed
  └── 刷新用户首屏「今日新动态」
```

### 4.4 今日动态触发规则

**触发条件（满足任一即触发AI Pipeline）：**
1. 候选车型价格变动 ±3%
2. 候选车型有新配色/配置/车款
3. 候选车型相关新评测/口碑文章出现
4. 用户所在地有新的购车补贴政策
5. 对比车型发布OTA更新/安全召回
6. 距上次快照超过24小时（兜底）

**AI过滤规则（避免噪音）：**
- 只推与用户候选池直接相关的变动
- 根据用户已表达的关注维度加权过滤
- 过滤用户已知/已读的信息
- 每天最多推送3条动态
- 同类信息合并（多条降价合为一条）

---

## 五、关键设计决策

### 5.1 行为信号 vs 对话信号的权重

行为信号（尤其是重复浏览、停留时长）比对话中表达的偏好更真实。
用户可能说"我不在意颜色"，但反复看某个配色页面。AI应以行为为准，但在摘要中用"你似乎..."的方式温和提示，不做强结论。

### 5.2 隐私边界

- 旅程默认私有（PRIVATE），用户主动选择发布
- 发布时可脱敏（隐藏城市/家庭信息）
- 行为数据仅用于该用户自己的AI推断，不作为训练数据（需在隐私协议中明确）
- 「进行中」的历程可发布，但只展示已完成的阶段内容

### 5.3 「从此出发」的边界

继承的内容：对比维度框架 + 评估权重参考 + 候选车型池（用户可增删）+ 关键问题清单

不继承的内容：原作者的个人偏好判断、价格谈判记录、个人评论

AI在新旅程开始时会提示："我已了解XX的对比框架，请告诉我你的情况有哪些不同？"

### 5.4 冷启动策略

社区内容冷启动路径：
1. 内部团队用真实购车需求跑完整旅程，发布10-20条种子历程
2. 覆盖主流场景：家用/通勤/首购/换购 × 15万/20万/30万以上
3. 确保每个主流车型（理想/问界/比亚迪/深蓝等）至少有2条历程
4. 「从此出发」功能从第一天就可用

---

## 六、技术栈参考（待详细规划）

- **前端：** Next.js（Web）+ 响应式 + 微信小程序（Mobile）
- **后端：** Node.js / Python FastAPI
- **数据库：** PostgreSQL（关系数据）+ Redis（缓存/会话）
- **向量数据库：** Pinecone 或 Weaviate（RAG知识库）
- **AI：** Claude API（对话 + 快照生成）
- **实时数据：** 价格/库存API对接 + 政策数据爬虫
- **行为追踪：** 自建事件系统（避免第三方数据泄露）

---

## 七、待讨论的开放问题

1. **变现模式**：订阅制 / 经销商导流佣金 / 广告（需确认不影响AI推荐公正性）
2. **车型数据来源**：自建爬虫 vs 购买第三方API（Edmunds/懂车帝）
3. **口碑数据合规**：小红书/汽车论坛内容的爬取合规性
4. **MVP范围**：首版上线应包含哪些功能？建议优先实现：旅程工作台 + AI对话 + 行为记录 + 每日快照，社区功能二期上线
5. **AI成本控制**：每用户每日快照的token成本估算和优化策略

---

*文档由 Claude Code + Superpowers Brainstorming 生成*
*研究基础：AI原生产品设计范式与汽车垂直领域应用深度研究报告（2026-03-20）*
