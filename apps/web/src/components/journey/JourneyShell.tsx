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
    <div className="min-h-screen pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-[1920px] gap-2.5 px-2.5 py-2.5 xl:gap-3.5 xl:px-4 xl:py-4 2xl:grid-cols-[260px_minmax(0,1fr)_400px] xl:grid-cols-[220px_minmax(0,1fr)_340px] lg:grid-cols-[180px_minmax(0,1fr)_280px] md:grid-cols-[minmax(0,1fr)_300px] md:grid-rows-[auto_minmax(0,1fr)]">
        <div className="hidden md:block md:col-span-full lg:col-span-1">
          <StageProgress />
        </div>
        <div className="min-w-0">{children}</div>
        <div className="hidden md:block">
          <ChatPanel />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileChatOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#667eea,#764ba2)] text-xl font-semibold text-white shadow-[0_4px_20px_rgba(102,126,234,0.4)] md:hidden"
      >
        ···
      </button>

      {mobileChatOpen ? (
        <div className="fixed inset-0 z-40 bg-black/35 md:hidden">
          <button type="button" className="absolute inset-0" onClick={() => setMobileChatOpen(false)} aria-label="关闭聊天面板" />
          <div className="absolute inset-x-0 bottom-0 h-[72vh] rounded-t-[24px] bg-[#f0ede8] p-2">
            <ChatPanel onClose={() => setMobileChatOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
