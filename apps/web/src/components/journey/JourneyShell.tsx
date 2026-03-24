'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { StageProgress } from '@/components/journey/StageProgress';

export function JourneyShell({ children }: { children: React.ReactNode }) {
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  useEffect(() => {
    if (!mobileChatOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileChatOpen]);

  return (
    <div className="min-h-screen pb-24 md:h-[100dvh] md:min-h-0 md:overflow-hidden md:pb-0">
      <div className="mx-auto grid h-full max-w-[1920px] items-stretch gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[148px_1fr_1fr] xl:grid-rows-none">
        <div className="hidden h-full min-h-0 md:col-span-full md:block xl:col-span-1">
          <StageProgress />
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
        <div className="hidden h-full min-h-0 md:block">
          <ChatPanel />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileChatOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[20px] font-semibold text-white shadow-[var(--shadow-accent)] md:hidden"
        aria-label="打开聊天面板"
      >
        Chat
      </button>

      {mobileChatOpen ? (
        <div className="fixed inset-0 z-40 bg-black/35 md:hidden">
          <button type="button" className="absolute inset-0" onClick={() => setMobileChatOpen(false)} aria-label="关闭聊天面板" />
          <div className="absolute inset-x-0 bottom-0 h-[70vh] rounded-t-[20px] border border-[var(--border)] bg-[var(--surface-subtle)] p-0">
            <ChatPanel onClose={() => setMobileChatOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
