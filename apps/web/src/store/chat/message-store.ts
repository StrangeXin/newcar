import { Candidate, CarInfo, TimelineEvent, TimelineEventType } from '@/types/api';

/* ── Public types ────────────────────────────────────────────────── */

export type ChatRole = 'USER' | 'ASSISTANT';
export type ToolName = 'car_search' | 'car_detail' | 'journey_update' | 'add_candidate';

type BaseMessage = {
  id: string;
  timestamp: string;
};

export type TextChatMessage = BaseMessage & {
  kind: 'text';
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
};

export type ToolChatMessage = BaseMessage & {
  kind: 'tool_status';
  name: ToolName;
  input: Record<string, unknown>;
  status: 'running' | 'done';
};

export type SideEffectEvent =
  | 'candidate_added'
  | 'candidate_eliminated'
  | 'candidate_winner'
  | 'journey_updated'
  | 'stage_changed'
  | 'ai_insight'
  | 'publish_suggestion'
  | 'journey_published'
  | 'timeline_event';

export type SideEffectChatMessage = BaseMessage & {
  kind: 'side_effect';
  event: SideEffectEvent;
  data: Record<string, unknown>;
};

export type CarResultChatMessage = BaseMessage & {
  kind: 'car_results';
  journeyId: string;
  cars: Array<
    Pick<CarInfo, 'id' | 'brand' | 'model' | 'type' | 'fuelType' | 'msrp'> & {
      matchScore?: number;
      subtitle?: string;
      addedCandidate?: Candidate | null;
    }
  >;
};

export type ChatMessage = TextChatMessage | ToolChatMessage | SideEffectChatMessage | CarResultChatMessage;

/* ── Internal types ──────────────────────────────────────────────── */

export interface HistoryResponse {
  messages: Array<{
    role: ChatRole;
    content: string;
    timestamp: string;
  }>;
}

export interface CandidateResponse {
  candidates: Candidate[];
}

export interface TimelineResponse {
  events: TimelineEvent[];
}

export interface SideEffectPayload {
  type: 'side_effect';
  event: SideEffectEvent;
  data?: unknown;
  timelineEvent?: TimelineEvent;
  patch?: {
    candidates?: Candidate[];
    stage?: string;
    requirements?: Record<string, unknown>;
  };
}

interface RawCarResult {
  id?: unknown;
  brand?: unknown;
  model?: unknown;
  type?: unknown;
  fuelType?: unknown;
  msrp?: unknown;
}

/* ── Helper functions ────────────────────────────────────────────── */

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function parseToolInput(input: unknown) {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isTimelineEvent(value: unknown): value is TimelineEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.journeyId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'string'
  );
}

export function mapTimelineEventTypeToSideEffect(type: TimelineEventType): SideEffectEvent {
  switch (type) {
    case 'CANDIDATE_ADDED':
      return 'candidate_added';
    case 'CANDIDATE_ELIMINATED':
      return 'candidate_eliminated';
    case 'CANDIDATE_WINNER':
      return 'candidate_winner';
    case 'STAGE_CHANGED':
      return 'stage_changed';
    case 'REQUIREMENT_UPDATED':
      return 'journey_updated';
    case 'AI_INSIGHT':
      return 'ai_insight';
    case 'PRICE_CHANGE':
      return 'journey_updated';
    case 'USER_ACTION':
      return 'journey_updated';
    case 'PUBLISH_SUGGESTION':
      return 'publish_suggestion';
    case 'JOURNEY_PUBLISHED':
      return 'journey_published';
    default:
      return 'timeline_event';
  }
}

export function parseCarResults(result: unknown): CarResultChatMessage['cars'] {
  if (!result || typeof result !== 'object' || !('cars' in result)) return [];
  const obj = result as { cars: unknown };
  if (!Array.isArray(obj.cars)) return [];

  return (obj.cars as RawCarResult[]).map((car, index) => ({
    id: String(car.id),
    brand: String(car.brand || ''),
    model: String(car.model || ''),
    type: String(car.type || ''),
    fuelType: String(car.fuelType || ''),
    msrp: typeof car.msrp === 'number' ? car.msrp : null,
    matchScore: [92, 85, 73][index] || 68,
    subtitle:
      typeof car.fuelType === 'string'
        ? `${car.fuelType === 'PHEV' ? '增程' : car.fuelType === 'BEV' ? '纯电' : car.fuelType} · ${car.type || ''} · ${
            typeof car.msrp === 'number' ? `${(car.msrp / 10000).toFixed(2)}万起` : '暂无价格'
          }`
        : undefined,
  }));
}
