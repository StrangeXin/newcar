'use client';

import { create } from 'zustand';
import type { WsServerMessage } from '@newcar/shared';
import { Candidate, TimelineEvent } from '@/types/api';
import { buildJourneyChatWsUrl, get, MOCK_MODE } from '@/lib/api';
import { dispatchJourneySideEffect } from '@/lib/journey-workspace-events';

import {
  ChatMessage,
  ChatRole,
  HistoryResponse,
  SideEffectChatMessage,
  SideEffectEvent,
  ToolChatMessage,
  ToolName,
  makeId,
  parseToolInput,
  isRecord,
  isTimelineEvent,
  parseCarResults,
} from './message-store';

import {
  waitForOpen,
  reconnectTimer,
  manualDisconnectRequested,
  reconnectSyncPending,
  connectionToken,
  setReconnectTimer,
  setManualDisconnectRequested,
  setReconnectSyncPending,
  incrementConnectionToken,
  sendAuth,
  refreshWorkspaceAfterReconnect,
} from './ws-connection';

/* ── Re-export public types so barrel can re-export from here ──── */

export type {
  ChatRole,
  ToolName,
  TextChatMessage,
  ToolChatMessage,
  SideEffectChatMessage,
  CarResultChatMessage,
  ChatMessage,
  SideEffectEvent,
} from './message-store';

/* ── State interface ─────────────────────────────────────────────── */

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

/* ── Store ───────────────────────────────────────────────────────── */

export const useChatStore = create<ChatState>((set, getState) => ({
  messages: [],
  conversationId: undefined,
  isLoading: false,
  isConnected: false,
  activeJourneyId: undefined,
  socket: undefined,

  loadHistory: async (journeyId) => {
    if (MOCK_MODE) {
      const { mockChatMessages } = await import('@/lib/mock-data');
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

    setManualDisconnectRequested(false);

    const { socket, activeJourneyId } = getState();
    if (socket && activeJourneyId === journeyId && socket.readyState <= WebSocket.OPEN) {
      return;
    }

    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      setReconnectTimer(undefined);
    }

    const socketToken = incrementConnectionToken();

    if (socket) {
      socket.close();
    }

    const nextSocket = new WebSocket(buildJourneyChatWsUrl(journeyId));

    nextSocket.addEventListener('open', () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        setReconnectTimer(undefined);
      }

      if (!sendAuth(nextSocket)) {
        setManualDisconnectRequested(true);
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
        setManualDisconnectRequested(false);
        setReconnectSyncPending(false);
        return;
      }

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      setReconnectSyncPending(true);
      setReconnectTimer(
        window.setTimeout(() => {
          setReconnectTimer(undefined);
          const current = getState();
          if (!current.isConnected && current.activeJourneyId === journeyId && socketToken === connectionToken) {
            current.connect(journeyId);
          }
        }, 3000)
      );
    });

    nextSocket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data)) as WsServerMessage;

      if (payload.type === 'auth_ok') {
        set({ isConnected: true, activeJourneyId: journeyId });

        if (reconnectSyncPending && socketToken === connectionToken) {
          setReconnectSyncPending(false);
          void refreshWorkspaceAfterReconnect(journeyId);
        }
        return;
      }

      if (payload.type === 'auth_error') {
        setManualDisconnectRequested(true);
        nextSocket.close();
        return;
      }

      if (payload.type === 'auth_required') {
        if (!sendAuth(nextSocket)) {
          setManualDisconnectRequested(true);
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
              name: payload.name as ToolName,
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
          payload.event === 'timeline_event' ? 'journey_updated' : (payload.event as Exclude<SideEffectEvent, 'timeline_event'>);

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
    setManualDisconnectRequested(true);
    setReconnectSyncPending(false);
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      setReconnectTimer(undefined);
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
