import { createDeepAgent } from 'deepagents';
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
  model: `openai:deepseek-chat`,
  tools: [carSearchTool, carDetailTool, journeyReadTool, journeyWriteTool, notifyTool],
  systemPrompt: SYSTEM_PROMPT,
});
