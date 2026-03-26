'use client';

import { create } from 'zustand';
import { Candidate, CarInfo, TimelineEvent, TimelineEventType } from '@/types/api';
import { buildJourneyChatWsUrl, get, MOCK_MODE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { dispatchJourneySideEffect } from '@/lib/journey-workspace-events';
import { mockChatMessages } from '@/lib/mock-data';

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

interface HistoryResponse {
  messages: Array<{
    role: ChatRole;
    content: string;
    timestamp: string;
  }>;
}

interface CandidateResponse {
  candidates: Candidate[];
}

interface TimelineResponse {
  events: TimelineEvent[];
}

interface SideEffectPayload {
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

interface ChatState {
  messages: ChatMessage[];
  conversationId?: string;
  isLoading: boolean;
  isConnected: boolean;
  activeJourneyId?: string;
  socket?: WebSocket;
  loadHistory: (journeyId: string) => Promise<void>;
  connect: (journeyId: string) => void;
  disconnect: () => void;
  sendMessage: (journeyId: string, content: string) => Promise<void>;
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parseToolInput(input: unknown) {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.journeyId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function mapTimelineEventTypeToSideEffect(type: TimelineEventType): SideEffectEvent {
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

interface RawCarResult {
  id?: unknown;
  brand?: unknown;
  model?: unknown;
  type?: unknown;
  fuelType?: unknown;
  msrp?: unknown;
}

function parseCarResults(result: unknown): CarResultChatMessage['cars'] {
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

function waitForOpen(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('WebSocket connection failed'));
    };
    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
    };

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
  });
}

let reconnectTimer: number | undefined;
let manualDisconnectRequested = false;
let reconnectSyncPending = false;
let connectionToken = 0;

async function refreshWorkspaceAfterReconnect(journeyId: string) {
  try {
    const [candidateResponse, timelineResponse] = await Promise.all([
      get<CandidateResponse>(`/journeys/${journeyId}/candidates`),
      get<TimelineResponse>(`/journeys/${journeyId}/timeline?limit=100`),
    ]);

    const replayEvents = Array.isArray(timelineResponse.events) ? [...timelineResponse.events].reverse() : [];
    let hasCandidateAddedEvent = false;

    for (const timelineEvent of replayEvents) {
      if (timelineEvent.type === 'CANDIDATE_ADDED') {
        hasCandidateAddedEvent = true;
      }

      dispatchJourneySideEffect({
        event: 'timeline_event',
        journeyId,
        data: timelineEvent,
      });

      const mappedEvent = mapTimelineEventTypeToSideEffect(timelineEvent.type);
      if (mappedEvent !== 'timeline_event') {
        dispatchJourneySideEffect({
          event: mappedEvent,
          journeyId,
          data: {
            ...timelineEvent.metadata,
            timelineEvent,
          },
        });
      }
    }

    if ((candidateResponse.candidates || []).length > 0 && !hasCandidateAddedEvent) {
      dispatchJourneySideEffect({
        event: 'candidate_added',
        journeyId,
        data: {
          reconnected: true,
          candidates: candidateResponse.candidates,
          candidatesCount: candidateResponse.candidates.length,
        },
      });
    }

    dispatchJourneySideEffect({
      event: 'journey_updated',
      journeyId,
      data: {
        reconnected: true,
        candidatesCount: candidateResponse.candidates?.length ?? 0,
        timelineCount: timelineResponse.events?.length ?? 0,
      },
    });
  } catch {
    // Best-effort compensation only.
  }
}

export const useChatStore = create<ChatState>((set, getState) => ({
  messages: [],
  conversationId: undefined,
  isLoading: false,
  isConnected: false,
  activeJourneyId: undefined,
  socket: undefined,

  loadHistory: async (journeyId) => {
    if (MOCK_MODE) {
      set({ messages: mockChatMessages });
      return;
    }
    try {
      const history = await get<HistoryResponse>(`/journeys/${journeyId}/conversation/messages?limit=50`);
      set({
        messages: (history.messages || []).map((message) => ({
          id: makeId('history'),
          kind: 'text',
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
        })),
      });
    } catch {
      set({ messages: [] });
    }
  },

  connect: (journeyId) => {
    if (MOCK_MODE) {
      set({ isConnected: true, activeJourneyId: journeyId });
      return;
    }

    manualDisconnectRequested = false;

    const { socket, activeJourneyId } = getState();
    if (socket && activeJourneyId === journeyId && socket.readyState <= WebSocket.OPEN) {
      return;
    }

    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }

    connectionToken += 1;
    const socketToken = connectionToken;

    if (socket) {
      socket.close();
    }

    const nextSocket = new WebSocket(buildJourneyChatWsUrl(journeyId));

    nextSocket.addEventListener('open', () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }

      // Send auth as first message instead of setting isConnected immediately
      const token = getToken();
      if (token) {
        nextSocket.send(JSON.stringify({ type: 'auth', token }));
      } else {
        // No token available — close immediately to avoid server timeout loop
        manualDisconnectRequested = true;
        nextSocket.close();
      }
    });

    nextSocket.addEventListener('close', () => {
      set((state) => ({
        isConnected: false,
        socket: state.socket === nextSocket ? undefined : state.socket,
      }));

      if (socketToken !== connectionToken) {
        return;
      }

      if (manualDisconnectRequested) {
        manualDisconnectRequested = false;
        reconnectSyncPending = false;
        return;
      }

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      reconnectSyncPending = true;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        const current = getState();
        if (!current.isConnected && current.activeJourneyId === journeyId && socketToken === connectionToken) {
          current.connect(journeyId);
        }
      }, 3000);
    });

    nextSocket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data)) as
        | { type: 'auth_ok'; userId: string }
        | { type: 'auth_error'; message: string }
        | { type: 'auth_required' }
        | { type: 'token'; delta: string }
        | { type: 'tool_start'; name: ToolName; input: Record<string, unknown> }
        | { type: 'tool_done'; name: ToolName; result: unknown }
        | SideEffectPayload
        | { type: 'done'; conversationId: string; fullContent: string }
        | { type: 'error'; code: string; message: string };

      if (payload.type === 'auth_ok') {
        set({ isConnected: true, activeJourneyId: journeyId });

        if (reconnectSyncPending && socketToken === connectionToken) {
          reconnectSyncPending = false;
          void refreshWorkspaceAfterReconnect(journeyId);
        }
        return;
      }

      if (payload.type === 'auth_error') {
        // Permanent failure — suppress reconnect
        manualDisconnectRequested = true;
        nextSocket.close();
        return;
      }

      if (payload.type === 'auth_required') {
        // Server says we need to authenticate first — resend auth
        const token = getToken();
        if (token) {
          nextSocket.send(JSON.stringify({ type: 'auth', token }));
        } else {
          manualDisconnectRequested = true;
          nextSocket.close();
        }
        return;
      }

      if (payload.type === 'token') {
        set((state) => {
          const lastMessage = state.messages[state.messages.length - 1];
          if (lastMessage?.kind === 'text' && lastMessage.role === 'ASSISTANT' && lastMessage.isStreaming) {
            const nextMessages = [...state.messages];
            nextMessages[nextMessages.length - 1] = {
              ...lastMessage,
              content: lastMessage.content + payload.delta,
            };
            return { messages: nextMessages };
          }

          return {
            messages: [
              ...state.messages,
              {
                id: makeId('assistant'),
                kind: 'text',
                role: 'ASSISTANT',
                content: payload.delta,
                timestamp: new Date().toISOString(),
                isStreaming: true,
              },
            ],
          };
        });
        return;
      }

      if (payload.type === 'tool_start') {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: makeId('tool'),
              kind: 'tool_status',
              name: payload.name,
              input: parseToolInput(payload.input),
              status: 'running',
              timestamp: new Date().toISOString(),
            },
          ],
          isLoading: true,
        }));
        return;
      }

      if (payload.type === 'tool_done') {
        const toolName = payload.name;
        set((state) => {
          const nextMessages: ChatMessage[] = state.messages.map((message) =>
            message.kind === 'tool_status' && message.name === toolName && message.status === 'running'
              ? ({ ...message, status: 'done' } as ToolChatMessage)
              : message
          );

          if (toolName === 'car_search') {
            const cars = parseCarResults(payload.result);
            if (cars.length > 0) {
              nextMessages.push({
                id: makeId('car-results'),
                kind: 'car_results',
                journeyId,
                cars,
                timestamp: new Date().toISOString(),
              });
            }
          }

          return { messages: nextMessages };
        });

        window.setTimeout(() => {
          set((state) => ({
            messages: state.messages.filter(
              (message) =>
                !(message.kind === 'tool_status' && message.name === toolName && message.status === 'done')
            ),
          }));
        }, 900);
        return;
      }

      if (payload.type === 'side_effect') {
        const sideEffectData = isRecord(payload.data) ? payload.data : {};
        const timelineEvent =
          isTimelineEvent(payload.timelineEvent) || isTimelineEvent(sideEffectData.timelineEvent)
            ? (payload.timelineEvent as TimelineEvent | undefined) || (sideEffectData.timelineEvent as TimelineEvent)
            : undefined;
        const patch = isRecord(payload.patch) ? payload.patch : isRecord(sideEffectData.patch) ? sideEffectData.patch : undefined;
        const mergedData: Record<string, unknown> = {
          ...sideEffectData,
          ...(patch ? { patch } : {}),
          ...(timelineEvent ? { timelineEvent } : {}),
        };
        const workspaceEvent: Exclude<SideEffectEvent, 'timeline_event'> =
          payload.event === 'timeline_event' ? 'journey_updated' : payload.event;

        const sideEffectMessage: SideEffectChatMessage = {
          id: makeId('effect'),
          kind: 'side_effect',
          event: workspaceEvent,
          data: mergedData,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: state.messages.map((message) =>
            payload.event === 'candidate_added' && message.kind === 'car_results'
              ? {
                  ...message,
                  cars: message.cars.map((car) => {
                    const carObj = isRecord(mergedData.car) ? mergedData.car : undefined;
                    const candidateId = typeof mergedData.carId === 'string' ? mergedData.carId : undefined;
                    return car.id === candidateId || car.id === carObj?.id
                      ? { ...car, addedCandidate: mergedData as unknown as Candidate }
                      : car;
                  }
                  ),
                }
              : message
          ).concat(sideEffectMessage),
        }));

        dispatchJourneySideEffect({
          event: workspaceEvent,
          journeyId,
          data: mergedData,
        });

        if (timelineEvent) {
          dispatchJourneySideEffect({
            event: 'timeline_event',
            journeyId,
            data: timelineEvent,
          });
        }

        if (patch?.candidates && payload.event !== 'candidate_added') {
          dispatchJourneySideEffect({
            event: 'candidate_added',
            journeyId,
            data: {
              reconnected: false,
              patch,
              sourceEvent: payload.event,
            },
          });
        }

        return;
      }

      if (payload.type === 'done') {
        set((state) => ({
          conversationId: payload.conversationId,
          isLoading: false,
          messages: state.messages.map((message, index) =>
            index === state.messages.length - 1 &&
            message.kind === 'text' &&
            message.role === 'ASSISTANT' &&
            message.isStreaming
              ? { ...message, isStreaming: false, content: payload.fullContent }
              : message
          ),
        }));
        return;
      }

      if (payload.type === 'error') {
        set((state) => ({
          isLoading: false,
          messages: [
            ...state.messages,
            {
              id: makeId('error'),
              kind: 'text',
              role: 'ASSISTANT',
              content: payload.message,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
      }
    });

    set({ socket: nextSocket, activeJourneyId: journeyId });
  },

  disconnect: () => {
    manualDisconnectRequested = true;
    reconnectSyncPending = false;
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    const { socket } = getState();
    socket?.close();
    set({ socket: undefined, isConnected: false, activeJourneyId: undefined });
  },

  sendMessage: async (journeyId, content) => {
    const now = new Date().toISOString();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: makeId('user'),
          kind: 'text',
          role: 'USER',
          content,
          timestamp: now,
        },
      ],
      isLoading: true,
    }));

    if (MOCK_MODE) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
      set((state) => ({
        isLoading: false,
        messages: [
          ...state.messages,
          {
            id: makeId('assistant'),
            kind: 'text',
            role: 'ASSISTANT',
            content: '（Mock 模式）这是模拟回复。请关闭 MOCK_MODE 以连接真实后端。',
            timestamp: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    if (!getState().socket || getState().activeJourneyId !== journeyId) {
      getState().connect(journeyId);
    }

    const socket = getState().socket;
    if (!socket) {
      throw new Error('WebSocket connection is unavailable');
    }

    await waitForOpen(socket);
    socket.send(JSON.stringify({ type: 'message', content }));
  },
}));
