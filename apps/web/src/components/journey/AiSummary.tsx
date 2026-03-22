'use client';

import { useState } from 'react';
import { post } from '@/lib/api';
import { useSnapshot } from '@/hooks/useSnapshot';
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

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold">AI 历程摘要</h3>
        <button
          type="button"
          onClick={refreshSnapshot}
          disabled={isRefreshing}
          className="rounded-lg border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold"
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
          <p className="text-sm leading-6 text-black/75">{snapshot.narrativeSummary || '暂无摘要'}</p>

          <div>
            <h4 className="text-sm font-semibold">关键洞察</h4>
            <ul className="mt-2 space-y-2">
              {insights.slice(0, 3).map((item) => (
                <li key={item.insight} className="rounded-lg border border-black/10 bg-pearl p-3 text-sm">
                  <p className="font-semibold text-ink">{item.insight}</p>
                  <p className="mt-1 text-black/65">{item.evidence}</p>
                  <p className="mt-1 text-xs text-black/55">置信度：{Math.round(item.confidence * 100)}%</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold">下一步建议</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-black/70">
              {actions.slice(0, 3).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
