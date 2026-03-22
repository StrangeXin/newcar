import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { MessageRole } from '@newcar/shared';
import { carService } from './car.service';
import { weaviateService } from './weaviate.service';

interface CarSearchToolInput {
  query: string;
  fuel_type?: string;
  budget_max?: number; // 单位：万元
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
    // 1. Get or create conversation
    const conversation = await conversationService.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    // 2. Save user message
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.USER,
      content: data.message,
    });

    // 3. Get conversation history (last 10 messages)
    const history = await conversationService.getConversationHistory({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      limit: 10,
    });

    // 4. Optionally trigger tools (car_search / get_car_detail)
    const toolContext = await this.runToolsForMessage(data.message);

    // 5. Build system prompt
    const systemPrompt = this.buildSystemPrompt(toolContext);

    // 6. Call Claude API
    const client = this.getClient();
    let aiContent: string;
    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages: history.map((m: any) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
        })),
      });
      // Find the first text block (skip thinking blocks from extended thinking)
      const textBlock = response.content.find((block: any) => block.type === 'text');
      aiContent = textBlock?.text ?? '';
    } catch (err: any) {
      console.error('AI API error:', err?.message || err);
      aiContent = '抱歉，我现在无法回答。请稍后再试。';
    }

    // 7. Save AI response
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: aiContent,
    });

    // 8. Extract basic signals from user message
    const signals = this.extractBasicSignals(data.message);

    // 9. Update journey lastActivityAt
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: aiContent,
      conversationId: conversation.id,
      extractedSignals: signals,
    };
  }

  private buildSystemPrompt(toolContext?: string): string {
    return `你是用户的购车助手，帮助用户完成购车决策。用户正在使用 AI 原生购车平台。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

工具约定（内部）：
- car_search: 输入 { query, fuel_type?, budget_max? }，返回候选车型列表
- get_car_detail: 输入 { carId }，返回车型完整规格

${toolContext ? `工具返回上下文：\n${toolContext}\n` : ''}
请用友好、专业的语气与用户交流。`;
  }

  private async runToolsForMessage(message: string): Promise<string | undefined> {
    const chunks: string[] = [];

    const maybeSearch = this.toCarSearchInput(message);
    if (maybeSearch) {
      const cars = await this.runCarSearchTool(maybeSearch);
      if (cars.length > 0) {
        const summary = cars
          .slice(0, 5)
          .map((car) => `${car.brand} ${car.model} ${car.variant} (${car.fuelType}, ${car.carType}, ${(car.msrp / 10000).toFixed(1)}万)`) // 单位换算展示
          .join('\n');
        chunks.push(`car_search结果：\n${summary}`);
      }
    }

    const detailMatch = message.match(/car[_-]?[a-zA-Z0-9]+/);
    if (detailMatch) {
      const detail = await this.runGetCarDetailTool(detailMatch[0]);
      if (detail) {
        chunks.push(`get_car_detail结果：${detail.brand} ${detail.model} ${detail.variant}，指导价${detail.msrp || '未知'}元`);
      }
    }

    return chunks.length > 0 ? chunks.join('\n\n') : undefined;
  }

  private toCarSearchInput(message: string): CarSearchToolInput | null {
    const hit = /(推荐|找|筛选|适合).*(车|SUV|轿车|MPV)|20万|30万|预算/.test(message);
    if (!hit) {
      return null;
    }

    const budgetMax = this.extractBudgetMaxWan(message);
    let fuelType: string | undefined;
    if (message.includes('纯电') || message.includes('BEV')) {
      fuelType = 'BEV';
    } else if (message.includes('插混') || message.includes('PHEV')) {
      fuelType = 'PHEV';
    }

    return {
      query: message,
      budget_max: budgetMax,
      fuel_type: fuelType,
    };
  }

  private extractBudgetMaxWan(message: string): number | undefined {
    const range = message.match(/(\d+)\s*[-~到]\s*(\d+)\s*万/);
    if (range) {
      return Number(range[2]);
    }
    const approx = message.match(/(\d+)\s*万/);
    if (approx) {
      return Number(approx[1]);
    }
    return undefined;
  }

  private async runCarSearchTool(input: CarSearchToolInput) {
    try {
      await weaviateService.ensureSchema();
      return await weaviateService.searchCars(input.query, {
        fuelType: input.fuel_type,
        maxMsrp: input.budget_max ? input.budget_max * 10000 : undefined,
      });
    } catch (error: any) {
      console.warn('car_search tool unavailable:', error?.message || error);
      return [];
    }
  }

  private async runGetCarDetailTool(carId: string) {
    return carService.getCarById(carId);
  }

  private extractBasicSignals(message: string): any[] {
    const signals: any[] = [];

    const budgetPatterns = [
      /(\d+)\s*万.*?左右/,
      /预算[为是]?(\d+)\s*万/,
      /(\d+)[-~](\d+)\s*万/,
    ];

    for (const pattern of budgetPatterns) {
      const match = message.match(pattern);
      if (match) {
        signals.push({
          type: 'REQUIREMENT',
          value: `预算${match[1]}万`,
          confidence: 0.8,
        });
        break;
      }
    }

    if (message.includes('SUV') || message.includes('越野')) {
      signals.push({ type: 'PREFERENCE', value: 'SUV', confidence: 0.9 });
    }
    if (message.includes('轿车')) {
      signals.push({ type: 'PREFERENCE', value: '轿车', confidence: 0.9 });
    }
    if (message.includes('纯电') || message.includes('BEV')) {
      signals.push({ type: 'PREFERENCE', value: '纯电', confidence: 0.85 });
    }

    return signals;
  }
}

export const aiChatService = new AiChatService();
