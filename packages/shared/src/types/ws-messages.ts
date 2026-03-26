// Client → Server
export type WsClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'message'; content: string }
  | { type: 'ping' };

// Server → Client
export type WsServerMessage =
  | { type: 'auth_ok'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'auth_required' }
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; name: string; input: unknown }
  | { type: 'tool_done'; name: string; result: unknown }
  | { type: 'side_effect'; event: string; data: unknown; timelineEvent?: unknown; patch?: unknown }
  | { type: 'done'; conversationId: string; fullContent: string }
  | { type: 'error'; code?: string; message: string }
  | { type: 'pong' };
