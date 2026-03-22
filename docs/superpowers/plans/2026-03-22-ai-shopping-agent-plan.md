# AI 购车助手 DeepAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `ai-chat.service.ts` 重构为基于 LangGraph 的 DeepAgent，支持 5 个工具自动调用 + 混合记忆

**Architecture:** 使用 `@langchain/langgraph` 的 `AgentExecutor` + `ChatAnthropic` model，ReAct 循环执行工具。Memory 分层：Redis 存短期 conversation history，Prisma 存持久化 signals/preferences。

**Tech Stack:** `@langchain/langgraph`, `@langchain/core`, `@anthropic-ai/sdk`, `ioredis`, `Prisma`

---

## 文件结构

```
src/
├── agents/
│   ├── shopping.agent.ts          # LangGraph Agent 定义 (createAgent)
│   ├── state.ts                   # AgentState 接口定义
│   └── memory/
│       ├── redis.memory.ts        # Redis 短期记忆
│       └── types.ts               # Signal, UserPreference 类型
├── tools/
│   ├── car.search.tool.ts         # car_search 工具
│   ├── car.detail.tool.ts         # car_detail 工具
│   ├── journey.read.tool.ts       # journey_read 工具
│   ├── journey.write.tool.ts      # journey_write 工具
│   ├── notify.tool.ts             # notify 工具
│   └── index.ts                  # 工具注册
├── services/
│   └── ai-chat.service.ts        # 重构后调用 Agent
└── config/
    └── index.ts                   # 已有配置，可能需新增 memory TTL
```

---

## Task 1: 添加 LangChain 依赖

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 添加依赖**

```json
"@langchain/langgraph": "^0.2.0",
"@langchain/core": "^0.3.0"
```

Run: `cd apps/api && npm install`

---

## Task 2: 创建 Agent State 定义

**Files:**
- Create: `apps/api/src/agents/state.ts`

- [ ] **Step 1: 创建 State 类型**

```typescript
import { BaseMessage } from '@langchain/core/messages';
import { JourneyStage } from '@newcar/shared';

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

export interface AgentState {
  messages: BaseMessage[];
  journeyId: string;
  userId: string;
  sessionId: string;
  extractedSignals: Signal[];
  userPreferences: UserPreference;
  currentStage: JourneyStage;
  toolResults: Record<string, unknown>;
  finalOutput?: string;
}
```

---

## Task 3: 创建 Redis Memory 存储

**Files:**
- Create: `apps/api/src/agents/memory/redis.memory.ts`

- [ ] **Step 1: 创建 Redis Memory 类**

```typescript
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { redis } from '../../lib/redis';
import { Signal } from '../state';

const CONVERSATION_PREFIX = 'conversation:';
const SIGNALS_PREFIX = 'signals:';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class RedisMemory {
  async saveMessages(sessionId: string, messages: BaseMessage[]): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    const serialized = messages.map((m) => ({
      type: m.constructor.name,
      content: m.content,
      additional_kwargs: m.additional_kwargs,
    }));
    await redis.setex(key, TTL_SECONDS, JSON.stringify(serialized));
  }

  async loadMessages(sessionId: string): Promise<BaseMessage[]> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    const data = await redis.get(key);
    if (!data) return [];
    const parsed = JSON.parse(data) as Array<{
      type: string;
      content: string;
      additional_kwargs?: Record<string, unknown>;
    }>;
    return parsed.map((m) =>
      m.type === 'AIMessage'
        ? new AIMessage({ content: m.content, additional_kwargs: m.additional_kwargs })
        : new HumanMessage({ content: m.content })
    );
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
- Create: `apps/api/src/tools/car.search.tool.ts`
- Create: `apps/api/src/tools/car.detail.tool.ts`
- Create: `apps/api/src/tools/journey.read.tool.ts`
- Create: `apps/api/src/tools/journey.write.tool.ts`
- Create: `apps/api/src/tools/notify.tool.ts`
- Create: `apps/api/src/tools/index.ts`

### 4.1 car_search tool

**Files:**
- Create: `apps/api/src/tools/car.search.tool.ts`

- [ ] **Step 1: 创建 car_search tool**

```typescript
import { DynamicTool } from '@langchain/core/tools';
import { weaviateService } from '../services/weaviate.service';

export const carSearchTool = new DynamicTool({
  name: 'car_search',
  description: 'Search for cars based on user requirements. Input: { query: string, fuel_type?: "BEV"|"PHEV"|"HEV", budget_max?: number (unit: 万元), car_type?: "SEDAN"|"SUV"|"MPV" }. Returns top 5 matching cars.',
  func: async (input: string) => {
    const args = JSON.parse(input);
    const results = await weaviateService.searchCars(args.query, {
      fuelType: args.fuel_type,
      maxMsrp: args.budget_max ? args.budget_max * 10000 : undefined,
      carType: args.car_type,
    });
    if (results.length === 0) {
      return '未找到匹配的车型，请尝试调整搜索条件。';
    }
    return results
      .slice(0, 5)
      .map((car, i) => `${i + 1}. ${car.brand} ${car.model} ${car.variant} - ${(car.msrp / 10000).toFixed(1)}万 (${car.fuelType}, ${car.carType})`)
      .join('\n');
  },
});
```

### 4.2 car_detail tool

**Files:**
- Create: `apps/api/src/tools/car.detail.tool.ts`

- [ ] **Step 2: 创建 car_detail tool**

```typescript
import { DynamicTool } from '@langchain/core/tools';
import { carService } from '../services/car.service';

export const carDetailTool = new DynamicTool({
  name: 'car_detail',
  description: 'Get detailed information about a specific car. Input: { car_id: string }. Returns car specifications and pricing.',
  func: async (input: string) => {
    const { car_id } = JSON.parse(input);
    const car = await carService.getCarById(car_id);
    if (!car) {
      return `未找到车型 ID: ${car_id}`;
    }
    return `${car.brand} ${car.model} ${car.variant}\n指导价: ${car.msrp ? `${(car.msrp / 10000).toFixed(1)}万` : '暂无'}\n类型: ${car.carType || '未知'}\n燃料类型: ${car.fuelType}`;
  },
});
```

### 4.3 journey_read tool

**Files:**
- Create: `apps/api/src/tools/journey.read.tool.ts`

- [ ] **Step 3: 创建 journey_read tool**

```typescript
import { DynamicTool } from '@langchain/core/tools';
import { journeyService } from '../services/journey.service';

export const journeyReadTool = new DynamicTool({
  name: 'journey_read',
  description: 'Read journey status and details. Input: { journey_id: string }. Returns stage, requirements, candidates count.',
  func: async (input: string) => {
    const { journey_id } = JSON.parse(input);
    const journey = await journeyService.getJourneyDetail(journey_id);
    if (!journey) {
      return `未找到 Journey: ${journey_id}`;
    }
    const candidates = journey.candidates || [];
    return `Journey: ${journey.title}\nStage: ${journey.stage}\nStatus: ${journey.status}\n预算范围: ${journey.requirements?.budgetMin || '未设置'}万 - ${journey.requirements?.budgetMax || '未设置'}万\n候选车型: ${candidates.length}款\n用车场景: ${journey.requirements?.useCases?.join(', ') || '未设置'}`;
  },
});
```

### 4.4 journey_write tool

**Files:**
- Create: `apps/api/src/tools/journey.write.tool.ts`

- [ ] **Step 4: 创建 journey_write tool**

```typescript
import { DynamicTool } from '@langchain/core/tools';
import { journeyService } from '../services/journey.service';
import { carCandidateService } from '../services/car-candidate.service';

export const journeyWriteTool = new DynamicTool({
  name: 'journey_write',
  description: 'Update journey status or requirements. Input: { journey_id: string, action: "update_stage"|"update_requirements"|"add_candidate"|"remove_candidate", data: object }. Returns updated result.',
  func: async (input: string) => {
    const { journey_id, action, data } = JSON.parse(input);

    switch (action) {
      case 'update_stage': {
        await journeyService.updateStage(journey_id, data.stage);
        return `Journey stage 已更新为: ${data.stage}`;
      }
      case 'update_requirements': {
        await journeyService.updateRequirements(journey_id, data.requirements);
        return `Journey requirements 已更新`;
      }
      case 'add_candidate': {
        await carCandidateService.addCandidate({
          journeyId: journey_id,
          carId: data.car_id,
          addedReason: 'AI_RECOMMENDED',
        });
        return `已添加车型 ${data.car_id} 到候选列表`;
      }
      case 'remove_candidate': {
        await carCandidateService.removeCandidate(journey_id, data.car_id);
        return `已从候选列表移除车型 ${data.car_id}`;
      }
      default:
        return `未知 action: ${action}`;
    }
  },
});
```

### 4.5 notify tool

**Files:**
- Create: `apps/api/src/tools/notify.tool.ts`

- [ ] **Step 5: 创建 notify tool**

```typescript
import { DynamicTool } from '@langchain/core/tools';
import { wechatService } from '../services/wechat.service';

export const notifyTool = new DynamicTool({
  name: 'notify',
  description: 'Send WeChat notification to user. Input: { user_id: string, template: "price_drop"|"new_review"|"policy_update"|"ota_recall", data: object }.',
  func: async (input: string) => {
    const { user_id, template, data } = JSON.parse(input);
    try {
      const result = await wechatService.sendTemplateMessage(user_id, template, data);
      return `通知已发送: ${template}`;
    } catch (err: any) {
      return `通知发送失败: ${err.message}`;
    }
  },
});
```

### 4.6 Tool 索引

**Files:**
- Create: `apps/api/src/tools/index.ts`

- [ ] **Step 6: 创建工具索引**

```typescript
import { carSearchTool } from './car.search.tool';
import { carDetailTool } from './car.detail.tool';
import { journeyReadTool } from './journey.read.tool';
import { journeyWriteTool } from './journey.write.tool';
import { notifyTool } from './notify.tool';

export const tools = [
  carSearchTool,
  carDetailTool,
  journeyReadTool,
  journeyWriteTool,
  notifyTool,
];

export { carSearchTool, carDetailTool, journeyReadTool, journeyWriteTool, notifyTool };
```

---

## Task 5: 创建 LangGraph Agent

**Files:**
- Create: `apps/api/src/agents/shopping.agent.ts`

- [ ] **Step 1: 创建 Agent 定义**

```typescript
import { ChatAnthropic } from '@anthropic-ai/sdk';
import { AgentState } from './state';
import { tools } from '../tools';
import { redisMemory } from './memory/redis.memory';
import { conversationService } from '../services/conversation.service';
import { carCandidateService } from '../services/car-candidate.service';
import { weaviateService } from '../services/weaviate.service';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { config } from '../config';

const SYSTEM_PROMPT = `你是用户的购车助手，帮助用户完成购车决策。用户正在使用 AI 原生购车平台。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 搜索和推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化
5. 根据对话内容判断 Journey stage 转换时机

当需要搜索车型时使用 car_search 工具。
当需要了解用户当前 Journey 状态时使用 journey_read 工具。
当用户决定添加/移除候选车型时使用 journey_write 工具。
当需要了解车型详情时使用 car_detail 工具。
当有重要更新（价格变动、新政策）需要通知用户时使用 notify 工具。

请用友好、专业的语气与用户交流。`;

export async function createShoppingAgent() {
  const model = new ChatAnthropic({
    model: config.ai.model,
    anthropicApiUrl: config.ai.baseURL + '/v1/messages',
    apiKey: config.ai.apiKey,
    maxTokens: config.ai.maxTokens,
  }).bindTools(tools);

  return model;
}

export async function runAgent(state: AgentState): Promise<Partial<AgentState>> {
  const model = await createShoppingAgent();

  const response = await model.invoke(state.messages, {
    configurable: { thread_id: state.sessionId },
  });

  return {
    messages: [...state.messages, response],
    finalOutput: response.content as string,
  };
}
```

---

## Task 6: 重构 ai-chat.service.ts

**Files:**
- Modify: `apps/api/src/services/ai-chat.service.ts`

- [ ] **Step 1: 重构 chat 方法**

```typescript
import { AgentState } from '../agents/state';
import { redisMemory } from '../agents/memory/redis.memory';
import { runAgent } from '../agents/shopping.agent';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { MessageRole } from '@newcar/shared';
import { JourneyStage } from '@newcar/shared';

export class AiChatService {
  async chat(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    message: string;
  }): Promise<{ message: string; conversationId: string; extractedSignals: any[] }> {
    // 1. Get or create conversation
    const conversation = await conversationService.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    // 2. Load memory from Redis
    const historyMessages = await redisMemory.loadMessages(data.sessionId);
    const savedSignals = await redisMemory.loadSignals(data.sessionId);

    // 3. Get journey state
    const journey = await journeyService.getJourneyDetail(data.journeyId);
    const currentStage = (journey?.stage as JourneyStage) || JourneyStage.AWARENESS;

    // 4. Build initial state
    const state: AgentState = {
      messages: [
        ...historyMessages,
        new HumanMessage({ content: data.message }),
      ],
      journeyId: data.journeyId,
      userId: data.userId || '',
      sessionId: data.sessionId,
      extractedSignals: savedSignals,
      userPreferences: { updatedAt: new Date().toISOString() },
      currentStage,
      toolResults: {},
    };

    // 5. Run agent (ReAct loop)
    const result = await runAgent(state);

    // 6. Extract final response
    const finalOutput = result.finalOutput || '抱歉，我现在无法回答。';

    // 7. Save updated messages to Redis
    const updatedMessages = result.messages || [];
    await redisMemory.saveMessages(data.sessionId, updatedMessages);

    // 8. Save AI response to Prisma (持久化)
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
      content: finalOutput,
    });

    // 9. Update journey lastActivityAt
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: finalOutput,
      conversationId: conversation.id,
      extractedSignals: state.extractedSignals,
    };
  }
}

export const aiChatService = new AiChatService();
```

---

## Task 7: 验证编译

- [ ] **Step 1: 运行 TypeScript 检查**

Run: `cd apps/api && npx tsc --noEmit`
Expected: 无编译错误

- [ ] **Step 2: 如有错误，修复**

常见问题：
- `journeyService.updateStage` / `updateRequirements` 方法不存在 → 需在 journey.service.ts 中添加
- `carCandidateService.addCandidate` / `removeCandidate` 方法不存在 → 需检查或添加

---

## Task 8: 集成测试

- [ ] **Step 1: 启动服务**

Run: `cd apps/api && npm run dev`

- [ ] **Step 2: 获取 OTP 和 Token**

```bash
OTP=$(curl -s -X POST http://localhost:3000/auth/phone/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "13900000002"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['otp'])")

TOKEN=$(curl -s -X POST http://localhost:3000/auth/phone/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"13900000002\", \"otp\": \"$OTP\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
```

- [ ] **Step 3: 测试 chat 接口**

```bash
curl -s -X POST http://localhost:3000/journeys/test-active-journey/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "我想买个10万左右的新能源车"}' | python3 -m json.tool
```

Expected: 返回包含具体车型推荐的文字回复，不是空内容

---

## 已知依赖/待确认

1. **journeyService.updateStage** - 需要在 `journey.service.ts` 中添加
2. **journeyService.updateRequirements** - 需要在 `journey.service.ts` 中添加
3. **carCandidateService.removeCandidate** - 需要确认方法签名
4. **wechatService.sendTemplateMessage** - 需要确认方法签名
5. **Weaviate 未运行** - 测试时 car_search 会返回空或降级
