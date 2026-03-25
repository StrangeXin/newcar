'use client';

import { useMemo, useEffect } from 'react';
import { trackEvent } from '@/lib/behavior';
import { Candidate } from '@/types/api';

interface ComparisonMatrixProps {
  candidates: Candidate[];
}

export function ComparisonMatrix({ candidates }: ComparisonMatrixProps) {
  const active = candidates.filter((item) => item.status === 'ACTIVE');
  const journeyId = active[0]?.journeyId;
  const dimensions = Array.from(
    new Set(
      active.flatMap((item) => (item.relevantDimensions || []).map((dimension) => String(dimension)))
    )
  ).slice(0, 4);

  useEffect(() => {
    if (!journeyId || active.length < 2) {
      return;
    }
    void trackEvent(journeyId, 'COMPARISON_OPEN', 'CANDIDATE_SET', undefined, {
      candidateCount: active.length,
    });
  }, [journeyId, active.length]);

  if (active.length < 2) {
    return null;
  }

  const rows: Array<{
    label: string;
    render: (candidate: Candidate) => string;
    numericValue: (candidate: Candidate) => number | null;
    lowerIsBetter?: boolean;
  }> = [
    ...dimensions.map((dimension) => ({
      label: dimension,
      render: (item: Candidate) => {
        const specs =
          item.car.baseSpecs && typeof item.car.baseSpecs === 'object' && !Array.isArray(item.car.baseSpecs)
            ? (item.car.baseSpecs as Record<string, unknown>)
            : {};
        const direct = specs[dimension];
        if (typeof direct === 'number' || typeof direct === 'string') {
          return String(direct);
        }
        if (dimension.includes('价格')) {
          return `¥${(item.priceAtAdd || item.car.msrp || 0).toLocaleString('zh-CN')}`;
        }
        if (dimension.includes('空间')) {
          return item.car.type;
        }
        if (dimension.includes('续航') && typeof specs.range === 'number') {
          return `${specs.range}km`;
        }
        return '待补充';
      },
      numericValue: (item: Candidate) => {
        const specs =
          item.car.baseSpecs && typeof item.car.baseSpecs === 'object' && !Array.isArray(item.car.baseSpecs)
            ? (item.car.baseSpecs as Record<string, unknown>)
            : {};
        const direct = specs[dimension];
        if (typeof direct === 'number') return direct;
        if (dimension.includes('价格')) return item.priceAtAdd || item.car.msrp || null;
        if (dimension.includes('续航') && typeof specs.range === 'number') return specs.range;
        return null;
      },
      lowerIsBetter: dimension.includes('价格') || dimension.includes('能耗'),
    })),
    {
      label: '价格',
      render: (item) => `¥${(item.priceAtAdd || item.car.msrp || 0).toLocaleString('zh-CN')}`,
      numericValue: (item) => item.priceAtAdd || item.car.msrp || null,
      lowerIsBetter: true,
    },
  ];

  // Compute which candidate is best per row
  const bestPerRow = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const row of rows) {
      let bestId: string | null = null;
      let bestVal: number | null = null;
      for (const item of active) {
        const val = row.numericValue(item);
        if (val === null) continue;
        if (bestVal === null || (row.lowerIsBetter ? val < bestVal : val > bestVal)) {
          bestVal = val;
          bestId = item.id;
        }
      }
      result[row.label] = bestId;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dimensions]);

  // AI comparison summary: find which car "wins" the most dimensions
  const aiSummary = useMemo(() => {
    const winCounts: Record<string, number> = {};
    for (const item of active) {
      winCounts[item.id] = 0;
    }
    for (const row of rows) {
      const winnerId = bestPerRow[row.label];
      if (winnerId && winnerId in winCounts) {
        winCounts[winnerId]++;
      }
    }
    let topId: string | null = null;
    let topCount = 0;
    for (const [id, count] of Object.entries(winCounts)) {
      if (count > topCount) {
        topCount = count;
        topId = id;
      }
    }
    const topCandidate = active.find((c) => c.id === topId);
    if (!topCandidate || topCount === 0) return null;
    const carName = `${topCandidate.car.brand} ${topCandidate.car.model}`;
    return `${carName} 在 ${topCount} 个维度中表现最优，综合竞争力较强。`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, bestPerRow]);

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[length:var(--text-sm)] font-bold text-[var(--text)]">对比模式</h3>
        <p className="text-[length:var(--text-xs)] text-[var(--text-muted)]">仅展示当前候选里最相关的维度</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] px-3 py-2 text-left text-[length:var(--text-xs)] uppercase tracking-[0.05em] text-[var(--text-muted)]">维度</th>
              {active.map((item) => (
                <th key={item.id} className="border-b border-[var(--border)] px-3 py-2 text-left text-[length:var(--text-xs)] font-semibold text-[var(--text)]">
                  {item.car.brand} {item.car.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] font-semibold text-[var(--text-soft)]">{row.label}</td>
                {active.map((item) => {
                  const isBest = bestPerRow[row.label] === item.id;
                  return (
                    <td
                      key={`${row.label}-${item.id}`}
                      className={`border-b border-[var(--border)] px-3 py-2 text-[length:var(--text-xs)] ${isBest ? 'font-bold text-[var(--accent-text)]' : 'text-[var(--text)]'}`}
                    >
                      <span className="flex items-center gap-1">
                        {row.render(item)}
                        {isBest ? (
                          <span className="inline-block rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-semibold text-[var(--accent-text)]">
                            最优
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aiSummary ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3">
          <h4 className="text-[length:var(--text-sm)] font-bold text-[var(--accent-text)]">AI 对比分析</h4>
          <p className="mt-1 text-[length:var(--text-xs)] leading-[1.6] text-[var(--text-soft)]">{aiSummary}</p>
        </div>
      ) : null}
    </section>
  );
}
