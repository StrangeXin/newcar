import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageRole } from '@newcar/shared';

const mockedPrisma = {
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock('../src/lib/prisma', () => ({
  prisma: mockedPrisma,
}));

describe('ConversationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses journey conversation for same user across turns', async () => {
    const existingConversation = {
      id: 'conv-1',
      journeyId: 'journey-1',
      userId: 'user-1',
      sessionId: 'journey-1',
      messages: [],
      extractedSignals: [],
      toolCalls: [],
    };

    mockedPrisma.conversation.findFirst.mockResolvedValue(existingConversation);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getOrCreateByJourney('journey-1', 'user-1');

    expect(result).toEqual(existingConversation);
    expect(mockedPrisma.conversation.create).not.toHaveBeenCalled();
  });

  it('appends message into existing conversation history', async () => {
    const existingConversation = {
      id: 'conv-1',
      journeyId: 'journey-1',
      sessionId: 'journey-1',
      messages: [
        {
          role: MessageRole.USER,
          content: '第一轮',
          timestamp: '2026-03-23T00:00:00.000Z',
        },
      ],
    };

    mockedPrisma.conversation.findFirst.mockResolvedValue(existingConversation);
    mockedPrisma.conversation.update.mockResolvedValue({
      id: 'conv-1',
    });

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.addMessage({
      journeyId: 'journey-1',
      sessionId: 'journey-1',
      userId: 'user-1',
      role: MessageRole.ASSISTANT,
      content: '第二轮回复',
    });

    expect(result.role).toBe(MessageRole.ASSISTANT);
    expect(result.content).toBe('第二轮回复');
    expect(mockedPrisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: {
          messages: expect.arrayContaining([
            expect.objectContaining({ content: '第一轮' }),
            expect.objectContaining({ content: '第二轮回复' }),
          ]),
        },
      })
    );
  });
});
