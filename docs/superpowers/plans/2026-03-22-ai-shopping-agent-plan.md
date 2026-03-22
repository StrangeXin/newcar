# AI 购车助手 DeepAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `ai-chat.service.ts` 重构为基于 `deepagents` 的 DeepAgent，支持 5 个工具自动调用 + Redis 混合记忆

**Architecture:** 使用 `deepagents` 的 `createDeepAgent`，直接绑定 tools，框架自动处理 ReAct 循环。MiniMax 通过 `ChatAnthropic` + 自定义 `baseURL` 接入。Memory 分层：Redis 存短期 conversation history，Prisma 存持久化 signals/preferences。

**Tech Stack:** `deepagents@^1.8.0`, `langchain`, `@langchain/core`, `@langchain/anthropic`, `zod`, `@anthropic-ai/sdk`, `ioredis`, `Prisma`

---

## DeepAgents 关键 API

### createDeepAgent()
```typescript
const agent = createDeepAgent({
  name?: string,
  model?: BaseLanguageModel | string,  // 可传 string 或 LangChain model 实例
  tools?: TTools | StructuredTool[],   // 直接传 tools 数组
  systemPrompt?: string | SystemMessage,
});
```

### invoke() 返回值
```typescript
const result = await agent.invoke({ messages: [...] });
// 最终回复: result.messages[result.messages.length - 1].content
```

### tool 定义（langchain + zod）
```typescript
import { tool } from "langchain";
import { z } from "zod";

const myTool = tool(
  async ({ arg1, arg2 }) => { return result; },
  {
    name: "tool_name",
    description: "...",
    schema: z.object({ arg1: z.string(), arg2: z.number().optional() }),
  }
);
```

---

## 文件结构

```
src/
├── agents/
│   └── shopping.agent.ts      # createDeepAgent 定义
├── memory/
│   ├── redis.memory.ts        # Redis 短期记忆
│   └── types.ts              # Signal, UserPreference 类型
├── tools/
│   └── index.ts              # 5 个工具定义 (使用 langchain tool)
├── services/
│   └── ai-chat.service.ts    # 重构后调用 Agent
└── config/
    └── index.ts              # 已有配置
```

---

## Task 1: 添加依赖

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 添加依赖**

```json
"deepagents": "^1.8.0",
"langchain": "^0.3.0",
"@langchain/core": "^0.3.0",
"@langchain/anthropic": "^0.3.0",
"zod": "^3.23.0"
```

Run: `cd apps/api && npm install`

---

## Task 2: 创建 Signal 和 UserPreference 类型

**Files:**
- Create: `apps/api/src/memory/types.ts`

- [ ] **Step 1: 创建类型**

```typescript
export interface Signal {
  type: 'REQUIREMENT' | 'PREFERENCE' | 'BUDGET';
  value: string;
  confidence: number;
  updatedAt: string;
}

export interface UserPreference {
  preferredBrands?: string[];
  preferredFuelTypes?: string[];
  preferredCarTypes?: string[];
  updatedAt: string;
}
```

---

## Task 3: 创建 Redis Memory 存储

**Files:**
- Create: `apps/api/src/memory/redis.memory.ts`

- [ ] **Step 1: 创建 Redis Memory 类**

```typescript
import { redis } from '../lib/redis';
import { Signal } from './types';

const CONVERSATION_PREFIX = 'conversation:';
const SIGNALS_PREFIX = 'signals:';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SerializedMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class RedisMemory {
  async saveMessages(sessionId: string, messages: SerializedMessage[]): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    await redis.setex(key, TTL_SECONDS, JSON.stringify(messages));
  }

  async loadMessages(sessionId: string): Promise<SerializedMessage[]> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : [];
  }

  async saveSignals(sessionId: string, signals: Signal[]): Promise<void> {
    const key = `${SIGNALS_PREFIX}${sessionId}`;
    await redis.setex(key, TTL_SECONDS, JSON.stringify(signals));
  }

  async loadSignals(sessionId: string): Promise<Signal[]> {
    const key = `${SIGNALS_PREFIX}${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : [];
  }

  async clear(sessionId: string): Promise<void> {
    await redis.del(`${CONVERSATION_PREFIX}${sessionId}`, `${SIGNALS_PREFIX}${sessionId}`);
  }
}

export const redisMemory = new RedisMemory();
```

---

## Task 4: 创建 5 个 Tool

**Files:**
- Create: `apps/api/src/tools/index.ts`

- [ ] **Step 1: 创建 5 个工具**

```typescript
import { tool } from 'langchain';
import { z } from 'zod';
import { weaviateService } from '../services/weaviate.service';
import { carService } from '../services/car.service';
import { journeyService } from '../services/journey.service';
import { carCandidateService } from '../services/car-candidate.service';

// Tool 1: car_search
export const carSearchTool = tool(
  async ({ query, fuel_type, budget_max, car_type }: {
    query: string;
    fuel_type?: 'BEV' | 'PHEV' | 'HEV';
    budget_max?: number;
    car_type?: 'SEDAN' | 'SUV' | 'MPV';
  }) => {
    const results = await weaviateService.searchCars(query, {
      fuelType: fuel_type,
      maxMsrp: budget_max ? budget_max * 10000 : undefined,
      carType: car_type,
    });
    if (results.length === 0) {
      return '未找到匹配的车型，请尝试调整搜索条件。';
    }
    return results
      .slice(0, 5)
      .map((car, i) =>
        `${i + 1}. ${car.brand} ${car.model} ${car.variant} - ${(car.msrp / 10000).toFixed(1)}万 (${car.fuelType}, ${car.carType})`
      )
      .join('\n');
  },
  {
    name: 'car_search',
    description: '搜索车型。根据用户需求搜索匹配的车型，返回前5个结果。',
    schema: z.object({
      query: z.string().describe('搜索query'),
      fuel_type: z.enum(['BEV', 'PHEV', 'HEV']).optional().describe('燃料类型'),
      budget_max: z.number().optional().describe('预算上限（万元）'),
      car_type: z.enum(['SEDAN', 'SUV', 'MPV']).optional().describe('车型类型'),
    }),
  }
);

// Tool 2: car_detail
export const carDetailTool = tool(
  async ({ car_id }: { car_id: string }) => {
    const car = await carService.getCarById(car_id);
    if (!car) return `未找到车型 ID: ${car_id}`;
    return [
      `${car.brand} ${car.model} ${car.variant}`,
      `指导价: ${car.msrp ? `${(car.msrp / 10000).toFixed(1)}万` : '暂无'}`,
      `类型: ${car.carType || '未知'}`,
      `燃料类型: ${car.fuelType}`,
    ].join('\n');
  },
  {
    name: 'car_detail',
    description: '获取车型详细信息',
    schema: z.object({
      car_id: z.string().describe('车型ID'),
    }),
  }
);

// Tool 3: journey_read
export const journeyReadTool = tool(
  async ({ journey_id }: { journey_id: string }) => {
    const journey = await journeyService.getJourneyDetail(journey_id);
    if (!journey) return `未找到 Journey: ${journey_id}`;
    const candidates = journey.candidates || [];
    return [
      `Journey: ${journey.title}`,
      `Stage: ${journey.stage}`,
      `Status: ${journey.status}`,
      `预算范围: ${journey.requirements?.budgetMin || '未设置'}万 - ${journey.requirements?.budgetMax || '未设置'}万`,
      `候选车型: ${candidates.length}款`,
    ].join('\n');
  },
  {
    name: 'journey_read',
    description: '读取用户Journey状态',
    schema: z.object({
      journey_id: z.string().describe('Journey ID'),
    }),
  }
);

// Tool 4: journey_write
export const journeyWriteTool = tool(
  async ({ journey_id, action, data }: {
    journey_id: string;
    action: 'update_stage' | 'update_requirements' | 'add_candidate' | 'remove_candidate';
    data: any;
  }) => {
    switch (action) {
      case 'update_stage':
        await journeyService.updateStage(journey_id, data.stage);
        return `Journey stage 已更新为: ${data.stage}`;
      case 'update_requirements':
        await journeyService.updateRequirements(journey_id, data.requirements);
        return `Journey requirements 已更新`;
      case 'add_candidate':
        await carCandidateService.addCandidate({
          journeyId: journey_id,
          carId: data.car_id,
          addedReason: 'AI_RECOMMENDED',
        });
        return `已添加车型 ${data.car_id} 到候选列表`;
      case 'remove_candidate':
        await carCandidateService.removeCandidate(journey_id, data.car_id);
        return `已从候选列表移除车型 ${data.car_id}`;
      default:
        return `未知 action: ${action}`;
    }
  },
  {
    name: 'journey_write',
    description: '更新Journey状态或候选车型',
    schema: z.object({
      journey_id: z.string(),
      action: z.enum(['update_stage', 'update_requirements', 'add_candidate', 'remove_candidate']),
      data: z.any(),
    }),
  }
);

// Tool 5: notify
export const notifyTool = tool(
  async ({ user_id, template, data }: {
    user_id: string;
    template: string;
    data: any;
  }) => {
    // TODO: 实现微信通知
    return `通知功能暂未实现`;
  },
  {
    name: 'notify',
    description: '发送微信通知',
    schema: z.object({
      user_id: z.string(),
      template: z.string(),
      data: z.any(),
    }),
  }
);
```

---

## Task 5: 创建 DeepAgent

**Files:**
- Create: `apps/api/src/agents/shopping.agent.ts`

- [ ] **Step 1: 创建 Agent**

```typescript
import { createDeepAgent } from 'deepagents';
import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config';
import { carSearchTool, carDetailTool, journeyReadTool, journeyWriteTool, notifyTool } from '../tools';

const SYSTEM_PROMPT = `你是用户的购车助手，帮助用户完成购车决策。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 搜索和推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

请用友好、专业的语气与用户交流。`;

export const shoppingAgent = createDeepAgent({
  model: new ChatAnthropic({
    model: config.ai.model, // "MiniMax-M2.7"
    anthropicApiUrl: config.ai.baseURL + '/v1/messages', // "https://api.minimaxi.com/anthropic/v1/messages"
    apiKey: config.ai.apiKey,
    maxTokens: config.ai.maxTokens,
  }),
  tools: [carSearchTool, carDetailTool, journeyReadTool, journeyWriteTool, notifyTool],
  systemPrompt: SYSTEM_PROMPT,
});
```

---

## Task 6: 重构 ai-chat.service.ts

**Files:**
- Modify: `apps/api/src/services/ai-chat.service.ts`

- [ ] **Step 1: 重构 chat 方法**

```typescript
import { shoppingAgent } from '../agents/shopping.agent';
import { redisMemory } from '../memory/redis.memory';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { MessageRole } from '@newcar/shared';

export class AiChatService {
  async chat(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    message: string;
  }): Promise<{ message: string; conversationId: string; extractedSignals: any[] }> {
    // 1. Get or create conversation (Prisma)
    const conversation = await conversationService.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    // 2. Load memory from Redis
    const historyMessages = await redisMemory.loadMessages(data.sessionId);

    // 3. Build messages array with history + new message
    const messages = [
      ...historyMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: data.message },
    ];

    // 4. Run DeepAgent
    const result = await shoppingAgent.invoke({ messages });

    // 5. Extract AI response
    const aiMessage = result.messages[result.messages.length - 1].content as string;

    // 6. Save updated messages to Redis
    await redisMemory.saveMessages(data.sessionId, [
      ...historyMessages,
      { role: 'user', content: data.message },
      { role: 'assistant', content: aiMessage },
    ]);

    // 7. Save to Prisma (持久化)
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.USER,
      content: data.message,
    });
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: aiMessage,
    });

    // 8. Update journey lastActivityAt
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: aiMessage,
      conversationId: conversation.id,
      extractedSignals: [],
    };
  }
}

export const aiChatService = new AiChatService();
```

---

## Task 7: 添加缺失的 Service 方法

检查并添加 `journeyService.updateStage` 和 `journeyService.updateRequirements`。

**Files:**
- Modify: `apps/api/src/services/journey.service.ts`

- [ ] **Step 1: 检查并添加缺失方法**

```typescript
// 在 journey.service.ts 中添加：
async updateStage(journeyId: string, stage: string): Promise<void> {
  await this.prisma.journey.update({
    where: { id: journeyId },
    data: { stage },
  });
}

async updateRequirements(journeyId: string, requirements: any): Promise<void> {
  await this.prisma.journey.update({
    where: { id: journeyId },
    data: { requirements },
  });
}
```

---

## Task 8: 验证编译

- [ ] **Step 1: 运行 TypeScript 检查**

Run: `cd apps/api && npx tsc --noEmit`

- [ ] **Step 2: 如有错误，修复**

---

## Task 9: 集成测试

- [ ] **Step 1: 启动服务**

Run: `cd apps/api && npm run dev`

- [ ] **Step 2: 测试 chat 接口**

```bash
OTP=$(curl -s -X POST http://localhost:3000/auth/phone/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "13900000002"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['otp'])")

TOKEN=$(curl -s -X POST http://localhost:3000/auth/phone/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"13900000002\", \"otp\": \"$OTP\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s -X POST http://localhost:3000/journeys/test-active-journey/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "我想买个10万左右的新能源车"}'
```

Expected: 返回包含具体车型推荐的文字回复

---

## 已知依赖/待确认

1. **deepagents 版本** - ^1.8.0
2. **journeyService.updateStage / updateRequirements** - 需在 journey.service.ts 中添加
3. **carCandidateService.removeCandidate** - 需确认方法签名
4. **Weaviate 未运行** - 测试时 car_search 会降级
5. **@langchain/anthropic** - 确认与 MiniMax Anthropic-compatible API 兼容
