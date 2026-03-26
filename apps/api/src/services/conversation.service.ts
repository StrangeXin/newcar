import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { MessageRole } from '@newcar/shared';

type JsonArray = Prisma.JsonArray;

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

  async getOrCreateByJourney(journeyId: string, userId: string) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        journeyId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.createConversation({
        journeyId,
        userId,
        sessionId: journeyId,
      });
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

    const messages = (conversation.messages as JsonArray) || [];
    const newMessage = {
      role: data.role,
      content: data.content,
      timestamp: new Date().toISOString(),
    };
    messages.push(newMessage);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { messages },
    });

    return newMessage;
  }

  async extractSignals(conversationId: string, signals: Prisma.InputJsonValue[]) {
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

    const toolCalls = (conversation.toolCalls as JsonArray) || [];
    toolCalls.push({
      ...data.toolCall,
      result: data.toolCall.result as Prisma.JsonValue,
      timestamp: new Date().toISOString(),
    } as Prisma.JsonValue);

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
    const conversation = await prisma.conversation.findFirst({
      where: {
        journeyId: data.journeyId,
        ...(data.userId
          ? {
              userId: data.userId,
            }
          : {
              sessionId: data.sessionId,
            }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      return [];
    }

    const messages = (conversation.messages as JsonArray) || [];
    const limit = data.limit ?? 10;
    return messages.slice(-limit);
  }

  async getExtractedSignals(data: {
    journeyId: string;
    sessionId: string;
    userId?: string;
  }) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        journeyId: data.journeyId,
        ...(data.userId
          ? {
              userId: data.userId,
            }
          : {
              sessionId: data.sessionId,
            }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      return [];
    }

    return conversation.extractedSignals as JsonArray;
  }
}

export const conversationService = new ConversationService();
