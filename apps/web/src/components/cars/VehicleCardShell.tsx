'use client';

import { ReactNode } from 'react';

interface VehicleCardShellProps {
  iconLabel: string;
  iconBgClassName: string;
  title: string;
  subtitle: string;
  rightMeta?: ReactNode;
  progressPercent?: number;
  progressLabel?: string;
  progressBarClassName?: string;
  note?: string;
  noteClassName?: string;
  actions?: ReactNode;
  className?: string;
  dimmed?: boolean;
}

export function VehicleCardShell({
  iconLabel,
  iconBgClassName,
  title,
  subtitle,
  rightMeta,
  progressPercent,
  progressLabel,
  progressBarClassName = 'bg-[linear-gradient(90deg,#ea580c,#f97316)]',
  note,
  noteClassName = 'bg-[var(--accent-muted)] text-[var(--accent-text)]',
  actions,
  className = '',
  dimmed = false,
}: VehicleCardShellProps) {
  return (
    <article
      className={`rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-[14px] py-[14px] shadow-[0_2px_10px_rgba(15,23,42,0.06)] ${dimmed ? 'opacity-55' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-[10px]">
        <div className="flex items-start gap-[10px]">
          <div
            className={`flex h-[34px] w-[46px] items-center justify-center rounded-[8px] text-[11px] font-bold text-[var(--text-soft)] ${iconBgClassName}`}
          >
            {iconLabel}
          </div>
          <div>
            <h4 className="text-[12px] font-bold text-[var(--text)]">{title}</h4>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
        {rightMeta}
      </div>

      {typeof progressPercent === 'number' ? (
        <div className="mt-[10px]">
          {progressLabel ? (
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-[var(--text-muted)]">匹配度</span>
              <span className="text-[11px] font-extrabold text-[var(--text-soft)]">{progressLabel}</span>
            </div>
          ) : null}
          <div className="h-[3px] rounded-full bg-[var(--border)]">
            <div className={`h-[3px] rounded-full ${progressBarClassName}`} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {note ? (
        <div className={`mt-[10px] rounded-[8px] px-[10px] py-[6px] text-[10px] leading-[1.5] ${noteClassName}`}>
          {note}
        </div>
      ) : null}

      {actions ? <div className="mt-[10px] flex gap-[6px]">{actions}</div> : null}
    </article>
  );
}
