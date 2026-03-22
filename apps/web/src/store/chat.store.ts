'use client';

import { create } from 'zustand';
import { get, post } from '@/lib/api';

export type ChatRole = 'USER' | 'ASSISTANT';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  conversationId?: string;
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  loadHistory: (journeyId: string) => Promise<void>;
  sendMessage: (journeyId: string, content: string) => Promise<void>;
}

interface HistoryResponse {
  messages: ChatMessage[];
}

interface ChatResponse {
  message: string;
  conversationId: string;
}

export const useChatStore = create<ChatState>((set, getState) => ({
  messages: [],
  conversationId: undefined,
  isLoading: false,
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setLoading: (loading) => set({ isLoading: loading }),

  loadHistory: async (journeyId) => {
    try {
      const history = await get<HistoryResponse>(`/journeys/${journeyId}/conversation/messages?limit=50`);
      set({ messages: history.messages || [] });
    } catch {
      set({ messages: [] });
    }
  },

  sendMessage: async (journeyId, content) => {
    const now = new Date().toISOString();
    getState().addMessage({ role: 'USER', content, timestamp: now });
    getState().setLoading(true);

    try {
      const response = await post<ChatResponse>(`/journeys/${journeyId}/chat`, { message: content });
      set((state) => ({
        conversationId: response.conversationId,
        messages: [
          ...state.messages,
          {
            role: 'ASSISTANT',
            content: response.message,
            timestamp: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      getState().setLoading(false);
    }
  },
}));
