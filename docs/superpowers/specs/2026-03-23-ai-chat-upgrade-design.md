# AI 购车助手升级设计：WebSocket + Anthropic Tool Use

**日期**: 2026-03-23
**状态**: 已批准
**作者**: 产品 + Claude Code

---

## 1. 背景与目标

### 现状问题

当前 AI 购车助手存在三个核心缺陷：

1. **能力弱**：偏好提取依赖正则匹配（如 `(\d+)万左右`），车型搜索依赖关键词触发（如检测"推荐"字样），准确性低、覆盖面窄。
2. **体验差**：HTTP 请求/响应模式，用户发送消息后界面无反馈，等待 AI 全量回复（通常 3-8 秒），无流式输出。
3. **功能孤立**：AI 工具调用结果（加候选车、更新需求）仅写入数据库，前端其他面板无实时感知，用户须手动刷新。

### 核心目标

> Chat 是入口，副作用是价值。AI 聊天应是整个旅程工作台的实时神经系统。

升级后：
- AI 用真正的 Anthropic tool use API 调用工具，精准识别意图并执行结构化动作
- AI 回复逐 token 流式输出，响应感从"等待"变为"对话"
- 工具执行的旅程副作用（加候选车、更新需求、推进阶段）通过 WebSocket 实时同步到所有面板

---

## 2. 产品创新背景

本次升级在技术上也为以下未来方向奠定基础（暂不实现，作为设计导引）：

| 未来方向 | 与本次设计的关联 |
|---------|---------------|
| **用车生命周期延伸**：买车后旅程继续，记录养车/里程/驾驶高光，AI 整理成"开车日记" | WS 状态总线可扩展推送生命周期事件 |
| **社交足迹跟随**：实时跟随他人决策旅程，AI 分析"相似用户最终选了什么" | side_effect 事件流将来可被订阅/广播 |
| **车主真实体验云集成**：AI 实时抛出已购用户反馈，如"12 个车主开了 6 个月，最常提到优点是…" | car_detail 工具可扩展聚合车主评价 |

---

## 3. 整体架构

```
前端 (Next.js)
  ChatPanel
    └── useChatStore (Zustand)
          │
          │  WebSocket  ws://api/ws/journeys/:journeyId/chat?token=<jwt>
          │
Express HTTP Server
  └── ws.Server (attached to same httpServer)
        └── ChatWsController
              ├── 认证（token query param 验证）
              ├── 会话管理（journeyId → socket map）
              └── AiChatService (重写)
                    ├── Anthropic messages.stream() + tool use
                    ├── Tool: car_search
                    ├── Tool: car_detail
                    ├── Tool: journey_update
                    └── Tool: add_candidate
```

**变更范围（最小化原则）：**

| 类别 | 文件 | 动作 |
|------|------|------|
| 后端 | `apps/api/src/index.ts` | 改为 `http.createServer(app)` 显式创建 server，挂载 ws.Server |
| 后端 | `apps/api/src/controllers/chat-ws.controller.ts` | 新增 WS 连接处理 |
| 后端 | `apps/api/src/services/ai-chat.service.ts` | 完全重写（tool use + streaming） |
| 后端 | `apps/api/src/tools/` | 新增 4 个工具定义文件 |
| 前端 | `apps/web/src/store/chat.store.ts` | 重写（HTTP → WebSocket） |
| 前端 | `apps/web/src/components/chat/MessageBubble.tsx` | 增加 streaming 状态 |
| 前端 | `apps/web/src/components/chat/ChatPanel.tsx` | 增加工具调用提示 |
| 保留 | `apps/api/src/routes/ai-chat.ts` (HTTP POST) | 不变，保持向后兼容 |

---

## 4. WebSocket 消息协议

WebSocket 承担双重职责：**AI 对话通道** + **旅程工作台实时状态总线**。

### 4.1 连接建立

```
ws://api/ws/journeys/:journeyId/chat?token=<jwt>
```

- 服务端在 `upgrade` 事件中验证 JWT token
- 验证失败立即关闭连接（code 4001）
- 每个 journeyId 同时只允许一个活跃 WS 连接（旧连接被替换）

### 4.2 Client → Server

```ts
// 发送用户消息
{
  type: "message",
  content: string,
  sessionId: string  // 从 localStorage 持久化读取（key: `chat_session_${journeyId}`），确保刷新后复用同一会话历史
}
```

### 4.3 Server → Client

```ts
// 流式 token（逐字输出）
{ type: "token", delta: string }

// 工具调用开始（前端显示"正在搜索…"提示）
{ type: "tool_start", name: "car_search" | "car_detail" | "journey_update" | "add_candidate", input: Record<string, any> }

// 工具调用完成
{ type: "tool_done", name: string, result: any }

// 旅程副作用（触发其他面板实时更新）
{ type: "side_effect", event: "candidate_added",  data: CarCandidate }
{ type: "side_effect", event: "journey_updated",  data: JourneyRequirements }
{ type: "side_effect", event: "stage_changed",    data: { stage: JourneyStage } }

// 消息完成
{ type: "done", conversationId: string, fullContent: string }

// 错误
{ type: "error", code: string, message: string }
```

**副作用事件触发时机**：工具写入 DB 后立即推送，不等 AI 全部回复完成。用户在对话途中即可看到候选车面板更新。

---

## 5. 四个工具定义

### 5.1 car_search

```ts
{
  name: "car_search",
  description: "根据用户需求搜索匹配的车型列表。当用户表达购车意向、询问推荐或提供预算/用途信息时调用。所有参数均可选，无参数时返回全量车型。",
  input_schema: {
    type: "object",
    required: [],
    properties: {
      query: { type: "string", description: "自然语言搜索词，如'家用SUV'，留空则宽泛搜索" },
      budgetMax: { type: "number", description: "最高预算（万元）" },
      budgetMin: { type: "number", description: "最低预算（万元）" },
      fuelType: { type: "string", enum: ["BEV", "PHEV", "ICE", "HEV"] },
      carType: { type: "string", enum: ["SUV", "SEDAN", "MPV", "COUPE", "HATCHBACK"] },
      limit: { type: "number", default: 5 }
    }
  }
}
```

无副作用，仅返回结果供 AI 分析。

### 5.2 car_detail

```ts
{
  name: "car_detail",
  description: "获取特定车型的详细参数、价格区间、主要配置。当用户询问某款具体车型详情时调用。",
  input_schema: {
    type: "object",
    required: ["carId"],
    properties: {
      carId: { type: "string", description: "车型 ID" }
    }
  }
}
```

无副作用，仅返回详情供 AI 讨论。

### 5.3 journey_update

```ts
{
  name: "journey_update",
  description: "更新旅程的结构化需求或阶段。当用户明确说出预算、用途、能源类型偏好，或用户决策进入新阶段时调用。",
  input_schema: {
    type: "object",
    properties: {
      requirements: {
        type: "object",
        properties: {
          budgetMin: { type: "number" },
          budgetMax: { type: "number" },
          fuelTypePreference: { type: "array", items: { type: "string" } },
          useCases: { type: "array", items: { type: "string" } },
          stylePreference: { type: "string" }
        }
      },
      stage: {
        type: "string",
        enum: ["AWARENESS", "CONSIDERATION", "COMPARISON", "DECISION", "PURCHASE"],
        description: "与数据库 JourneyStage 枚举对齐。仅在用户明显进入新决策阶段时才更新，且阶段只能前进不能后退（journeyService.advanceStage 会校验）"
      }
    }
  }
}
```

**副作用**：
- 更新 requirements → 推送 `side_effect: journey_updated`
- 更新 stage → 推送 `side_effect: stage_changed`

### 5.4 add_candidate

```ts
{
  name: "add_candidate",
  description: "将车型加入用户旅程的候选列表。当用户表示对某款车感兴趣、想进一步了解或对比时调用。",
  input_schema: {
    type: "object",
    required: ["carId"],
    properties: {
      carId: { type: "string" },
      note: { type: "string", description: "AI 为该候选车添加的简短说明，如'符合家用SUV需求，价格在预算内'" }
    }
  }
}
```

**副作用**：写入 DB 后推送 `side_effect: candidate_added`。若候选车已存在（`carCandidateService` 抛出 "Car already in candidate list" 错误），工具执行器捕获该错误并静默跳过（不推送 side_effect，不向 AI 报告失败）。

---

## 6. Anthropic Streaming + Tool Use 循环

```
调用 anthropic.messages.stream({
  model: config.ai.model,
  max_tokens: 1024,
  system: systemPrompt,
  tools: [car_search, car_detail, journey_update, add_candidate],
  messages: conversationHistory
})

收到事件:
  content_block_delta (text_delta)
    → ws.send({ type: "token", delta })

  message_stop (stop_reason = "tool_use")
    → 提取所有 tool_use blocks（可能多个，顺序执行）
    → for each tool（顺序执行，不并发）:
        ws.send({ type: "tool_start", name, input })
        result = await executeTool(name, input)     // 含写 DB + 副作用推送
        ws.send({ type: "tool_done", name, result })
    → 将 tool_result 追加到 messages
    → 继续 stream（循环）

  message_stop (stop_reason = "end_turn")
    → ws.send({ type: "done", conversationId, fullContent })
    → 保存完整回复到 DB (conversationService.addMessage)
    → journeyService.updateAiConfidenceScore(journeyId, computedScore)
```

工具调用可能连续多次（如 `car_search` → `add_candidate` → `journey_update`），每次都即时推送事件，前端保持实时反馈。

---

## 7. 前端变更设计

### 7.1 chat.store.ts 新状态

```ts
interface ChatState {
  messages: ChatMessage[];
  streamingContent: string;        // 新增：正在流入的当前消息内容
  activeTools: string[];           // 新增：当前正在执行的工具名列表
  isStreaming: boolean;            // 新增：区分"等待首 token"与"流式输出中"
  conversationId?: string;
  // sendMessage 改为通过 WS 发送
  // 新增：connect(journeyId) / disconnect()
}
```

### 7.2 side_effect 分发

```ts
// chat.store.ts 中监听 side_effect 并分发
case "side_effect":
  if (event === "candidate_added")  candidateStore.addCandidate(data)
  if (event === "journey_updated")  journeyStore.updateRequirements(data)
  if (event === "stage_changed")    journeyStore.updateStage(data.stage)
```

### 7.3 ChatPanel 工具调用提示

当 `activeTools.length > 0` 时在消息列表底部显示内联提示：

```
🔍 正在搜索小鹏X9…
```

工具完成后自动淡出（200ms transition）。

### 7.4 MessageBubble streaming 状态

- `streaming` 状态消息末尾显示光标（`|` 闪烁）
- 内容通过 `streamingContent` 逐字追加，不创建新消息对象

---

## 8. 认证方案

WebSocket 连接认证通过 query param 传递 JWT：

```
ws://api/ws/journeys/:journeyId/chat?token=<jwt>
```

服务端在 `upgrade` 事件（WS 握手阶段）验证 token，失败则拒绝升级（返回 HTTP 401）。这样认证在连接建立时完成，后续消息无需重复验证。

---

## 9. 不在本次范围内

- 微信小程序端适配（WebSocket 需单独处理小程序 WS API）
- 多设备同一 journey 并发 WS 连接同步
- WS 连接断线重连策略（前端简单重连即可，暂不做指数退避）
- WS 消息频率限制（现有 Express rateLimitMiddleware 不覆盖 WS 连接，暂不实现；首次上线流量小，已知风险可接受）
- 工具：`trigger_snapshot`、`get_owner_feedback`（未来迭代）
