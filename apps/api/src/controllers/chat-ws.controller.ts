import { IncomingMessage } from 'http';
import { WsClientMessage, WsServerMessage } from '@newcar/shared';
import { logger } from '../lib/logger';
import { aiChatService } from '../services/ai-chat.service';
import { authService } from '../services/auth.service';
import { journeyService } from '../services/journey.service';

type WebSocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type AuthState = 'PENDING' | 'AUTHENTICATED';

const AUTH_TIMEOUT_MS = 5000;

export class ChatWsController {
  private sockets = new Map<string, WebSocketLike>();
  private msgCounts = new Map<string, { count: number; resetAt: number }>();

  private checkWsRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.msgCounts.get(userId);
    if (!entry || now > entry.resetAt) {
      this.msgCounts.set(userId, { count: 1, resetAt: now + 60000 });
      return true;
    }
    if (entry.count >= 10) return false;
    entry.count++;
    return true;
  }

  private buildTraceId(journeyId: string) {
    return `chat_${journeyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private log(event: string, details?: Record<string, unknown>) {
    if (process.env.AI_CHAT_DEBUG !== '1') {
      return;
    }

    logger.info({ event, ...(details || {}) }, '[chat-ws]');
  }

  handleConnection(
    ws: WebSocketLike,
    _req: IncomingMessage,
    journeyId: string,
  ) {
    const traceId = this.buildTraceId(journeyId);
    const previous = this.sockets.get(journeyId);
    if (previous && previous !== ws) {
      logger.info({ journeyId }, '[chat-ws] replacing previous connection');
      previous.close(4000, 'Replaced by a newer connection');
    }
    this.sockets.set(journeyId, ws);

    let authState: AuthState = 'PENDING';
    let resolvedAuth: { userId: string; sessionId?: string } | undefined;

    this.log('connection_open_pending_auth', { traceId, journeyId });

    // Auth timeout: close if not authenticated within AUTH_TIMEOUT_MS
    let authTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      if (authState === 'PENDING') {
        this.log('auth_timeout', { traceId, journeyId });
        ws.close(4001, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', async (raw: unknown) => {
      try {
        const text = typeof raw === 'string' ? raw : raw instanceof Buffer ? raw.toString('utf-8') : '';
        const message = JSON.parse(text) as WsClientMessage;

        // Handle auth message when in PENDING state
        if (authState === 'PENDING') {
          if (message.type === 'auth') {
            try {
              const payload = authService.verifyToken(message.token);
              if (payload.type !== 'access') {
                this.send(ws, { type: 'auth_error', message: 'Invalid token type' });
                ws.close(4002, 'Invalid token type');
                return;
              }

              const journey = await journeyService.getJourneyDetail(journeyId);
              if (!journey || journey.userId !== payload.userId) {
                this.send(ws, { type: 'auth_error', message: 'Journey access denied' });
                ws.close(4003, 'Journey access denied');
                return;
              }

              // Auth succeeded
              authState = 'AUTHENTICATED';
              resolvedAuth = { userId: payload.userId, sessionId: payload.sessionId };
              if (authTimer) {
                clearTimeout(authTimer);
                authTimer = undefined;
              }
              this.log('auth_ok', { traceId, journeyId, userId: payload.userId });
              this.send(ws, { type: 'auth_ok', userId: payload.userId });
            } catch {
              this.send(ws, { type: 'auth_error', message: 'Token verification failed' });
              ws.close(4002, 'Token verification failed');
            }
            return;
          }

          // Non-auth message before authentication
          this.send(ws, { type: 'auth_required' });
          return;
        }

        // --- Authenticated message handling (existing logic) ---
        this.log('message_received', {
          traceId,
          journeyId,
          type: message.type,
          contentLength: message.type === 'message' ? message.content?.length || 0 : 0,
        });

        if (message.type !== 'message' || !message.content?.trim()) {
          this.send(ws, {
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Only non-empty message events are supported',
          });
          return;
        }

        if (!resolvedAuth) {
          this.send(ws, { type: 'error', code: 'AUTH_LOST', message: 'Authentication state lost' });
          return;
        }

        if (!this.checkWsRateLimit(resolvedAuth.userId)) {
          this.send(ws, {
            type: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many messages. Please wait before sending more.',
          });
          return;
        }

        await aiChatService.streamChat({
          journeyId,
          userId: resolvedAuth.userId,
          sessionId: resolvedAuth.sessionId,
          traceId,
          message: message.content.trim(),
          onEvent: (event) => {
            this.log('event_send', {
              traceId,
              journeyId,
              eventType: event.type,
              eventName: 'name' in event ? (event as Record<string, unknown>).name : undefined,
              sideEffect: 'event' in event ? (event as Record<string, unknown>).event : undefined,
            });
            this.send(ws, event as WsServerMessage);
          },
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Chat failed';
        this.log('chat_failed', {
          traceId,
          journeyId,
          message: errMsg,
        });
        this.send(ws, {
          type: 'error',
          code: 'CHAT_FAILED',
          message: errMsg,
        });
      }
    });

    ws.on('close', () => {
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = undefined;
      }
      this.log('connection_close', {
        traceId,
        journeyId,
      });
      if (this.sockets.get(journeyId) === ws) {
        this.sockets.delete(journeyId);
      }
    });
  }

  private send(ws: WebSocketLike, payload: WsServerMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    } else {
      logger.warn(
        { readyState: ws.readyState, payloadType: payload.type },
        '[chat-ws] message dropped: socket not open',
      );
    }
  }
}

export const chatWsController = new ChatWsController();
