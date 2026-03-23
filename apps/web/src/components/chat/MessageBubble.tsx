'use client';

import { ChatMessage } from '@/store/chat.store';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.kind === 'tool_status') {
    const summary = Object.values(message.input)
      .map((value) => String(value))
      .join(' · ');

    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl border border-[#e9d5ff] bg-[#faf5ff] px-3 py-2 text-sm text-[#6d28d9] transition-opacity">
          <p className="font-semibold">正在{message.name === 'car_search' ? '搜索车型' : message.name === 'car_detail' ? '读取车型详情' : message.name === 'journey_update' ? '更新旅程' : '加入候选'}…</p>
          {summary ? <p className="mt-1 text-xs text-[#7c3aed]/80">{summary}</p> : null}
        </div>
      </div>
    );
  }

  if (message.kind === 'side_effect') {
    const label =
      message.event === 'candidate_added'
        ? `${message.data?.car?.brand || ''} ${message.data?.car?.model || ''} 已加入候选列表`
        : message.event === 'journey_updated'
          ? '旅程需求已更新'
          : `旅程已推进到 ${message.data?.stage || '下一阶段'}`;

    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#15803d]">
          {label}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2.5 text-sm ${
          isUser
            ? 'rounded-[14px_14px_2px_14px] bg-[#1a1a1a] text-white'
            : 'rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] text-black/80'
        }`}
      >
        <p className="whitespace-pre-wrap leading-6">
          {message.content}
          {message.isStreaming ? <span className="ml-0.5 animate-pulse text-[#8b5cf6]">|</span> : null}
        </p>
      </div>
    </div>
  );
}
