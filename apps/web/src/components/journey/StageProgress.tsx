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

export function StageProgress() {
  const { journey, refresh } = useJourney();
  const currentStage = journey?.stage || 'AWARENESS';
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
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
    <aside className="h-full rounded-[16px] border border-black/10 bg-white/90 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] md:px-4 md:py-3 lg:p-3.5 xl:p-5">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#e85d26] md:hidden lg:block">Journey Stage</p>
      <h2 className="mt-1 text-[15px] font-extrabold text-[#111] md:hidden lg:block">旅程进度</h2>
      <ol className="mt-4 flex flex-wrap gap-1.5 md:mt-0 md:flex-row lg:mt-4 lg:flex-col lg:gap-[5px]">
        {STAGES.map((stage, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap lg:px-[9px] lg:py-[7px] lg:text-[12px] ${
                active
                  ? 'border-[#111] bg-[#111] text-white'
                  : completed
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]'
                    : 'border-black/10 bg-black/[0.03] text-black/45'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  active
                    ? 'bg-white/20 text-white'
                    : completed
                      ? 'bg-[#22c55e]/15 text-[#16a34a]'
                      : 'bg-black/10 text-black/55'
                }`}
              >
                {completed ? '✓' : index + 1}
              </span>
              {stage.label}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 hidden rounded-2xl border border-[#e9d5ff] bg-[#faf5ff] p-3 lg:block">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#7c3aed]">AI 置信度</p>
        <p className="mt-0.5 text-[28px] font-extrabold leading-none text-[#6d28d9]">{confidence || 0}%</p>
        <div className="mt-[5px] h-[3px] rounded-full bg-[#e9d5ff]">
          <div className="h-[3px] rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6d28d9)]" style={{ width: `${confidence || 8}%` }} />
        </div>
        <p className="mt-[3px] text-[9px] leading-[1.45] text-[#7c3aed]">已收集预算、车型偏好，继续聊可提升</p>
      </div>
      <Link
        href="/journey/publish"
        className="mt-4 hidden w-full rounded-[10px] border border-black/15 bg-white px-4 py-[9px] text-center text-[11px] font-bold text-black/75 xl:block"
      >
        发布我的旅程 →
      </Link>
    </aside>
  );
}
