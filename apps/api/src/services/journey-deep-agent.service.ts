import path from 'path';
import { promises as fs } from 'fs';
import { createDeepAgent, FilesystemBackend } from 'deepagents';
import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, ToolMessage, tool } from 'langchain';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { z } from 'zod';
import { JourneyStage, type MessageRole } from '@newcar/shared';
import { config } from '../config';
import { carSearchTool, runCarSearch } from '../tools/car-search.tool';
import { carDetailTool, runCarDetail } from '../tools/car-detail.tool';
import { journeyUpdateTool, runJourneyUpdate } from '../tools/journey-update.tool';
import { addCandidateTool, runAddCandidate } from '../tools/add-candidate.tool';
import type { ChatSideEffect, ChatToolName } from '../tools/chat-tools';

export type JourneyAgentStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; name: string; input: Record<string, unknown> }
  | { type: 'tool_done'; name: string; result: unknown }
  | { type: 'side_effect'; event: ChatSideEffect['event']; data: unknown }
  | { type: 'done'; fullContent: string }
  | { type: 'error'; code: string; message: string };

type JourneyWorkspaceContext = {
  journey: {
    id: string;
    title: string;
    stage: JourneyStage;
    status?: string;
    requirements?: Record<string, unknown> | null;
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

const journeyAgentCheckpointer = new MemorySaver();
const DOMAIN_TOOLS = new Set<ChatToolName>(['car_search', 'car_detail', 'journey_update', 'add_candidate']);

export class JourneyDeepAgentService {
  private log(event: string, details?: Record<string, unknown>) {
    if (!config.ai.debug) {
      return;
    }

    console.log(
      `[deep-agent] ${JSON.stringify({
        ts: new Date().toISOString(),
        event,
        ...details,
      })}`
    );
  }

  private getWorkspaceRoot(journeyId: string) {
    return path.join(process.cwd(), '.deepagents', 'journeys', journeyId);
  }

  private getModel() {
    const model = new ChatAnthropic({
      model: config.ai.model as any,
      apiKey: config.ai.apiKey,
      anthropicApiUrl: config.ai.baseURL,
      maxTokens: config.ai.maxTokens,
      temperature: 0.2,
      maxRetries: 2,
      clientOptions: {
        timeout: config.ai.roundTimeoutMs,
      } as any,
    });

    return model.withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (error) => {
        this.log('model_retry', {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }) as any;
  }

  private getJourneyTools(journeyId: string) {
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

  private buildSystemPrompt(journey: JourneyWorkspaceContext['journey']) {
    return [
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
    ].join('\n');
  }

  private async ensureWorkspace(context: JourneyWorkspaceContext) {
    const rootDir = this.getWorkspaceRoot(context.journey.id);
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

  private createAgent(journey: JourneyWorkspaceContext['journey'], rootDir: string) {
    return createDeepAgent({
      model: this.getModel(),
      tools: this.getJourneyTools(journey.id),
      systemPrompt: this.buildSystemPrompt(journey),
      backend: new FilesystemBackend({ rootDir }),
      checkpointer: journeyAgentCheckpointer,
    });
  }

  private extractText(value: unknown): string {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.extractText(item)).join('');
    }
    if (typeof value === 'object') {
      const maybeRecord = value as Record<string, unknown>;
      if (typeof maybeRecord.text === 'string') {
        return maybeRecord.text;
      }
      if (maybeRecord.type === 'text' && typeof maybeRecord.text === 'string') {
        return maybeRecord.text;
      }
      if ('content' in maybeRecord) {
        return this.extractText(maybeRecord.content);
      }
      if ('output' in maybeRecord) {
        return this.extractText(maybeRecord.output);
      }
      if ('messages' in maybeRecord) {
        return this.extractText(maybeRecord.messages);
      }
    }
    return '';
  }

  private maybeParseJson(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private normalizeToolInput(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const record = input as Record<string, unknown>;
    if ('input' in record) {
      const parsed = this.maybeParseJson(record.input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }

    return record;
  }

  private normalizeToolOutput(output: unknown): unknown {
    if (!output || typeof output !== 'object') {
      return this.maybeParseJson(output);
    }

    const record = output as Record<string, unknown>;
    if ('artifact' in record && record.artifact !== undefined) {
      return record.artifact;
    }
    if ('lc_direct_tool_output' in record && record.lc_direct_tool_output !== undefined) {
      return record.lc_direct_tool_output;
    }
    if ('content' in record) {
      return this.maybeParseJson(record.content);
    }

    return record;
  }

  private getLastAssistantText(output: unknown): string {
    if (!output || typeof output !== 'object') {
      return '';
    }

    const messages = (output as { messages?: unknown[] }).messages;
    if (!Array.isArray(messages)) {
      return '';
    }

    const assistantMessages = messages.filter((message) => {
      if (!message || typeof message !== 'object') {
        return false;
      }
      const getType = (message as any)._getType;
      if (typeof getType === 'function') {
        return getType.call(message) === 'ai';
      }
      return (message as any).type === 'ai';
    });

    const last = assistantMessages.at(-1) as { content?: unknown } | undefined;
    return this.extractText(last?.content);
  }

  private isToolLikeMessage(message: unknown) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (ToolMessage.isInstance(message as any)) {
      return true;
    }

    const maybeType = (message as { type?: string }).type;
    const getType = (message as { _getType?: () => string })._getType;
    return maybeType === 'tool' || (typeof getType === 'function' && getType.call(message) === 'tool');
  }

  private getToolCallId(message: unknown): string | undefined {
    if (!message || typeof message !== 'object') {
      return undefined;
    }

    const record = message as Record<string, unknown>;
    return typeof record.tool_call_id === 'string' ? record.tool_call_id : undefined;
  }

  private getToolName(message: unknown): string | undefined {
    if (!message || typeof message !== 'object') {
      return undefined;
    }

    const record = message as Record<string, unknown>;
    return typeof record.name === 'string' ? record.name : undefined;
  }

  private getToolCalls(message: unknown): Array<{ id?: string; name?: string; args?: unknown }> {
    if (!message || typeof message !== 'object') {
      return [];
    }

    const record = message as Record<string, unknown>;
    const toolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : [];
    return toolCalls
      .map((toolCall) => {
        if (!toolCall || typeof toolCall !== 'object') {
          return null;
        }

        const value = toolCall as Record<string, unknown>;
        return {
          id: typeof value.id === 'string' ? value.id : undefined,
          name: typeof value.name === 'string' ? value.name : undefined,
          args: value.args,
        };
      })
      .filter(Boolean) as Array<{ id?: string; name?: string; args?: unknown }>;
  }

  async streamJourneyChat(
    context: JourneyWorkspaceContext,
    message: string,
    onEvent?: (event: JourneyAgentStreamEvent) => void
  ) {
    const rootDir = await this.ensureWorkspace(context);
    const agent = this.createAgent(context.journey, rootDir);
    const threadId = context.conversationId;
    let fullContent = '';
    let finalAssistantText = '';
    const startedToolCalls = new Set<string>();
    const finishedToolCalls = new Set<string>();

    const stream = await agent.stream(
      {
        messages: [{ role: 'user', content: message }],
      },
      {
        configurable: { thread_id: threadId },
        streamMode: ['updates', 'messages', 'custom'],
        subgraphs: true,
      }
    );
    const iterator = stream[Symbol.asyncIterator]();

    try {
      while (true) {
        const nextEvent = await Promise.race([
          iterator.next(),
          new Promise<IteratorResult<any>>((_, reject) =>
            setTimeout(() => reject(new Error(`deep_agent_stream_idle_timeout:${config.ai.roundTimeoutMs}`)), config.ai.roundTimeoutMs)
          ),
        ]);

        if (nextEvent.done) {
          break;
        }

        const [namespace, mode, data] = nextEvent.value as [string[], string, unknown];
        const isMainNamespace = Array.isArray(namespace) && namespace.length === 0;

        if (mode === 'messages') {
          const [messageChunk, metadata] = Array.isArray(data) ? data : [null, null];

          if (
            isMainNamespace &&
            AIMessageChunk.isInstance(messageChunk as any) &&
            (metadata as Record<string, unknown> | null)?.langgraph_node === 'model_request'
          ) {
            const delta = this.extractText((messageChunk as { text?: unknown }).text);
            const toolCallChunks = (messageChunk as { tool_call_chunks?: unknown[] }).tool_call_chunks;
            if (delta && (!Array.isArray(toolCallChunks) || toolCallChunks.length === 0)) {
              fullContent += delta;
              onEvent?.({ type: 'token', delta });
            }
          }
          continue;
        }

        if (mode === 'custom') {
          if (isMainNamespace) {
            const payload = (data || {}) as ChatSideEffect;
            if (payload?.event) {
              onEvent?.({
                type: 'side_effect',
                event: payload.event,
                data: payload.data,
              });
            }
          }
          continue;
        }

        if (mode === 'updates' && isMainNamespace && data && typeof data === 'object') {
          for (const [nodeName, nodeData] of Object.entries(data as Record<string, unknown>)) {
            finalAssistantText = this.getLastAssistantText(nodeData) || finalAssistantText;

            const messages = Array.isArray((nodeData as { messages?: unknown[] })?.messages)
              ? ((nodeData as { messages?: unknown[] }).messages as unknown[])
              : [];

            if (nodeName === 'model_request') {
              for (const graphMessage of messages) {
                for (const toolCall of this.getToolCalls(graphMessage)) {
                  if (!toolCall.name || !DOMAIN_TOOLS.has(toolCall.name as ChatToolName)) {
                    continue;
                  }

                  const callId = toolCall.id || `${toolCall.name}:${JSON.stringify(toolCall.args ?? {})}`;
                  if (startedToolCalls.has(callId)) {
                    continue;
                  }

                  startedToolCalls.add(callId);
                  onEvent?.({
                    type: 'tool_start',
                    name: toolCall.name,
                    input: this.normalizeToolInput(toolCall.args),
                  });
                }
              }
            }

            if (nodeName === 'tools') {
              for (const graphMessage of messages) {
                if (!this.isToolLikeMessage(graphMessage)) {
                  continue;
                }

                const toolName = this.getToolName(graphMessage);
                if (!toolName || !DOMAIN_TOOLS.has(toolName as ChatToolName)) {
                  continue;
                }

                const callId = this.getToolCallId(graphMessage) || `${toolName}:${this.extractText((graphMessage as { content?: unknown }).content)}`;
                if (finishedToolCalls.has(callId)) {
                  continue;
                }

                finishedToolCalls.add(callId);
                onEvent?.({
                  type: 'tool_done',
                  name: toolName,
                  result: this.normalizeToolOutput((graphMessage as { content?: unknown }).content),
                });
              }
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('stream_error', {
        journeyId: context.journey.id,
        conversationId: context.conversationId,
        message,
        fullContentLength: fullContent.length,
        finalAssistantTextLength: finalAssistantText.length,
      });

      const canGracefullyFinish =
        fullContent.trim().length > 0 || finalAssistantText.trim().length > 0;

      if (!canGracefullyFinish) {
        throw error;
      }
    }

    const resolvedContent = fullContent.trim() || finalAssistantText.trim();
    onEvent?.({ type: 'done', fullContent: resolvedContent });

    return {
      fullContent: resolvedContent,
      workspaceRoot: rootDir,
    };
  }
}

const carSearchToolSchema = z.object({
  query: z.string().optional().describe('自然语言搜索词，如“家用 SUV”'),
  budgetMin: z.number().optional().describe('最低预算（万元）'),
  budgetMax: z.number().optional().describe('最高预算（万元）'),
  fuelType: z.enum(['BEV', 'PHEV', 'ICE', 'HEV']).optional(),
  carType: z.enum(['SUV', 'SEDAN', 'MPV', 'COUPE', 'HATCHBACK']).optional(),
  limit: z.number().optional().describe('返回数量，默认 5'),
});

const carDetailToolSchema = z.object({
  carId: z.string().optional().describe('车型 ID。若没有，也可能传车型名称。'),
  query: z.string().optional().describe('车型名称或品牌+车型，例如“深蓝S7”'),
});

const journeyUpdateToolSchema = z.object({
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

const addCandidateToolSchema = z.object({
  carId: z.string().optional().describe('车型 ID。若模型只有车型名，也可能把车型名填在这里。'),
  query: z.string().optional().describe('车型名称或品牌+车型，例如“理想 L6”'),
  userNotes: z.string().optional(),
  priceAtAdd: z.number().optional(),
});

export const journeyDeepAgentService = new JourneyDeepAgentService();
