# AI 购车助手 DeepAgent 设计

**日期**: 2026-03-22
**状态**: 已批准

## 1. 目标

将当前简单的 AI chat 升级为基于 LangChain DeepAgent 的智能购车助手，具备：
- 多轮对话 + 自动工具调用
- 意图识别 + 智能路由
- 跨会话记忆管理

## 2. 技术选型

- **Runtime**: `@langchain/langgraph` (LangChain JS 原生)
- **Model**: MiniMax-M2.7 (Anthropic 兼容 API)
- **Memory**: 混合模式 (Redis 短期 + Prisma 持久化)
- **向量搜索**: Weaviate (混合查询)

## 3. 架构

```
前端 (Web)
    ↓ HTTP
Chat API (/journeys/:journeyId/chat)
    ↓
AgentExecutor (LangGraph)
    ├── State: { messages[], journeyId, userId, memory }
    ├── Nodes: llm_node, tool_node
    ├── Edges: conditional (has_tool_calls? → tool : end)
    │
    ├── Memory (Hybrid)
    │   ├── Redis: conversation:{sessionId} (7天TTL)
    │   └── Prisma: extracted_signals, user_preferences
    │
    └── Tools (5个): car_search, car_detail, journey_read, journey_write, notify
```

## 4. State 设计

```typescript
interface AgentState {
  messages: BaseMessage[];           // 对话历史
  journeyId: string;
  userId: string;
  sessionId: string;
  extractedSignals: Signal[];        // 累积需求信号
  userPreferences: UserPreference;   // 品牌/类型偏好
  currentStage: JourneyStage;
  toolResults: Record<string, ToolResult>;
}
```

## 5. 5个 Tool 定义

| Tool | 输入 | 输出 |
|------|------|------|
| `car_search` | query, fuel_type?, budget_max?, car_type? | 车型列表(top 5) |
| `car_detail` | car_id | 车型完整规格+价格 |
| `journey_read` | journey_id | stage, requirements, candidates |
| `journey_write` | journey_id, action, data | 更新后的 journey |
| `notify` | user_id, template, data | 发送结果 |

### 5.1 car_search

调用 Weaviate 混合搜索：
- 向量相似度 (query)
- 结构化过滤 (fuel_type, car_type, max_msrp)
- 返回 top 5 车型

### 5.2 journey_write

支持的操作：
- `update_stage`: AWARENESS → CONSIDERATION → COMPARISON → COMPARISON_OPEN
- `update_requirements`: 更新预算/用车场景/家庭情况
- `add_candidate`: 添加候选车型
- `remove_candidate`: 移除候选车型

## 6. Memory 分层

```
┌─────────────────────────────────────┐
│  LangGraph State.messages           │  ← LLM 上下文窗口 (最近10轮)
├─────────────────────────────────────┤
│  Redis: conversation:{sessionId}    │  ← 全量历史 (7天TTL)
│    → history: BaseMessage[]         │
│    → signals: Signal[]               │
├─────────────────────────────────────┤
│  Prisma: Conversation               │  ← 持久化
│  Prisma: User.preferences           │  ← 长期偏好
└─────────────────────────────────────┘
```

## 7. Journey Stage 流转

```
AWARENESS → CONSIDERATION → COMPARISON → COMPARISON_OPEN → COMPLETED
```

AI 根据对话内容自动判断 stage 转换时机，调用 `journey_write` 更新。

## 8. 实施步骤

1. 新增 `@langchain/langgraph` 依赖
2. 重构 `ai-chat.service.ts` 为 LangGraph Agent
3. 实现 5 个 Tool
4. 实现 Hybrid Memory (Redis + Prisma)
5. 迁移现有 conversation 历史到 Redis
6. 集成测试

## 9. 已知问题

- Weaviate Car class 和 Prisma Car 表的 ID 映射需确认
- 微信通知 tool 需要有效的微信模板 ID
