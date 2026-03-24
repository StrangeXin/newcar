'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, ListChecks, RefreshCcw, Sparkles } from 'lucide-react';
import { post } from '@/lib/api';
import { useSnapshot } from '@/hooks/useSnapshot';
import { JOURNEY_SIDE_EFFECT_EVENT, JourneySideEffectEvent } from '@/lib/journey-workspace-events';
import { SnapshotInsight } from '@/types/api';
import { mockSnapshot } from './workspace-mock-data';

interface AiSummaryProps {
  journeyId: string;
}

function toInsights(value: unknown): SnapshotInsight[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as SnapshotInsight[];
}

function toActions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

export function AiSummary({ journeyId }: AiSummaryProps) {
  const { snapshot, isLoading, refresh } = useSnapshot(journeyId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const displaySnapshot = snapshot || mockSnapshot;

  const insights = toInsights(displaySnapshot?.keyInsights);
  const actions = toActions(displaySnapshot?.nextSuggestedActions);

  async function refreshSnapshot() {
    try {
      setIsRefreshing(true);
      await post(`/snapshots/${journeyId}/snapshot?trigger=MANUAL`, {});
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    const handleSideEffect = (event: Event) => {
      const detail = (event as CustomEvent<JourneySideEffectEvent>).detail;
      if (detail?.journeyId === journeyId) {
        void refresh();
      }
    };
    window.addEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
    return () => window.removeEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
  }, [journeyId, refresh]);

  function getInsightTone(confidence: number) {
    if (confidence >= 0.75) return 'border-[#22c55e] bg-[#f0fdf4]';
    if (confidence >= 0.55) return 'border-[#fb923c] bg-[#fff7ed]';
    return 'border-[#f59e0b] bg-[#fffbeb]';
  }

  return (
    <section className="rounded-ws-lg border border-slate-200 bg-white/90 p-ws14 shadow-workspace">
      <div className="flex min-h-[28px] items-center justify-between gap-[10px]">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-900">
          <Sparkles className="h-4 w-4 text-sky-700" aria-hidden="true" />
          AI 旅程摘要
        </h3>
        <button
          type="button"
          onClick={refreshSnapshot}
          disabled={isRefreshing}
          className="inline-flex cursor-pointer items-center gap-1 rounded-ws-sm border-[1.5px] border-slate-300 bg-white px-[10px] py-[6px] text-[10px] font-semibold leading-[1.2] text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {isRefreshing ? '刷新中...' : '刷新快照'}
        </button>
      </div>

      {isLoading ? <p className="mt-4 text-[11px] text-slate-500">加载中...</p> : null}
      {displaySnapshot ? (
        <div className="mt-[14px] space-y-[14px]">
          <p className="text-[11px] leading-[1.7] text-slate-600">{displaySnapshot.narrativeSummary || '暂无摘要'}</p>

          <div>
            <h4 className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              关键洞察
            </h4>
            <ul className="mt-[10px] space-y-[10px]">
              {insights.slice(0, 3).map((item) => (
                <li key={item.insight} className={`rounded-[10px] border-l-[3px] px-[10px] py-[10px] text-sm ${getInsightTone(item.confidence)}`}>
                  <p className="text-[11px] font-bold text-slate-900">{item.insight}</p>
                  <p className="mt-1 text-[10px] leading-[1.4] text-slate-600">{item.evidence}</p>
                  <p className="mt-1 text-[9px] text-slate-500">置信度 {Math.round(item.confidence * 100)}%</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
              <ListChecks className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              AI 建议下一步
            </h4>
            <div className="mt-[6px] flex flex-wrap gap-[6px]">
              {actions.slice(0, 3).map((action) => (
                <button
                  key={action}
                  type="button"
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-[10px] py-1 text-[10px] font-medium leading-[1.2] text-slate-600 hover:border-slate-300"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
