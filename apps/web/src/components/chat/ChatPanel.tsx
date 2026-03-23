'use client';

import { useEffect } from 'react';
import { useJourney } from '@/hooks/useJourney';
import { useChatStore } from '@/store/chat.store';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { journey } = useJourney();
  const { messages, isLoading, isConnected, loadHistory, connect, disconnect, sendMessage } = useChatStore();

  useEffect(() => {
    if (!journey?.id) {
      return;
    }
    void loadHistory(journey.id);
    connect(journey.id);

    return () => {
      disconnect();
    };
  }, [connect, disconnect, journey?.id, loadHistory]);

  async function onSend(content: string) {
    if (!journey?.id) {
      return;
    }
    await sendMessage(journey.id, content);
  }

  return (
    <aside className="flex h-full min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[20px] border border-black/10 bg-white/88 shadow-card backdrop-blur">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7c3aed]">Copilot</p>
          <h2 className="mt-1 text-base font-bold">AI 购车助手</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#d1d5db]'}`} />
          {onClose ? (
            <button type="button" onClick={onClose} className="rounded-full border border-black/10 px-2 py-1 text-xs font-semibold text-black/55">
              关闭
            </button>
          ) : null}
        </div>
      </div>
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput disabled={isLoading || !journey?.id} onSend={onSend} />
    </aside>
  );
}
