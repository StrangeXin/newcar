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

  handleConnection(
    ws: WebSocketLike,
    _req: IncomingMessage,
    journeyId: string,
    auth: { userId: string; sessionId?: string }
  ) {
    const previous = this.sockets.get(journeyId);
    if (previous && previous !== ws) {
      previous.close(4000, 'Replaced by a newer connection');
    }
    this.sockets.set(journeyId, ws);

    ws.on('message', async (raw: unknown) => {
      try {
        const text = typeof raw === 'string' ? raw : raw instanceof Buffer ? raw.toString('utf-8') : '';
        const message = JSON.parse(text) as { type?: string; content?: string };

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
          message: message.content.trim(),
          onEvent: (event) => {
            this.send(ws, event);
          },
        });
      } catch (error: any) {
        this.send(ws, {
          type: 'error',
          code: 'CHAT_FAILED',
          message: error?.message || 'Chat failed',
        });
      }
    });

    ws.on('close', () => {
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
