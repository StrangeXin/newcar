# Plan 5: 车型知识库实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立车型知识库，包含 Car/Price/Policy/Review CRUD API、种子数据初始化、Weaviate RAG 集成（语义搜索），为 AI 对话和前端候选筛选提供数据支撑。

**Tech Stack:** Node.js + TypeScript + existing Prisma (schema already complete) + Weaviate（RAG）

---

## 架构说明

### Car API vs RAG 知识库的分工

| 功能 | 实现方式 | 用途 |
|------|----------|------|
| 车型基础查询（按品牌/类型/预算筛选） | PostgreSQL + Prisma | 前端候选车型搜索 |
| 当前价格 / 政策查询 | PostgreSQL + Prisma | 动态数据，不进RAG |
| 评测内容查询 | PostgreSQL + Prisma | 静态数据读取 |
| 语义搜索（"适合家用的20万新能源"） | Weaviate 向量检索 | AI 对话工具调用 |
| 车型规格向量化 | Weaviate + text2vec | RAG 知识库 |

### 数据流

```
种子数据（JSON）→ prisma db seed → PostgreSQL
                                 ↓
                           Weaviate 同步脚本
                                 ↓
                          Weaviate Collection
                                 ↓
                      AI 对话工具 car_search 调用
```

---

## 文件结构

```
apps/api/
├── prisma/
│   └── seed.ts                          # 种子数据脚本（新建）
├── src/
│   ├── controllers/
│   │   └── car.controller.ts            # 新建
│   ├── routes/
│   │   └── cars.ts                      # 新建
│   ├── services/
│   │   ├── car.service.ts               # 新建
│   │   └── weaviate.service.ts          # 新建
│   ├── lib/
│   │   └── weaviate.ts                  # Weaviate 客户端（新建）
│   └── app.ts                           # 修改：挂载 car routes
└── tests/
    └── car.test.ts                      # 新建

scripts/
└── sync-to-weaviate.ts                  # 新建，独立脚本：将 Car+Review 同步到 Weaviate
```

---

## Task 1: Car CRUD & 搜索 API

**目标：** 提供车型查询接口，支持按品牌、燃油类型、预算范围、车型类别筛选。

**Files:**
- Create: `apps/api/src/services/car.service.ts`
- Create: `apps/api/src/controllers/car.controller.ts`
- Create: `apps/api/src/routes/cars.ts`
- Modify: `apps/api/src/app.ts`

**API 接口设计：**

| Method | Path | 描述 |
|--------|------|------|
| GET | `/cars` | 搜索/筛选车型 |
| GET | `/cars/:id` | 获取单车详情 |
| GET | `/cars/:id/price` | 获取当前价格快照（按地区） |
| GET | `/cars/:id/reviews` | 获取评测列表 |
| GET | `/policies` | 查询补贴政策（按地区/车型） |

**GET /cars 查询参数：**
- `brand` — 品牌筛选（如 BYD、Li Auto、AITO）
- `fuel_type` — 燃油类型（BEV / PHEV / HEV / ICE）
- `type` — 车型类别（SUV / SEDAN / MPV / HATCHBACK）
- `budget_min` / `budget_max` — 预算区间（单位：万元，转换为 msrp 范围）
- `q` — 关键词搜索（brand + model 文本匹配）
- `limit` / `offset` — 分页

**GET /cars/:id/price 查询参数：**
- `region` — 地区（如 "北京"、"上海"）

**GET /policies 查询参数：**
- `region` — 地区（必填）
- `car_id` — 特定车型（可选）
- `active_only` — 仅返回当前有效政策（默认 true）

**步骤：**

- [ ] **Step 1:** 创建 `apps/api/src/services/car.service.ts`，实现以下方法：
  - `searchCars(params)` — 按查询参数筛选，返回 Car 列表
  - `getCarById(id)` — 获取单车详情（含 baseSpecs）
  - `getCarPrice(carId, region?)` — 返回最新 CarPriceSnapshot
  - `getCarReviews(carId, limit?)` — 返回 CarReview 列表
  - `getPolicies(region, carId?, activeOnly?)` — 返回有效政策列表

- [ ] **Step 2:** 创建 `apps/api/src/controllers/car.controller.ts`，处理各路由的请求解析和响应格式化。注意：`budget_min/max` 参数单位为万元，需乘以 10000 转换为 `msrp` 范围。

- [ ] **Step 3:** 创建 `apps/api/src/routes/cars.ts`，注册上述路由。GET 接口不需要认证（公开数据）。

- [ ] **Step 4:** 修改 `apps/api/src/app.ts`，挂载 `app.use('/cars', carRoutes)` 和 `app.use('/policies', policyRoutes)`。

- [ ] **Step 5:** 写测试 `apps/api/tests/car.test.ts`，验证筛选逻辑（budget 转换、fuel_type 过滤）。

- [ ] **Step 6:** Commit

```
git commit -m "feat: add car search and policy API endpoints"
```

---

## Task 2: 种子数据

**目标：** 初始化 15 款主流中国市场车型，覆盖各预算段和燃油类型，确保 CarCandidate 可以关联到真实车型。

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json`（添加 prisma.seed 配置）

**种子车型清单（15款）：**

| 品牌 | 车型 | 类型 | 燃油 | MSRP（万元） |
|------|------|------|------|-------------|
| 比亚迪 | 海豹 EV | SEDAN | BEV | 17-24 |
| 比亚迪 | 宋Pro DM-i | SUV | PHEV | 15-19 |
| 比亚迪 | 汉 EV | SEDAN | BEV | 21-33 |
| 理想 | L6 | SUV | PHEV | 25-28 |
| 理想 | L7 | SUV | PHEV | 32-37 |
| 问界 | M7 Plus | SUV | PHEV | 25-32 |
| 问界 | M9 | SUV | PHEV | 47-56 |
| 小鹏 | P7 | SEDAN | BEV | 21-27 |
| 小鹏 | G6 | SUV | BEV | 21-27 |
| 深蓝 | S7 | SUV | PHEV | 14-20 |
| 极氪 | 001 | SEDAN | BEV | 27-33 |
| 特斯拉 | Model 3 | SEDAN | BEV | 23-33 |
| 特斯拉 | Model Y | SUV | BEV | 25-36 |
| 丰田 | RAV4荣放 | SUV | HEV | 19-25 |
| 大众 | 途观L Pro | SUV | ICE | 22-30 |

每款车包含：brand, model, variant（基础版/Pro/Max等主要变体）, year(2024), type, fuelType, baseSpecs（主要规格）, msrp（最低配）。

**步骤：**

- [ ] **Step 1:** 创建 `apps/api/prisma/seed.ts`，定义上述15款车的数据结构，使用 `prisma.car.upsert`（按 brand+model+variant 唯一标识，避免重复执行）。

- [ ] **Step 2:** 在 `apps/api/package.json` 中添加：
  ```json
  "prisma": { "seed": "ts-node prisma/seed.ts" }
  ```

- [ ] **Step 3:** 运行 `cd apps/api && npx prisma db seed`，验证 15 条记录写入。

- [ ] **Step 4:** Commit

```
git commit -m "feat: add car seed data with 15 popular Chinese market vehicles"
```

---

## Task 3: Weaviate 集成 — RAG 知识库

**目标：** 将车型规格和评测内容向量化入库，供 AI 对话的 `car_search` 工具调用，实现语义搜索（如"7座家用新能源30万以内"）。

**Weaviate Schema 设计：**

**Collection: `Car`**
| 属性 | 类型 | 说明 |
|------|------|------|
| `carId` | text | PostgreSQL Car.id |
| `brand` | text | 品牌 |
| `model` | text | 车型 |
| `variant` | text | 配置版本 |
| `fuelType` | text | BEV/PHEV/HEV/ICE |
| `carType` | text | SUV/SEDAN/MPV/HATCHBACK |
| `msrp` | int | 厂商建议零售价（元） |
| `specsSummary` | text | 规格自然语言描述（向量化的主要字段） |

`specsSummary` 示例：`"比亚迪海豹 EV 四驱版，纯电动轿车，续航632公里，零百加速3.8秒，5座，后备箱400L，MSRP 23万元，适合追求性能的城市通勤用户。"`

**Collection: `CarReview`**
| 属性 | 类型 | 说明 |
|------|------|------|
| `reviewId` | text | PostgreSQL CarReview.id |
| `carId` | text | 关联车型 |
| `brand` | text | 品牌（便于过滤） |
| `model` | text | 车型（便于过滤） |
| `reviewText` | text | aiSummary 或 content 截取（向量化字段） |
| `sentiment` | text | overall情感倾向（positive/neutral/negative） |

**Vectorizer 配置：** `text2vec-openai`（或 `text2vec-transformers`，用本地模型）— 以 `specsSummary` / `reviewText` 为向量化字段。

**Files:**
- Create: `apps/api/src/lib/weaviate.ts`（Weaviate 客户端单例）
- Create: `apps/api/src/services/weaviate.service.ts`（搜索接口封装）
- Create: `scripts/sync-to-weaviate.ts`（一次性同步脚本）
- Modify: `apps/api/src/services/ai-chat.service.ts`（添加 `car_search` 工具）

**步骤：**

- [ ] **Step 1:** 安装 Weaviate client：`npm install weaviate-ts-client`（在 apps/api）

- [ ] **Step 2:** 创建 `apps/api/src/lib/weaviate.ts`，初始化 Weaviate 客户端，连接到 `http://localhost:8080`（开发环境）。在 `apps/api/src/config/index.ts` 中添加 `weaviate.url` 配置项（默认 `http://localhost:8080`）。

- [ ] **Step 3:** 创建 `apps/api/src/services/weaviate.service.ts`，实现以下方法：
  - `searchCars(query, filters?)` — 语义搜索车型，支持 `fuelType`、`carType`、`maxMsrp` 过滤
  - `getCarContext(carId)` — 获取指定车型的向量化上下文（用于 AI 对话）
  - `ensureSchema()` — 创建/验证 Weaviate Schema（Car + CarReview Collection）

- [ ] **Step 4:** 创建 `scripts/sync-to-weaviate.ts`，步骤：
  1. 从 PostgreSQL 读取所有 Car 记录
  2. 为每款车生成 `specsSummary` 自然语言描述
  3. 批量写入 Weaviate Car Collection
  4. 从 PostgreSQL 读取所有 CarReview
  5. 批量写入 Weaviate CarReview Collection

- [ ] **Step 5:** 在 `docker-compose.yml` 中添加 Weaviate 服务（使用官方镜像，开启 text2vec-transformers 模块，或配置 text2vec-openai）。

- [ ] **Step 6:** 修改 `apps/api/src/services/ai-chat.service.ts`，在 AI 工具列表中添加 `car_search` 工具：
  - 工具定义：输入为 `query`（自然语言）+ 可选过滤器（fuel_type、budget_max）
  - 工具执行：调用 `weaviateService.searchCars()`，返回匹配车型列表
  - 同时添加 `get_car_detail` 工具：按 carId 从 PostgreSQL 查询完整规格

- [ ] **Step 7:** 运行同步脚本 `ts-node scripts/sync-to-weaviate.ts`，验证 Weaviate 中有数据。

- [ ] **Step 8:** Commit

```
git commit -m "feat: add Weaviate RAG integration for semantic car search"
```

---

## Task 4: CarPriceSnapshot 价格更新 API

**目标：** 提供价格快照写入接口，供后续价格爬虫或人工录入使用。同时在 AttentionSignal 流程中确保价格变动检测正常工作。

**Files:**
- Modify: `apps/api/src/routes/cars.ts`（添加价格写入路由）
- Modify: `apps/api/src/services/car.service.ts`（添加价格快照写入方法）

**新增 API：**

| Method | Path | 认证 | 描述 |
|--------|------|------|------|
| POST | `/cars/:id/price` | Admin | 写入新价格快照 |
| POST | `/policies` | Admin | 添加新补贴政策 |

**POST /cars/:id/price Request Body：**
```
{
  region: string,
  msrp: number,           // 元
  dealerDiscount: number, // 元
  effectivePrice: number, // 元
  source: string,         // 数据来源描述
  policyIds: string[]     // 关联政策 ID
}
```

**步骤：**

- [ ] **Step 1:** 在 `car.service.ts` 中添加 `createPriceSnapshot(carId, data)` 和 `createPolicy(data)` 方法。

- [ ] **Step 2:** 在 `cars.ts` 路由中添加写入接口，使用 `authMiddleware`（暂时只验证登录，Admin 角色检查后续完善）。

- [ ] **Step 3:** 添加几条测试价格快照数据（手动通过 API 或 seed 脚本），确保 AttentionSignal 的价格变动检测逻辑可以运行。

- [ ] **Step 4:** Commit

```
git commit -m "feat: add car price snapshot and policy write APIs"
```

---

## Task 5: 集成测试与验证

**步骤：**

- [ ] **Step 1:** 运行所有测试：`cd apps/api && npm test`，确保 PASS。

- [ ] **Step 2:** 手动验证以下接口：
  - `GET /cars?fuel_type=BEV&budget_max=25` — 返回25万以内纯电车型
  - `GET /cars?q=比亚迪` — 返回比亚迪品牌车型
  - `GET /cars/:id/price?region=上海` — 返回上海地区价格
  - `GET /policies?region=北京&active_only=true` — 返回北京有效政策

- [ ] **Step 3:** 验证 AI 对话中 `car_search` 工具可以调用（发一条"推荐20万SUV"的消息，确认工具被触发）。

- [ ] **Step 4:** Commit（如有修复）

---

## Dependencies

- Task 1 → Task 2（需要有车型数据才能测试搜索）
- Task 2 → Task 3（种子数据入库后同步到 Weaviate）
- Task 3 独立于 Task 4
- Task 5 依赖 Task 1-4

---

## Summary of New Files

```
apps/api/
├── prisma/seed.ts
├── src/
│   ├── controllers/car.controller.ts
│   ├── routes/cars.ts
│   ├── services/
│   │   ├── car.service.ts
│   │   └── weaviate.service.ts
│   └── lib/weaviate.ts

scripts/sync-to-weaviate.ts
```

**修改文件：**
- `apps/api/src/app.ts` — 挂载 car routes
- `apps/api/src/config/index.ts` — 添加 weaviate.url 配置
- `apps/api/src/services/ai-chat.service.ts` — 添加 car_search 工具
- `apps/api/package.json` — 添加 prisma seed 配置
- `docker-compose.yml` — 添加 Weaviate 服务

---

## Verification

```bash
# 运行测试
cd apps/api && npm test

# 验证 Car API
curl http://localhost:3000/cars?fuel_type=BEV&budget_max=250000
curl http://localhost:3000/cars?q=比亚迪
curl http://localhost:3000/policies?region=北京

# 验证种子数据
# 期望: 15条 Car 记录写入 PostgreSQL

# 验证 Weaviate
# 期望: Car + CarReview Collection 有数据
# 期望: AI 对话中 car_search 工具可以被调用
```
