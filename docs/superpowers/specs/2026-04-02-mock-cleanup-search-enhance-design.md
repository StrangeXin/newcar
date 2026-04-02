# 前端 Mock 清理 + Car Search 增强 设计 Spec

## 目标

1. 清理前端 3 个组件的 mock 数据 fallback，替换为空状态引导
2. 增强车型搜索：基于用户 journey 偏好智能排序 + 模糊匹配/同义词

---

## 子项目 A：前端 Mock 数据清理

### 问题

CandidateList、TodayUpdates、AiSummary 三个组件在真实数据为空时显示 mock 数据，用户无法区分真假。

### 改造方案

**CandidateList.tsx**
- 删除 `mockCandidates` 导入和 fallback 逻辑
- 候选为空时显示空状态卡片：
  - 图标：搜索/汽车图标
  - 标题："还没有候选车"
  - 描述："和 AI 聊聊你的购车需求，我会帮你找到合适的车型"
  - 按钮：可选，聚焦到聊天输入框

**TodayUpdates.tsx**
- 删除 `mockNotifications` 导入和 fallback 逻辑
- 无通知时显示：
  - "暂无新动态"
  - 副文案："添加候选车后，会收到价格变动、新款发布等提醒"

**AiSummary.tsx**
- 删除 `mockSnapshot` 导入和 fallback 逻辑
- 无快照时显示：
  - "AI 分析尚未生成"
  - 副文案："继续和 AI 对话，系统会自动生成旅程分析"

**清理 workspace-mock-data.ts**
- 删除 `mockCandidates`、`mockNotifications`、`mockSnapshot` 导出
- 如果文件变空则删除文件，更新所有 import

### 不改动

- `apps/web/src/lib/mock-data.ts` 保留（MOCK_MODE 开发用）
- `apps/web/src/lib/api.ts` 的 mock 拦截保留（开发用）
- `CandidateCard.tsx` 的 `isMock` 判断保留（防御性代码）

---

## 子项目 B：Car Search 智能排序

### 设计原则

- 纯函数计算，不改数据库 schema
- 不依赖外部服务
- AI 的 car_search tool 和 REST API 共用同一套排序逻辑

### 新增文件

**`apps/api/src/services/car-ranking.service.ts`**

```typescript
export interface UserPreferences {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];        // ['family', 'commute', 'long-trip']
  fuelTypePreference?: string[];  // ['BEV', 'PHEV']
  stylePreference?: string;   // 'SUV', 'SEDAN', etc.
}

export function rankByRelevance<T extends { msrp?: number | null; type: string; fuelType: string }>(
  cars: T[],
  prefs: UserPreferences,
): T[]
```

### 评分维度（总分 100）

| 维度 | 权重 | 满分条件 | 降分规则 |
|------|------|---------|---------|
| 预算匹配 | 30 | msrp 在 budgetMin~budgetMax 之间 | 偏离 10% 以内 → 20分，偏离 10-30% → 10分，>30% → 0分 |
| 用途匹配 | 25 | 车型与用途对应 | family→SUV/MPV=25, SEDAN=15; commute→SEDAN/HATCHBACK=25, SUV=15 |
| 燃料偏好 | 25 | fuelType 完全匹配 | BEV↔PHEV 互相 15分，其他 5分 |
| 车型偏好 | 20 | type === stylePreference | 不匹配 0分 |

无偏好时（字段为空），该维度所有车得满分，不影响排序。

### 修改文件

**`apps/api/src/services/car.service.ts`**
- `searchCars` 方法增加可选参数 `preferences?: UserPreferences`
- 查完 DB 后调用 `rankByRelevance(results, preferences)` 排序
- 无 preferences 时保持原有排序（updatedAt）

**`apps/api/src/tools/car-search.tool.ts`**
- 在执行搜索前，从 journey requirements 中提取 UserPreferences
- 传入 `searchCars(params, preferences)` 实现智能排序

**`apps/api/src/controllers/car.controller.ts`**
- REST API `/cars/search` 增加可选 query params：`use_case`, `style_pref`
- 从 query params 构建 UserPreferences 传入搜索

### 单元测试

**`apps/api/tests/car-ranking.service.test.ts`**

| 测试用例 | 期望 |
|---------|------|
| 无偏好 → 原序不变 | 分数全相等 |
| 预算 20-30万 → 25万车排第一，50万车排最后 | 预算内 > 预算外 |
| family 用途 → SUV/MPV 在前 | SUV > SEDAN |
| fuelType=BEV → 纯电在前，PHEV 次之 | BEV > PHEV > ICE |
| 多维度组合 → 综合得分最高的排第一 | 各维度加权和 |

---

## 子项目 C：模糊匹配 + 同义词

### 新增文件

**`apps/api/src/services/car-fuzzy.ts`**

```typescript
// 品牌别名映射
export const BRAND_ALIASES: Record<string, string[]>

// 归一化查询：去空格、转小写、别名映射
export function normalizeCarQuery(query: string): string[]

// 编辑距离模糊匹配
export function fuzzyMatchBrand(input: string, brands: string[]): string | null
```

### 品牌别名表

```typescript
{
  '比亚迪': ['BYD', 'byd'],
  '特斯拉': ['Tesla', 'tesla', 'tsla'],
  '大众': ['VW', 'Volkswagen'],
  '小鹏': ['XPeng', 'xpeng'],
  '理想': ['Li Auto', 'LiAuto', 'li'],
  '蔚来': ['NIO', 'nio'],
  '极氪': ['Zeekr', 'zeekr'],
  '问界': ['AITO', 'aito'],
  '零跑': ['Leapmotor', 'leapmotor'],
  '小米': ['Xiaomi', 'xiaomi'],
  '吉利': ['Geely', 'geely'],
  '丰田': ['Toyota', 'toyota'],
  '奇瑞': ['Chery', 'chery'],
}
```

### 模糊匹配规则

1. **精确匹配**（归一化后）：`理想L6` → `理想 L6` ✓
2. **别名匹配**：`Tesla Model 3` → `特斯拉 Model 3` ✓
3. **编辑距离**（≤2）：`理像L6` → `理想L6` ✓
4. **品牌+型号拆分**：`比亚迪秦L` → brand=`比亚迪`, model=`秦L` ✓

### 修改文件

- `apps/api/src/tools/add-candidate.tool.ts` — 车名解析前先调用 `normalizeCarQuery`
- `apps/api/src/tools/car-detail.tool.ts` — 同上
- `apps/api/src/services/car.service.ts` — `searchCars` 的 `q` 参数先归一化

### 单元测试

**`apps/api/tests/car-fuzzy.test.ts`**

| 测试用例 | 期望 |
|---------|------|
| `normalizeCarQuery('理想L6')` | `['理想 L6', '理想L6']` |
| `normalizeCarQuery('Tesla Model 3')` | `['特斯拉 Model 3', 'Tesla Model 3']` |
| `normalizeCarQuery('byd')` | `['比亚迪', 'byd']` |
| `fuzzyMatchBrand('理像', [...brands])` | `'理想'` |
| `fuzzyMatchBrand('小朋', [...brands])` | `'小鹏'` |
| `fuzzyMatchBrand('宝马', [...brands])` | `null`（不在列表中不误匹配） |

---

## 技术约束

- 前端改动仅涉及 3 个组件 + 1 个 mock 数据文件，不动 API 层
- 后端排序和模糊匹配都是纯函数，可完全单元测试
- 不新增任何外部依赖
- 不改动数据库 schema

## 预估

| 子项目 | 新增文件 | 修改文件 | 工作量 |
|--------|---------|---------|--------|
| A. Mock 清理 | 0 | 4 (3 组件 + 1 mock 数据) | 小 |
| B. 智能排序 | 2 (service + test) | 3 (car.service + tool + controller) | 中 |
| C. 模糊匹配 | 2 (fuzzy + test) | 3 (car.service + 2 tools) | 中 |
