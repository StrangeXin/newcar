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
      className="chat-panel flex h-full min-h-0 flex-col overflow-hidden rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-0 shadow-workspace"
    >
      <div className="flex items-center gap-[6px] border-b border-[var(--border-soft)] px-[14px] py-[14px]">
        <span className={`h-[7px] w-[7px] rounded-full ${isConnected ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'}`} />
        <div>
          <h2 className="flex items-center gap-2 text-[length:var(--text-base)] font-extrabold text-[var(--text)] 2xl:text-[length:var(--text-md)]">
            <IconBadge icon={Bot} tone="accent" size="sm" />
            AI 购车助手
          </h2>
        </div>
        <p className="ml-auto rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--text-muted)]">旅程模式</p>
        <div className="flex items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)]"
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>
      {!isConnected && (
        <div className="flex items-center justify-center border-b border-[var(--warning-border)] bg-[var(--warning-muted)] px-3 py-[5px] text-[length:var(--text-sm)] font-medium text-[var(--warning-text)]">
          连接已断开，正在重连...
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput disabled={isLoading || !journey?.id} onSend={onSend} />
    </aside>
  );
}
