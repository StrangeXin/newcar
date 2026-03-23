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
    <div className="flex-1 overflow-y-auto px-[14px] py-[14px]">
      {messages.length === 0 ? (
        <div className="flex flex-col gap-[10px]">
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-[14px_14px_2px_14px] bg-[#1a1a1a] px-3 py-2 text-[12px] leading-[1.6] text-white">
              帮我找一下预算30万以内的增程SUV
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#667eea,#764ba2)] text-[8px] font-bold text-white">
              AI
            </div>
            <div className="flex max-w-[88%] flex-col gap-[6px]">
              <div className="rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-[12px] leading-[1.6] text-black/80">
                好的，我来帮你搜索一下
              </div>
              <div className="flex items-center gap-[6px] rounded-[8px] border border-[#e9d5ff] bg-[#faf5ff] px-[10px] py-[6px]">
                <span className="text-[12px]">🔍</span>
                <span className="text-[10px] font-medium text-[#7c3aed]">正在搜索「30万 增程 SUV」…</span>
                <div className="ml-auto flex gap-[2px]">
                  <span className="h-[3px] w-[3px] rounded-full bg-[#c4b5fd]" />
                  <span className="h-[3px] w-[3px] rounded-full bg-[#c4b5fd]" />
                  <span className="h-[3px] w-[3px] rounded-full bg-[#c4b5fd]" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#667eea,#764ba2)] text-[8px] font-bold text-white">
              AI
            </div>
            <div className="flex max-w-[88%] flex-col gap-[6px]">
              <div className="rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-[12px] leading-[1.6] text-black/80">
                找到 2 款非常匹配的车型 👇
              </div>
              <PreviewCarCard name="理想 L6" subtitle="增程 · 五座 · 27.98万起" barColor="#6366f1" gradient="bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]" />
              <PreviewCarCard name="小鹏 G6" subtitle="纯电 · 五座 · 20.99万起" barColor="#10b981" gradient="bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]" />
              <div className="flex items-center gap-[6px] rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-[10px] py-[6px] text-[10px] font-medium text-[#15803d]">
                <span>✓</span>
                <span>理想 L6 已加入候选列表</span>
                <span className="ml-auto text-[9px] text-[#60a5fa] underline">查看</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-[14px_14px_2px_14px] bg-[#1a1a1a] px-3 py-2 text-[12px] leading-[1.6] text-white">
              理想 L6 口碑怎么样？
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#667eea,#764ba2)] text-[8px] font-bold text-white">
              AI
            </div>
            <div className="max-w-[88%] rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-[12px] leading-[1.6] text-black/80">
              理想 L6 整体口碑不错，空间和增程体验获高频认可
              <span className="ml-0.5 inline-block h-[11px] w-[2px] animate-pulse align-middle text-[#6366f1]">|</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-[10px]">
        {messages.map((message, index) => (
          <MessageBubble key={`${message.timestamp}-${index}`} message={message} />
        ))}
      </div>

      {isLoading ? (
        <div className="mt-[10px] flex justify-start">
          <div className="rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] px-3 py-2 text-[12px] text-black/60">
            AI 思考中...
          </div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

function PreviewCarCard({
  name,
  subtitle,
  barColor,
  gradient,
}: {
  name: string;
  subtitle: string;
  barColor: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-[10px] rounded-[10px] border border-[#e5e7eb] bg-white px-[10px] py-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <div className={`flex h-[30px] w-[40px] items-center justify-center rounded-[6px] text-[16px] text-white ${gradient}`}>
        🚗
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-[#111]">{name}</div>
        <div className="mt-px text-[9px] text-[#6b7280]">{subtitle}</div>
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#e5e7eb]">
          <div className="h-full rounded-full" style={{ width: '88%', background: barColor }} />
        </div>
      </div>
      <button className="rounded-[8px] bg-[#1a1a1a] px-[10px] py-[6px] text-[10px] font-semibold text-white">+ 加入</button>
    </div>
  );
}
