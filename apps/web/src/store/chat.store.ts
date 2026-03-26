/**
 * Barrel re-export — public API preserved.
 * Implementation split into ./chat/ submodules.
 */
export {
  useChatStore,
} from './chat/chat.store';

export type {
  ChatRole,
  ToolName,
  TextChatMessage,
  ToolChatMessage,
  SideEffectChatMessage,
  CarResultChatMessage,
  ChatMessage,
  SideEffectEvent,
} from './chat/chat.store';
