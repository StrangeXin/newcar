import { IncomingMessage } from 'http';
import { aiChatService } from '../services/ai-chat.service';

type WebSocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
};

export class ChatWsController {
  private sockets = new Map<string, WebSocketLike>();

  private buildTraceId(journeyId: string) {
    return `chat_${journeyId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private log(event: string, details?: Record<string, unknown>) {
    if (process.env.AI_CHAT_DEBUG !== '1') {
      return;
    }

    console.log(
      '[chat-ws]',
      JSON.stringify({
        ts: new Date().toISOString(),
        event,
        ...(details || {}),
      })
    );
  }

  handleConnection(
    ws: WebSocketLike,
    _req: IncomingMessage,
    journeyId: string,
    auth: { userId: string; sessionId?: string }
  ) {
    const traceId = this.buildTraceId(journeyId);
    const previous = this.sockets.get(journeyId);
    if (previous && previous !== ws) {
      previous.close(4000, 'Replaced by a newer connection');
    }
    this.sockets.set(journeyId, ws);
    this.log('connection_open', {
      traceId,
      journeyId,
      userId: auth.userId,
      hasSessionId: Boolean(auth.sessionId),
    });

    ws.on('message', async (raw: unknown) => {
      try {
        const text = typeof raw === 'string' ? raw : raw instanceof Buffer ? raw.toString('utf-8') : '';
        const message = JSON.parse(text) as { type?: string; content?: string };
        this.log('message_received', {
          traceId,
          journeyId,
          type: message.type,
          contentLength: message.content?.length || 0,
        });

        if (message.type !== 'message' || !message.content?.trim()) {
          this.send(ws, {
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Only non-empty message events are supported',
          });
          return;
        }

        await aiChatService.streamChat({
          journeyId,
          userId: auth.userId,
          sessionId: auth.sessionId,
          traceId,
          message: message.content.trim(),
          onEvent: (event) => {
            this.log('event_send', {
              traceId,
              journeyId,
              eventType: event.type,
              eventName: 'name' in event ? (event as any).name : undefined,
              sideEffect: 'event' in event ? (event as any).event : undefined,
            });
            this.send(ws, event);
          },
        });
      } catch (error: any) {
        this.log('chat_failed', {
          traceId,
          journeyId,
          message: error?.message || 'Chat failed',
        });
        this.send(ws, {
          type: 'error',
          code: 'CHAT_FAILED',
          message: error?.message || 'Chat failed',
        });
      }
    });

    ws.on('close', () => {
      this.log('connection_close', {
        traceId,
        journeyId,
      });
      if (this.sockets.get(journeyId) === ws) {
        this.sockets.delete(journeyId);
      }
    });
  }

  private send(ws: WebSocketLike, payload: unknown) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }
}

export const chatWsController = new ChatWsController();
