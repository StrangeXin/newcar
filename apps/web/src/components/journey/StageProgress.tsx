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
    <aside className="h-full rounded-[18px] border border-black/10 bg-white/90 p-4 shadow-card md:p-4 lg:p-3 xl:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e85d26] md:hidden lg:block">Journey Stage</p>
      <h2 className="mt-1 text-lg font-extrabold text-[#111] md:hidden lg:block">旅程进度</h2>
      <ol className="mt-4 flex flex-wrap gap-2 md:mt-0 md:flex-row lg:mt-4 lg:flex-col lg:gap-2">
        {STAGES.map((stage, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 text-sm font-semibold ${
                active
                  ? 'border-[#111] bg-[#111] text-white'
                  : completed
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]'
                    : 'border-black/10 bg-black/[0.03] text-black/45'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">AI Confidence</p>
        <p className="mt-1 text-3xl font-extrabold text-[#6d28d9]">{confidence || 0}%</p>
        <div className="mt-2 h-1.5 rounded-full bg-[#e9d5ff]">
          <div className="h-1.5 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6d28d9)]" style={{ width: `${confidence || 8}%` }} />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#7c3aed]">AI 已经对你的需求形成初步画像，继续聊天会让建议更准。</p>
      </div>
      <Link
        href="/journey/publish"
        className="mt-4 hidden w-full rounded-xl border border-black/15 bg-white px-4 py-2 text-center text-sm font-semibold text-black/75 xl:block"
      >
        发布历程
      </Link>
    </aside>
  );
}
