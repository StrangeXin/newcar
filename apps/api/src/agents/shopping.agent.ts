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
  // Note: ChatAnthropic from @langchain/anthropic has type mismatch with deepagents due to
  // @langchain/core version conflicts (deepagents uses 1.x, @langchain/anthropic uses 0.3.x).
  // Using `as any` to bypass type checking - runtime behavior is correct.
  model: new ChatAnthropic({
    model: config.ai.model, // "MiniMax-M2.7"
    anthropicApiUrl: config.ai.baseURL + '/v1/messages', // "https://api.minimaxi.com/anthropic/v1/messages"
    apiKey: config.ai.apiKey,
    maxTokens: config.ai.maxTokens,
  }) as any,
  tools: [carSearchTool, carDetailTool, journeyReadTool, journeyWriteTool, notifyTool],
  systemPrompt: SYSTEM_PROMPT,
});
