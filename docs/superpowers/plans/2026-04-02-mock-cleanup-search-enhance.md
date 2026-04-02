# Mock 清理 + Car Search 增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理前端 3 个组件的 mock fallback 替换为空状态引导，并增强车型搜索的智能排序和模糊匹配。

**Architecture:** 前端改动纯 UI 层（删 mock import，加空状态），后端新增两个纯函数模块（car-ranking + car-fuzzy），通过 car.service 和 tools 集成到搜索流程。

**Tech Stack:** React/Next.js, TypeScript, Vitest, Prisma

---

## File Structure

### 新增文件

| 文件路径 | 职责 |
|---------|------|
| `apps/api/src/services/car-ranking.service.ts` | 基于用户偏好的搜索结果排序纯函数 |
| `apps/api/src/services/car-fuzzy.ts` | 品牌别名 + 查询归一化 + 编辑距离模糊匹配 |
| `apps/api/tests/car-ranking.service.test.ts` | 排序单元测试 |
| `apps/api/tests/car-fuzzy.test.ts` | 模糊匹配单元测试 |

### 修改文件

| 文件路径 | 改动 |
|---------|------|
| `apps/web/src/components/journey/CandidateList.tsx` | 删 mock fallback，加空状态 |
| `apps/web/src/components/journey/TodayUpdates.tsx` | 删 mock fallback，加空状态 |
| `apps/web/src/components/journey/AiSummary.tsx` | 删 mock fallback，加空状态 |
| `apps/web/src/components/journey/workspace-mock-data.ts` | 删除文件 |
| `apps/api/src/services/car.service.ts` | 集成排序 + 模糊匹配 |
| `apps/api/src/services/car-query.ts` | 查询归一化 |
| `apps/api/src/tools/car-search.tool.ts` | 传入 journey preferences |
| `apps/api/src/tools/add-candidate.tool.ts` | 用 fuzzy 解析车名 |
| `apps/api/src/tools/car-detail.tool.ts` | 用 fuzzy 解析车名 |

---

## Task 1: CandidateList 空状态

**Files:**
- Modify: `apps/web/src/components/journey/CandidateList.tsx`

- [ ] **Step 1: 删除 mock 导入和 fallback**

在 `CandidateList.tsx` 中删除第 8 行的 import 和第 18 行的 fallback：

删除：
```typescript
import { mockCandidates } from './workspace-mock-data';
```

将第 18 行：
```typescript
const displayCandidates = candidates.length > 0 ? candidates : mockCandidates;
```
改为：
```typescript
const displayCandidates = candidates;
```

- [ ] **Step 2: 验证构建**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: 编译成功（或仅有不相关警告）

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/journey/CandidateList.tsx
git commit -m "fix(web): replace mock candidate fallback with empty state"
```

---

## Task 2: TodayUpdates 空状态

**Files:**
- Modify: `apps/web/src/components/journey/TodayUpdates.tsx`

- [ ] **Step 1: 删除 mock 导入和 fallback，加空状态 UI**

删除第 8 行：
```typescript
import { mockNotifications } from './workspace-mock-data';
```

将第 31 行：
```typescript
const displayItems = unread.length > 0 ? unread : mockNotifications;
```
改为：
```typescript
const displayItems = unread;
```

在 `<ul>` 之前（第 63 行前），加空状态判断：

```tsx
      {!isLoading && displayItems.length === 0 ? (
        <div className="mt-[10px] flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[var(--border)] px-4 py-6 text-center">
          <Bell className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[11px] font-semibold text-[var(--text-soft)]">暂无新动态</p>
          <p className="text-[10px] leading-[1.5] text-[var(--text-muted)]">添加候选车后，会收到价格变动、新款发布等提醒</p>
        </div>
      ) : null}
```

将 `<ul>` 包裹在条件中，仅在有数据时渲染：

```tsx
      {displayItems.length > 0 ? (
        <ul className="mt-[10px] space-y-[10px]">
          {displayItems.map((item) => (
            ...existing code...
          ))}
        </ul>
      ) : null}
```

同时更新 badge 计数，当无数据时不显示：

将 badge 的 `{displayItems.length} 条未读` 改为 `{displayItems.length > 0 ? `${displayItems.length} 条未读` : '无未读'}`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/journey/TodayUpdates.tsx
git commit -m "fix(web): replace mock notification fallback with empty state"
```

---

## Task 3: AiSummary 空状态

**Files:**
- Modify: `apps/web/src/components/journey/AiSummary.tsx`

- [ ] **Step 1: 删除 mock 导入和 fallback，加空状态 UI**

删除第 9 行：
```typescript
import { mockSnapshot } from './workspace-mock-data';
```

将第 32 行：
```typescript
const displaySnapshot = snapshot || mockSnapshot;
```
改为：
```typescript
const displaySnapshot = snapshot;
```

在 `{displaySnapshot ? (` 之后加一个 else 分支。将第 83-121 行的条件渲染改为：

```tsx
      {!isLoading && !displaySnapshot ? (
        <div className="mt-[14px] flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[var(--border)] px-4 py-6 text-center">
          <Sparkles className="h-6 w-6 text-[var(--text-muted)]" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[11px] font-semibold text-[var(--text-soft)]">AI 分析尚未生成</p>
          <p className="text-[10px] leading-[1.5] text-[var(--text-muted)]">继续和 AI 对话，系统会自动生成旅程分析</p>
        </div>
      ) : null}
      {displaySnapshot ? (
        ...existing snapshot rendering...
      ) : null}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/journey/AiSummary.tsx
git commit -m "fix(web): replace mock snapshot fallback with empty state"
```

---

## Task 4: 删除 workspace-mock-data.ts

**Files:**
- Delete: `apps/web/src/components/journey/workspace-mock-data.ts`

- [ ] **Step 1: 确认无其他引用**

Run: `grep -r 'workspace-mock-data' apps/web/src/ --include="*.ts" --include="*.tsx"`
Expected: 0 个结果（Task 1-3 已删除所有 import）

- [ ] **Step 2: 删除文件**

```bash
rm apps/web/src/components/journey/workspace-mock-data.ts
```

- [ ] **Step 3: 验证构建**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(web): remove workspace-mock-data.ts (no longer needed)"
```

---

## Task 5: Car Ranking 单元测试（红）

**Files:**
- Create: `apps/api/tests/car-ranking.service.test.ts`

- [ ] **Step 1: 写测试文件**

```typescript
// apps/api/tests/car-ranking.service.test.ts
import { describe, it, expect } from 'vitest';
import { rankByRelevance, UserPreferences } from '../src/services/car-ranking.service';

interface TestCar {
  id: string;
  brand: string;
  model: string;
  msrp: number | null;
  type: string;
  fuelType: string;
}

const CARS: TestCar[] = [
  { id: 'c1', brand: '理想', model: 'L6', msrp: 249800, type: 'SUV', fuelType: 'PHEV' },
  { id: 'c2', brand: '特斯拉', model: 'Model 3', msrp: 231900, type: 'SEDAN', fuelType: 'BEV' },
  { id: 'c3', brand: '问界', model: 'M9', msrp: 469800, type: 'SUV', fuelType: 'PHEV' },
  { id: 'c4', brand: '比亚迪', model: '海鸥', msrp: 69800, type: 'HATCHBACK', fuelType: 'BEV' },
  { id: 'c5', brand: '腾势', model: 'D9', msrp: 309800, type: 'MPV', fuelType: 'PHEV' },
];

describe('rankByRelevance', () => {
  it('无偏好 → 原序不变', () => {
    const result = rankByRelevance(CARS, {});
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('预算 20-30万 → 预算内的排前面', () => {
    const prefs: UserPreferences = { budgetMin: 200000, budgetMax: 300000 };
    const result = rankByRelevance(CARS, prefs);
    // c1(24.98万) 和 c2(23.19万) 在预算内，应排前两位
    expect(result[0].id).toBe('c1');
    expect(result[1].id).toBe('c2');
    // c3(46.98万) 和 c4(6.98万) 严重偏离，排后面
    const lastTwo = result.slice(-2).map((c) => c.id);
    expect(lastTwo).toContain('c3');
    expect(lastTwo).toContain('c4');
  });

  it('family 用途 → SUV/MPV 在前', () => {
    const prefs: UserPreferences = { useCases: ['family'] };
    const result = rankByRelevance(CARS, prefs);
    // SUV 和 MPV 类型的应排前面
    const topTypes = result.slice(0, 3).map((c) => c.type);
    expect(topTypes).toContain('SUV');
    expect(topTypes).toContain('MPV');
  });

  it('commute 用途 → SEDAN/HATCHBACK 在前', () => {
    const prefs: UserPreferences = { useCases: ['commute'] };
    const result = rankByRelevance(CARS, prefs);
    const topTypes = result.slice(0, 2).map((c) => c.type);
    expect(topTypes).toContain('SEDAN');
    expect(topTypes).toContain('HATCHBACK');
  });

  it('fuelType=BEV → 纯电在前', () => {
    const prefs: UserPreferences = { fuelTypePreference: ['BEV'] };
    const result = rankByRelevance(CARS, prefs);
    // c2 和 c4 是 BEV，应排前两位
    const topFuels = result.slice(0, 2).map((c) => c.fuelType);
    expect(topFuels).toEqual(['BEV', 'BEV']);
  });

  it('stylePreference=SUV → SUV 在前', () => {
    const prefs: UserPreferences = { stylePreference: 'SUV' };
    const result = rankByRelevance(CARS, prefs);
    const topTypes = result.slice(0, 2).map((c) => c.type);
    expect(topTypes).toEqual(['SUV', 'SUV']);
  });

  it('多维度组合 → 综合最匹配排第一', () => {
    const prefs: UserPreferences = {
      budgetMin: 200000,
      budgetMax: 300000,
      useCases: ['family'],
      fuelTypePreference: ['PHEV'],
      stylePreference: 'SUV',
    };
    const result = rankByRelevance(CARS, prefs);
    // c1(理想L6) 全维度匹配：预算内+SUV+PHEV+family → 应排第一
    expect(result[0].id).toBe('c1');
  });

  it('msrp 为 null 的车不崩溃', () => {
    const carsWithNull = [...CARS, { id: 'c6', brand: '测试', model: 'X', msrp: null, type: 'SUV', fuelType: 'BEV' }];
    const prefs: UserPreferences = { budgetMin: 200000, budgetMax: 300000 };
    const result = rankByRelevance(carsWithNull, prefs);
    expect(result).toHaveLength(6);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd apps/api && npx vitest run tests/car-ranking.service.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/car-ranking.service.test.ts
git commit -m "test: add car-ranking unit tests (red phase)"
```

---

## Task 6: Car Ranking 实现（绿）

**Files:**
- Create: `apps/api/src/services/car-ranking.service.ts`

- [ ] **Step 1: 实现排序纯函数**

```typescript
// apps/api/src/services/car-ranking.service.ts

export interface UserPreferences {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  stylePreference?: string;
}

const USE_CASE_TYPE_MAP: Record<string, string[]> = {
  family: ['SUV', 'MPV'],
  commute: ['SEDAN', 'HATCHBACK'],
  'long-trip': ['SUV', 'SEDAN'],
  offroad: ['SUV'],
};

export function rankByRelevance<
  T extends { msrp?: number | null; type: string; fuelType: string },
>(cars: T[], prefs: UserPreferences): T[] {
  if (!prefs || Object.keys(prefs).length === 0) {
    return cars;
  }

  const scored = cars.map((car) => ({
    car,
    score: calcScore(car, prefs),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.car);
}

function calcScore(
  car: { msrp?: number | null; type: string; fuelType: string },
  prefs: UserPreferences,
): number {
  let score = 0;
  score += scoreBudget(car.msrp, prefs.budgetMin, prefs.budgetMax);
  score += scoreUseCase(car.type, prefs.useCases);
  score += scoreFuelType(car.fuelType, prefs.fuelTypePreference);
  score += scoreStyle(car.type, prefs.stylePreference);
  return score;
}

function scoreBudget(
  msrp: number | null | undefined,
  min?: number,
  max?: number,
): number {
  if (min === undefined && max === undefined) return 30;
  if (msrp == null) return 15;

  const midBudget = ((min || 0) + (max || min || 0)) / 2 || msrp;
  const range = (max || midBudget) - (min || 0) || midBudget;
  const deviation = Math.abs(msrp - midBudget) / range;

  if (min !== undefined && max !== undefined && msrp >= min && msrp <= max) return 30;
  if (deviation <= 0.1) return 20;
  if (deviation <= 0.3) return 10;
  return 0;
}

function scoreUseCase(type: string, useCases?: string[]): number {
  if (!useCases || useCases.length === 0) return 25;

  for (const useCase of useCases) {
    const preferred = USE_CASE_TYPE_MAP[useCase];
    if (preferred) {
      if (preferred[0] === type) return 25;
      if (preferred.includes(type)) return 20;
    }
  }
  return 10;
}

function scoreFuelType(fuelType: string, preferences?: string[]): number {
  if (!preferences || preferences.length === 0) return 25;
  if (preferences.includes(fuelType)) return 25;

  const similar: Record<string, string[]> = {
    BEV: ['PHEV'],
    PHEV: ['BEV', 'HEV'],
    HEV: ['PHEV'],
    ICE: [],
  };
  if (similar[preferences[0]]?.includes(fuelType)) return 15;
  return 5;
}

function scoreStyle(type: string, stylePreference?: string): number {
  if (!stylePreference) return 20;
  return type === stylePreference ? 20 : 0;
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/car-ranking.service.test.ts`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/car-ranking.service.ts
git commit -m "feat: add car-ranking service with preference-based scoring"
```

---

## Task 7: Car Fuzzy 单元测试（红）

**Files:**
- Create: `apps/api/tests/car-fuzzy.test.ts`

- [ ] **Step 1: 写测试文件**

```typescript
// apps/api/tests/car-fuzzy.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeCarQuery,
  fuzzyMatchBrand,
  BRAND_ALIASES,
} from '../src/services/car-fuzzy';

describe('normalizeCarQuery', () => {
  it('中文品牌+英文型号 → 拆分加空格', () => {
    const result = normalizeCarQuery('理想L6');
    expect(result).toContain('理想 L6');
  });

  it('英文别名 → 映射为中文', () => {
    const result = normalizeCarQuery('Tesla Model 3');
    expect(result).toContain('特斯拉 Model 3');
  });

  it('小写别名 → 映射为中文', () => {
    const result = normalizeCarQuery('byd');
    expect(result).toContain('比亚迪');
  });

  it('已经正确的查询 → 原样返回', () => {
    const result = normalizeCarQuery('理想 L6');
    expect(result).toContain('理想 L6');
  });

  it('空字符串 → 返回空数组', () => {
    const result = normalizeCarQuery('');
    expect(result).toHaveLength(0);
  });
});

describe('fuzzyMatchBrand', () => {
  const brands = Object.keys(BRAND_ALIASES);

  it('精确匹配', () => {
    expect(fuzzyMatchBrand('理想', brands)).toBe('理想');
  });

  it('编辑距离 1 → 匹配', () => {
    expect(fuzzyMatchBrand('理像', brands)).toBe('理想');
  });

  it('编辑距离 1 → 匹配（小朋→小鹏）', () => {
    expect(fuzzyMatchBrand('小朋', brands)).toBe('小鹏');
  });

  it('不在列表中 → 返回 null', () => {
    expect(fuzzyMatchBrand('宝马', brands)).toBeNull();
  });

  it('编辑距离太大 → 返回 null', () => {
    expect(fuzzyMatchBrand('东风日产', brands)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd apps/api && npx vitest run tests/car-fuzzy.test.ts`
Expected: FAIL

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/car-fuzzy.test.ts
git commit -m "test: add car-fuzzy unit tests (red phase)"
```

---

## Task 8: Car Fuzzy 实现（绿）

**Files:**
- Create: `apps/api/src/services/car-fuzzy.ts`

- [ ] **Step 1: 实现模糊匹配模块**

```typescript
// apps/api/src/services/car-fuzzy.ts

export const BRAND_ALIASES: Record<string, string[]> = {
  '比亚迪': ['BYD', 'byd'],
  '特斯拉': ['Tesla', 'tesla', 'tsla'],
  '大众': ['VW', 'Volkswagen', 'volkswagen'],
  '小鹏': ['XPeng', 'xpeng'],
  '理想': ['Li Auto', 'LiAuto', 'li', 'lixiang'],
  '蔚来': ['NIO', 'nio'],
  '极氪': ['Zeekr', 'zeekr'],
  '问界': ['AITO', 'aito'],
  '零跑': ['Leapmotor', 'leapmotor'],
  '小米': ['Xiaomi', 'xiaomi'],
  '吉利': ['Geely', 'geely'],
  '吉利银河': ['Galaxy', 'galaxy'],
  '丰田': ['Toyota', 'toyota'],
  '奇瑞': ['Chery', 'chery'],
  '腾势': ['Denza', 'denza'],
  '深蓝': ['Deepal', 'deepal'],
  '哪吒': ['Neta', 'neta'],
  '岚图': ['Voyah', 'voyah'],
  '方程豹': [],
  '智界': [],
  '享界': [],
};

// 反向别名表（启动时构建）
const REVERSE_ALIAS = new Map<string, string>();
for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
  for (const alias of aliases) {
    REVERSE_ALIAS.set(alias.toLowerCase(), brand);
  }
}

/**
 * 归一化查询：别名映射 + 中文品牌与英文型号拆分
 * 返回多个候选查询词（用于 OR 搜索）
 */
export function normalizeCarQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = new Set<string>();
  results.add(trimmed);

  // 别名映射
  const lower = trimmed.toLowerCase();
  const mappedBrand = REVERSE_ALIAS.get(lower);
  if (mappedBrand) {
    results.add(mappedBrand);
    return [...results];
  }

  // 检查是否包含别名作为前缀（如 "Tesla Model 3"）
  for (const [alias, brand] of REVERSE_ALIAS) {
    if (lower.startsWith(alias + ' ') || lower.startsWith(alias)) {
      const rest = trimmed.slice(alias.length).trim();
      if (rest) {
        results.add(`${brand} ${rest}`);
      } else {
        results.add(brand);
      }
    }
  }

  // 中文品牌 + 英文/数字型号拆分："理想L6" → "理想 L6"
  const splitMatch = trimmed.match(/^([\u4e00-\u9fa5]+)([A-Za-z0-9].*)$/);
  if (splitMatch) {
    results.add(`${splitMatch[1]} ${splitMatch[2]}`);
  }

  return [...results];
}

/**
 * 编辑距离（Levenshtein）
 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * 模糊匹配品牌名：编辑距离 ≤ 1 视为匹配
 */
export function fuzzyMatchBrand(
  input: string,
  brands: string[],
): string | null {
  // 精确匹配优先
  if (brands.includes(input)) return input;

  // 编辑距离匹配（阈值 1，对于短字符串更严格）
  let bestMatch: string | null = null;
  let bestDist = Infinity;

  for (const brand of brands) {
    const dist = editDistance(input, brand);
    if (dist <= 1 && dist < bestDist) {
      bestDist = dist;
      bestMatch = brand;
    }
  }

  return bestMatch;
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/car-fuzzy.test.ts`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/car-fuzzy.ts
git commit -m "feat: add car-fuzzy with brand aliases and edit distance matching"
```

---

## Task 9: 集成排序到 car.service + car_search tool

**Files:**
- Modify: `apps/api/src/services/car.service.ts`
- Modify: `apps/api/src/services/car-query.ts`
- Modify: `apps/api/src/tools/car-search.tool.ts`

- [ ] **Step 1: car-query.ts 增加归一化**

在 `apps/api/src/services/car-query.ts` 的顶部添加 import：

```typescript
import { normalizeCarQuery } from './car-fuzzy';
```

修改 `buildCarSearchWhere` 中的 `q` 处理（第 44-50 行）：

将：
```typescript
  if (params.q) {
    where.OR = [
      { brand: { contains: params.q, mode: 'insensitive' } },
      { model: { contains: params.q, mode: 'insensitive' } },
      { variant: { contains: params.q, mode: 'insensitive' } },
    ];
  }
```

改为：
```typescript
  if (params.q) {
    const queries = normalizeCarQuery(params.q);
    const orClauses: Prisma.CarWhereInput[] = [];
    for (const q of queries) {
      orClauses.push(
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { variant: { contains: q, mode: 'insensitive' } },
      );
    }
    if (orClauses.length > 0) {
      where.OR = orClauses;
    }
  }
```

- [ ] **Step 2: car.service.ts 增加可选排序参数**

在 `apps/api/src/services/car.service.ts` 顶部添加 import：

```typescript
import { rankByRelevance, UserPreferences } from './car-ranking.service';
```

修改 `searchCars` 方法签名和返回：

```typescript
  async searchCars(params: CarSearchParams, preferences?: UserPreferences) {
    const where = buildCarSearchWhere(params);
    const take = Math.max(1, Math.min(params.limit ?? 20, 100));
    const skip = Math.max(0, params.offset ?? 0);

    const cars = await prisma.car.findMany({
      where,
      take,
      skip,
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (preferences && Object.keys(preferences).length > 0) {
      return rankByRelevance(cars, preferences);
    }
    return cars;
  }
```

- [ ] **Step 3: car-search tool 传入 journey preferences**

在 `apps/api/src/tools/car-search.tool.ts` 中，修改 `runCarSearch` 函数签名，接收 journey context：

在文件顶部添加 import：
```typescript
import type { UserPreferences } from '../services/car-ranking.service';
```

修改 `runCarSearch` 签名：
```typescript
export async function runCarSearch(
  input: Record<string, unknown>,
  context?: { requirements?: Record<string, unknown> },
) {
```

在 `carService.searchCars` 调用时传入 preferences：
```typescript
  // 从 journey requirements 提取偏好
  const preferences: UserPreferences = {};
  if (context?.requirements) {
    const req = context.requirements;
    if (typeof req.budgetMin === 'number') preferences.budgetMin = req.budgetMin;
    if (typeof req.budgetMax === 'number') preferences.budgetMax = req.budgetMax;
    if (Array.isArray(req.useCases)) preferences.useCases = req.useCases as string[];
    if (Array.isArray(req.fuelTypePreference)) preferences.fuelTypePreference = req.fuelTypePreference as string[];
    if (typeof req.stylePreference === 'string') preferences.stylePreference = req.stylePreference;
  }

  const cars = await carService.searchCars({
    q: query,
    budgetMin: toYuanFromWan(typeof input.budgetMin === 'number' ? input.budgetMin : undefined),
    budgetMax: toYuanFromWan(typeof input.budgetMax === 'number' ? input.budgetMax : undefined),
    fuelType: typeof input.fuelType === 'string' ? input.fuelType : undefined,
    carType: typeof input.carType === 'string' ? input.carType : undefined,
    limit,
  }, preferences);
```

- [ ] **Step 4: 运行全部测试**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/car-query.ts apps/api/src/services/car.service.ts apps/api/src/tools/car-search.tool.ts
git commit -m "feat: integrate ranking + fuzzy into car search pipeline"
```

---

## Task 10: 集成模糊匹配到 add-candidate + car-detail tools

**Files:**
- Modify: `apps/api/src/tools/add-candidate.tool.ts`
- Modify: `apps/api/src/tools/car-detail.tool.ts`

- [ ] **Step 1: add-candidate.tool.ts 用 normalizeCarQuery**

在文件顶部添加 import：
```typescript
import { normalizeCarQuery } from '../services/car-fuzzy';
```

找到车名解析逻辑（约第 20-68 行），在 `fallbackQuery` 生成后、搜索前，增加归一化：

在 `const fallbackQuery = query || carId;` 之后，添加：
```typescript
  const normalizedQueries = normalizeCarQuery(fallbackQuery);
```

修改搜索逻辑，用归一化后的查询：在现有的 `carService.searchCars({ q: fallbackQuery })` 调用中，如果 `normalizedQueries` 有多个候选，依次尝试直到找到结果。

具体改法：将现有的单次搜索改为循环：

在 `if (!car && fallbackQuery) {` 块内，将搜索改为：
```typescript
  if (!car && fallbackQuery) {
    const queries = normalizeCarQuery(fallbackQuery);
    let candidates: Awaited<ReturnType<typeof carService.searchCars>> = [];

    for (const q of queries) {
      candidates = await carService.searchCars({ q, limit: 10 });
      if (candidates.length > 0) break;
    }
```

保持后续的精确匹配逻辑（`candidates.find(...)` 等）不变。

- [ ] **Step 2: car-detail.tool.ts 同样处理**

同样的改法：添加 import，在搜索前归一化查询，依次尝试。

- [ ] **Step 3: 运行全部测试**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tools/add-candidate.tool.ts apps/api/src/tools/car-detail.tool.ts
git commit -m "feat: integrate fuzzy matching into add-candidate and car-detail tools"
```

---

## Task 11: 集成验证

- [ ] **Step 1: 运行全部单元测试**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 2: 验证前端编译**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: integration verification pass"
```
