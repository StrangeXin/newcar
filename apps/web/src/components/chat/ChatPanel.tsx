'use client';

import { useEffect } from 'react';
import { Bot } from 'lucide-react';
import { useJourney } from '@/hooks/useJourney';
import { useChatStore } from '@/store/chat.store';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { IconBadge } from '@/components/ui/IconBadge';

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
    <aside
      data-testid="chat-panel"
      className="chat-panel flex h-full min-h-0 flex-col overflow-hidden rounded-ws-lg border border-slate-200 bg-white/90 p-0 shadow-workspace"
    >
      <div className="flex items-center gap-[6px] border-b border-slate-200 px-[14px] py-[14px]">
        <span className={`h-[7px] w-[7px] rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-slate-900 2xl:text-[15px]">
            <IconBadge icon={Bot} tone="accent" size="sm" />
            AI 购车助手
          </h2>
        </div>
        <p className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] text-slate-500">旅程模式</p>
        <div className="flex items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
            >
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
