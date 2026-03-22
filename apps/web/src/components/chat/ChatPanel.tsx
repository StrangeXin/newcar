'use client';

import { useEffect } from 'react';
import { useJourney } from '@/hooks/useJourney';
import { useChatStore } from '@/store/chat.store';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export function ChatPanel() {
  const { journey } = useJourney();
  const { messages, isLoading, loadHistory, sendMessage } = useChatStore();

  useEffect(() => {
    if (!journey?.id) {
      return;
    }
    void loadHistory(journey.id);
  }, [journey?.id, loadHistory]);

  async function onSend(content: string) {
    if (!journey?.id) {
      return;
    }
    await sendMessage(journey.id, content);
  }

  return (
    <aside className="flex h-full min-h-[calc(100vh-2rem)] flex-col rounded-2xl border border-black/10 bg-white/85 shadow-card">
      <div className="border-b border-black/10 px-4 py-3">
        <h2 className="text-base font-bold">AI 购车助手</h2>
      </div>
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput disabled={isLoading || !journey?.id} onSend={onSend} />
    </aside>
  );
}
