import OpenAI from 'openai';
import { config } from '../config';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { MessageRole } from '@newcar/shared';
import { weaviateService } from './weaviate.service';

export class AiChatService {
  private getClient(): OpenAI {
    return new OpenAI({
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

    // 4. Run tools for context
    const toolContext = await this.runToolsForMessage(data.message);

    // 5. Build system prompt
    const systemPrompt = this.buildSystemPrompt(toolContext);

    // 6. Call AI API via OpenAI SDK (OpenRouter)
    const client = this.getClient();
    let aiContent: string;
    try {
      const response = await client.chat.completions.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map((m: any) => ({
            role: m.role === 'USER' ? 'user' : 'assistant',
            content: m.content,
          })),
        ],
      });
      aiContent = response.choices[0]?.message?.content ?? '';
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

    // 8. Extract signals
    const signals = this.extractBasicSignals(data.message);

    // 9. Update journey
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: aiContent,
      conversationId: conversation.id,
      extractedSignals: signals,
    };
  }

  private async runToolsForMessage(message: string): Promise<string> {
    try {
      if (message.includes('想买') || message.includes('搜索') || message.includes('找')) {
        const budgetMatch = message.match(/(\d+)\s*万左右?/);
        const budget = budgetMatch ? parseInt(budgetMatch[1]) : undefined;

        let fuelType: string | undefined;
        if (message.includes('电车') || message.includes('纯电')) fuelType = 'BEV';
        else if (message.includes('混动') || message.includes('PHEV')) fuelType = 'PHEV';
        else if (message.includes('油车') || message.includes('燃油')) fuelType = 'ICE';

        const results = await weaviateService.searchCars('', {
          fuelType: fuelType as any,
          maxMsrp: budget ? budget * 10000 : undefined,
        });

        if (results.length > 0) {
          return `\n\n以下是搜索结果：\n${results.slice(0, 5).map((car, i) =>
            `${i + 1}. ${car.brand} ${car.model} ${car.variant} - ${(car.msrp / 10000).toFixed(1)}万`
          ).join('\n')}`;
        }
      }
    } catch (err) {
      console.error('Tool error:', err);
    }
    return '';
  }

  private buildSystemPrompt(toolContext: string): string {
    return `你是用户的购车助手，帮助用户完成购车决策。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 搜索和推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

请用友好、专业的语气与用户交流。${toolContext}`;
  }

  private extractBasicSignals(message: string): any[] {
    const signals: any[] = [];

    const budgetMatch = message.match(/(\d+)\s*万左右?/);
    if (budgetMatch) {
      signals.push({
        type: 'BUDGET',
        value: budgetMatch[1],
        confidence: 0.8,
        updatedAt: new Date().toISOString(),
      });
    }

    if (message.includes('电车') || message.includes('纯电')) {
      signals.push({
        type: 'PREFERENCE',
        value: 'BEV',
        confidence: 0.7,
        updatedAt: new Date().toISOString(),
      });
    }

    return signals;
  }
}

export const aiChatService = new AiChatService();
