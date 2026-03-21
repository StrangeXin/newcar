# AI原生购车社区产品设计文档

**版本：** v1.1
**日期：** 2026-03-21
**状态：** Spec Review 修订版

---

## 一、产品定位

### 核心理念

> 用户在平台上的一切行为——浏览、对话、对比、停留——都是购车决策的一部分。AI实时感知这些信号，自动构建结构化的"购车旅程"，用户可以将旅程发布为社区内容，其他人可以阅读、借鉴，甚至"从此出发"继承对比框架，开始自己的旅程。

> 注：对比表为产品定位示意，非功能完整性清单。

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
- 三种阅读模式（故事/报告/模板），仅展示作者选择发布的形式
- 「从此出发」继承对比框架（仅当作者发布模板形式时可用）
- 按车型/预算/场景/燃油类型筛选
- 互动（点赞/评论/收藏）

### 核心用户流程

```
① 进入平台，描述需求（游客可体验，注册后保存旅程）
      ↓
② AI推荐候选车型，加入看板
      ↓
③ 浏览/对话/对比（行为持续被记录）
      ↓（每天）
④ AI生成今日动态 + 更新历程摘要
      ↓（循环，持续1-3个月）
⑤ 做出购买决策
      ↓
⑥ 发布历程（三种形式，可选择发布哪些）
      ↓
⑦ 历程进入社区，他人「从此出发」
```

### 目标平台

Web（PC/平板）+ Mobile（H5/小程序），响应式设计。

### 每用户旅程数量限制

**每用户同时只能有一条 ACTIVE 状态的旅程。** 这是明确的产品决策，理由：
- 控制AI Pipeline成本（每活跃旅程每日运行一次快照）
- 聚焦用户注意力，避免分散
- 简化「我的旅程」UI（无需多旅程切换逻辑）

旧旅程需手动或自动进入 COMPLETED/ABANDONED 状态后，才能开始新旅程。

---

## 三、用户认证与会话

### 认证方式（优先级排序）

1. **微信 OAuth**（主要方式）— 微信小程序强制使用，Web端首推
2. **手机号 + OTP**（备用方式）— 无微信场景或海外用户
3. **邮箱 + 密码**（备用方式）— 企业用户/Web端

### 游客模式与转化

游客（未登录）可以：
- 浏览社区历程（只读）
- 开始旅程对话（前3轮）

游客触发注册的时机：
- 第4轮AI对话时提示"登录后保存旅程"
- 查看完整社区历程时提示
- 尝试「从此出发」时提示

**游客 → 注册用户迁移：**
- `session_id` 在游客阶段已绑定到本地存储
- 注册完成后，后端将该 `session_id` 下的 `BehaviorEvent` 和 `Conversation` 关联到新 `user_id`
- 无缝继续当前旅程，无数据丢失

### session_id 作用域

`session_id` 是每次浏览器会话的唯一标识（UUID），与登录状态无关：
- 未登录时：`session_id` 存入 localStorage，关联游客行为
- 登录后：`session_id` 仍有效，服务端将其关联到 `user_id`
- `BehaviorEvent` 和 `Conversation` 均记录 `session_id`，支持跨设备行为合并（同一用户多设备登录时，按 `user_id` 聚合）

---

## 四、核心界面设计

### 4.1 旅程工作台（主界面）

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

**阶段推进逻辑（单调前进）：**
`Journey.stage` 只向前推进，不回退。当用户行为暗示"回到上一阶段"（如在DECISION阶段大量浏览新车型），AI通过 `JourneySnapshot.key_insights` 提示"你似乎在重新考虑候选范围"，并在 `narrative_summary` 中体现，但 `stage` 字段不回退。这样保留了完整的决策轨迹，同时不破坏进度可视化。

### 4.2 移动端

四底栏导航：「我的旅程 / AI助手 / 社区 / 我的」

首屏直接展示：
- 今日新动态卡片
- AI一句话今日解读
- 旅程进度条（5阶段可视化）

### 4.3 社区广场

**历程卡片包含：**
- 用户昵称 + 纠结时长 + 最终结果
- 一句话摘要（AI生成）
- 车型/预算/场景标签
- 互动数据（赞/评/「从此出发」次数）
- 状态标签：「已购车」或「进行中」
- **「从此出发 →」** 按钮（仅当 `published_formats` 包含 `template` 时显示）

**筛选维度：**车型 / 预算区间 / 燃油类型 / 用车场景 / 购车结果

**排序公式：**
```
score = (fork_count × 3.0 + like_count × 1.0 + comment_count × 1.5 + view_count × 0.1)
        × relevance_boost(viewer_journey)
```

> **冷启动期简化：** 去掉 `time_decay`，改为纯按发布时间倒序兜底（当内容量少于500条时）。内容积累后再引入衰减。`relevance_boost` 保留，它是本产品差异化排序的核心。

`relevance_boost` 定义：
```
relevance_boost(viewer_journey) =
  1.0 （未登录或无活跃旅程）
  budget_overlap × 0.4 +
  use_case_overlap × 0.4 +
  fuel_type_overlap × 0.2 + 1.0
  （有活跃旅程时，最大值 2.0）

其中：
  budget_overlap = 1 if viewer.budget 与 post.tags.budget_range 有交集 else 0
  use_case_overlap = |交集(viewer.use_cases, post.tags.use_cases)| / max(|viewer.use_cases|, 1)
  fuel_type_overlap = 1 if viewer.fuel_type_preference 与 post.tags.fuel_type 有交集 else 0
```

`PublishedJourney.tags.budget_range` 统一改为结构化：`{min: int, max: int}`，与 `Journey.requirements.budget_min/max` 类型对齐。

### 4.4 历程发布 — 三种呈现形式

同一段旅程由AI自动生成三种版本，用户通过 `published_formats` 字段选择发布哪些（至少选一种）：

**① 叙事故事（Narrative Story）— `story`**
- AI以第一人称将决策过程写成有情感的文章
- 包含关键转折点、心路历程、最终结论
- 适合分享朋友圈/社区

**② 结构化报告（Structured Report）— `report`**
- 用户画像 + 车型对比矩阵 + 加权评分
- AI评估「决策置信度」（float 0-1）
- 适合有同类需求的人参考

**③ 可复用模板（Reusable Template）— `template`**
- 对比维度框架 + 候选车型池 + 必问问题清单 + 评估权重
- **「从此出发」按钮的前提条件**：仅当发布了此形式
- 显示「已有N人从此出发」（`fork_count` 来自 `JourneyFork` 表）

> 注：「平均节省X周」统计需要足够样本量（≥50个fork完成了COMPLETED旅程）才显示，基准线为全平台平均购车决策周期（初始值由种子数据估算）。样本不足时只显示 `fork_count`。

---

## 五、数据架构

### 5.1 核心实体（13个）

#### User
```
id, email, phone, avatar, nickname
city, has_garage: bool
charging_situation: HOME | PUBLIC | NONE
family_size: int
privacy_default: PRIVATE | FRIENDS | PUBLIC
notification_settings: {
  push_enabled: bool,
  push_channel: WECHAT | APP | BOTH,
  daily_digest: bool,
  price_drop_threshold_pct: float,  # 降价多少%才推送，默认3%
  max_per_day: int                   # 每日最多推送条数，默认3
}
created_at, last_active_at
```

#### UserDevice（设备注册）
```
id, user_id
platform: WEB | WECHAT_MINIAPP | IOS | ANDROID
push_token: string        # APNs/FCM/微信服务消息 token
device_fingerprint: string
last_seen_at
```

#### Journey（核心实体）
```
id, user_id, title
stage: AWARENESS | CONSIDERATION | COMPARISON | DECISION | PURCHASE
status: ACTIVE | PAUSED | COMPLETED | ABANDONED
requirements: {
  budget_min: int,
  budget_max: int,
  use_cases: string[],
  fuel_type_preference: string[],
  daily_km: int,
  style_preference: string
}
ai_confidence_score: float      # AI对当前推荐的置信度
template_source_id: JourneyID?  # 从哪个历程「从此出发」
started_at, completed_at, last_activity_at
```

自动过期规则：`last_activity_at` 超过90天且状态为 ACTIVE/PAUSED，系统自动转为 ABANDONED，关联 PublishedJourney 状态标签更新为「已停止」。

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
  tab_name: string,
  ...
}
ai_weight: float   # 写入时计算，见下方公式
timestamp
```

**`ai_weight` 计算公式（写入时计算）：**
```
base_weight = {
  CAR_VIEW: 1.0,
  COMPARISON_OPEN: 1.2,
  SPEC_TAB: 0.8,
  REVIEW_READ: 0.7,
  PRICE_CHECK: 1.1,
  DEALER_LOCATE: 1.5,     # 意向最强
  VIDEO_WATCH: 0.6,
  PAGE_VIEW: 0.3,
  COMMUNITY_POST_VIEW: 0.4
}

duration_factor = min(duration_sec / 300.0, 1.0)   # 超过5分钟按满分
recency_factor = 1.0                                 # Pipeline聚合时按天衰减

ai_weight = base_weight[type] × (0.5 + 0.5 × duration_factor)
```

Pipeline 聚合时叠加时间衰减（分档方式，早期实现简单，效果与指数衰减相当）：
```
effective_weight = ai_weight × decay_factor

decay_factor:
  days_ago ≤ 7:   1.0   （全权重）
  days_ago 8-14:  0.5   （半权重）
  days_ago > 14:  不纳入计算
```
> 后期积累足够数据后可替换为指数衰减 `e^(-0.1 × days_ago)`，接口不变。

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
tool_calls: [{
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
user_interest_score: float    # 由行为事件计算
ai_match_score: float         # 需求匹配度
price_at_add: int
elimination_reason: string?
user_notes: text
added_at
```

#### JourneySnapshot（AI每日快照）
```
id, journey_id
trigger: DAILY | EVENT_TRIGGERED | MANUAL
narrative_summary: text
key_insights: [{
  insight: string,
  evidence: string,
  confidence: float
}]
top_recommendation: car_id
recommendation_reasoning: text
attention_signals: [{
  car_id,
  signal_type: PRICE_DROP | NEW_VARIANT | NEW_REVIEW | POLICY_UPDATE | OTA_RECALL,
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
base_specs: {
  length_mm: int,
  width_mm: int,
  height_mm: int,
  wheelbase_mm: int,
  seating_capacity: int,
  cargo_volume_l: int,
  power_kw: int,
  range_km: int?,           # BEV/PHEV专用
  zero_to_hundred_sec: float,
  safety_rating: string?    # C-NCAP/E-NCAP评级
}
msrp: int
updated_at
```

#### CarPriceSnapshot（实时价格）
```
id, car_id, region
msrp: int
dealer_discount: int
policy_ids: CarPolicy.id[]    # 关联的补贴政策
effective_price: int          # msrp - dealer_discount - sum(policy.amount)
source: string
captured_at
```

#### CarPolicy（政府补贴政策）
```
id, car_id?, region           # car_id为null表示全品类政策
policy_type: PURCHASE_TAX | TRADE_IN_SUBSIDY | NEW_ENERGY_SUBSIDY | LICENSE_PLATE
subsidy_amount: int           # 金额（元）或税率减免
eligibility_criteria: {
  household_registration?: string,  # 户籍要求
  license_plate_restriction?: bool, # 限牌城市特殊规则
  income_threshold?: int,
  vehicle_conditions?: string[]
}
valid_from: date
valid_until: date
source_url: string
created_at, updated_at
```

#### CarReview（评测与口碑）
```
id, car_id
source: MEDIA | USER_GENERATED
platform: string
title, content
ai_summary: text
sentiment_scores: {
  overall, space, technology, reliability, value
}
published_at, ingested_at
```

#### PublishedJourney（发布历程）
```
id, journey_id, user_id
title, description
published_formats: string[]   # ["story","report","template"] 的子集，至少一个
tags: {
  car_ids: int[],
  budget_min: int,            # 与Journey.requirements对齐
  budget_max: int,
  use_cases: string[],
  fuel_type: string
}
story_content: text?          # 仅当 "story" in published_formats
report_data: json?            # 仅当 "report" in published_formats
template_data: {              # 仅当 "template" in published_formats
  dimensions: string[],
  weights: {},
  candidate_car_ids: int[],
  key_questions: string[]
}?
content_version: int          # 每次内容更新递增
last_synced_at: datetime      # 最后一次从Journey同步内容的时间
visibility: PUBLIC | UNLISTED
view_count, like_count, comment_count, fork_count: int
featured: bool
content_status: LIVE | JOURNEY_ABANDONED | AUTHOR_DELETED
published_at, updated_at
```

**PublishedJourney 内容生命周期：**
- `LIVE`：正常显示，「进行中」历程每次AI快照后可选择同步
- `JOURNEY_ABANDONED`：原始旅程90天无活动后自动标注，显示「该历程已停止更新」，`template` 形式仍可「从此出发」
- `AUTHOR_DELETED`：作者删除，内容下架，但 `JourneyFork` 记录保留（孤立fork仍然有效）

**「进行中」历程的发布更新策略：**
作者可选择「快照模式」（发布时锁定当前内容，不自动更新）或「同步模式」（每次AI快照后提示作者确认是否同步到已发布版本）。默认快照模式。

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
forked_at
```

#### NotificationFeed（动态通知）
```
id, user_id, journey_id
type: PRICE_DROP | NEW_VARIANT | NEW_REVIEW | POLICY_UPDATE | OTA_RECALL
related_car_id
title, body
metadata: {delta, old_value, new_value, ...}
is_read: bool
created_at
```

通知上限：每条 `Journey` 每天最多3条，跨旅程不累加（每用户当前只有一条活跃旅程，等同于每用户每天最多3条）。

### 5.2 数据分层

**静态知识层（批量更新，进RAG知识库）**
- 车型基础参数（Car.base_specs）
- 媒体评测文章（CarReview，来源：汽车之家/懂车帝等）
- 车主口碑（经AI情感分析后入库）
- 历史价格走势

**动态数据层（实时API，不进RAG）**
- 当前终端价格（CarPriceSnapshot）
- 补贴政策（CarPolicy）
- 经销商库存/等待周期
- 新车发布/OTA/召回公告

**用户行为层（实时写入，触发AI Pipeline）**
- BehaviorEvent
- Conversation

### 5.3 AI Pipeline — 快照生成流程

```
输入聚合
  ├── 近7天 BehaviorEvent（按 effective_weight 加权）
  ├── 全量 extracted_signals（来自 Conversation）
  ├── 当前 CarCandidate 列表
  ├── 今日 CarPriceSnapshot（候选车型）
  ├── 相关 CarPolicy（用户所在城市）
  └── 近期 CarReview（候选车型相关）
       ↓
意图推断
  ├── 用户当前核心纠结是什么？
  ├── 需求权重是否发生变化？
  └── 对哪款车的情感倾向（偏向/抗拒）？
       ↓
内容生成
  ├── narrative_summary（100-200字）
  ├── key_insights（最多3条）
  ├── top_recommendation + reasoning
  └── attention_signals（今日动态，最多3条）
       ↓
写入 & 推送
  ├── 存储 JourneySnapshot
  ├── 更新 CarCandidate 排序
  ├── 写入 NotificationFeed
  └── 通过 UserDevice.push_token 推送通知
```

### 5.4 今日动态触发规则

**触发条件（满足任一）：**
1. 候选车型价格变动 ±3%（可按用户设置调整阈值）
2. 候选车型有新配色/配置/车款
3. 候选车型相关新评测/口碑出现
4. 用户所在地有新补贴政策
5. 候选车型发布OTA/召回
6. 距上次快照超过24小时（兜底）

**去重规则：** 每条旅程每日最多生成一次快照。若当天已因条件1–5触发生成，第6条兜底不再运行。Pipeline 在执行前检查当日是否已有快照记录（`JourneySnapshot.generated_at` 在今日）。

**AI过滤规则：**
- 只推与用户候选池直接相关的变动
- 根据用户已表达的关注维度加权过滤
- 过滤用户已读的信息
- 每天每旅程最多3条
- 同类信息合并

### 5.5 社区内容审核

**合规背景：** 平台在中国运营，须遵守网信办《网络信息内容生态治理规定》，需要主动内容审核机制。

**审核流程：**
1. **AI预审**（发布前自动）：检测违禁词、虚假信息模式（如伪造购车结论）、广告/商业推广内容
2. **自动过审**：AI预审通过 → 直接发布
3. **人工审核队列**：AI预审标记异常 → 进入队列，24小时内处理
4. **社区举报**：用户举报 → 24小时内人工复核
5. **编辑精选**（`featured: bool`）：由内容运营人员手动标记，需有明确的内容运营角色（Admin/Editor）

**User角色扩展：**`User.role: MEMBER | EDITOR | ADMIN`（默认MEMBER）

---

## 六、关键设计决策

### 6.1 行为信号 vs 对话信号的权重

行为信号比对话中表达的偏好更真实。用户可能说"我不在意颜色"，但反复看某个配色页面。AI以行为为准，在摘要中用"你似乎..."温和提示，不做强结论。

### 6.2 隐私边界

- 旅程默认私有，用户主动选择发布
- 发布时可脱敏（隐藏城市/家庭信息）
- 行为数据仅用于该用户自己的AI推断，不作为训练数据（隐私协议中明确）
- 遵守《个人信息保护法》（PIPL）和《数据安全法》（DSL）
- 第三方平台（小红书/懂车帝）口碑数据爬取须评估合规风险，建议优先通过官方合作获取

### 6.3 「从此出发」的边界

**继承的内容：** 对比维度框架 + 评估权重参考 + 候选车型池 + 关键问题清单

**不继承的内容：** 原作者个人偏好判断、价格谈判记录、个人评论

AI在新旅程开始时提示："我已了解XX的对比框架，请告诉我你的情况有哪些不同？"

### 6.4 冷启动策略

1. 内部团队用真实购车需求跑完整旅程，发布10-20条种子历程
2. 覆盖主流场景：家用/通勤/首购/换购 × 15万/20万/30万以上
3. 确保主流车型（理想/问界/比亚迪/深蓝等）至少各2条历程
4. MVP阶段建议包含只读社区（可浏览历程），「从此出发」和发布功能在MVP后期或二期上线

---

## 七、技术栈

- **前端：** Next.js（Web，SSR利于SEO）+ 微信小程序（Mobile）
- **API服务：** Node.js + TypeScript（主API，处理用户请求）
- **AI Pipeline服务：** Python + FastAPI（独立服务，处理快照生成、信号提取、RAG查询；Python生态对LLM更友好）
- **数据库：** PostgreSQL（主库）+ Redis（会话/缓存/通知队列）
- **向量数据库：** Weaviate（RAG知识库，支持混合检索）
- **AI模型：** Claude API（对话 + 快照生成）
- **行为追踪：** 自建事件系统写入PostgreSQL，避免第三方数据外泄
- **推送服务：** 微信服务消息 + APNs/FCM（通过统一推送网关适配）

---

## 八、AI成本约束

每日快照是主要成本来源，需在架构层控制：

| 操作 | 预估token用量 | 频率 |
|------|-------------|------|
| 每日快照生成 | ~3,000 tokens | 每活跃用户/天 |
| 对话单轮 | ~1,500 tokens | 按需 |
| 发布时生成三种形式 | ~5,000 tokens | 一次性 |

**成本控制策略：**
- 快照生成仅对「过去7天有行为」的活跃旅程运行（避免为沉默用户浪费）
- 快照输入做摘要截断：BehaviorEvent最多取300条，Conversation信号最多取50条
- 对话上下文窗口滑动：保留最近10轮 + 全量 `extracted_signals`（结构化摘要替代原始对话）
- 发布三种形式可分步生成（用户点击对应Tab时按需生成）

**目标成本上限：** 每活跃用户每月 ≤ $0.5（按Claude API价格估算，依实际用量调整）

---

## 九、待讨论的开放问题

1. **变现模式**：订阅制 / 经销商导流佣金 / 广告。注意：经销商导流佣金可能影响AI推荐的用户信任度，需要产品层面明确隔离机制。
2. **车型数据来源**：自建爬虫 vs 购买第三方API。国内优先考虑懂车帝/汽车之家数据合作。
3. **口碑数据合规**：第三方UGC爬取须法律评估，优先考虑平台官方数据合作或API接入。
4. **MVP范围**：建议首版：旅程工作台 + AI对话 + 行为记录 + 每日快照 + 只读社区（浏览历程）。「从此出发」和发布功能在积累足够种子内容后上线。
5. **ICP与数据本地化**：平台服务中国用户需要ICP许可证，用户数据须存储在境内服务器，需在立项时确认。

---

*文档版本 v1.2 — 辩证分析修订*
*修订内容：① 快照触发改为"每日最多一次"（信号触发后不再兜底，降低AI成本）；② Pipeline时间衰减改为分档方式（≤7天全量/8-14天半权重/>14天忽略，简化早期实现）；③ 社区排序去掉冷启动期time_decay，保留relevance_boost核心差异化逻辑*
*v1.1 修订内容：新增认证模型（三）、定义 relevance_boost 公式、CarPolicy 实体、PublishedJourney 生命周期、ai_weight 计算公式、内容审核机制、AI成本约束章节；明确单旅程限制、技术栈选型、通知架构*
*由 Claude Code + Superpowers Brainstorming 生成*
