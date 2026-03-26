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

  it('getOrCreateByJourney: creates new when none exists', async () => {
    mockedPrisma.conversation.findFirst.mockResolvedValue(null);
    const newConv = {
      id: 'conv-new',
      journeyId: 'journey-1',
      userId: 'user-1',
      sessionId: 'journey-1',
      messages: [],
      extractedSignals: [],
      toolCalls: [],
    };
    mockedPrisma.conversation.create.mockResolvedValue(newConv);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getOrCreateByJourney('journey-1', 'user-1');

    expect(result).toEqual(newConv);
    expect(mockedPrisma.conversation.create).toHaveBeenCalledWith({
      data: {
        journeyId: 'journey-1',
        userId: 'user-1',
        sessionId: 'journey-1',
        messages: [],
        extractedSignals: [],
        toolCalls: [],
      },
    });
  });

  it('getOrCreateByJourney: returns existing when found', async () => {
    const existing = {
      id: 'conv-existing',
      journeyId: 'journey-2',
      userId: 'user-2',
      sessionId: 'journey-2',
      messages: [{ role: 'USER', content: 'hello' }],
    };
    mockedPrisma.conversation.findFirst.mockResolvedValue(existing);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getOrCreateByJourney('journey-2', 'user-2');

    expect(result).toEqual(existing);
    expect(mockedPrisma.conversation.create).not.toHaveBeenCalled();
  });

  it('addMessage: appends message with correct role/content', async () => {
    const conv = {
      id: 'conv-1',
      journeyId: 'j-1',
      sessionId: 'sess-1',
      messages: [],
    };
    mockedPrisma.conversation.findFirst.mockResolvedValue(conv);
    mockedPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.addMessage({
      journeyId: 'j-1',
      sessionId: 'sess-1',
      userId: 'user-1',
      role: MessageRole.USER,
      content: 'I want an EV',
    });

    expect(result.role).toBe(MessageRole.USER);
    expect(result.content).toBe('I want an EV');
    expect(result.timestamp).toBeDefined();
    expect(mockedPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: {
        messages: [
          expect.objectContaining({
            role: MessageRole.USER,
            content: 'I want an EV',
          }),
        ],
      },
    });
  });

  it('addToolCall: appends tool call record', async () => {
    const conv = {
      id: 'conv-1',
      toolCalls: [],
    };
    mockedPrisma.conversation.findUnique.mockResolvedValue(conv);
    const updatedConv = { id: 'conv-1', toolCalls: [{ name: 'search_cars', args: { query: 'suv' }, result: [], timestamp: expect.any(String) }] };
    mockedPrisma.conversation.update.mockResolvedValue(updatedConv);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.addToolCall({
      conversationId: 'conv-1',
      toolCall: {
        name: 'search_cars',
        args: { query: 'suv' },
        result: [],
      },
    });

    expect(mockedPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: {
        toolCalls: [
          expect.objectContaining({
            name: 'search_cars',
            args: { query: 'suv' },
            result: [],
            timestamp: expect.any(String),
          }),
        ],
      },
    });
  });

  it('addToolCall: throws when conversation not found', async () => {
    mockedPrisma.conversation.findUnique.mockResolvedValue(null);

    const { conversationService } = await import('../src/services/conversation.service');
    await expect(
      conversationService.addToolCall({
        conversationId: 'nonexistent',
        toolCall: { name: 'test', args: {}, result: null },
      })
    ).rejects.toThrow('Conversation not found');
  });

  it('extractSignals: creates signal records from array', async () => {
    const signals = [
      { type: 'REQUIREMENT', value: 'budget 200k', confidence: 0.9 },
      { type: 'PREFERENCE', value: 'EV', confidence: 0.8 },
    ];
    const updated = { id: 'conv-1', extractedSignals: signals };
    mockedPrisma.conversation.update.mockResolvedValue(updated);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.extractSignals('conv-1', signals);

    expect(result.extractedSignals).toEqual(signals);
    expect(mockedPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { extractedSignals: signals },
    });
  });

  it('getConversationHistory: returns messages in order', async () => {
    const messages = [
      { role: MessageRole.USER, content: 'msg1', timestamp: '2026-01-01T00:00:00Z' },
      { role: MessageRole.ASSISTANT, content: 'msg2', timestamp: '2026-01-01T00:01:00Z' },
      { role: MessageRole.USER, content: 'msg3', timestamp: '2026-01-01T00:02:00Z' },
    ];
    mockedPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      messages,
    });

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getConversationHistory({
      journeyId: 'j-1',
      sessionId: 'sess-1',
      limit: 10,
    });

    expect(result).toHaveLength(3);
    expect((result[0] as Record<string, unknown>).content).toBe('msg1');
    expect((result[2] as Record<string, unknown>).content).toBe('msg3');
  });

  it('getConversationHistory: returns empty array when no conversation', async () => {
    mockedPrisma.conversation.findFirst.mockResolvedValue(null);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getConversationHistory({
      journeyId: 'j-nonexistent',
      sessionId: 'sess-1',
    });

    expect(result).toEqual([]);
  });

  it('getConversationHistory: respects limit parameter', async () => {
    const messages = [
      { role: MessageRole.USER, content: 'msg1' },
      { role: MessageRole.ASSISTANT, content: 'msg2' },
      { role: MessageRole.USER, content: 'msg3' },
      { role: MessageRole.ASSISTANT, content: 'msg4' },
    ];
    mockedPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      messages,
    });

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getConversationHistory({
      journeyId: 'j-1',
      sessionId: 'sess-1',
      limit: 2,
    });

    expect(result).toHaveLength(2);
    // slice(-2) returns last 2 messages
    expect((result[0] as Record<string, unknown>).content).toBe('msg3');
    expect((result[1] as Record<string, unknown>).content).toBe('msg4');
  });

  it('getExtractedSignals: returns signals for conversation', async () => {
    const signals = [
      { type: 'REQUIREMENT', value: 'budget 200k' },
      { type: 'PREFERENCE', value: 'EV' },
    ];
    mockedPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      extractedSignals: signals,
    });

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getExtractedSignals({
      journeyId: 'j-1',
      sessionId: 'sess-1',
      userId: 'user-1',
    });

    expect(result).toEqual(signals);
  });

  it('getExtractedSignals: returns empty array when no conversation', async () => {
    mockedPrisma.conversation.findFirst.mockResolvedValue(null);

    const { conversationService } = await import('../src/services/conversation.service');
    const result = await conversationService.getExtractedSignals({
      journeyId: 'j-nonexistent',
      sessionId: 'sess-1',
    });

    expect(result).toEqual([]);
  });
});
