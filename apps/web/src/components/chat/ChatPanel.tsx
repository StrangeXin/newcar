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
    <aside data-testid="chat-panel" className="chat-panel flex h-full min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[16px] border border-black/10 bg-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-[7px] border-b border-black/5 px-4 py-3">
        <span className={`h-[7px] w-[7px] rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#d1d5db]'}`} />
        <div>
          <h2 className="text-[13px] font-extrabold text-[#111]">AI 助手</h2>
        </div>
        <p className="ml-auto text-[9px] text-[#9ca3af]">实时同步</p>
        <div className="flex items-center gap-2">
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
