'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/store/chat.store';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 space-y-[10px] overflow-y-auto px-3 py-3">
      {messages.length === 0 ? (
        <p className="rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-[11px] text-black/55">
          你好，我可以帮你梳理预算、用途并筛选候选车型。
        </p>
      ) : null}

      {messages.map((message, index) => (
        <MessageBubble key={`${message.timestamp}-${index}`} message={message} />
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div className="rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-sm text-black/60">
            AI 思考中...
          </div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
