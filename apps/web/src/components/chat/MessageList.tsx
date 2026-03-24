'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/store/chat.store';
import { MessageBubble } from './MessageBubble';
import { VehicleCardShell } from '@/components/cars/VehicleCardShell';

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
            <div className="max-w-[75%] rounded-[14px_14px_2px_14px] bg-slate-900 px-3 py-2 text-[12px] leading-[1.6] text-white">
              帮我找一下预算30万以内的增程SUV
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sky-700 text-[8px] font-bold text-white">AI</div>
            <div className="flex max-w-[88%] flex-col gap-[6px]">
              <div className="rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-[1.6] text-slate-700">
                好的，我来帮你搜索一下
              </div>
              <div className="flex items-center gap-[6px] rounded-[8px] border border-sky-200 bg-sky-50 px-[10px] py-[6px]">
                <span className="text-[10px] font-semibold text-sky-700">搜索中</span>
                <span className="text-[10px] font-medium text-sky-700/85">30万 增程 SUV</span>
                <div className="ml-auto flex gap-[2px]">
                  <span className="h-[3px] w-[3px] rounded-full bg-sky-300" />
                  <span className="h-[3px] w-[3px] rounded-full bg-sky-300" />
                  <span className="h-[3px] w-[3px] rounded-full bg-sky-300" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sky-700 text-[8px] font-bold text-white">AI</div>
            <div className="flex max-w-[88%] flex-col gap-[6px]">
              <div className="rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-[1.6] text-slate-700">
                找到 2 款非常匹配的车型
              </div>
              <PreviewCarCard
                brand="理想"
                model="L6"
                name="理想 L6"
                subtitle="增程 · 五座 · 27.98万起"
                barClassName="bg-[linear-gradient(90deg,#ea580c,#f97316)]"
                gradient="bg-[linear-gradient(135deg,#ffedd5,#fdba74)]"
              />
              <PreviewCarCard
                brand="小鹏"
                model="G6"
                name="小鹏 G6"
                subtitle="纯电 · 五座 · 20.99万起"
                barClassName="bg-[linear-gradient(90deg,#10b981,#059669)]"
                gradient="bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]"
              />
              <div className="flex items-center gap-[6px] rounded-[8px] border border-emerald-200 bg-emerald-50 px-[10px] py-[6px] text-[10px] font-medium text-emerald-700">
                <span>理想 L6 已加入候选列表</span>
                <span className="ml-auto text-[9px] text-sky-700 underline">查看</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-[14px_14px_2px_14px] bg-slate-900 px-3 py-2 text-[12px] leading-[1.6] text-white">
              理想 L6 口碑怎么样？
            </div>
          </div>
          <div className="flex justify-start gap-[6px]">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sky-700 text-[8px] font-bold text-white">AI</div>
            <div className="max-w-[88%] rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-[1.6] text-slate-700">
              理想 L6 整体口碑不错，空间和增程体验获高频认可
              <span className="ml-0.5 inline-block h-[11px] w-[2px] animate-pulse align-middle bg-sky-600" />
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
          <div className="rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
            AI 思考中...
          </div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

function PreviewCarCard({
  brand,
  model,
  name,
  subtitle,
  barClassName,
  gradient,
}: {
  brand: string;
  model: string;
  name: string;
  subtitle: string;
  barClassName: string;
  gradient: string;
}) {
  return (
    <VehicleCardShell
      iconLabel={brand || model.slice(0, 2)}
      iconBgClassName={gradient}
      title={name}
      subtitle={subtitle}
      progressPercent={88}
      progressLabel="88%"
      progressBarClassName={barClassName}
      className="px-[10px] py-[10px] shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
      actions={(
        <button className="ml-auto cursor-pointer rounded-[8px] bg-slate-900 px-[10px] py-[6px] text-[10px] font-semibold text-white hover:bg-slate-800">
          加入
        </button>
      )}
    />
  );
}
