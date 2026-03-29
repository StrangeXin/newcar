# Journey 核心系统测试设计 Spec

> 子项目 3/5：Journey 核心系统测试。

## 目标

删除 Journey 相关镜像测试（journey.test.ts 前 3 个、car-candidate.test.ts 全部、conversation.test.ts 全部、integration.test.ts 全部、journey-expire.test.ts 全部），保留已有高质量 service/controller 层单元测试，补充缺失的集成测试覆盖 Journey 生命周期端到端流程。

## 现有测试盘点

### 保留不动的高质量测试

| 文件 | 测试数 | 说明 |
|------|--------|------|
| journey.test.ts（service 部分） | 11 | JourneyService mock Prisma 测试（删前 3 个镜像） |
| journey.controller.test.ts | 8 | Controller 层测试 |
| car-candidate.service.test.ts | 17 | CarCandidateService 完整 mock 测试 |
| conversation.service.test.ts | 13 | ConversationService 完整 mock 测试 |
| timeline.test.ts | 38 | TimelineService 完整测试 |
| timeline.controller.test.ts | 11 | TimelineController 完整测试 |
| snapshot.test.ts（service 部分） | 14 | SnapshotService mock 测试（保留，删前 4 个镜像） |
| snapshot-concurrency.test.ts | 保留 | 并发控制测试 |
| add-candidate.tool.test.ts | 7 | Tool 层测试 |
| add-candidate-enhanced.test.ts | 保留 | 增强匹配测试 |
| car-detail.tool.test.ts | 保留 | CarDetail tool 测试 |
| candidate-scoring.test.ts | 保留 | 评分逻辑测试 |
| car.test.ts | 4 | Car service 测试 |

### 删除的镜像测试

| 文件 | 测试数 | 原因 |
|------|--------|------|
| journey.test.ts 前 3 个 | 3 | 纯数学/enum 比较，service 测试已覆盖 |
| car-candidate.test.ts | 4 | 硬编码 enum 数组 + 静态对象断言 |
| conversation.test.ts | 4 | 硬编码 enum 数组 + 静态结构断言 |
| integration.test.ts | 4 | 静态对象/数组操作，不调用任何真实代码 |
| journey-expire.test.ts | 3 | 纯日期数学 + 数组 filter |
| snapshot.test.ts 前 4 个 | 4 | 纯数学/静态解析断言 |

## 测试范围

### 单元测试改动

#### 1. `tests/journey.test.ts`（修改）

**删除前 3 个镜像测试：**
- "should validate stage progression order" — 硬编码数组 indexOf 比较
- "should calculate ai weight correctly for 5 min duration" — 纯数学
- "should calculate ai weight with short duration" — 纯数学

保留后续 11 个 JourneyService mock 测试不动。

#### 2. `tests/snapshot.test.ts`（修改）

**删除前 4 个 describe('Snapshot') 内的镜像测试：**
- "should calculate decay factor correctly" — 纯日期数学
- "should limit signals to 50" — Array.slice 断言
- "should limit behavior events to 300" — Array.slice 断言
- "should parse AI response correctly" — 静态 JSON 断言

保留后续 describe('SnapshotService') 共 ~10 个 service 测试不动。

#### 3. 删除整个文件

- `tests/car-candidate.test.ts`（4 个镜像）→ 被 car-candidate.service.test.ts 完全覆盖
- `tests/conversation.test.ts`（4 个镜像）→ 被 conversation.service.test.ts 完全覆盖
- `tests/integration.test.ts`（4 个镜像）→ 被集成测试覆盖
- `tests/journey-expire.test.ts`（3 个镜像）→ 由新集成测试覆盖

### 集成测试

#### 4. `tests/integration/journey-crud.integration.test.ts`（新建）

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 创建 journey | POST /journeys (member) | 201，返回 journey with stage=AWARENESS, status=ACTIVE |
| 获取活跃 journey | GET /journeys/active (member) | 200，返回含 candidates 的 journey |
| 获取 journey 详情 | GET /journeys/:id/detail (member) | 200，返回完整详情 |
| 访问他人 journey | GET /journeys/:id/detail (admin) | 403 或 404（不属于 admin） |
| 推进阶段 | PATCH /journeys/:id/stage (member) {targetStage:'CONSIDERATION'} | 200，stage 更新 |
| 拒绝回退阶段 | PATCH /journeys/:id/stage (member) {targetStage:'AWARENESS'} | 400 |
| 暂停 journey | PATCH /journeys/:id/pause (member) | 200，status=PAUSED |
| 记录行为事件 | POST /journeys/:id/events (member) {type:'CAR_VIEW', ...} | 201 |
| 未认证 | POST /journeys (no token) | 401 |

#### 5. `tests/integration/candidate-lifecycle.integration.test.ts`（新建）

前置：使用 seed 数据中 activeJourney + carBev/carPhev。

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 列出 journey 候选 | GET /journeys/:id/candidates (member) | 200，返回 seeded candidates |
| 添加候选（已存在则去重） | POST /journeys/:id/candidates (member) {carId} | 200/201 |
| 更新候选状态 | PATCH /journeys/:id/candidates/:candidateId (member) {status:'ELIMINATED'} | 200 |
| 标记 winner | POST /journeys/:id/candidates/:candidateId/winner (member) | 200，其余变 ELIMINATED |

#### 6. `tests/integration/timeline-events.integration.test.ts`（新建）

| 测试用例 | 方法 | 期望 |
|---------|------|------|
| 列出时间线事件 | GET /journeys/:id/timeline (member) | 200，events 数组 |
| 创建自定义事件 | POST /journeys/:id/timeline (member) | 201 |
| 他人无权访问 | GET /journeys/:id/timeline (admin) | 403 |

## 技术约束

- 集成测试使用 seed 数据（seed-test.ts 已有 journey + candidates）
- 候选车型相关路由需确认实际路径（可能挂载在 /journeys/:id/ 下）
- timeline 路由挂载在 /journeys/:id/timeline

## 预估

| 文件 | 类型 | 变更 | 测试数 |
|------|------|------|--------|
| journey.test.ts | Unit | 删 3 镜像 | 11（-3） |
| snapshot.test.ts | Unit | 删 4 镜像 | ~10（-4） |
| car-candidate.test.ts | Unit | 删除 | 0（-4） |
| conversation.test.ts | Unit | 删除 | 0（-4） |
| integration.test.ts | Unit | 删除 | 0（-4） |
| journey-expire.test.ts | Unit | 删除 | 0（-3） |
| journey-crud.integration.test.ts | Integration | 新建 | 9 |
| candidate-lifecycle.integration.test.ts | Integration | 新建 | 4 |
| timeline-events.integration.test.ts | Integration | 新建 | 3 |
| **净变动** | | | **-22 镜像 +16 真实 = -6 总数，质量大幅提升** |
