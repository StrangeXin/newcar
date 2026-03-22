'use client';

import { Candidate } from '@/types/api';

interface ComparisonMatrixProps {
  candidates: Candidate[];
}

export function ComparisonMatrix({ candidates }: ComparisonMatrixProps) {
  const active = candidates.filter((item) => item.status === 'ACTIVE');
  if (active.length < 2) {
    return null;
  }

  const rows: Array<{ label: string; render: (candidate: Candidate) => string }> = [
    {
      label: '价格',
      render: (item) => `¥${(item.priceAtAdd || item.car.msrp || 0).toLocaleString('zh-CN')}`,
    },
    { label: '车型类别', render: (item) => item.car.type },
    { label: '燃油类型', render: (item) => item.car.fuelType },
    { label: 'AI匹配分', render: (item) => `${Math.round((item.aiMatchScore || 0) * 100)}%` },
    { label: '用户评分', render: (item) => String(item.userInterestScore ?? '-') },
  ];

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-card">
      <h3 className="text-base font-bold">候选对比矩阵</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-black/10 px-3 py-2 text-left">维度</th>
              {active.map((item) => (
                <th key={item.id} className="border-b border-black/10 px-3 py-2 text-left">
                  {item.car.brand} {item.car.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-black/10 px-3 py-2 font-semibold">{row.label}</td>
                {active.map((item) => (
                  <td key={`${row.label}-${item.id}`} className="border-b border-black/10 px-3 py-2 text-black/75">
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
