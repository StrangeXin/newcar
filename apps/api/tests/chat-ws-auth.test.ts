import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mockVerifyToken = vi.fn();
const mockGetJourneyDetail = vi.fn();
const mockStreamChat = vi.fn();

vi.mock('../src/services/auth.service', () => ({
  authService: {
    verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  },
}));

vi.mock('../src/services/journey.service', () => ({
  journeyService: {
    getJourneyDetail: (...args: unknown[]) => mockGetJourneyDetail(...args),
  },
}));

vi.mock('../src/services/ai-chat.service', () => ({
  aiChatService: {
    streamChat: (...args: unknown[]) => mockStreamChat(...args),
  },
}));

import { ChatWsController } from '../src/controllers/chat-ws.controller';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function createMockWs() {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  const sent: string[] = [];
  let closeCode: number | undefined;
  let closeReason: string | undefined;

  const ws = {
    readyState: 1,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn((code?: number, reason?: string) => {
      closeCode = code;
      closeReason = reason;
      ws.readyState = 3;
    }),
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
    }),
  };

  function emit(event: string, ...args: any[]) {
    for (const fn of listeners[event] || []) {
      fn(...args);
    }
  }

  function getSentMessages() {
    return sent.map((s) => JSON.parse(s));
  }

  return { ws, emit, getSentMessages, getCloseCode: () => closeCode, getCloseReason: () => closeReason };
}

const JOURNEY_ID = 'journey-123';
const USER_ID = 'user-456';
const VALID_TOKEN = 'valid-access-token';

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('ChatWsController auth state machine', () => {
  let controller: ChatWsController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ChatWsController();
    mockVerifyToken.mockReset();
    mockGetJourneyDetail.mockReset();
    mockStreamChat.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts auth message and responds with auth_ok', async () => {
    mockVerifyToken.mockReturnValue({ type: 'access', userId: USER_ID, sessionId: 'sess-1' });
    mockGetJourneyDetail.mockResolvedValue({ id: JOURNEY_ID, userId: USER_ID });

    const { ws, emit, getSentMessages } = createMockWs();
    const req = {} as any;

    controller.handleConnection(ws, req, JOURNEY_ID);

    // Send auth message
    await emit('message', JSON.stringify({ type: 'auth', token: VALID_TOKEN }));

    // Allow async journey lookup to resolve
    await vi.runAllTimersAsync();

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_ok', userId: USER_ID });
  });

  it('rejects auth with invalid token type', async () => {
    mockVerifyToken.mockReturnValue({ type: 'refresh', userId: USER_ID });

    const { ws, emit, getSentMessages } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'auth', token: 'bad-token' }));
    await vi.runAllTimersAsync();

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_error', message: 'Invalid token type' });
    expect(ws.close).toHaveBeenCalledWith(4002, 'Invalid token type');
  });

  it('rejects auth when journey access denied', async () => {
    mockVerifyToken.mockReturnValue({ type: 'access', userId: USER_ID });
    mockGetJourneyDetail.mockResolvedValue({ id: JOURNEY_ID, userId: 'other-user' });

    const { ws, emit, getSentMessages } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await vi.runAllTimersAsync();

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_error', message: 'Journey access denied' });
    expect(ws.close).toHaveBeenCalledWith(4003, 'Journey access denied');
  });

  it('rejects auth when token verification throws', async () => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error('JWT expired');
    });

    const { ws, emit, getSentMessages } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'auth', token: 'expired-token' }));
    await vi.runAllTimersAsync();

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_error', message: 'Token verification failed' });
    expect(ws.close).toHaveBeenCalledWith(4002, 'Token verification failed');
  });

  it('sends auth_required for non-auth messages before authentication', async () => {
    const { ws, emit, getSentMessages } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'message', content: 'hello' }));

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_required' });
  });

  it('closes with 4001 after 5s auth timeout', async () => {
    const { ws } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    // Advance past auth timeout
    await vi.advanceTimersByTimeAsync(5000);

    expect(ws.close).toHaveBeenCalledWith(4001, 'Authentication timeout');
  });

  it('does not timeout after successful auth', async () => {
    mockVerifyToken.mockReturnValue({ type: 'access', userId: USER_ID });
    mockGetJourneyDetail.mockResolvedValue({ id: JOURNEY_ID, userId: USER_ID });

    const { ws, emit } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await vi.runAllTimersAsync();

    // Now advance past the timeout period
    await vi.advanceTimersByTimeAsync(6000);

    // close should not have been called with 4001
    const closeCalls = ws.close.mock.calls;
    const timeoutClose = closeCalls.find((c: any[]) => c[0] === 4001);
    expect(timeoutClose).toBeUndefined();
  });

  it('handles messages normally after auth succeeds', async () => {
    mockVerifyToken.mockReturnValue({ type: 'access', userId: USER_ID, sessionId: 'sess-1' });
    mockGetJourneyDetail.mockResolvedValue({ id: JOURNEY_ID, userId: USER_ID });
    mockStreamChat.mockResolvedValue(undefined);

    const { ws, emit } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    // Authenticate first
    await emit('message', JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await vi.runAllTimersAsync();

    // Now send a regular message
    await emit('message', JSON.stringify({ type: 'message', content: 'hello world' }));
    await vi.runAllTimersAsync();

    expect(mockStreamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: JOURNEY_ID,
        userId: USER_ID,
        sessionId: 'sess-1',
        message: 'hello world',
      })
    );
  });

  it('clears auth timer on close', async () => {
    const { ws, emit } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    // Close before auth
    emit('close');

    // Advance past the auth timeout — should not throw or try to close again
    await vi.advanceTimersByTimeAsync(6000);

    // close was not called with 4001 (only the close event was emitted)
    const timeoutClose = ws.close.mock.calls.find((c: any[]) => c[0] === 4001);
    expect(timeoutClose).toBeUndefined();
  });

  it('rejects auth when journey not found', async () => {
    mockVerifyToken.mockReturnValue({ type: 'access', userId: USER_ID });
    mockGetJourneyDetail.mockResolvedValue(null);

    const { ws, emit, getSentMessages } = createMockWs();
    controller.handleConnection(ws, {} as any, JOURNEY_ID);

    await emit('message', JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await vi.runAllTimersAsync();

    const messages = getSentMessages();
    expect(messages).toContainEqual({ type: 'auth_error', message: 'Journey access denied' });
    expect(ws.close).toHaveBeenCalledWith(4003, 'Journey access denied');
  });
});
