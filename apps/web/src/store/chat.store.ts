'use client';

import { create } from 'zustand';
import { Candidate, CarInfo } from '@/types/api';
import { buildJourneyChatWsUrl, get, MOCK_MODE } from '@/lib/api';
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

export type SideEffectChatMessage = BaseMessage & {
  kind: 'side_effect';
  event: 'candidate_added' | 'journey_updated' | 'stage_changed';
  data: any;
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

function parseCarResults(result: unknown): CarResultChatMessage['cars'] {
  if (!result || typeof result !== 'object' || !('cars' in result) || !Array.isArray((result as any).cars)) {
    return [];
  }

  return (result as any).cars.map((car: any, index: number) => ({
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

    const { socket, activeJourneyId } = getState();
    if (socket && activeJourneyId === journeyId && socket.readyState <= WebSocket.OPEN) {
      return;
    }

    if (socket) {
      socket.close();
    }

    const nextSocket = new WebSocket(buildJourneyChatWsUrl(journeyId));

    nextSocket.addEventListener('open', () => {
      set({ isConnected: true, activeJourneyId: journeyId });
    });

    nextSocket.addEventListener('close', () => {
      set((state) => ({
        isConnected: false,
        socket: state.socket === nextSocket ? undefined : state.socket,
      }));
    });

    nextSocket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data)) as
        | { type: 'token'; delta: string }
        | { type: 'tool_start'; name: ToolName; input: Record<string, unknown> }
        | { type: 'tool_done'; name: ToolName; result: unknown }
        | { type: 'side_effect'; event: SideEffectChatMessage['event']; data: any }
        | { type: 'done'; conversationId: string; fullContent: string }
        | { type: 'error'; code: string; message: string };

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
        const sideEffectMessage: SideEffectChatMessage = {
          id: makeId('effect'),
          kind: 'side_effect',
          event: payload.event,
          data: payload.data,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          messages: state.messages.map((message) =>
            payload.event === 'candidate_added' && message.kind === 'car_results'
              ? {
                  ...message,
                  cars: message.cars.map((car) =>
                    car.id === payload.data?.carId || car.id === payload.data?.car?.id
                      ? { ...car, addedCandidate: payload.data }
                      : car
                  ),
                }
              : message
          ).concat(sideEffectMessage),
        }));
        dispatchJourneySideEffect({
          event: payload.event,
          journeyId,
          data: payload.data,
        });
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
