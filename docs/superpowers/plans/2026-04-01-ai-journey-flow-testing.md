# AI 购车助手全旅程流程 + 测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Journey Completeness Model（旅程完整度计算）+ Promptfoo 驱动的 4 层测试体系 + CI/CD 集成。

**Architecture:** 子项目 A 是纯函数计算模型，在 chat service 构建 system prompt 时注入完整度信息引导 AI。子项目 B 用 Promptfoo 框架实现 L1(Mock) / L2(Real AI) / L3(Red Team) / L4(Regression) 四层测试，L1 通过 Vitest wrapper 运行，L2-L4 通过 promptfoo CLI 运行。子项目 C 添加 GitHub Actions workflow。

**Tech Stack:** TypeScript, Vitest, Promptfoo, Express/Supertest, GitHub Actions

---

## File Structure

### 新增文件

| 文件路径 | 职责 |
|---------|------|
| `packages/shared/src/types/journey-completeness.ts` | CompletenessResult 类型定义 |
| `apps/api/src/services/journey-completeness.service.ts` | 纯函数：计算旅程完整度 |
| `apps/api/src/services/chat/completeness-prompt.ts` | 生成完整度 prompt context block |
| `apps/api/tests/journey-completeness.service.test.ts` | 完整度计算单元测试 |
| `apps/api/promptfoo/providers/newcar-chat-provider.ts` | Promptfoo Custom Provider |
| `apps/api/promptfoo/hooks/lifecycle.ts` | beforeAll/afterAll extension hooks |
| `apps/api/promptfoo/mock-responses/family-buyer.json` | 场景 1 mock 回复 |
| `apps/api/promptfoo/mock-responses/explorer-buyer.json` | 场景 2 mock 回复 |
| `apps/api/promptfoo/mock-responses/indecisive-buyer.json` | 场景 3 mock 回复 |
| `apps/api/promptfoo/scenarios/family-buyer.yaml` | 场景 1 L1 测试脚本 |
| `apps/api/promptfoo/scenarios/explorer-buyer.yaml` | 场景 2 L1 测试脚本 |
| `apps/api/promptfoo/scenarios/indecisive-buyer.yaml` | 场景 3 L1 测试脚本 |
| `apps/api/promptfoo/promptfooconfig.yaml` | L1 Mock 主配置 |
| `apps/api/promptfoo/promptfooconfig.real-ai.yaml` | L2 Real AI 配置 |
| `apps/api/promptfoo/promptfooconfig.redteam.yaml` | L3 Red Team 配置 |
| `apps/api/tests/e2e/promptfoo-e2e.test.ts` | Vitest wrapper 调用 promptfoo |
| `apps/api/vitest.config.e2e.ts` | E2E 测试 Vitest 配置 |
| `.github/workflows/ai-eval.yml` | CI/CD workflow |

### 修改文件

| 文件路径 | 改动 |
|---------|------|
| `packages/shared/src/index.ts` | 导出 journey-completeness 类型 |
| `apps/api/src/services/chat/chat.service.ts` | runChat 中注入完整度 block + runMockChat 增加场景路由 |
| `apps/api/package.json` | 添加 promptfoo 依赖和新脚本 |

---

## Task 1: CompletenessResult 类型定义

**Files:**
- Create: `packages/shared/src/types/journey-completeness.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// packages/shared/src/types/journey-completeness.ts

export interface CompletenessResult {
  stage: string;
  score: number;              // 0-100
  missingItems: string[];     // 中文描述的缺失项列表
  suggestions: string[];      // 给 AI 的引导建议
}
```

- [ ] **Step 2: 在 barrel export 中导出**

在 `packages/shared/src/index.ts` 末尾添加：

```typescript
export * from './types/journey-completeness';
```

- [ ] **Step 3: 验证编译**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/journey-completeness.ts packages/shared/src/index.ts
git commit -m "feat(shared): add CompletenessResult type definition"
```

---

## Task 2: Journey Completeness Service — 单元测试

**Files:**
- Create: `apps/api/tests/journey-completeness.service.test.ts`

先写测试，后实现（TDD）。测试不依赖任何 mock，因为 `calculateCompleteness` 是纯函数。

- [ ] **Step 1: 写完整的测试文件**

```typescript
// apps/api/tests/journey-completeness.service.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCompleteness } from '../src/services/journey-completeness.service';

// Helper: 构造最小 journey 对象
function makeJourney(overrides: Record<string, unknown> = {}) {
  return {
    id: 'j1',
    stage: 'AWARENESS',
    requirements: {},
    ...overrides,
  };
}

// Helper: 构造候选车对象
function makeCandidate(
  status: 'ACTIVE' | 'ELIMINATED' | 'WINNER' = 'ACTIVE',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    status,
    userNotes: null,
    car: { id: 'car1', brand: '理想', model: 'L6' },
    ...overrides,
  };
}

// Helper: 构造信号对象
function makeSignal(type: string = 'PREFERENCE', value: string = 'test') {
  return { type, value, confidence: 0.8 };
}

// Helper: 构造快照对象
function makeSnapshot() {
  return { id: 's1', journeyId: 'j1', trigger: 'DAILY' };
}

describe('calculateCompleteness', () => {
  // ─── AWARENESS ───
  describe('AWARENESS stage', () => {
    it('requirements 全空 → score=0, 4 个缺失项', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'AWARENESS', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.stage).toBe('AWARENESS');
      expect(result.score).toBe(0);
      expect(result.missingItems).toHaveLength(4);
    });

    it('budgetMin+budgetMax 已填 → score=25', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: { budgetMin: 20, budgetMax: 30 },
        }),
        [],
        [],
        [],
      );
      expect(result.score).toBe(25);
      expect(result.missingItems).toHaveLength(3);
    });

    it('全部已填 → score=100, missingItems 为空', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [],
        [],
        [],
      );
      expect(result.score).toBe(100);
      expect(result.missingItems).toHaveLength(0);
    });
  });

  // ─── CONSIDERATION ───
  describe('CONSIDERATION stage', () => {
    it('0 个候选 → score 低, missingItems 含"至少1个候选车"', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'CONSIDERATION', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.score).toBeLessThan(50);
      expect(result.missingItems).toEqual(
        expect.arrayContaining([expect.stringContaining('候选车')]),
      );
    });

    it('2 候选 + signals + 完整 awareness → score 高', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'CONSIDERATION',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [makeCandidate(), makeCandidate()],
        [makeSignal(), makeSignal()],
        [],
      );
      expect(result.score).toBeGreaterThanOrEqual(75);
    });
  });

  // ─── COMPARISON ───
  describe('COMPARISON stage', () => {
    it('2 ACTIVE + 1 ELIMINATED + snapshot → score >= 80', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [makeSignal('PREFERENCE')],
        [makeSnapshot()],
      );
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('用户换车后只剩 1 ACTIVE → score 下降', () => {
      const full = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [makeSignal('PREFERENCE')],
        [makeSnapshot()],
      );
      const reduced = calculateCompleteness(
        makeJourney({ stage: 'COMPARISON' }),
        [makeCandidate('ACTIVE'), makeCandidate('ELIMINATED')],
        [],
        [],
      );
      expect(reduced.score).toBeLessThan(full.score);
    });
  });

  // ─── DECISION ───
  describe('DECISION stage', () => {
    it('有 WINNER + notes → score >= 70', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'DECISION' }),
        [makeCandidate('WINNER', { userNotes: '空间大，适合家用' })],
        [],
        [],
      );
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('WINNER 被取消 → score 下降到 0-30', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'DECISION' }),
        [makeCandidate('ELIMINATED')],
        [],
        [],
      );
      expect(result.score).toBeLessThanOrEqual(30);
    });
  });

  // ─── PURCHASE ───
  describe('PURCHASE stage', () => {
    it('WINNER 确认 + 可发布 → score=100', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'PURCHASE' }),
        [
          makeCandidate('WINNER', { userNotes: '最终选择' }),
          makeCandidate('ELIMINATED'),
        ],
        [makeSignal(), makeSignal(), makeSignal()],
        [makeSnapshot()],
      );
      expect(result.score).toBe(100);
    });
  });

  // ─── suggestions ───
  describe('suggestions', () => {
    it('总是返回非空 suggestions 数组（当有缺失项时）', () => {
      const result = calculateCompleteness(
        makeJourney({ stage: 'AWARENESS', requirements: {} }),
        [],
        [],
        [],
      );
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('满分时 suggestions 为空', () => {
      const result = calculateCompleteness(
        makeJourney({
          stage: 'AWARENESS',
          requirements: {
            budgetMin: 20,
            budgetMax: 30,
            useCases: ['family'],
            fuelTypePreference: ['BEV'],
            stylePreference: 'SUV',
          },
        }),
        [],
        [],
        [],
      );
      expect(result.suggestions).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx vitest run tests/journey-completeness.service.test.ts`
Expected: FAIL — `Cannot find module '../src/services/journey-completeness.service'`

- [ ] **Step 3: Commit 测试文件**

```bash
git add apps/api/tests/journey-completeness.service.test.ts
git commit -m "test: add journey-completeness unit tests (red phase)"
```

---

## Task 3: Journey Completeness Service — 实现

**Files:**
- Create: `apps/api/src/services/journey-completeness.service.ts`

- [ ] **Step 1: 实现 calculateCompleteness 纯函数**

```typescript
// apps/api/src/services/journey-completeness.service.ts
import type { CompletenessResult } from '@newcar/shared';

interface JourneyInput {
  id: string;
  stage: string;
  requirements: Record<string, unknown>;
}

interface CandidateInput {
  id: string;
  status: string;
  userNotes?: string | null;
  car: { id: string; brand: string; model: string };
}

interface SignalInput {
  type: string;
  value: string;
  confidence: number;
}

interface SnapshotInput {
  id: string;
}

export function calculateCompleteness(
  journey: JourneyInput,
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const req = journey.requirements || {};
  const stage = journey.stage;

  switch (stage) {
    case 'AWARENESS':
      return calcAwareness(req);
    case 'CONSIDERATION':
      return calcConsideration(req, candidates, signals);
    case 'COMPARISON':
      return calcComparison(candidates, signals, snapshots);
    case 'DECISION':
      return calcDecision(candidates);
    case 'PURCHASE':
      return calcPurchase(candidates, signals, snapshots);
    default:
      return { stage, score: 0, missingItems: [], suggestions: [] };
  }
}

function calcAwareness(req: Record<string, unknown>): CompletenessResult {
  const items: { label: string; met: boolean }[] = [
    { label: '预算范围已明确', met: Boolean(req.budgetMin && req.budgetMax) },
    { label: '用途已明确', met: isNonEmptyArray(req.useCases) },
    { label: '燃料偏好已明确', met: isNonEmptyArray(req.fuelTypePreference) },
    { label: '车型偏好已明确', met: Boolean(req.stylePreference) },
  ];

  return buildResult('AWARENESS', items, 25);
}

function calcConsideration(
  req: Record<string, unknown>,
  candidates: CandidateInput[],
  signals: SignalInput[],
): CompletenessResult {
  const awarenessComplete =
    Boolean(req.budgetMin && req.budgetMax) &&
    isNonEmptyArray(req.useCases) &&
    isNonEmptyArray(req.fuelTypePreference) &&
    Boolean(req.stylePreference);

  const items: { label: string; met: boolean }[] = [
    { label: 'AWARENESS 维度完成', met: awarenessComplete },
    { label: '至少 1 个候选车', met: candidates.filter((c) => c.status !== 'ELIMINATED').length >= 1 },
    { label: '至少浏览过 2 款车', met: candidates.length >= 2 },
    { label: '有提取到的偏好信号', met: signals.length > 0 },
  ];

  return buildResult('CONSIDERATION', items, [20, 30, 25, 25]);
}

function calcComparison(
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const activeCandidates = candidates.filter((c) => c.status === 'ACTIVE');
  const eliminatedCandidates = candidates.filter((c) => c.status === 'ELIMINATED');
  const preferenceSignals = signals.filter((s) => s.type === 'PREFERENCE');

  const items: { label: string; met: boolean }[] = [
    { label: '至少 2 个 ACTIVE 候选车', met: activeCandidates.length >= 2 },
    { label: '有候选车被淘汰', met: eliminatedCandidates.length > 0 },
    { label: 'AI 生成过快照分析', met: snapshots.length > 0 },
    { label: '用户表达过倾向', met: preferenceSignals.length > 0 },
  ];

  return buildResult('COMPARISON', items, [30, 25, 25, 20]);
}

function calcDecision(candidates: CandidateInput[]): CompletenessResult {
  const winner = candidates.find((c) => c.status === 'WINNER');

  const items: { label: string; met: boolean }[] = [
    { label: '有 1 个明确的 WINNER', met: Boolean(winner) },
    { label: '选择理由已记录', met: Boolean(winner?.userNotes) },
    { label: '最终预算已确认', met: Boolean(winner) },
  ];

  return buildResult('DECISION', items, [40, 30, 30]);
}

function calcPurchase(
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const winner = candidates.find((c) => c.status === 'WINNER');
  // 可发布条件：有 winner + 足够内容（>= 3 信号 + >= 1 快照 + >= 2 候选）
  const hasEnoughContent =
    signals.length >= 3 && snapshots.length >= 1 && candidates.length >= 2;

  const items: { label: string; met: boolean }[] = [
    { label: 'WINNER 状态确认', met: Boolean(winner) },
    { label: '旅程可发布', met: hasEnoughContent },
  ];

  return buildResult('PURCHASE', items, [50, 50]);
}

// ─── Helpers ───

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function buildResult(
  stage: string,
  items: { label: string; met: boolean }[],
  weights: number | number[],
): CompletenessResult {
  const weightArray = Array.isArray(weights) ? weights : items.map(() => weights);
  let score = 0;
  const missingItems: string[] = [];

  for (let i = 0; i < items.length; i++) {
    if (items[i].met) {
      score += weightArray[i];
    } else {
      missingItems.push(items[i].label);
    }
  }

  const suggestions = missingItems.map((item) => `引导用户补全：${item}`);

  return { stage, score, missingItems, suggestions };
}
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd apps/api && npx vitest run tests/journey-completeness.service.test.ts`
Expected: 全部 PASS（10 个测试）

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/journey-completeness.service.ts
git commit -m "feat: add journey-completeness service (pure function)"
```

---

## Task 4: Completeness Prompt Builder + 注入 Chat Service

**Files:**
- Create: `apps/api/src/services/chat/completeness-prompt.ts`
- Modify: `apps/api/src/services/chat/chat.service.ts`

- [ ] **Step 1: 创建 completeness-prompt.ts**

```typescript
// apps/api/src/services/chat/completeness-prompt.ts
import type { CompletenessResult } from '@newcar/shared';

export function buildCompletenessBlock(result: CompletenessResult): string {
  const lines = [
    '## 当前旅程状态',
    `- 阶段: ${result.stage}`,
    `- 完整度: ${result.score}/100`,
  ];

  if (result.missingItems.length > 0) {
    lines.push(`- 缺失信息: ${result.missingItems.join(', ')}`);
  }

  lines.push('');
  lines.push('## 引导策略');
  lines.push('根据缺失信息，自然地在对话中引导用户补全。');
  lines.push('不要一次问太多问题，每轮聚焦 1-2 个点。');
  lines.push('如果用户主动换话题或换车，跟随用户节奏，不要强拉回来。');
  lines.push('当完整度 >= 80 时，可以建议推进到下一阶段，但不要强制。');
  lines.push('用户在做决定前更换候选车是完全正常的，帮助用户重新梳理即可。');

  return lines.join('\n');
}
```

- [ ] **Step 2: 修改 chat.service.ts — 在 runChat 中注入完整度 block**

在 `apps/api/src/services/chat/chat.service.ts` 中，找到 `runChat` 方法内 `const existingRequirements` 行（约第 158 行），在其后、`if (config.ai.e2eMock)` 之前，添加完整度计算：

在文件顶部添加 import：

```typescript
import { calculateCompleteness } from '../journey-completeness.service';
import { buildCompletenessBlock } from './completeness-prompt';
```

在 `const existingRequirements = ...` 之后（约第 159 行后），`const extractedSignals = buildSignals(...)` 之前，添加：

```typescript
    // 计算旅程完整度
    const completeness = calculateCompleteness(
      {
        id: journey.id,
        stage: journey.stage,
        requirements: existingRequirements,
      },
      (journey.candidates || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        status: c.status as string,
        userNotes: c.userNotes as string | null,
        car: c.car as { id: string; brand: string; model: string },
      })),
      extractedSignals.map((s) => ({
        type: s.type,
        value: s.value,
        confidence: s.confidence,
      })),
      (journey.snapshots || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
      })),
    );
    const completenessBlock = buildCompletenessBlock(completeness);
```

注意：`extractedSignals` 在完整度计算之前已定义，需要把 `const extractedSignals = buildSignals(...)` 移到完整度计算之前。实际上它已经在第 159 行，所以顺序是正确的。

等等——重新检查代码顺序。原始代码是：
1. L158: `const existingRequirements = ...`
2. L159: `const extractedSignals = buildSignals(...)`
3. L165: `if (config.ai.e2eMock) { ... }`

所以完整度计算应放在 L159 之后、L165 之前。这样 `extractedSignals` 可用。

然后在 real AI 路径中（`journeyDeepAgentService.streamJourneyChat` 调用之前），将 `completenessBlock` 附加到传入的上下文中。找到约第 232 行的 `streamJourneyChat` 调用，在传入的 journey 对象中添加 `completenessContext: completenessBlock`。

具体修改：在 `const fullContentResult = await journeyDeepAgentService.streamJourneyChat(` 的参数中，找到 `requirements: existingRequirements,` 行，在其后添加：

```typescript
          completenessContext: completenessBlock,
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`
Expected: 无错误（或仅有已知的非相关警告）

- [ ] **Step 4: 运行全部现有测试确保无回归**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/chat/completeness-prompt.ts apps/api/src/services/chat/chat.service.ts
git commit -m "feat: inject journey completeness into chat system prompt"
```

---

## Task 5: 安装 Promptfoo + 配置脚本

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/vitest.config.e2e.ts`

- [ ] **Step 1: 安装 promptfoo**

Run: `cd apps/api && npm install -D promptfoo`

- [ ] **Step 2: 添加 package.json 脚本**

在 `apps/api/package.json` 的 `scripts` 中添加：

```json
"test:e2e": "vitest run --config vitest.config.e2e.ts",
"test:real-ai": "REAL_AI_TEST=true promptfoo eval -c promptfoo/promptfooconfig.real-ai.yaml",
"test:redteam": "promptfoo redteam run -c promptfoo/promptfooconfig.redteam.yaml",
"test:eval-view": "promptfoo view"
```

- [ ] **Step 3: 创建 e2e vitest 配置**

```typescript
// apps/api/vitest.config.e2e.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60000,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/vitest.config.e2e.ts
git commit -m "chore: add promptfoo dependency and e2e test scripts"
```

---

## Task 6: Mock Chat 场景路由增强

**Files:**
- Modify: `apps/api/src/services/chat/chat.service.ts`
- Create: `apps/api/promptfoo/mock-responses/family-buyer.json`
- Create: `apps/api/promptfoo/mock-responses/explorer-buyer.json`
- Create: `apps/api/promptfoo/mock-responses/indecisive-buyer.json`

- [ ] **Step 1: 创建 3 个场景 mock 回复 JSON**

```json
// apps/api/promptfoo/mock-responses/family-buyer.json
{
  "scenarioId": "family-buyer",
  "description": "家庭刚需型 — 8 轮走完 AWARENESS → PURCHASE",
  "rounds": [
    {
      "round": 1,
      "response": "了解！25-30万的SUV，家用接送孩子为主。我帮你搜索一下这个价位段的热门SUV车型。",
      "tools": [
        { "name": "journey_update", "input": { "requirements": { "budgetMin": 25, "budgetMax": 30, "useCases": ["family"], "stylePreference": "SUV" }, "stage": "CONSIDERATION" } },
        { "name": "car_search", "input": { "query": "SUV", "budgetMin": 25, "budgetMax": 30, "limit": 5 } }
      ]
    },
    {
      "round": 2,
      "response": "理想L6是一款不错的增程SUV，空间表现优秀。我把它加入你的候选列表。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "用户主动提及，家用SUV候选" } }
      ]
    },
    {
      "round": 3,
      "response": "好的，问界M7也加入候选了。现在你有两款候选车，我们可以开始对比了。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "用户主动提及对比" } }
      ]
    },
    {
      "round": 4,
      "response": "来看看这两款车的对比：理想L6在空间和舒适性上更突出，增程续航无忧；问界M7智能化程度高，华为生态体验好。价格方面两者相近。",
      "tools": [
        { "name": "journey_update", "input": { "stage": "COMPARISON" } }
      ]
    },
    {
      "round": 5,
      "response": "理解，空间确实是家用SUV的关键指标。我把问界M7标记为淘汰。",
      "tools": [
        { "name": "journey_update", "input": { "eliminateCandidate": "问界M7" } }
      ]
    },
    {
      "round": 6,
      "response": "深蓝S7也是不错的选择，性价比很高。加入候选帮你和理想L6对比。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "对比用" } }
      ]
    },
    {
      "round": 7,
      "response": "好的！理想L6确认为你的最终选择。恭喜做出决定！",
      "tools": [
        { "name": "journey_update", "input": { "stage": "DECISION", "winner": "理想L6" } }
      ]
    },
    {
      "round": 8,
      "response": "恭喜完成购车旅程！你的旅程总结：从25-30万家用SUV需求出发，经过理想L6、问界M7、深蓝S7的对比，最终选择了理想L6。这段旅程可以发布分享给其他用户参考。",
      "tools": [
        { "name": "journey_update", "input": { "stage": "PURCHASE" } }
      ]
    }
  ]
}
```

```json
// apps/api/promptfoo/mock-responses/explorer-buyer.json
{
  "scenarioId": "explorer-buyer",
  "description": "预算模糊探索型 — 6 轮，AI 主动引导",
  "rounds": [
    {
      "round": 1,
      "response": "没问题！买车确实需要好好想想。先聊聊你的用车场景吧——主要是上下班通勤还是经常跑长途？大概预算在什么范围？",
      "tools": []
    },
    {
      "round": 2,
      "response": "上下班通勤为主，15万以内，我帮你看看合适的车型。",
      "tools": [
        { "name": "journey_update", "input": { "requirements": { "budgetMax": 15, "useCases": ["commute"] }, "stage": "CONSIDERATION" } },
        { "name": "car_search", "input": { "query": "通勤轿车", "budgetMax": 15, "limit": 5 } }
      ]
    },
    {
      "round": 3,
      "response": "纯电车的续航现在已经很成熟了。15万内的纯电车普遍续航在400-500公里，日常通勤30公里以内完全够用，一周充一次电就行。",
      "tools": [
        { "name": "journey_update", "input": { "requirements": { "fuelTypePreference": ["BEV"] } } }
      ]
    },
    {
      "round": 4,
      "response": "比亚迪秦PLUS EV是这个价位的热门选择，续航和性价比都不错。已加入候选。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "用户主动选择" } }
      ]
    },
    {
      "round": 5,
      "response": "当然，我再帮你搜搜其他同价位的纯电轿车，看看有没有更好的选择。",
      "tools": [
        { "name": "car_search", "input": { "query": "纯电轿车", "budgetMax": 15, "fuelType": "BEV", "limit": 5 } }
      ]
    },
    {
      "round": 6,
      "response": "好的！比亚迪秦PLUS EV确认为你的最终选择。性价比之选，通勤利器！",
      "tools": [
        { "name": "journey_update", "input": { "stage": "DECISION", "winner": "比亚迪秦PLUS EV" } }
      ]
    }
  ]
}
```

```json
// apps/api/promptfoo/mock-responses/indecisive-buyer.json
{
  "scenarioId": "indecisive-buyer",
  "description": "反复横跳型 — 10 轮，DECISION 阶段反悔换车",
  "rounds": [
    {
      "round": 1,
      "response": "了解！25-30万的SUV，家用为主。帮你搜索这个价位的热门SUV。",
      "tools": [
        { "name": "journey_update", "input": { "requirements": { "budgetMin": 25, "budgetMax": 30, "useCases": ["family"], "stylePreference": "SUV" }, "stage": "CONSIDERATION" } },
        { "name": "car_search", "input": { "query": "SUV", "budgetMin": 25, "budgetMax": 30, "limit": 5 } }
      ]
    },
    {
      "round": 2,
      "response": "理想L6是一款不错的增程SUV，已加入候选列表。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "家用SUV候选" } }
      ]
    },
    {
      "round": 3,
      "response": "问界M7也加入了，现在有两款候选。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "对比用" } }
      ]
    },
    {
      "round": 4,
      "response": "理想L6空间更大适合家用，问界M7智能化更强。进入对比阶段。",
      "tools": [
        { "name": "journey_update", "input": { "stage": "COMPARISON" } }
      ]
    },
    {
      "round": 5,
      "response": "好的，问界M7空间确实偏小，已标记淘汰。",
      "tools": [
        { "name": "journey_update", "input": { "eliminateCandidate": "问界M7" } }
      ]
    },
    {
      "round": 6,
      "response": "好的！理想L6确认为你的最终选择！",
      "tools": [
        { "name": "journey_update", "input": { "stage": "DECISION", "winner": "理想L6" } }
      ]
    },
    {
      "round": 7,
      "response": "没问题！小鹏G6也是不错的选择，我帮你加入候选重新对比。",
      "tools": [
        { "name": "add_candidate", "input": { "carId": "auto", "userNotes": "朋友推荐，重新对比" } }
      ]
    },
    {
      "round": 8,
      "response": "理想L6增程续航无忧，空间大；小鹏G6智能驾驶领先，纯电动力强。价格上小鹏G6略低。",
      "tools": []
    },
    {
      "round": 9,
      "response": "好的！最终还是选择理想L6，空间和家用需求更匹配。确认为最终选择。",
      "tools": [
        { "name": "journey_update", "input": { "stage": "DECISION", "winner": "理想L6" } }
      ]
    },
    {
      "round": 10,
      "response": "旅程完成！虽然中间考虑过小鹏G6，但理想L6的大空间更适合你的家庭需求。这段旅程可以发布分享了！",
      "tools": [
        { "name": "journey_update", "input": { "stage": "PURCHASE" } }
      ]
    }
  ]
}
```

- [ ] **Step 2: 修改 runMockChat — 增加场景驱动路由**

在 `apps/api/src/services/chat/chat.service.ts` 的 `runMockChat` 方法开头（约第 395 行 `private async runMockChat(data: ChatOptions, existingRequirements: Record<string, unknown>) {` 之后），添加场景路由逻辑：

```typescript
    // 场景驱动 mock：当有 x-scenario-id header 时，使用预定义回复
    if (data.scenarioId) {
      return this.runScenarioMock(data);
    }
```

在 `ChatOptions` 接口（约第 40 行）中添加可选字段：

```typescript
  scenarioId?: string;
  scenarioRound?: number;
```

在 `AiChatService` 类中添加新方法（在 `runMockChat` 之后）：

```typescript
  private scenarioRoundCounters = new Map<string, number>();

  private async runScenarioMock(data: ChatOptions): Promise<string> {
    const scenarioId = data.scenarioId!;
    const counterKey = `${data.journeyId}:${scenarioId}`;
    const round = (this.scenarioRoundCounters.get(counterKey) || 0) + 1;
    this.scenarioRoundCounters.set(counterKey, round);

    let scenarioData: { rounds: Array<{ round: number; response: string; tools: Array<{ name: string; input: Record<string, unknown> }> }> };
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(__dirname, '../../promptfoo/mock-responses', `${scenarioId}.json`);
      scenarioData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      const fallback = `[Mock] 场景 ${scenarioId} 未找到，轮次 ${round}`;
      data.onEvent?.({ type: 'token', delta: fallback });
      return fallback;
    }

    const roundData = scenarioData.rounds.find((r) => r.round === round);
    if (!roundData) {
      const fallback = `[Mock] 场景 ${scenarioId} 无第 ${round} 轮数据`;
      data.onEvent?.({ type: 'token', delta: fallback });
      return fallback;
    }

    // 执行工具调用
    for (const tool of roundData.tools) {
      if (this.isChatToolName(tool.name)) {
        await this.emitMockTool(data, tool.name as ChatToolName, tool.input);
      }
    }

    // 流式输出回复
    for (const chunk of roundData.response.match(/.{1,12}/g) || [roundData.response]) {
      data.onEvent?.({ type: 'token', delta: chunk });
    }

    return roundData.response;
  }
```

- [ ] **Step 3: 运行现有测试确保无回归**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/promptfoo/mock-responses/ apps/api/src/services/chat/chat.service.ts
git commit -m "feat: add scenario-driven mock chat with 3 buyer scenarios"
```

---

## Task 7: Promptfoo Custom Provider

**Files:**
- Create: `apps/api/promptfoo/providers/newcar-chat-provider.ts`

- [ ] **Step 1: 实现 Custom Provider**

```typescript
// apps/api/promptfoo/providers/newcar-chat-provider.ts
import type { ApiProvider, ProviderResponse } from 'promptfoo';
import { resolve } from 'path';

// 动态导入 app 和 supertest，避免顶层副作用
let appInstance: unknown = null;
let supertestInstance: typeof import('supertest').default;

async function getApp() {
  if (!appInstance) {
    // 设置测试环境
    process.env.AI_E2E_MOCK = '1';
    process.env.NODE_ENV = 'test';

    const { createApp } = await import(resolve(__dirname, '../../src/app'));
    appInstance = createApp();
    supertestInstance = (await import('supertest')).default;
  }
  return { app: appInstance, supertest: supertestInstance };
}

interface ProviderConfig {
  scenarioId?: string;
  journeyId?: string;
  userId?: string;
  mode?: 'mock' | 'real-ai';
}

export default class NewcarChatProvider implements ApiProvider {
  private config: ProviderConfig;
  private roundCounter = 0;

  constructor(options: { config?: ProviderConfig; id?: string } = {}) {
    this.config = options.config || {};
  }

  id(): string {
    return `newcar-chat:${this.config.scenarioId || 'default'}`;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    this.roundCounter++;
    const { app, supertest } = await getApp();

    const journeyId = this.config.journeyId || 'test-journey-id';

    try {
      const request = supertest(app)
        .post(`/journeys/${journeyId}/chat`)
        .send({ message: prompt });

      if (this.config.scenarioId) {
        request.set('x-scenario-id', this.config.scenarioId);
      }

      const res = await request;

      if (res.status !== 200) {
        return {
          error: `HTTP ${res.status}: ${JSON.stringify(res.body)}`,
        };
      }

      const body = res.body;
      return {
        output: body.message || body.fullContent || '',
        metadata: {
          toolsCalled: body.toolsCalled || [],
          journeyState: body.journeyState || {},
          completeness: body.completeness || {},
          round: this.roundCounter,
        },
      };
    } catch (err) {
      return {
        error: `Provider error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/promptfoo/providers/newcar-chat-provider.ts
git commit -m "feat: add Promptfoo custom provider for newcar chat API"
```

---

## Task 8: Promptfoo Extension Hooks

**Files:**
- Create: `apps/api/promptfoo/hooks/lifecycle.ts`

- [ ] **Step 1: 实现 lifecycle hooks**

```typescript
// apps/api/promptfoo/hooks/lifecycle.ts
import type { UnifiedConfig } from 'promptfoo';

interface HookContext {
  vars?: Record<string, unknown>;
  results?: unknown[];
}

// beforeAll: 设置测试环境
export async function beforeAll(
  _config: UnifiedConfig,
  _context: HookContext,
): Promise<void> {
  process.env.AI_E2E_MOCK = '1';
  process.env.NODE_ENV = 'test';
  console.log('[lifecycle] Test environment initialized');
}

// afterAll: 输出完整度报告
export async function afterAll(
  _config: UnifiedConfig,
  context: HookContext,
): Promise<void> {
  const results = context.results || [];
  const passed = (results as Array<{ success?: boolean }>).filter((r) => r.success).length;
  const total = results.length;
  console.log(`[lifecycle] Test complete: ${passed}/${total} passed`);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/promptfoo/hooks/lifecycle.ts
git commit -m "feat: add Promptfoo lifecycle hooks (beforeAll/afterAll)"
```

---

## Task 9: L1 场景测试 YAML + 主配置

**Files:**
- Create: `apps/api/promptfoo/scenarios/family-buyer.yaml`
- Create: `apps/api/promptfoo/scenarios/explorer-buyer.yaml`
- Create: `apps/api/promptfoo/scenarios/indecisive-buyer.yaml`
- Create: `apps/api/promptfoo/promptfooconfig.yaml`

- [ ] **Step 1: 创建 family-buyer.yaml**

```yaml
# apps/api/promptfoo/scenarios/family-buyer.yaml
# 场景 1：家庭刚需型 — 8 轮走完全旅程
tests:
  - vars:
      message: "我想买一辆25-30万的SUV，家用为主，接送孩子"
    assert:
      - type: icontains-any
        value: ["SUV", "推荐", "预算", "搜索"]
      - type: javascript
        value: "output.metadata.toolsCalled.includes('car_search')"

  - vars:
      message: "理想L6怎么样？帮我加入候选"
    assert:
      - type: icontains-any
        value: ["理想", "L6"]
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"
      - type: javascript
        value: "output.metadata.journeyState.candidateCount >= 1"

  - vars:
      message: "再看看问界M7"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"
      - type: javascript
        value: "output.metadata.journeyState.candidateCount >= 2"

  - vars:
      message: "这两款帮我对比一下优缺点"
    assert:
      - type: icontains-any
        value: ["对比", "优", "缺", "空间", "价格"]
      - type: javascript
        value: "output.metadata.journeyState.stage === 'COMPARISON'"

  - vars:
      message: "问界空间小了点，不考虑了"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.some(t => t === 'journey_update') || output.metadata.journeyState.eliminatedCount >= 1"

  - vars:
      message: "深蓝S7加入候选对比一下"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.candidateCount >= 2"

  - vars:
      message: "还是理想L6吧，就选它了"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.hasWinner === true"
      - type: javascript
        value: "output.metadata.journeyState.stage === 'DECISION'"

  - vars:
      message: "确认购买，帮我总结一下这段旅程"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.stage === 'PURCHASE'"
      - type: javascript
        value: "output.metadata.completeness.score >= 80"
```

- [ ] **Step 2: 创建 explorer-buyer.yaml**

```yaml
# apps/api/promptfoo/scenarios/explorer-buyer.yaml
# 场景 2：预算模糊探索型 — 6 轮，AI 主动引导
tests:
  - vars:
      message: "我想买车，不知道买什么好"
    assert:
      - type: icontains-any
        value: ["预算", "用途", "场景", "需求"]

  - vars:
      message: "上下班用，预算不超过15万"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('car_search')"

  - vars:
      message: "纯电的续航够吗？"
    assert:
      - type: icontains-any
        value: ["续航", "公里", "充电"]

  - vars:
      message: "比亚迪秦不错，加入候选"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"
      - type: javascript
        value: "output.metadata.journeyState.candidateCount >= 1"

  - vars:
      message: "还有别的推荐吗"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('car_search')"

  - vars:
      message: "就比亚迪秦吧，确认了"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.hasWinner === true"
      - type: javascript
        value: "output.metadata.journeyState.stage === 'DECISION'"
```

- [ ] **Step 3: 创建 indecisive-buyer.yaml**

```yaml
# apps/api/promptfoo/scenarios/indecisive-buyer.yaml
# 场景 3：反复横跳型 — 10 轮，DECISION 阶段反悔换车
tests:
  - vars:
      message: "我想买一辆25-30万的SUV，家用为主"
    assert:
      - type: icontains-any
        value: ["SUV", "搜索", "推荐"]
      - type: javascript
        value: "output.metadata.toolsCalled.includes('car_search')"

  - vars:
      message: "理想L6加入候选"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"

  - vars:
      message: "问界M7也加入"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"
      - type: javascript
        value: "output.metadata.journeyState.candidateCount >= 2"

  - vars:
      message: "对比一下这两款"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.stage === 'COMPARISON'"

  - vars:
      message: "问界空间小了，淘汰"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.eliminatedCount >= 1"

  - vars:
      message: "理想L6就它了"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.hasWinner === true"
      - type: javascript
        value: "output.metadata.journeyState.stage === 'DECISION'"

  - vars:
      message: "等等，我朋友说小鹏G6不错"
    assert:
      - type: javascript
        value: "output.metadata.toolsCalled.includes('add_candidate')"

  - vars:
      message: "帮我和理想L6对比一下"
    assert:
      - type: icontains-any
        value: ["对比", "优势", "理想", "小鹏"]

  - vars:
      message: "还是理想L6好"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.hasWinner === true"

  - vars:
      message: "确认，发布旅程"
    assert:
      - type: javascript
        value: "output.metadata.journeyState.stage === 'PURCHASE'"
      - type: javascript
        value: "output.metadata.completeness.score >= 80"
```

- [ ] **Step 4: 创建 L1 主配置 promptfooconfig.yaml**

```yaml
# apps/api/promptfoo/promptfooconfig.yaml
# L1: 脚本化 Mock 测试 — 零 API 成本，每次提交运行

description: "Newcar AI 购车助手 L1 Mock 测试"

providers:
  - id: "./providers/newcar-chat-provider.ts"
    config:
      mode: mock

extensions:
  - "./hooks/lifecycle.ts"

scenarios:
  - id: family-buyer
    config:
      scenarioId: family-buyer
    tests: "./scenarios/family-buyer.yaml"

  - id: explorer-buyer
    config:
      scenarioId: explorer-buyer
    tests: "./scenarios/explorer-buyer.yaml"

  - id: indecisive-buyer
    config:
      scenarioId: indecisive-buyer
    tests: "./scenarios/indecisive-buyer.yaml"

defaultTest:
  options:
    provider:
      config:
        mode: mock
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/promptfoo/scenarios/ apps/api/promptfoo/promptfooconfig.yaml
git commit -m "feat: add L1 scenario YAML tests and main promptfoo config"
```

---

## Task 10: Vitest E2E Wrapper

**Files:**
- Create: `apps/api/tests/e2e/promptfoo-e2e.test.ts`

- [ ] **Step 1: 创建 Vitest wrapper**

```typescript
// apps/api/tests/e2e/promptfoo-e2e.test.ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

describe('Promptfoo L1 Mock Tests', () => {
  it('should pass all L1 scenario tests', async () => {
    const { evaluate } = await import('promptfoo');

    const configPath = resolve(__dirname, '../../promptfoo/promptfooconfig.yaml');

    const results = await evaluate({
      config: configPath,
      maxConcurrency: 1,
    });

    const failedTests = results.results.filter(
      (r) => !r.success,
    );

    if (failedTests.length > 0) {
      const failures = failedTests.map(
        (t) =>
          `  - ${t.vars?.message || 'unknown'}: ${
            t.failureReason || 'assertion failed'
          }`,
      );
      console.error(`Failed tests:\n${failures.join('\n')}`);
    }

    expect(failedTests).toHaveLength(0);
  }, 120000);
});
```

- [ ] **Step 2: 运行确认（预期暂时失败，因为 provider 还没完全集成 DB）**

Run: `cd apps/api && npx vitest run --config vitest.config.e2e.ts`
Expected: 可能因 DB/app 初始化问题失败 — 这是正常的，后续调试

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/e2e/promptfoo-e2e.test.ts
git commit -m "feat: add Vitest E2E wrapper for Promptfoo L1 tests"
```

---

## Task 11: L2 Real AI 配置

**Files:**
- Create: `apps/api/promptfoo/promptfooconfig.real-ai.yaml`

- [ ] **Step 1: 创建 L2 配置文件**

```yaml
# apps/api/promptfoo/promptfooconfig.real-ai.yaml
# L2: 模拟用户 + Real AI — 需要 API key，手动/每日运行

description: "Newcar AI 购车助手 L2 Real AI 测试"

providers:
  - id: "./providers/newcar-chat-provider.ts"
    config:
      mode: real-ai

tests:
  # 画像 1：家庭用户
  - provider:
      id: "promptfoo:simulated-user"
      config:
        maxTurns: 10
        instructions: >
          你是一位30岁的家庭用户，预算25-30万，想买SUV，
          主要接送孩子和周末出游。你倾向新能源车。
          你会自然地和AI顾问对话，按照AI的引导逐步明确需求、
          看车、对比、做决定。你不会主动提很多要求，
          需要AI引导你。当你满意了就确认购买。
    assert:
      - type: llm-rubric
        value: >
          评估这段购车咨询对话：
          1. AI 是否专业地引导了用户明确需求？
          2. AI 是否推荐了合适的车型？
          3. AI 是否帮助用户做了对比分析？
          4. 对话是否自然流畅？
          5. 最终是否达成了购车决定？
      - type: answer-relevance
      - type: javascript
        value: "output.metadata.journeyState.stage !== 'AWARENESS'"

  # 画像 2：通勤用户
  - provider:
      id: "promptfoo:simulated-user"
      config:
        maxTurns: 8
        instructions: >
          你是一位25岁的上班族，预算10-15万，主要上下班通勤。
          你对车不太了解，需要AI帮你从零开始。
          你比较在意省油/省电和好停车。
    assert:
      - type: llm-rubric
        value: >
          评估对话质量：AI是否从零引导新手用户，
          推荐了合适价位的车型，对话自然且专业。
      - type: answer-relevance

  # 画像 3：犹豫不决用户
  - provider:
      id: "promptfoo:simulated-user"
      config:
        maxTurns: 12
        instructions: >
          你是一位35岁用户，预算25-35万，想买SUV但拿不定主意。
          你会频繁改变想法，先选A后选B再回到A。
          你会在决定后突然说"等等，我再想想"。
          测试AI是否能耐心应对你的反复。
    assert:
      - type: llm-rubric
        value: >
          评估AI应对犹豫用户的能力：
          1. 用户反复改变主意时AI是否保持耐心？
          2. AI是否帮助用户理清思路而非催促决定？
          3. 当用户反悔时AI是否自然地重新梳理？
      - type: answer-relevance
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/promptfoo/promptfooconfig.real-ai.yaml
git commit -m "feat: add L2 Real AI promptfoo config with 3 simulated user profiles"
```

---

## Task 12: L3 Red Team 配置

**Files:**
- Create: `apps/api/promptfoo/promptfooconfig.redteam.yaml`

- [ ] **Step 1: 创建 L3 Red Team 配置**

```yaml
# apps/api/promptfoo/promptfooconfig.redteam.yaml
# L3: Red Teaming — 需要真实 API，每周/release 前运行

description: "Newcar AI 购车助手 L3 Red Team 安全测试"

providers:
  - id: "./providers/newcar-chat-provider.ts"
    config:
      mode: real-ai

redteam:
  purpose: "AI购车顾问，帮助用户选车和购车决策"
  plugins:
    - hijacking          # 话题劫持（诱导讨论非汽车话题）
    - hallucination      # 幻觉（编造不存在的车型/价格）
    - overreliance       # 过度依赖（不加验证地接受用户错误信息）
    - prompt-extraction  # system prompt 泄露
    - competitors        # 竞品攻击（诱导推荐竞品平台）
    - contracts          # 合同陷阱（诱导做出价格承诺）
  strategies:
    - jailbreak
    - prompt-injection
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/promptfoo/promptfooconfig.redteam.yaml
git commit -m "feat: add L3 Red Team promptfoo config"
```

---

## Task 13: CI/CD GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/ai-eval.yml`

- [ ] **Step 1: 创建 workflow 文件**

```yaml
# .github/workflows/ai-eval.yml
name: AI Evaluation

on:
  pull_request:
    paths:
      - 'apps/api/src/services/chat/**'
      - 'apps/api/src/tools/**'
      - 'apps/api/promptfoo/**'

jobs:
  l1-mock-test:
    name: L1 Mock Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run L1 Mock Tests
        run: cd apps/api && npm run test:e2e
        env:
          AI_E2E_MOCK: "1"
          NODE_ENV: test

  l2-real-ai-test:
    name: L2 Real AI Tests
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'ai-eval')
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Cache Promptfoo
        uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: promptfoo-${{ hashFiles('apps/api/promptfoo/**') }}
          restore-keys: promptfoo-

      - name: Run L2 Real AI Tests
        run: cd apps/api && npm run test:real-ai
        env:
          AI_API_KEY: ${{ secrets.AI_API_KEY }}
          AI_BASE_URL: ${{ secrets.AI_BASE_URL }}
          NODE_ENV: test

  l4-regression:
    name: L4 Regression Detection
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'ai-eval')
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Cache Promptfoo
        uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: promptfoo-${{ hashFiles('apps/api/promptfoo/**') }}
          restore-keys: promptfoo-

      - uses: promptfoo/promptfoo-action@v1
        with:
          config: apps/api/promptfoo/promptfooconfig.real-ai.yaml
          cache-path: ~/.cache/promptfoo
          compare-baseline: true
          fail-on-regression: true
        env:
          AI_API_KEY: ${{ secrets.AI_API_KEY }}
          AI_BASE_URL: ${{ secrets.AI_BASE_URL }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ai-eval.yml
git commit -m "ci: add AI evaluation workflow (L1 mock + L2 real AI + L4 regression)"
```

---

## Task 14: Chat API 路由增加 scenarioId 传递

**Files:**
- Modify: `apps/api/src/services/chat/chat.service.ts` (runChat 方法)

Provider 通过 HTTP 请求传入 `x-scenario-id` header，需要在 chat 路由中将其传递给 `ChatOptions.scenarioId`。

- [ ] **Step 1: 查找 chat 路由处理函数**

找到处理 `POST /journeys/:id/chat` 的 controller/route，在其中读取 `req.headers['x-scenario-id']` 并传入 `ChatOptions`。

在调用 `aiChatService.chat()` 或 `aiChatService.streamChat()` 时，添加：

```typescript
scenarioId: req.headers['x-scenario-id'] as string | undefined,
```

- [ ] **Step 2: 验证编译**

Run: `cd apps/api && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行全部测试确认无回归**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/
git commit -m "feat: pass x-scenario-id header through to chat service"
```

---

## Task 15: 集成验证

- [ ] **Step 1: 运行单元测试**

Run: `cd apps/api && npx vitest run`
Expected: 全部 PASS（包括新的 journey-completeness 测试）

- [ ] **Step 2: 运行集成测试**

Run: `cd apps/api && npx vitest run --config vitest.config.integration.ts`
Expected: 全部 PASS

- [ ] **Step 3: 运行 E2E 测试（L1 Mock）**

Run: `cd apps/api && AI_E2E_MOCK=1 npx vitest run --config vitest.config.e2e.ts`
Expected: PASS（如果 DB/app 可初始化）或明确的环境错误（需要 DB）

- [ ] **Step 4: 验证 promptfoo CLI 能加载配置**

Run: `cd apps/api && npx promptfoo eval --dry-run -c promptfoo/promptfooconfig.yaml`
Expected: 配置加载成功，显示测试计划

- [ ] **Step 5: 最终 commit**

```bash
git add -A
git commit -m "chore: integration verification pass"
```
