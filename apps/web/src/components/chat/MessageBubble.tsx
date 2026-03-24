'use client';

import { useState } from 'react';
import { post } from '@/lib/api';
import { dispatchJourneySideEffect } from '@/lib/journey-workspace-events';
import { ChatMessage } from '@/store/chat.store';
import { VehicleCardShell } from '@/components/cars/VehicleCardShell';

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
        <div className="max-w-[88%] rounded-[8px] border border-sky-200 bg-sky-50 px-[10px] py-[6px] text-sm text-sky-700 transition-opacity">
          <p className="text-[10px] font-medium">正在{message.name === 'car_search' ? '搜索车型' : message.name === 'car_detail' ? '读取车型详情' : message.name === 'journey_update' ? '更新旅程' : '加入候选'}...</p>
          {summary ? <p className="mt-1 text-[10px] text-sky-700/85">{summary}</p> : null}
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
        <div className="flex max-w-[88%] items-center gap-[6px] rounded-[8px] border border-emerald-200 bg-emerald-50 px-[10px] py-[6px] text-[10px] font-medium text-emerald-700">
          <span>{label}</span>
          {message.event === 'candidate_added' ? <span className="ml-auto text-[9px] text-sky-700 underline">查看</span> : null}
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
            ? 'rounded-[14px_14px_2px_14px] bg-slate-900 text-white'
            : 'rounded-[2px_14px_14px_14px] border border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <p className="whitespace-pre-wrap leading-[1.6]">
          {message.content}
          {message.isStreaming ? <span className="ml-0.5 inline-block h-[11px] w-[2px] animate-pulse align-middle bg-sky-600" /> : null}
        </p>
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sky-700 text-[8px] font-bold text-white">
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
              : 'bg-slate-100';
          const barClass = car.brand.includes('理想')
            ? 'bg-[linear-gradient(90deg,#ea580c,#f97316)]'
            : car.brand.includes('小鹏')
              ? 'bg-[linear-gradient(90deg,#10b981,#059669)]'
              : 'bg-[linear-gradient(90deg,#94a3b8,#475569)]';

          return (
            <ChatCarCard
              key={car.id}
              brand={car.brand}
              model={car.model}
              name={`${car.brand} ${car.model}`}
              subtitle={car.subtitle || `${car.type}`}
              iconGradient={iconGradient}
              barClassName={barClass}
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
  brand,
  model,
  name,
  subtitle,
  iconGradient,
  barClassName,
  isAdded,
  isLoading,
  onAdd,
}: {
  brand: string;
  model: string;
  name: string;
  subtitle: string;
  iconGradient: string;
  barClassName: string;
  isAdded: boolean;
  isLoading: boolean;
  onAdd: () => Promise<void>;
}) {
  return (
    <VehicleCardShell
      iconLabel={brand || model.slice(0, 2)}
      iconBgClassName={iconGradient}
      title={name}
      subtitle={subtitle}
      progressPercent={88}
      progressLabel="88%"
      progressBarClassName={barClassName}
      className="px-[10px] py-[10px] shadow-[0_1px_4px_rgba(15,23,42,0.05)]"
      actions={(
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={isAdded || isLoading}
          className="ml-auto cursor-pointer whitespace-nowrap rounded-[8px] bg-slate-900 px-[10px] py-[6px] text-[10px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAdded ? '已加入' : isLoading ? '加入中' : '加入'}
        </button>
      )}
    />
  );
}
