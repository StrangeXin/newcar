'use client';

import { useState, useEffect, useCallback } from 'react';

interface Stage {
  key: string;
  labelKey: string;
  content: React.ReactNode;
}

type Messages = Record<string, string>;

const INTERVAL = 4000;

const stages: Stage[] = [
  {
    key: 'needs',
    labelKey: 'carousel.stage.needs',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">您好！开始之前，我想了解几个关键问题：</p>
        </div>
        <div className="space-y-1.5">
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">预算范围？</span>
            <span className="ml-2 text-[var(--text-soft)]">20-30万</span>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">主要用途？</span>
            <span className="ml-2 text-[var(--text-soft)]">家用通勤</span>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-2 text-[11px]">
            <span className="font-medium text-[var(--accent-text)]">动力偏好？</span>
            <span className="ml-2 text-[var(--text-soft)]">增程优先</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'recommend',
    labelKey: 'carousel.stage.recommend',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">根据您「家用、预算25万、增程优先」的需求，为您筛选了3款候选车型：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { name: '理想 L6', spec: '增程 · 五座 · 24.98万起', score: 92 },
            { name: '问界 M7', spec: '增程 · 五座 · 24.98万起', score: 85 },
            { name: '小鹏 G6', spec: '纯电 · 五座 · 20.99万起', score: 78 },
          ].map((car) => (
            <div key={car.name} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold text-[var(--text)]">{car.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{car.spec}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-12 rounded-full bg-[var(--accent-border)]">
                  <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${car.score}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-[var(--accent)]">{car.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'compare',
    labelKey: 'carousel.stage.compare',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">以下是三款车型的核心参数横向对比：</p>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                <th className="px-2 py-1.5 text-left font-medium text-[var(--text-muted)]">参数</th>
                <th className="px-2 py-1.5 text-center font-semibold text-[var(--accent)]">理想 L6</th>
                <th className="px-2 py-1.5 text-center font-medium text-[var(--text)]">问界 M7</th>
                <th className="px-2 py-1.5 text-center font-medium text-[var(--text)]">小鹏 G6</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-soft)]">
              <tr className="border-b border-[var(--border)]">
                <td className="px-2 py-1.5 text-[var(--text-muted)]">纯电续航</td>
                <td className="px-2 py-1.5 text-center">212km</td>
                <td className="px-2 py-1.5 text-center">200km</td>
                <td className="px-2 py-1.5 text-center">580km</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="px-2 py-1.5 text-[var(--text-muted)]">空间</td>
                <td className="px-2 py-1.5 text-center">★★★★★</td>
                <td className="px-2 py-1.5 text-center">★★★★☆</td>
                <td className="px-2 py-1.5 text-center">★★★★☆</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 text-[var(--text-muted)]">智驾</td>
                <td className="px-2 py-1.5 text-center">AD Max</td>
                <td className="px-2 py-1.5 text-center">ADS 2.0</td>
                <td className="px-2 py-1.5 text-center">XNGP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    key: 'testdrive',
    labelKey: 'carousel.stage.testdrive',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">已为您找到附近3家门店，选择时间即可预约试驾：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { store: '理想汽车 · 望京体验中心', dist: '2.3km', time: '周六 10:00' },
            { store: '理想汽车 · 朝阳大悦城店', dist: '4.1km', time: '周六 14:00' },
            { store: '理想汽车 · 中关村店', dist: '6.8km', time: '周日 10:00' },
          ].map((s) => (
            <div key={s.store} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold text-[var(--text)]">{s.store}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{s.dist}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-text)]">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'finance',
    labelKey: 'carousel.stage.finance',
    content: (
      <div className="space-y-2">
        <div className="rounded-[3px_12px_12px_12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5 text-[11px] text-[var(--text)]">
          <p className="font-medium text-[var(--accent)]">AI 助手</p>
          <p className="mt-1 leading-relaxed">理想 L6 的购车金融方案对比：</p>
        </div>
        <div className="space-y-1.5">
          {[
            { plan: '全款购车', price: '24.98万', monthly: '-', total: '24.98万', tag: '最省' },
            { plan: '低首付贷款', price: '首付5万', monthly: '4,280/月', total: '30.4万', tag: '月供低' },
            { plan: '36期免息', price: '首付8.3万', monthly: '4,633/月', total: '24.98万', tag: '推荐' },
          ].map((f) => (
            <div key={f.plan} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[var(--text)]">{f.plan}</p>
                <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--accent-text)]">{f.tag}</span>
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-[var(--text-muted)]">
                <span>{f.price}</span>
                {f.monthly !== '-' && <span>月供 {f.monthly}</span>}
                <span>总计 {f.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export function JourneyCarousel({ t }: { t: Messages }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % stages.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <div
      className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-subtle)] p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em] text-[var(--accent-text-soft)]">
          AI Journey Preview
        </p>

        {/* Stage indicators */}
        <div className="mt-3 flex gap-1.5">
          {stages.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              className={`cursor-pointer rounded-full px-2 py-0.5 text-[9px] font-medium transition ${
                i === active
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--accent-muted)] text-[var(--accent-text)] hover:bg-[var(--accent-border)]'
              }`}
            >
              {t[s.labelKey] || s.labelKey}
            </button>
          ))}
        </div>

        {/* Content area with fade transition */}
        <div className="relative mt-3 min-h-[200px]">
          {stages.map((s, i) => (
            <div
              key={s.key}
              className={`transition-opacity duration-500 ${
                i === active ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
              }`}
            >
              {s.content}
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {stages.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${
                i === active ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--accent-border)] hover:bg-[var(--accent)]'
              }`}
              aria-label={t[s.labelKey] || s.labelKey}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
