'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Brain, Route, Upload } from 'lucide-react';
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
    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
    : completed
      ? 'border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-text)]'
      : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]';

  const dotClass = active
    ? 'bg-white/20 text-white'
    : completed
      ? 'bg-[var(--success-muted)] text-[var(--success-text)]'
      : 'bg-[var(--surface-subtle)] text-[var(--text-muted)]';

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
    <aside className="hidden h-full min-h-0 w-full flex-col overflow-hidden rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-ws14 shadow-workspace xl:flex">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent-text)]">Journey Stage</p>
      <h2 className="mt-1 flex items-center gap-2 text-[18px] font-extrabold text-[var(--text)]">
        <Route className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        旅程进度
      </h2>

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

      <div className="mt-[10px] rounded-[10px] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-[10px]">
        <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent-text)]">
          <Brain className="h-3 w-3" aria-hidden="true" />
          AI 置信度
        </p>
        <p className="mt-0.5 text-[22px] font-extrabold leading-none text-[var(--accent-text-soft)]">{confidence || 0}%</p>
        <div className="mt-[6px] h-[3px] rounded-full bg-[var(--accent-border)]">
          <div className="h-[3px] rounded-full bg-[var(--accent)]" style={{ width: `${confidence || 8}%` }} />
        </div>
        <p className="mt-1 text-[9px] leading-[1.4] text-[var(--accent-text-soft)]">已收集预算与车型偏好，继续对话可提升准确度。</p>
      </div>

      <Link
        href="/journey/publish"
        className="mt-[10px] flex w-full cursor-pointer items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-[10px] py-[8px] text-center text-[11px] font-bold text-[var(--text-soft)] hover:border-[var(--border-soft)]"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        发布我的旅程
      </Link>
    </aside>
  );
}

function CompactStageProgress({ currentIndex }: { currentIndex: number }) {
  return (
    <aside className="hidden w-full flex-wrap items-center gap-[10px] rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-ws14 shadow-workspace md:flex xl:hidden">
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
