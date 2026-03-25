'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Fuel, ListChecks, PenSquare, Route, Sparkles, Wallet } from 'lucide-react';
import { post } from '@/lib/api';
import { IconBadge } from '@/components/ui/IconBadge';

interface NewJourneyWizardProps {
  onCreated: () => Promise<unknown>;
}

const USE_CASES = [
  { key: 'commute', label: '通勤代步' },
  { key: 'family', label: '家庭出行' },
  { key: 'business', label: '商务接待' },
  { key: 'travel', label: '长途旅行' },
];

const FUEL_TYPES = ['BEV', 'PHEV', 'HEV', 'ICE'];

const BUDGET_OPTIONS = [
  { label: '10-15 万', value: '10-15' },
  { label: '15-25 万', value: '15-25' },
  { label: '25-35 万', value: '25-35' },
  { label: '35-50 万', value: '35-50' },
];

export function NewJourneyWizard({ onCreated }: NewJourneyWizardProps) {
  const [title, setTitle] = useState('');
  const [budgetRange, setBudgetRange] = useState(BUDGET_OPTIONS[1].value);
  const [useCases, setUseCases] = useState<string[]>([]);
  const [fuelTypes, setFuelTypes] = useState<string[]>(['BEV', 'PHEV']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budget = useMemo(() => {
    const [min, max] = budgetRange.split('-').map((v) => parseInt(v, 10));
    return { min, max };
  }, [budgetRange]);

  function toggleItem(values: string[], next: string): string[] {
    return values.includes(next) ? values.filter((item) => item !== next) : [...values, next];
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError('请先填写旅程标题');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await post('/journeys', {
        title: title.trim(),
        requirements: {
          budgetMin: budget.min,
          budgetMax: budget.max,
          useCases,
          fuelTypePreference: fuelTypes,
        },
      });
      await onCreated();
    } catch (err) {
      setError((err as Error).message || '创建旅程失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_220px] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">Journey Setup</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[var(--text)]">开始你的购车旅程</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">用 1 分钟告诉我们预算与偏好，马上生成专属看板。</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[var(--error)]/20 bg-[var(--error)]/10 px-2 py-1 text-[var(--error)]">1 需求输入</span>
            <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 py-1 text-[var(--accent)]">2 AI 建议</span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-muted)] px-2 py-1 text-[var(--success-text)]">3 看板执行</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
            <div className="flex items-center gap-2 rounded-md bg-[var(--accent-muted)] px-2 py-1.5 text-[var(--accent-text)]">
              <PenSquare className="h-3.5 w-3.5" />
              输入预算与偏好
            </div>
            <div className="flex items-center gap-2 rounded-md bg-[var(--accent-muted)] px-2 py-1.5 text-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              AI 生成候选与建议
            </div>
            <div className="flex items-center gap-2 rounded-md bg-[var(--success-muted)] px-2 py-1.5 text-[var(--success-text)]">
              <Route className="h-3.5 w-3.5" />
              自动创建旅程看板
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]" htmlFor="title">
            <IconBadge icon={PenSquare} tone="neutral" size="sm" />
            旅程标题
          </label>
          <input
            data-testid="journey-title-input"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：家用 20 万新能源 SUV"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]">
            <IconBadge icon={Wallet} tone="neutral" size="sm" />
            预算范围（万元）
          </label>
          <select
            data-testid="journey-budget-select"
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
          >
            {BUDGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]">
            <IconBadge icon={ListChecks} tone="neutral" size="sm" />
            用车场景（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map((item) => {
              const selected = useCases.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setUseCases((prev) => toggleItem(prev, item.key))}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--border-soft)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]">
            <IconBadge icon={Fuel} tone="neutral" size="sm" />
            燃油类型偏好（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {FUEL_TYPES.map((item) => {
              const selected = fuelTypes.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFuelTypes((prev) => toggleItem(prev, item))}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selected
                      ? 'border-[var(--success-text)] bg-[var(--success-text)] text-white'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)] hover:border-[var(--border-soft)]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p role="alert" className="text-sm text-[var(--error)]">{error}</p> : null}

        <button
          data-testid="start-journey-button"
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '创建中...' : '开始旅程'}
        </button>
      </form>
    </section>
  );
}
