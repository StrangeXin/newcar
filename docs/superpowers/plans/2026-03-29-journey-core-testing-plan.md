# Journey 核心系统测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 Journey 相关镜像测试，补充 Journey CRUD、候选车型生命周期、时间线事件的集成测试。

**Architecture:** 删除 6 个纯逻辑镜像测试文件（car-candidate.test.ts、conversation.test.ts、integration.test.ts、journey-expire.test.ts）和 journey.test.ts/snapshot.test.ts 中的镜像 describe 块，新增 3 个集成测试文件覆盖真实 API 端到端流程。已有 journey-lifecycle.integration.test.ts 覆盖基本生命周期，新测试聚焦更细粒度场景（权限、边界、错误处理）。

**Tech Stack:** Vitest, supertest, Prisma (test DB), seed-test.ts

---

### Task 1: 删除整个镜像测试文件

**Files:**
- Delete: `apps/api/tests/car-candidate.test.ts`
- Delete: `apps/api/tests/conversation.test.ts`
- Delete: `apps/api/tests/integration.test.ts`
- Delete: `apps/api/tests/journey-expire.test.ts`

- [ ] **Step 1: 删除 4 个镜像测试文件**

```bash
rm apps/api/tests/car-candidate.test.ts
rm apps/api/tests/conversation.test.ts
rm apps/api/tests/integration.test.ts
rm apps/api/tests/journey-expire.test.ts
```

- [ ] **Step 2: 运行单元测试确认无破坏**

Run: `cd apps/api && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: 所有测试通过，无 import 引用断裂

- [ ] **Step 3: Commit**

```bash
git add -A apps/api/tests/car-candidate.test.ts apps/api/tests/conversation.test.ts apps/api/tests/integration.test.ts apps/api/tests/journey-expire.test.ts
git commit -m "test: remove 4 mirror test files (car-candidate, conversation, integration, journey-expire)"
```

---

### Task 2: 删除 journey.test.ts 中前 3 个镜像测试

**Files:**
- Modify: `apps/api/tests/journey.test.ts:1-31`

- [ ] **Step 1: 删除 journey.test.ts 的镜像 describe 块**

删除文件开头第 1-31 行（`describe('Journey', () => { ... })`），保留第 33 行开始的 service-level 测试。删除后文件应从 `const mockedPrisma = {` 开始（保留 import 行）。

具体删除内容：
```typescript
// --- Pure logic tests (original) ---
describe('Journey', () => {
  it('should validate stage progression order', () => {
    // ...
  });

  it('should calculate ai weight correctly for 5 min duration', () => {
    // ...
  });

  it('should calculate ai weight with short duration', () => {
    // ...
  });
});
```

- [ ] **Step 2: 运行单元测试确认通过**

Run: `cd apps/api && npx vitest run tests/journey.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: 11 个 service 测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/journey.test.ts
git commit -m "test: remove 3 mirror tests from journey.test.ts"
```

---

### Task 3: 删除 snapshot.test.ts 中前 4 个镜像测试

**Files:**
- Modify: `apps/api/tests/snapshot.test.ts:141-186`

- [ ] **Step 1: 删除 snapshot.test.ts 的镜像 describe 块**

删除第 141-186 行（`// ===================== Original tests =====================` 到 `describe('Snapshot', () => { ... })` 整个块），保留第 188 行开始的 `describe('SnapshotService', () => { ... })`。

具体删除内容：
```typescript
// ===================== Original tests =====================

describe('Snapshot', () => {
  it('should calculate decay factor correctly', () => { ... });
  it('should limit signals to 50', () => { ... });
  it('should limit behavior events to 300', () => { ... });
  it('should parse AI response correctly', () => { ... });
});
```

- [ ] **Step 2: 运行单元测试确认通过**

Run: `cd apps/api && npx vitest run tests/snapshot.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: SnapshotService 测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/snapshot.test.ts
git commit -m "test: remove 4 mirror tests from snapshot.test.ts"
```

---

### Task 4: 新增 journey-crud 集成测试

**Files:**
- Create: `apps/api/tests/integration/journey-crud.integration.test.ts`

注意：已有 `journey-lifecycle.integration.test.ts` 覆盖了基本创建+详情+事件流程。本文件聚焦更细粒度的 CRUD 场景：权限控制、阶段推进/回退、暂停、未认证。

- [ ] **Step 1: 编写集成测试**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getMemberNoActiveToken, getTestApp } from './helpers';

describe('Journey CRUD Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('GET /journeys/active', () => {
    it('should return active journey for member', async () => {
      const res = await getTestApp()
        .get('/journeys/active')
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.activeJourneyId);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('should return 401 without auth', async () => {
      const res = await getTestApp().get('/journeys/active');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /journeys/:id/detail', () => {
    it('should return journey detail for owner', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/detail`)
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.activeJourneyId);
    });

    it('should return 403 for non-owner', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/detail`)
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent journey', async () => {
      const res = await getTestApp()
        .get('/journeys/nonexistent-id/detail')
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /journeys/:id/stage', () => {
    it('should advance stage forward', async () => {
      // activeJourney is at CONSIDERATION, advance to COMPARISON
      const res = await getTestApp()
        .patch(`/journeys/${TEST_IDS.activeJourneyId}/stage`)
        .set(authHeader(getMemberToken()))
        .send({ targetStage: 'COMPARISON' });

      expect(res.status).toBe(200);
      expect(res.body.stage).toBe('COMPARISON');
    });

    it('should reject backward stage transition', async () => {
      // activeJourney is at CONSIDERATION, try going back to AWARENESS
      const res = await getTestApp()
        .patch(`/journeys/${TEST_IDS.activeJourneyId}/stage`)
        .set(authHeader(getMemberToken()))
        .send({ targetStage: 'AWARENESS' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /journeys/:id/pause', () => {
    it('should pause an active journey', async () => {
      const res = await getTestApp()
        .patch(`/journeys/${TEST_IDS.activeJourneyId}/pause`)
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAUSED');
    });
  });

  describe('POST /journeys/:id/events', () => {
    it('should record behavior event', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/events`)
        .set('x-session-id', 'integration-session')
        .send({
          type: 'CAR_VIEW',
          targetType: 'CAR',
          targetId: TEST_IDS.carBevId,
          metadata: { duration_sec: 60 },
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: 运行集成测试确认通过**

Run: `cd apps/api && npx vitest run --config vitest.config.integration.ts tests/integration/journey-crud.integration.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: 8 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/journey-crud.integration.test.ts
git commit -m "test: add journey CRUD integration tests (8 cases)"
```

---

### Task 5: 新增 candidate-lifecycle 集成测试

**Files:**
- Create: `apps/api/tests/integration/candidate-lifecycle.integration.test.ts`

- [ ] **Step 1: 编写集成测试**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getMemberToken, getTestApp } from './helpers';

describe('Candidate Lifecycle Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should list journey candidates', async () => {
    const res = await getTestApp()
      .get(`/journeys/${TEST_IDS.activeJourneyId}/candidates`)
      .set(authHeader(getMemberToken()));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // seeded BEV + PHEV candidates
  });

  it('should add a candidate car', async () => {
    const res = await getTestApp()
      .post(`/journeys/${TEST_IDS.activeJourneyId}/candidates`)
      .set(authHeader(getMemberToken()))
      .send({ carId: TEST_IDS.carIceId });

    expect([200, 201]).toContain(res.status);
  });

  it('should update candidate status to ELIMINATED', async () => {
    const res = await getTestApp()
      .patch(`/journeys/${TEST_IDS.activeJourneyId}/candidates/test-candidate-bev`)
      .set(authHeader(getMemberToken()))
      .send({ status: 'ELIMINATED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ELIMINATED');
  });

  it('should mark candidate as winner', async () => {
    const res = await getTestApp()
      .post(`/journeys/${TEST_IDS.activeJourneyId}/candidates/test-candidate-bev/winner`)
      .set(authHeader(getMemberToken()));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WINNER');

    // Verify other candidates are ELIMINATED
    const others = await prisma.carCandidate.findMany({
      where: {
        journeyId: TEST_IDS.activeJourneyId,
        id: { not: 'test-candidate-bev' },
      },
    });
    for (const c of others) {
      expect(c.status).toBe('ELIMINATED');
    }
  });
});
```

- [ ] **Step 2: 运行集成测试确认通过**

Run: `cd apps/api && npx vitest run --config vitest.config.integration.ts tests/integration/candidate-lifecycle.integration.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: 4 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/candidate-lifecycle.integration.test.ts
git commit -m "test: add candidate lifecycle integration tests (4 cases)"
```

---

### Task 6: 新增 timeline-events 集成测试

**Files:**
- Create: `apps/api/tests/integration/timeline-events.integration.test.ts`

路由挂载在 `/journeys/:journeyId/timeline`（见 `apps/api/src/routes/timeline.ts`）。

- [ ] **Step 1: 编写集成测试**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Timeline Events Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should list timeline events for journey owner', async () => {
    const res = await getTestApp()
      .get(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
      .set(authHeader(getMemberToken()));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should create a custom timeline event', async () => {
    const res = await getTestApp()
      .post(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
      .set(authHeader(getMemberToken()))
      .send({
        type: 'USER_NOTE',
        title: '试驾体验',
        description: '今天去 4S 店试驾了 Model Y',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('试驾体验');
  });

  it('should deny access to non-owner timeline', async () => {
    // admin 不拥有 activeJourney（属于 member）
    const res = await getTestApp()
      .get(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
      .set(authHeader(getAdminToken()));

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: 运行集成测试确认通过**

Run: `cd apps/api && npx vitest run --config vitest.config.integration.ts tests/integration/timeline-events.integration.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: 3 个测试全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/timeline-events.integration.test.ts
git commit -m "test: add timeline events integration tests (3 cases)"
```

---

### Task 7: 全量验证

- [ ] **Step 1: 运行所有单元测试**

Run: `cd apps/api && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: 全部通过

- [ ] **Step 2: 运行所有集成测试**

Run: `cd apps/api && npx vitest run --config vitest.config.integration.ts --reporter=verbose 2>&1 | tail -40`
Expected: 全部通过（含已有的 auth, subscription, ai-chat, community-flow, moderation-flow, journey-lifecycle 和新增的 3 个文件）

- [ ] **Step 3: 确认测试计数**

预期结果：
- 删除：22 个镜像测试（4+4+4+3+3+4）
- 新增：15 个集成测试（8+4+3）
- 净变动：-7 总数，质量大幅提升
