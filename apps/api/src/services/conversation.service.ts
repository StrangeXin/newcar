import { prisma } from '../lib/prisma';
import { MessageRole } from '@newcar/shared';

export class ConversationService {
  async createConversation(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
  }) {
    return prisma.conversation.create({
      data: {
        journeyId: data.journeyId,
        userId: data.userId,
        sessionId: data.sessionId,
        messages: [],
        extractedSignals: [],
        toolCalls: [],
      },
    });
  }

  async getOrCreateConversation(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
  }) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        journeyId: data.journeyId,
        sessionId: data.sessionId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.createConversation(data);
    }

    return conversation;
  }

  async addMessage(data: {
    journeyId: string;
    sessionId: string;
    userId?: string;
    role: MessageRole;
    content: string;
  }) {
    const conversation = await this.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    const messages = (conversation.messages as any[]) || [];
    messages.push({
      role: data.role,
      content: data.content,
      timestamp: new Date().toISOString(),
    });

    return prisma.conversation.update({
      where: { id: conversation.id },
      data: { messages },
    });
  }

  async extractSignals(conversationId: string, signals: any[]) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { extractedSignals: signals },
    });
  }

  async addToolCall(data: {
    conversationId: string;
    toolCall: {
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    };
  }) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const toolCalls = (conversation.toolCalls as any[]) || [];
    toolCalls.push({
      ...data.toolCall,
      timestamp: new Date().toISOString(),
    });

    return prisma.conversation.update({
      where: { id: data.conversationId },
      data: { toolCalls },
    });
  }

  async getConversationHistory(data: {
    journeyId: string;
    sessionId: string;
    userId?: string;
    limit?: number;
  }) {
    const conversation = await this.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    const messages = (conversation.messages as any[]) || [];
    const limit = data.limit ?? 10;
    return messages.slice(-limit);
  }

  async getExtractedSignals(data: {
    journeyId: string;
    sessionId: string;
    userId?: string;
  }) {
    const conversation = await this.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    return conversation.extractedSignals as any[];
  }
}

export const conversationService = new ConversationService();
