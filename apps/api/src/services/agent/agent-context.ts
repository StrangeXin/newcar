import path from 'path';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { JourneyStage, type MessageRole } from '@newcar/shared';
import { config } from '../../config';
import { tool } from 'langchain';
import { carSearchTool, runCarSearch } from '../../tools/car-search.tool';
import { carDetailTool, runCarDetail } from '../../tools/car-detail.tool';
import { journeyUpdateTool, runJourneyUpdate } from '../../tools/journey-update.tool';
import { addCandidateTool, runAddCandidate } from '../../tools/add-candidate.tool';
import type { ChatSideEffect } from '../../tools/chat-tools';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JourneyWorkspaceContext = {
  journey: {
    id: string;
    title: string;
    stage: JourneyStage;
    status?: string;
    requirements?: Record<string, unknown> | null;
    completenessContext?: string;
    candidates?: Array<{
      id: string;
      status: string;
      addedReason?: string | null;
      userNotes?: string | null;
      car?: {
        id: string;
        brand: string;
        model: string;
        variant?: string | null;
        msrp?: number | null;
        fuelType?: string | null;
        type?: string | null;
      } | null;
    }>;
  };
  conversationId: string;
  history: Array<{
    role: MessageRole | string;
    content: string;
    timestamp?: string;
  }>;
};

// ---------------------------------------------------------------------------
// Tool Schemas
// ---------------------------------------------------------------------------

export const carSearchToolSchema = z.object({
  query: z.string().optional().describe('自然语言搜索词，如"家用 SUV"'),
  budgetMin: z.number().optional().describe('最低预算（万元）'),
  budgetMax: z.number().optional().describe('最高预算（万元）'),
  fuelType: z.enum(['BEV', 'PHEV', 'ICE', 'HEV']).optional(),
  carType: z.enum(['SUV', 'SEDAN', 'MPV', 'COUPE', 'HATCHBACK']).optional(),
  limit: z.number().optional().describe('返回数量，默认 5'),
});

export const carDetailToolSchema = z.object({
  carId: z.string().optional().describe('车型 ID。若没有，也可能传车型名称。'),
  query: z.string().optional().describe('车型名称或品牌+车型，例如"深蓝S7"'),
});

export const journeyUpdateToolSchema = z.object({
  requirements: z
    .object({
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      fuelTypePreference: z.array(z.string()).optional(),
      useCases: z.array(z.string()).optional(),
      stylePreference: z.string().optional(),
    })
    .optional(),
  stage: z.enum(['AWARENESS', 'CONSIDERATION', 'COMPARISON', 'DECISION', 'PURCHASE']).optional(),
});

export const addCandidateToolSchema = z.object({
  carId: z.string().optional().describe('车型 ID。若模型只有车型名，也可能把车型名填在这里。'),
  query: z.string().optional().describe('车型名称或品牌+车型，例如"理想 L6"'),
  userNotes: z.string().optional(),
  priceAtAdd: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Workspace helpers
// ---------------------------------------------------------------------------

export function getWorkspaceRoot(journeyId: string) {
  return path.join(process.cwd(), '.deepagents', 'journeys', journeyId);
}

export function buildSystemPrompt(journey: JourneyWorkspaceContext['journey']) {
  const parts: string[] = [
    '你是新车购买旅程工作台里的长期 AI 购车助手。',
    '你的目标不是一次性回答，而是持续推进这段购车旅程，帮助用户逐步完成选车、对比、决策和购买准备。',
    '你拥有 write_todos、filesystem、task(subagent) 等 deep agent 能力，请合理使用这些能力维持长期记忆和行动计划。',
    '请优先把长期信息沉淀到文件：',
    '- /journey-context.md：当前旅程事实、阶段、候选和需求快照',
    '- /working-notes.md：用户偏好、风险点、待确认问题',
    '- /comparison-notes.md：候选车型对比结论',
    '- /next-steps.md：后续动作清单',
    '处理复杂任务前，优先用 write_todos 分解步骤；需要隔离上下文时，用 task 调用 subagent。',
    '在单轮对话里，一旦已有足够信息回答，就停止继续搜索并直接给出结论。',
    '避免重复调用同一个业务工具，除非前一次结果明显不足以回答用户问题。',
    '涉及真实业务状态变更时，必须使用业务工具，而不是只写文件。',
    '业务工具说明：',
    '- car_search：搜索符合需求的车型',
    '- car_detail：查询具体车型详情',
    '- journey_update：更新旅程需求或阶段',
    '- add_candidate：把某个车型加入候选',
    '回答必须使用简洁、专业、自然的中文。',
    '优先帮助用户做下一步决策，不要空泛聊天。',
    `当前旅程标题：${journey.title}`,
    `当前阶段：${journey.stage}`,
  ];

  if (journey.completenessContext) {
    parts.push('', journey.completenessContext);
  }

  return parts.join('\n');
}

export async function ensureWorkspace(context: JourneyWorkspaceContext) {
  const rootDir = getWorkspaceRoot(context.journey.id);
  await fs.mkdir(rootDir, { recursive: true });

  const candidates = (context.journey.candidates || []).map((candidate) => ({
    id: candidate.id,
    status: candidate.status,
    addedReason: candidate.addedReason,
    userNotes: candidate.userNotes,
    car: candidate.car
      ? {
          id: candidate.car.id,
          name: `${candidate.car.brand} ${candidate.car.model}${candidate.car.variant ? ` ${candidate.car.variant}` : ''}`.trim(),
          msrp: candidate.car.msrp,
          fuelType: candidate.car.fuelType,
          type: candidate.car.type,
        }
      : null,
  }));

  const journeyContext = [
    `# Journey Context`,
    ``,
    `- Journey ID: ${context.journey.id}`,
    `- Conversation ID: ${context.conversationId}`,
    `- Title: ${context.journey.title}`,
    `- Stage: ${context.journey.stage}`,
    `- Status: ${context.journey.status || 'UNKNOWN'}`,
    ``,
    `## Requirements`,
    '```json',
    JSON.stringify(context.journey.requirements || {}, null, 2),
    '```',
    ``,
    `## Candidates`,
    '```json',
    JSON.stringify(candidates, null, 2),
    '```',
    ``,
    `## Recent Conversation`,
    ...context.history.slice(-8).map((message) => `- ${message.role}: ${message.content}`),
    '',
  ].join('\n');

  const agentsFile = [
    '# Newcar Journey Agent',
    '',
    'You are operating inside a persistent journey workspace.',
    'Use write_todos to track evolving work.',
    'Use working-notes.md to store stable user preferences and unresolved questions.',
    'Use comparison-notes.md to maintain structured comparisons between candidate cars.',
    'Use next-steps.md to keep a short actionable plan for the user.',
    'Use business tools for any state-changing or factual vehicle operations.',
  ].join('\n');

  await fs.writeFile(path.join(rootDir, 'AGENTS.md'), agentsFile, 'utf-8');
  await fs.writeFile(path.join(rootDir, 'journey-context.md'), journeyContext, 'utf-8');

  return rootDir;
}

export function getJourneyTools(journeyId: string) {
  const emitSideEffects = async (sideEffects: ChatSideEffect[], runnableConfig?: unknown) => {
    const writer =
      runnableConfig && typeof runnableConfig === 'object' && typeof (runnableConfig as { writer?: unknown }).writer === 'function'
        ? ((runnableConfig as { writer: (chunk: unknown) => void }).writer)
        : undefined;
    for (const sideEffect of sideEffects) {
      writer?.(sideEffect);
    }
  };

  return [
    tool(
      async (input: z.infer<typeof carSearchToolSchema>) => {
        return runCarSearch(input);
      },
      {
        name: carSearchTool.name,
        description: carSearchTool.description,
        schema: carSearchToolSchema,
      }
    ),
    tool(
      async (input: z.infer<typeof carDetailToolSchema>) => {
        return runCarDetail(input);
      },
      {
        name: carDetailTool.name,
        description: carDetailTool.description,
        schema: carDetailToolSchema,
      }
    ),
    tool(
      async (input: z.infer<typeof journeyUpdateToolSchema>, runnableConfig) => {
        const result = await runJourneyUpdate(journeyId, input);
        await emitSideEffects(result.sideEffects, runnableConfig);
        return result.output;
      },
      {
        name: journeyUpdateTool.name,
        description: journeyUpdateTool.description,
        schema: journeyUpdateToolSchema,
      }
    ),
    tool(
      async (input: z.infer<typeof addCandidateToolSchema>, runnableConfig) => {
        const result = await runAddCandidate(journeyId, input);
        await emitSideEffects(result.sideEffects, runnableConfig);
        return result.output;
      },
      {
        name: addCandidateTool.name,
        description: addCandidateTool.description,
        schema: addCandidateToolSchema,
      }
    ),
  ];
}
