'use client';

import { useState } from 'react';
import { post } from '@/lib/api';
import { dispatchJourneySideEffect } from '@/lib/journey-workspace-events';
import { ChatMessage } from '@/store/chat.store';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.kind === 'car_results') {
    return <CarResultCards message={message} />;
  }

  if (message.kind === 'tool_status') {
    const summary = Object.values(message.input)
      .map((value) => String(value))
      .join(' · ');

    return (
      <div className="flex items-start gap-[6px]">
        <AiAvatar />
        <div className="max-w-[88%] rounded-[8px] border border-[#e9d5ff] bg-[#faf5ff] px-[10px] py-[6px] text-sm text-[#6d28d9] transition-opacity">
          <p className="text-[10px] font-medium text-[#7c3aed]">正在{message.name === 'car_search' ? '搜索车型' : message.name === 'car_detail' ? '读取车型详情' : message.name === 'journey_update' ? '更新旅程' : '加入候选'}…</p>
          {summary ? <p className="mt-1 text-[10px] text-[#7c3aed]/80">{summary}</p> : null}
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
      <div className="flex items-start gap-[6px]">
        <AiAvatar />
        <div className="flex max-w-[88%] items-center gap-[6px] rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-[10px] py-[6px] text-[10px] font-medium text-[#15803d]">
          <span>{label}</span>
          {message.event === 'candidate_added' ? <span className="ml-auto text-[9px] text-[#60a5fa] underline">查看</span> : null}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'items-start gap-[6px] justify-start'}`}>
      {!isUser ? <AiAvatar /> : null}
      <div
        className={`max-w-[85%] px-[10px] py-[8px] text-[12px] ${
          isUser
            ? 'rounded-[14px_14px_2px_14px] bg-[#1a1a1a] text-white'
            : 'rounded-[2px_14px_14px_14px] border border-black/10 bg-[#f5f4f2] text-black/80'
        }`}
      >
        <p className="whitespace-pre-wrap leading-[1.6]">
          {message.content}
          {message.isStreaming ? <span className="ml-0.5 inline-block h-[11px] w-[2px] animate-pulse align-middle bg-[#6366f1]" /> : null}
        </p>
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#667eea,#764ba2)] text-[8px] font-bold text-white">
      AI
    </div>
  );
}

function CarResultCards({ message }: { message: Extract<ChatMessage, { kind: 'car_results' }> }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>(
    message.cars.filter((car) => car.addedCandidate).map((car) => car.id)
  );

  async function addToCandidates(carId: string, msrp?: number | null) {
    try {
      setLoadingId(carId);
      const candidate = await post<any>(`/journeys/${message.journeyId}/candidates`, {
        carId,
        addedReason: 'AI_RECOMMENDED',
        priceAtAdd: typeof msrp === 'number' ? msrp : undefined,
      });
      dispatchJourneySideEffect({
        event: 'candidate_added',
        journeyId: message.journeyId,
        data: candidate,
      });
      setAddedIds((current) => (current.includes(carId) ? current : [...current, carId]));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex items-start gap-[6px]">
      <AiAvatar />
      <div className="flex max-w-[88%] flex-col gap-[6px]">
        {message.cars.map((car) => {
          const isAdded = addedIds.includes(car.id) || Boolean(car.addedCandidate);
          const iconGradient = car.brand.includes('理想')
            ? 'bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]'
            : car.brand.includes('小鹏')
              ? 'bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]'
              : 'bg-[linear-gradient(135deg,#e5e7eb,#d1d5db)]';
          const barColor = car.brand.includes('理想') ? '#6366f1' : car.brand.includes('小鹏') ? '#10b981' : '#9ca3af';

          return (
            <ChatCarCard
              key={car.id}
              name={`${car.brand} ${car.model}`}
              subtitle={car.subtitle || `${car.type}`}
              iconGradient={iconGradient}
              barColor={barColor}
              isAdded={isAdded}
              isLoading={loadingId === car.id}
              onAdd={() => addToCandidates(car.id, car.msrp)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChatCarCard({
  name,
  subtitle,
  iconGradient,
  barColor,
  isAdded,
  isLoading,
  onAdd,
}: {
  name: string;
  subtitle: string;
  iconGradient: string;
  barColor: string;
  isAdded: boolean;
  isLoading: boolean;
  onAdd: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-[10px] rounded-[10px] border border-[#e5e7eb] bg-white px-[10px] py-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <div className={`flex h-[30px] w-[40px] items-center justify-center rounded-[6px] text-[16px] text-white ${iconGradient}`}>
        🚗
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-[#111]">{name}</div>
        <div className="mt-px text-[9px] text-[#6b7280]">{subtitle}</div>
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#e5e7eb]">
          <div className="h-full rounded-full" style={{ width: '88%', background: barColor }} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onAdd()}
        disabled={isAdded || isLoading}
        className="whitespace-nowrap rounded-[8px] bg-[#1a1a1a] px-[10px] py-[6px] text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAdded ? '已加入' : isLoading ? '加入中' : '+ 加入'}
      </button>
    </div>
  );
}
