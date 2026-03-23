'use client';

import { FormEvent, useMemo, useState } from 'react';
import { post } from '@/lib/api';

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
    <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-card">
      <h2 className="text-2xl font-bold">开始你的购车旅程</h2>
      <p className="mt-2 text-sm text-black/65">用 1 分钟告诉我们你的预算与偏好，马上生成专属看板。</p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-black/70" htmlFor="title">
            旅程标题
          </label>
          <input
            data-testid="journey-title-input"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：家用 20 万新能源 SUV"
            className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none ring-ember/30 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black/70">预算范围（万元）</label>
          <select
            data-testid="journey-budget-select"
            value={budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none ring-ember/30 focus:ring-2"
          >
            {BUDGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black/70">用车场景（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map((item) => {
              const selected = useCases.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setUseCases((prev) => toggleItem(prev, item.key))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selected ? 'border-ink bg-ink text-white' : 'border-black/20 bg-white text-black/70'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-black/70">燃油类型偏好（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {FUEL_TYPES.map((item) => {
              const selected = fuelTypes.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFuelTypes((prev) => toggleItem(prev, item))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    selected ? 'border-pine bg-pine text-white' : 'border-black/20 bg-white text-black/70'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          data-testid="start-journey-button"
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '创建中...' : '开始旅程'}
        </button>
      </form>
    </section>
  );
}
