'use client';

import { useEffect, useState } from 'react';
import { post } from '@/lib/api';
import { useSnapshot } from '@/hooks/useSnapshot';
import { JOURNEY_SIDE_EFFECT_EVENT, JourneySideEffectEvent } from '@/lib/journey-workspace-events';
import { SnapshotInsight } from '@/types/api';

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

  const insights = toInsights(snapshot?.keyInsights);
  const actions = toActions(snapshot?.nextSuggestedActions);

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
    if (confidence >= 0.55) return 'border-[#3b82f6] bg-[#eff6ff]';
    return 'border-[#eab308] bg-[#fefce8]';
  }

  return (
    <section className="rounded-[16px] border border-black/10 bg-white/90 p-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] xl:px-4 xl:py-[14px]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-extrabold text-[#111]">AI 旅程摘要</h3>
        <button
          type="button"
          onClick={refreshSnapshot}
          disabled={isRefreshing}
          className="rounded-[7px] border-[1.5px] border-[#e5e7eb] bg-white px-[9px] py-[3px] text-[10px] font-semibold"
        >
          {isRefreshing ? '刷新中...' : '刷新快照'}
        </button>
      </div>

      {isLoading ? <p className="mt-4 text-sm text-black/60">加载中...</p> : null}
      {!snapshot && !isLoading ? (
        <p className="mt-4 rounded-xl bg-black/5 p-3 text-sm text-black/55">正在生成首次旅程摘要...</p>
      ) : null}

      {snapshot ? (
        <div className="mt-4 space-y-4">
          <p className="text-[11px] leading-[1.7] text-[#4b5563]">{snapshot.narrativeSummary || '暂无摘要'}</p>

          <div>
            <h4 className="text-[10px] font-bold text-[#374151]">关键洞察</h4>
            <ul className="mt-2 space-y-2">
              {insights.slice(0, 3).map((item) => (
                <li key={item.insight} className={`rounded-[9px] border-l-[3px] px-[11px] py-[9px] text-sm ${getInsightTone(item.confidence)}`}>
                  <p className="text-[11px] font-bold text-ink">{item.insight}</p>
                  <p className="mt-1 text-[10px] leading-[1.4] text-black/65">{item.evidence}</p>
                  <p className="mt-1 text-[9px] text-black/55">置信度 {Math.round(item.confidence * 100)}%</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-bold text-[#374151]">AI 建议下一步</h4>
            <div className="mt-[5px] flex flex-wrap gap-1">
              {actions.slice(0, 3).map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-full border border-[#e5e7eb] bg-[#f3f4f6] px-[9px] py-[3px] text-[10px] font-medium text-[#374151]"
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
