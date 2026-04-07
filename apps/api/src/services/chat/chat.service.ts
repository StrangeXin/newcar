/**
 * AiChatService — main chat flow (streamChat / runChat).
 *
 * Delegates signal extraction to ./signal-extraction and
 * side-effect dispatch to ./chat-side-effects.
 */

import { AddedReason, JourneyStage, MessageRole } from '@newcar/shared';
import { Prisma } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { carCandidateService } from '../car-candidate.service';
import { carService } from '../car.service';
import { conversationService } from '../conversation.service';
import { journeyService } from '../journey.service';
import { journeyDeepAgentService } from '../journey-deep-agent.service';
import { executeChatTool } from '../../tools/chat-tools';
import type { ChatSideEffect, ChatToolName } from '../../tools/chat-tools';

import { buildSignals, estimateConfidenceScore } from './signal-extraction';
import { createTimelineEventForSideEffect, shouldSuggestPublish } from './chat-side-effects';
import { calculateCompleteness } from '../journey-completeness.service';
import { buildCompletenessBlock } from './completeness-prompt';

export type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; name: ChatToolName; input: Record<string, unknown> }
  | { type: 'tool_done'; name: ChatToolName; result: unknown }
  | {
      type: 'side_effect';
      event: ChatSideEffect['event'];
      data: unknown;
      timelineEvent?: unknown;
      patch?: {
        candidates?: unknown[];
        stage?: string;
        requirements?: Record<string, unknown>;
      };
    }
  | { type: 'done'; conversationId: string; fullContent: string }
  | { type: 'error'; code: string; message: string };

export interface ChatOptions {
  journeyId: string;
  userId?: string;
  sessionId?: string;
  message: string;
  traceId?: string;
  scenarioId?: string;
  onEvent?: (event: StreamEvent) => void;
}

export class AiChatService {
  /* ---- delegating helpers (keep backward-compat for tests that cast to access privates) ---- */

  private buildSignals(message: string, requirements: Record<string, unknown>) {
    return buildSignals(message, requirements);
  }

  private estimateConfidenceScore(requirements: Record<string, unknown>, response: string) {
    return estimateConfidenceScore(requirements, response);
  }

  private createTimelineEventForSideEffect(journeyId: string, event: ChatSideEffect['event'], data: unknown) {
    return createTimelineEventForSideEffect(journeyId, event, data);
  }

  private shouldSuggestPublish(stage?: string) {
    return shouldSuggestPublish(stage);
  }

  /* ---- internals ---- */

  private logChat(traceId: string | undefined, event: string, details?: Record<string, unknown>) {
    if (!config.ai.debug) {
      return;
    }

    logger.info({ traceId, event, ...(details || {}) }, '[ai-chat]');
  }

  async chat(data: ChatOptions): Promise<{
    message: string;
    conversationId: string;
    extractedSignals: Array<{ type: string; value: string; confidence: number; updatedAt: string }>;
  }> {
    const result = await this.runChat({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
      message: data.message,
    });

    return {
      message: result.fullContent,
      conversationId: result.conversationId,
      extractedSignals: result.extractedSignals,
    };
  }

  async streamChat(data: ChatOptions): Promise<void> {
    await this.runChat(data);
  }

  private async runChat(data: ChatOptions): Promise<{
    fullContent: string;
    conversationId: string;
    extractedSignals: Array<{ type: string; value: string; confidence: number; updatedAt: string }>;
  }> {
    this.logChat(data.traceId, 'chat_start', {
      journeyId: data.journeyId,
      userId: data.userId,
      hasSessionId: Boolean(data.sessionId),
      messageLength: data.message.length,
    });

    const journey = await journeyService.getJourneyDetail(data.journeyId);
    if (!journey) {
      this.logChat(data.traceId, 'chat_abort_missing_journey', { journeyId: data.journeyId });
      throw new Error('Journey not found');
    }

    const conversation = data.userId
      ? await conversationService.getOrCreateByJourney(data.journeyId, data.userId)
      : await conversationService.getOrCreateConversation({
          journeyId: data.journeyId,
          userId: data.userId,
          sessionId: data.sessionId || data.journeyId,
        });

    const sessionId = conversation.sessionId;
    this.logChat(data.traceId, 'conversation_ready', {
      conversationId: conversation.id,
      sessionId,
    });

    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      role: MessageRole.USER,
      content: data.message,
    });

    const history = (await conversationService.getConversationHistory({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      limit: 20,
    })) as Array<{ role: string; content: string; timestamp?: string }>;

    this.logChat(data.traceId, 'history_loaded', {
      conversationId: conversation.id,
      messageCount: history.length,
    });

    const existingRequirements = (journey.requirements as Record<string, unknown>) || {};
    const extractedSignals = buildSignals(data.message, existingRequirements);

    if (extractedSignals.length > 0) {
      await conversationService.extractSignals(conversation.id, extractedSignals as unknown as Prisma.InputJsonValue[]);
    }

    // 计算旅程完整度
    const completeness = calculateCompleteness(
      {
        id: journey.id,
        stage: journey.stage,
        requirements: existingRequirements,
      },
      ((journey.candidates as Array<Record<string, unknown>>) || []).map((c) => ({
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
      ((journey.snapshots as Array<Record<string, unknown>>) || []).map((s) => ({
        id: s.id as string,
      })),
    );
    const completenessBlock = buildCompletenessBlock(completeness);

    if (config.ai.e2eMock) {
      this.logChat(data.traceId, 'mock_chat_start', { conversationId: conversation.id });
      const fullContent = await this.runMockChat(data, existingRequirements);

      await conversationService.addMessage({
        journeyId: data.journeyId,
        sessionId,
        userId: data.userId,
        role: MessageRole.ASSISTANT,
        content: fullContent,
      });

      await journeyService.updateAiConfidenceScore(
        data.journeyId,
        estimateConfidenceScore(existingRequirements, fullContent),
      );

      data.onEvent?.({
        type: 'done',
        conversationId: conversation.id,
        fullContent,
      });
      this.logChat(data.traceId, 'mock_chat_done', {
        conversationId: conversation.id,
        fullContentLength: fullContent.length,
      });

      return {
        fullContent,
        conversationId: conversation.id,
        extractedSignals,
      };
    }

    if (!config.ai.apiKey) {
      const fallback =
        '我已经收到你的问题，但当前 AI 服务还没有配置完成。先告诉我你的预算、车型和用途，我可以继续帮你整理需求。';
      await conversationService.addMessage({
        journeyId: data.journeyId,
        sessionId,
        userId: data.userId,
        role: MessageRole.ASSISTANT,
        content: fallback,
      });
      data.onEvent?.({ type: 'token', delta: fallback });
      data.onEvent?.({
        type: 'done',
        conversationId: conversation.id,
        fullContent: fallback,
      });
      this.logChat(data.traceId, 'chat_fallback_no_api_key', {
        conversationId: conversation.id,
      });
      return {
        fullContent: fallback,
        conversationId: conversation.id,
        extractedSignals,
      };
    }

    const executedTools: string[] = [];
    const toolInputs = new Map<string, Record<string, unknown>>();
    const toolCallsToPersist: Array<{
      name: ChatToolName;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    let fullContentResult: { fullContent: string; workspaceRoot: string };
    try {
    fullContentResult = await journeyDeepAgentService.streamJourneyChat(
      {
        journey: {
          id: journey.id,
          title: journey.title,
          stage: journey.stage as JourneyStage,
          status: journey.status,
          requirements: existingRequirements,
          completenessContext: completenessBlock,
          candidates: journey.candidates?.map((c) => ({
            id: c.id,
            status: c.status,
            addedReason: c.addedReason,
            userNotes: c.userNotes,
            car: c.car
              ? {
                  id: c.car.id,
                  brand: c.car.brand,
                  model: c.car.model,
                  variant: c.car.variant,
                  msrp: c.car.msrp,
                  fuelType: c.car.fuelType,
                  type: c.car.type,
                }
              : undefined,
          })),
        },
        conversationId: conversation.id,
        history,
      },
      data.message,
      (event) => {
        if (event.type === 'tool_start') {
          const toolName = event.name as ChatToolName;
          executedTools.push(toolName);
          toolInputs.set(toolName, event.input);
          this.logChat(data.traceId, 'tool_start', {
            conversationId: conversation.id,
            toolName,
            input: event.input,
          });
          data.onEvent?.({ ...event, name: toolName });
          return;
        }

        if (event.type === 'tool_done') {
          const toolName = event.name as ChatToolName;
          this.logChat(data.traceId, 'tool_done', {
            conversationId: conversation.id,
            toolName,
            resultKeys:
              event.result && typeof event.result === 'object'
                ? Object.keys(event.result as Record<string, unknown>)
                : [],
          });
          if (this.isChatToolName(toolName)) {
            toolCallsToPersist.push({
              name: toolName,
              args: toolInputs.get(toolName) || {},
              result: event.result,
            });
          }
          data.onEvent?.({ ...event, name: toolName });
          return;
        }

        if (event.type === 'side_effect') {
          this.logChat(data.traceId, 'tool_side_effect', {
            conversationId: conversation.id,
            sideEffect: event.event,
          });
          void createTimelineEventForSideEffect(data.journeyId, event.event, event.data)
            .then((payload) => {
              data.onEvent?.({
                type: 'side_effect',
                event: event.event,
                data: payload.data,
                timelineEvent: payload.timelineEvent,
                patch: payload.patch,
              });

              if (event.event === 'stage_changed') {
                const stage = String(
                  payload.patch?.stage ||
                    (payload.data as Record<string, unknown> | undefined)?.stage ||
                    '',
                );
                if (shouldSuggestPublish(stage)) {
                  void createTimelineEventForSideEffect(data.journeyId, 'publish_suggestion', {
                    stage,
                  }).then((suggestionPayload) => {
                    data.onEvent?.({
                      type: 'side_effect',
                      event: 'publish_suggestion',
                      data: suggestionPayload.data,
                      timelineEvent: suggestionPayload.timelineEvent,
                      patch: suggestionPayload.patch,
                    });
                  }).catch((err) => {
                    this.logChat(data.traceId, 'publish_suggestion_error', {
                      journeyId: data.journeyId,
                      error: err instanceof Error ? err.message : String(err),
                    });
                  });
                }
              }
            })
            .catch((error) => {
              this.logChat(data.traceId, 'timeline_event_error', {
                conversationId: conversation.id,
                sideEffect: event.event,
                error: error instanceof Error ? error.message : String(error),
              });
              data.onEvent?.(event);
            });
          return;
        }

        if (event.type === 'token') {
          data.onEvent?.(event);
          return;
        }

        return;
      },
    );
    } catch (agentError) {
      const errMsg = agentError instanceof Error ? agentError.message : String(agentError);
      logger.error({ traceId: data.traceId, journeyId: data.journeyId, error: errMsg }, '[ai-chat] agent stream failed');
      data.onEvent?.({ type: 'error', code: 'AGENT_ERROR', message: errMsg });

      fullContentResult = {
        fullContent: '抱歉，AI 服务暂时出现问题，请稍后再试。你可以继续告诉我你的需求，我会尽快恢复。',
        workspaceRoot: '',
      };
    }

    for (const toolCall of toolCallsToPersist) {
      try {
        await conversationService.addToolCall({
          conversationId: conversation.id,
          toolCall,
        });
      } catch (err) {
        logger.error(
          { traceId: data.traceId, conversationId: conversation.id, toolName: toolCall.name, error: err instanceof Error ? err.message : String(err) },
          '[ai-chat] failed to persist tool call',
        );
      }
    }

    const rawContent = fullContentResult.fullContent.trim();
    if (!rawContent) {
      logger.warn({ traceId: data.traceId, journeyId: data.journeyId }, '[ai-chat] agent returned empty content, using fallback');
    }
    const fullContent =
      rawContent ||
      '我已经更新了旅程信息。接下来我们可以继续缩小车型范围，或者开始做深度对比。';

    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: fullContent,
    });

    await journeyService.updateAiConfidenceScore(
      data.journeyId,
      estimateConfidenceScore(existingRequirements, fullContent),
    );

    data.onEvent?.({
      type: 'done',
      conversationId: conversation.id,
      fullContent,
    });
    this.logChat(data.traceId, 'chat_done', {
      conversationId: conversation.id,
      fullContentLength: fullContent.length,
      executedTools,
    });

    return {
      fullContent,
      conversationId: conversation.id,
      extractedSignals,
    };
  }

  private async runMockChat(data: ChatOptions, existingRequirements: Record<string, unknown>) {
    // 场景驱动 mock：当有 scenarioId 时，使用预定义回复
    if (data.scenarioId) {
      return this.runScenarioMock(data);
    }

    const lowerMessage = data.message.toLowerCase();
    const budgetMatch = data.message.match(/(\d+(?:\.\d+)?)\s*万/);
    const requirements: Record<string, unknown> = {};
    const namedCarQuery = this.extractNamedCarQuery(data.message);

    if (budgetMatch) {
      requirements.budgetMax = Number(budgetMatch[1]);
    }
    if (/家用|家庭|带娃/.test(data.message)) {
      requirements.useCases = ['family'];
    }
    if (/增程|插混|phev/.test(lowerMessage)) {
      requirements.fuelTypePreference = ['PHEV'];
    }

    if (Object.keys(requirements).length > 0 || /推荐|候选|对比|加入/.test(data.message)) {
      await this.emitMockTool(data, 'journey_update', {
        requirements: Object.keys(requirements).length > 0 ? requirements : undefined,
        stage: /推荐|候选|对比|加入/.test(data.message) ? JourneyStage.COMPARISON : undefined,
      });
    }

    if (/推荐|候选|理想|l6/.test(lowerMessage)) {
      await this.emitMockTool(data, 'car_search', {
        query: /理想|l6/.test(lowerMessage) ? 'L6' : 'SUV',
        budgetMax:
          typeof requirements.budgetMax === 'number' ? requirements.budgetMax : undefined,
        fuelType: Array.isArray(requirements.fuelTypePreference)
          ? String(requirements.fuelTypePreference[0])
          : undefined,
        limit: 3,
      });
    }

    if (namedCarQuery && /详情|参数|配置|口碑|试驾|门店/.test(data.message)) {
      await this.emitMockTool(data, 'car_detail', {
        query: namedCarQuery,
      });
    }

    let candidateAdded = false;
    let targetCarName = '理想 L6';
    if (/理想\s*l6|理想l6|l6/.test(lowerMessage)) {
      const cars = await carService.searchCars({ q: 'L6', limit: 10 });
      const targetCar =
        cars.find((car) => car.brand.includes('理想') && car.model.toLowerCase().includes('l6')) ||
        cars[0];

      if (targetCar) {
        targetCarName = `${targetCar.brand} ${targetCar.model}`;
        const alreadyAdded = await carCandidateService
          .getCandidatesByJourney(data.journeyId)
          .then((candidates) =>
            candidates.some(
              (candidate) => candidate.carId === targetCar.id && candidate.status !== 'ELIMINATED',
            ),
          );

        if (!alreadyAdded) {
          await this.emitMockTool(data, 'add_candidate', {
            carId: targetCar.id,
            priceAtAdd: targetCar.msrp || undefined,
            userNotes: 'E2E mock: 满足家用增程 SUV 的核心需求。',
          });
          candidateAdded = true;
        }
      }
    }

    const finalText =
      namedCarQuery && /试驾|门店/.test(data.message)
        ? `我已经调出 ${namedCarQuery} 的车型详情。试驾门店功能还在接入中，现阶段你可以先继续比较配置、价格和口碑，我也可以帮你把它加入候选继续跟进。`
        : [
            `已按你的需求更新旅程画像${budgetMatch ? `，预算控制在 ${budgetMatch[1]} 万以内` : ''}。`,
            '我也切到了更适合继续筛选的深度对比阶段。',
            candidateAdded
              ? `并且已经把 ${targetCarName} 加入候选列表，接下来可以继续比较空间、续航和落地价。`
              : `${targetCarName} 目前已在候选中，接下来可以继续比较空间、续航和落地价。`,
          ].join('');

    for (const chunk of finalText.match(/.{1,12}/g) || [finalText]) {
      data.onEvent?.({ type: 'token', delta: chunk });
    }

    return finalText;
  }

  private extractNamedCarQuery(message: string) {
    const normalized = message.replace(/\s+/g, '');
    const candidates = ['深蓝S7', '理想L6', '理想L7', '小鹏G6', '问界M7', '特斯拉ModelY'];
    return candidates.find((candidate) => normalized.includes(candidate)) || '';
  }

  private async emitMockTool(
    data: ChatOptions,
    name: ChatToolName,
    input: Record<string, unknown>,
  ) {
    this.logChat(data.traceId, 'mock_tool_start', {
      journeyId: data.journeyId,
      toolName: name,
      input,
    });
    const sanitizedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    data.onEvent?.({ type: 'tool_start', name, input: sanitizedInput });
    const result = await executeChatTool(name, sanitizedInput, {
      journeyId: data.journeyId,
      userId: data.userId,
    });
    data.onEvent?.({ type: 'tool_done', name, result: result.output });
    this.logChat(data.traceId, 'mock_tool_done', {
      journeyId: data.journeyId,
      toolName: name,
      sideEffectCount: result.sideEffects.length,
    });
    for (const sideEffect of result.sideEffects) {
      data.onEvent?.({
        type: 'side_effect',
        event: sideEffect.event,
        data: sideEffect.data,
      });
    }
  }

  private scenarioRoundCounters = new Map<string, number>();

  private async runScenarioMock(data: ChatOptions): Promise<string> {
    const scenarioId = data.scenarioId!;
    const counterKey = `${data.journeyId}:${scenarioId}`;
    const round = (this.scenarioRoundCounters.get(counterKey) || 0) + 1;
    this.scenarioRoundCounters.set(counterKey, round);

    let scenarioData: {
      rounds: Array<{
        round: number;
        response: string;
        tools: Array<{ name: string; input: Record<string, unknown> }>;
      }>;
    };
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(
        __dirname,
        '../../promptfoo/mock-responses',
        `${scenarioId}.json`,
      );
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

  private isChatToolName(name: string): name is ChatToolName {
    return ['car_search', 'car_detail', 'journey_update', 'add_candidate'].includes(name);
  }
}

export const aiChatService = new AiChatService();
