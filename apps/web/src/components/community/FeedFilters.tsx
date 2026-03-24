'use client';

import { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface FeedFilterState {
  fuel_type?: string;
  budget_range?: string;
  use_case?: string;
  result?: string;
  has_template?: string;
  sort?: string;
}

interface FeedFiltersProps {
  value: FeedFilterState;
  onChange: (next: FeedFilterState) => void;
}

export function FeedFilters({ value, onChange }: FeedFiltersProps) {
  const update = (key: keyof FeedFilterState, next: string) => {
    const merged: FeedFilterState = { ...value };
    if (!next) {
      delete merged[key];
    } else {
      merged[key] = next;
    }
    onChange(merged);
  };

  const summary = useMemo(() => Object.entries(value).map(([k, v]) => `${k}:${v}`).join(' | '), [value]);

  return (
    <div className="sticky top-0 z-10 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg)]/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-md">
      <p className="mb-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent-text-soft)]">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        筛选条件
      </p>
      <div className="grid gap-3 md:grid-cols-6">
        <select
          value={value.fuel_type || ''}
          onChange={(e) => update('fuel_type', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="">全部燃油类型</option>
          <option value="BEV">BEV</option>
          <option value="PHEV">PHEV</option>
          <option value="HEV">HEV</option>
          <option value="ICE">ICE</option>
        </select>

        <select
          value={value.budget_range || ''}
          onChange={(e) => update('budget_range', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="">全部预算</option>
          <option value="0-15">15万以下</option>
          <option value="15-25">15-25万</option>
          <option value="25-35">25-35万</option>
          <option value="35-999">35万以上</option>
        </select>

        <select
          value={value.use_case || ''}
          onChange={(e) => update('use_case', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="">全部场景</option>
          <option value="family">家用</option>
          <option value="commute">通勤</option>
          <option value="travel">越野/旅行</option>
          <option value="business">商务</option>
        </select>

        <select
          value={value.result || ''}
          onChange={(e) => update('result', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="">全部结果</option>
          <option value="purchased">已购车</option>
          <option value="in_progress">进行中</option>
        </select>

        <select
          value={value.has_template || ''}
          onChange={(e) => update('has_template', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="">全部内容</option>
          <option value="true">仅可从此出发</option>
        </select>

        <select
          value={value.sort || 'relevance'}
          onChange={(e) => update('sort', e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]"
        >
          <option value="relevance">最相关</option>
          <option value="latest">最新</option>
          <option value="popular">最受欢迎</option>
        </select>
      </div>

      {summary ? <p className="mt-2 text-xs text-[var(--text-muted)]">当前筛选：{summary}</p> : null}
    </div>
  );
}
