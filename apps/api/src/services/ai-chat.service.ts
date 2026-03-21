import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { conversationService } from './conversation.service';
import { journeyService } from './journey.service';
import { MessageRole } from '@newcar/shared';

export class AiChatService {
  private getClient(): Anthropic {
    return new Anthropic({ apiKey: config.ai.apiKey });
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

    // 4. Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    // 5. Call Claude API
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
      const block = response.content[0];
      aiContent = block.type === 'text' ? block.text : '';
    } catch (err: any) {
      aiContent = '抱歉，我现在无法回答。请稍后再试。';
    }

    // 6. Save AI response
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: aiContent,
    });

    // 7. Extract basic signals from user message
    const signals = this.extractBasicSignals(data.message);

    // 8. Update journey lastActivityAt
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: aiContent,
      conversationId: conversation.id,
      extractedSignals: signals,
    };
  }

  private buildSystemPrompt(): string {
    return `你是用户的购车助手，帮助用户完成购车决策。用户正在使用 AI 原生购车平台。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

请用友好、专业的语气与用户交流。`;
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
