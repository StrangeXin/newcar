'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useJourney } from '@/hooks/useJourney';
import { JOURNEY_SIDE_EFFECT_EVENT, JourneySideEffectEvent } from '@/lib/journey-workspace-events';

const STAGES = [
  { key: 'AWARENESS', label: '需求确认' },
  { key: 'CONSIDERATION', label: '候选筛选' },
  { key: 'COMPARISON', label: '深度对比' },
  { key: 'DECISION', label: '决策强化' },
  { key: 'PURCHASE', label: '购买执行' },
];

type StageItemProps = {
  index: number;
  label: string;
  active: boolean;
  completed: boolean;
  fullWidth?: boolean;
};

function StageItem({ index, label, active, completed, fullWidth = false }: StageItemProps) {
  const toneClass = active
    ? 'border-[#111] bg-[#111] text-white'
    : completed
      ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]'
      : 'border-black/10 bg-black/[0.03] text-black/45';

  const dotClass = active
    ? 'bg-white/20 text-white'
    : completed
      ? 'bg-[#22c55e]/15 text-[#16a34a]'
      : 'bg-black/10 text-black/55';

  return (
    <li
      data-testid={`stage-${STAGES[index].key.toLowerCase()}`}
      data-active={active ? 'true' : 'false'}
      className={`flex items-center gap-[6px] rounded-[10px] border border-[1.5px] px-[10px] py-[8px] text-[12px] font-semibold whitespace-nowrap ${fullWidth ? 'w-full' : ''} ${toneClass}`}
    >
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${dotClass}`}>
        {completed ? '✓' : index + 1}
      </span>
      {label}
    </li>
  );
}

function DesktopStageProgress({ currentIndex, confidence }: { currentIndex: number; confidence: number }) {
  return (
    <aside className="hidden h-full min-h-0 w-full flex-col overflow-hidden rounded-ws-lg border border-workspace-border bg-workspace-surface p-ws14 shadow-workspace xl:flex">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#e85d26]">Journey Stage</p>
      <h2 className="mt-1 text-[18px] font-extrabold text-[#111]">旅程进度</h2>

      <ol className="mt-[10px] flex flex-1 flex-col gap-[6px]">
        {STAGES.map((stage, index) => (
          <StageItem
            key={stage.key}
            index={index}
            label={stage.label}
            active={index === currentIndex}
            completed={index < currentIndex}
            fullWidth
          />
        ))}
      </ol>

      <div className="mt-[10px] rounded-[10px] border border-[#e9d5ff] bg-[#faf5ff] p-[10px]">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#7c3aed]">AI 置信度</p>
        <p className="mt-0.5 text-[22px] font-extrabold leading-none text-[#6d28d9]">{confidence || 0}%</p>
        <div className="mt-[6px] h-[3px] rounded-full bg-[#e9d5ff]">
          <div className="h-[3px] rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6d28d9)]" style={{ width: `${confidence || 8}%` }} />
        </div>
        <p className="mt-1 text-[9px] leading-[1.4] text-[#7c3aed]">已收集预算、车型偏好，继续聊可提升</p>
      </div>

      <Link
        href="/journey/publish"
        className="mt-[10px] block w-full rounded-[10px] border-[1.5px] border-black/15 bg-white px-[10px] py-[8px] text-center text-[11px] font-bold text-black/75"
      >
        发布我的旅程 →
      </Link>
    </aside>
  );
}

function CompactStageProgress({ currentIndex }: { currentIndex: number }) {
  return (
    <aside className="hidden w-full flex-wrap items-center gap-[10px] rounded-ws-lg border border-workspace-border bg-workspace-surface p-ws14 shadow-workspace md:flex xl:hidden">
      <ol className="flex w-full flex-wrap gap-[6px]">
        {STAGES.map((stage, index) => (
          <StageItem
            key={stage.key}
            index={index}
            label={stage.label}
            active={index === currentIndex}
            completed={index < currentIndex}
          />
        ))}
      </ol>
    </aside>
  );
}

export function StageProgress() {
  const { journey, refresh } = useJourney();
  const currentStage = journey?.stage || 'AWARENESS';
  const currentIndex = STAGES.findIndex((stage) => stage.key === currentStage);
  const confidence = Math.round((journey?.aiConfidenceScore || 0) * 100);

  useEffect(() => {
    const handleSideEffect = (event: Event) => {
      const detail = (event as CustomEvent<JourneySideEffectEvent>).detail;
      if (detail?.journeyId === journey?.id) {
        void refresh();
      }
    };

    window.addEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
    return () => window.removeEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
  }, [journey?.id, refresh]);

  return (
    <>
      <CompactStageProgress currentIndex={currentIndex} />
      <DesktopStageProgress currentIndex={currentIndex} confidence={confidence} />
    </>
  );
}
