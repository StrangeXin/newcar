/**
 * Barrel re-export — preserves the original public API.
 *
 * All logic has been split into:
 *   ./chat/signal-extraction.ts  — buildSignals, estimateConfidenceScore
 *   ./chat/chat-side-effects.ts  — createTimelineEventForSideEffect, shouldSuggestPublish
 *   ./chat/chat.service.ts       — AiChatService class, aiChatService singleton
 */

export { AiChatService, aiChatService } from './chat/chat.service';
export type { StreamEvent, ChatOptions } from './chat/chat.service';
export { buildSignals, estimateConfidenceScore } from './chat/signal-extraction';
export type { ExtractedSignal } from './chat/signal-extraction';
export { createTimelineEventForSideEffect, shouldSuggestPublish } from './chat/chat-side-effects';
export type { SideEffectResult } from './chat/chat-side-effects';
