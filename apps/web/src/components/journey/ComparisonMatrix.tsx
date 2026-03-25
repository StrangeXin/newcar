'use client';

import { useEffect } from 'react';
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

  const rows: Array<{ label: string; render: (candidate: Candidate) => string }> = [
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
    })),
    {
      label: '价格',
      render: (item) => `¥${(item.priceAtAdd || item.car.msrp || 0).toLocaleString('zh-CN')}`,
    },
  ];

  return (
    <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-bold text-[var(--text)]">对比模式</h3>
        <p className="text-[10px] text-[var(--text-muted)]">仅展示当前候选里最相关的维度</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] px-3 py-2 text-left text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)]">维度</th>
              {active.map((item) => (
                <th key={item.id} className="border-b border-[var(--border)] px-3 py-2 text-left text-[11px] font-semibold text-[var(--text)]">
                  {item.car.brand} {item.car.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--text-soft)]">{row.label}</td>
                {active.map((item) => (
                  <td key={`${row.label}-${item.id}`} className="border-b border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text)]">
                    {row.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
