import Anthropic from '@anthropic-ai/sdk';
import { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages';
import { AddedReason, JourneyStage, MessageRole } from '@newcar/shared';
import { config } from '../config';
import { carCandidateService } from './car-candidate.service';
import { carService } from './car.service';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { chatTools, executeChatTool, type ChatSideEffect, type ChatToolName } from '../tools/chat-tools';

type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; name: ChatToolName; input: Record<string, unknown> }
  | { type: 'tool_done'; name: ChatToolName; result: unknown }
  | { type: 'side_effect'; event: ChatSideEffect['event']; data: unknown }
  | { type: 'done'; conversationId: string; fullContent: string }
  | { type: 'error'; code: string; message: string };

interface ChatOptions {
  journeyId: string;
  userId?: string;
  sessionId?: string;
  message: string;
  onEvent?: (event: StreamEvent) => void;
}

export class AiChatService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async chat(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    message: string;
  }): Promise<{ message: string; conversationId: string; extractedSignals: any[] }> {
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
    extractedSignals: any[];
  }> {
    const journey = await journeyService.getJourneyDetail(data.journeyId);
    if (!journey) {
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

    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      role: MessageRole.USER,
      content: data.message,
    });

    const history = await conversationService.getConversationHistory({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      limit: 20,
    });

    const messages: MessageParam[] = history.map((message: any) => ({
      role: message.role === MessageRole.USER ? 'user' : 'assistant',
      content: message.content,
    }));

    const existingRequirements = (journey.requirements as Record<string, unknown>) || {};
    const extractedSignals = this.buildSignals(data.message, existingRequirements);

    if (extractedSignals.length > 0) {
      await conversationService.extractSignals(conversation.id, extractedSignals);
    }

    if (config.ai.e2eMock) {
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
        this.estimateConfidenceScore(existingRequirements, fullContent)
      );

      data.onEvent?.({
        type: 'done',
        conversationId: conversation.id,
        fullContent,
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
      return {
        fullContent: fallback,
        conversationId: conversation.id,
        extractedSignals,
      };
    }

    const client = this.getClient();
    const systemPrompt = this.buildSystemPrompt(journey.title, existingRequirements);
    let fullContent = '';
    let toolRounds = 0;

    while (toolRounds < 6) {
      const stream = client.messages.stream({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages,
        tools: chatTools as any,
      });

      let streamedText = '';
      stream.on('text', (delta) => {
        streamedText += delta;
        data.onEvent?.({ type: 'token', delta });
      });

      const finalMessage = await stream.finalMessage();
      messages.push({
        role: 'assistant',
        content: finalMessage.content as MessageParam['content'],
      });

      if (streamedText) {
        fullContent += streamedText;
      }

      const toolUses = finalMessage.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        break;
      }

      toolRounds += 1;
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolUse of toolUses) {
        const toolName = toolUse.name as ChatToolName;
        const toolInput = (toolUse.input ?? {}) as Record<string, unknown>;
        data.onEvent?.({ type: 'tool_start', name: toolName, input: toolInput });

        const toolResult = await executeChatTool(toolName, toolInput, {
          journeyId: data.journeyId,
          userId: data.userId,
        });

        await conversationService.addToolCall({
          conversationId: conversation.id,
          toolCall: {
            name: toolName,
            args: toolInput,
            result: toolResult.output,
          },
        });

        data.onEvent?.({ type: 'tool_done', name: toolName, result: toolResult.output });

        for (const sideEffect of toolResult.sideEffects) {
          data.onEvent?.({
            type: 'side_effect',
            event: sideEffect.event,
            data: sideEffect.data,
          });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult.output, null, 2),
        });
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    if (!fullContent.trim()) {
      fullContent = '我已经更新了旅程信息。接下来我们可以继续缩小车型范围，或者开始做深度对比。';
    }

    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: fullContent,
    });

    await journeyService.updateAiConfidenceScore(
      data.journeyId,
      this.estimateConfidenceScore(existingRequirements, fullContent)
    );

    data.onEvent?.({
      type: 'done',
      conversationId: conversation.id,
      fullContent,
    });

    return {
      fullContent,
      conversationId: conversation.id,
      extractedSignals,
    };
  }

  private async runMockChat(data: ChatOptions, existingRequirements: Record<string, unknown>) {
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
        budgetMax: typeof requirements.budgetMax === 'number' ? requirements.budgetMax : undefined,
        fuelType: Array.isArray(requirements.fuelTypePreference) ? String(requirements.fuelTypePreference[0]) : undefined,
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
        cars.find((car) => car.brand.includes('理想') && car.model.toLowerCase().includes('l6')) || cars[0];

      if (targetCar) {
        targetCarName = `${targetCar.brand} ${targetCar.model}`;
        const alreadyAdded = await carCandidateService.getCandidatesByJourney(data.journeyId).then((candidates) =>
          candidates.some((candidate) => candidate.carId === targetCar.id && candidate.status !== 'ELIMINATED')
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

    const finalText = namedCarQuery && /试驾|门店/.test(data.message)
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
    input: Record<string, unknown>
  ) {
    const sanitizedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    data.onEvent?.({ type: 'tool_start', name, input: sanitizedInput });
    const result = await executeChatTool(name, sanitizedInput, {
      journeyId: data.journeyId,
      userId: data.userId,
    });
    data.onEvent?.({ type: 'tool_done', name, result: result.output });
    for (const sideEffect of result.sideEffects) {
      data.onEvent?.({
        type: 'side_effect',
        event: sideEffect.event,
        data: sideEffect.data,
      });
    }
  }

  private buildSystemPrompt(title: string, requirements: Record<string, unknown>) {
    return [
      '你是新车购买旅程工作台中的 AI 购车助手。',
      '目标不是闲聊，而是帮助用户更快完成购车决策，并在必要时调用工具更新旅程状态。',
      '请使用简洁、专业、友好的中文回答。',
      '当用户提到预算、用途、能源偏好、风格偏好、阶段变化时，优先调用 journey_update。',
      '当用户想找车、要推荐、想补充候选时，优先使用 car_search；明确点名车型时使用 car_detail。',
      '只有在用户明确表达“加入候选”“把这款加进去”等意图时调用 add_candidate。',
      '如果工具已经完成结构化动作，请在回答里自然确认结果，并给出下一步建议。',
      `当前旅程标题：${title}`,
      `当前已知需求：${JSON.stringify(requirements, null, 2)}`,
    ].join('\n');
  }

  private buildSignals(message: string, requirements: Record<string, unknown>) {
    const signals: Array<{
      type: string;
      value: string;
      confidence: number;
      updatedAt: string;
    }> = [];
    const now = new Date().toISOString();

    const rangeMatch = message.match(/(\d+)\s*[-到]\s*(\d+)\s*万/);
    if (rangeMatch) {
      signals.push({
        type: 'REQUIREMENT',
        value: `${rangeMatch[1]}-${rangeMatch[2]}万`,
        confidence: 0.86,
        updatedAt: now,
      });
    }

    const singleBudgetMatch = message.match(/(\d+)\s*万/);
    if (!rangeMatch && singleBudgetMatch) {
      signals.push({
        type: 'REQUIREMENT',
        value: `${singleBudgetMatch[1]}万预算`,
        confidence: 0.72,
        updatedAt: now,
      });
    }

    for (const keyword of ['SUV', '轿车', 'MPV', '纯电', '增程', '混动', '家用', '通勤', '长途']) {
      if (message.includes(keyword)) {
        signals.push({
          type: 'PREFERENCE',
          value: keyword,
          confidence: 0.7,
          updatedAt: now,
        });
      }
    }

    if (signals.length === 0 && Object.keys(requirements).length > 0) {
      signals.push({
        type: 'CONCERN',
        value: '延续现有需求上下文',
        confidence: 0.5,
        updatedAt: now,
      });
    }

    return signals;
  }

  private estimateConfidenceScore(requirements: Record<string, unknown>, response: string) {
    let score = 0.45;
    if (requirements.budgetMin || requirements.budgetMax) score += 0.12;
    if (Array.isArray(requirements.useCases) && requirements.useCases.length > 0) score += 0.12;
    if (Array.isArray(requirements.fuelTypePreference) && requirements.fuelTypePreference.length > 0) score += 0.1;
    if (requirements.stylePreference) score += 0.08;
    if (response.length > 80) score += 0.05;
    return Math.min(0.95, Number(score.toFixed(2)));
  }
}

export const aiChatService = new AiChatService();
