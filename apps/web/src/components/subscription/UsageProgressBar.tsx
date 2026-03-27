'use client';

interface UsageProgressBarProps {
  label: string;
  used: number;
  limit: number;
  formatValue?: (value: number) => string;
}

export default function UsageProgressBar({ label, used, limit, formatValue }: UsageProgressBarProps) {
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isExceeded = used >= limit && limit > 0;
  const format = formatValue ?? ((v: number) => String(v));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={isExceeded ? 'text-red-500 font-medium' : 'text-[var(--text-primary)]'}>
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isExceeded
              ? 'bg-red-500'
              : percentage > 80
                ? 'bg-yellow-500'
                : 'bg-[var(--accent)]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {limit === 0 && (
        <p className="text-xs text-[var(--text-tertiary)]">升级套餐解锁</p>
      )}
    </div>
  );
}
