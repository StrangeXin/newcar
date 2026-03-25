'use client';

import { useEffect, useState } from 'react';
import { Check, Quote, Star } from 'lucide-react';
import { patch, post } from '@/lib/api';
import { trackEvent } from '@/lib/behavior';
import { Candidate } from '@/types/api';

interface CandidateCardProps {
  candidate: Candidate;
  onUpdated: () => Promise<unknown>;
  emphasizeTags?: boolean;
}

export function CandidateCard({ candidate, onUpdated, emphasizeTags }: CandidateCardProps) {
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(candidate.userNotes || '');
  const isMock = candidate.journeyId === 'mock-journey';

  async function eliminate() {
    if (isMock) return;
    try {
      setBusy(true);
      await patch(`/journeys/${candidate.journeyId}/candidates/${candidate.id}`, {
        status: 'ELIMINATED',
      });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (isMock) return;
    try {
      setBusy(true);
      await patch(`/journeys/${candidate.journeyId}/candidates/${candidate.id}`, {
        status: 'ACTIVE',
      });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function markWinner() {
    if (isMock) return;
    try {
      setBusy(true);
      await post(`/journeys/${candidate.journeyId}/candidates/${candidate.id}/winner`, {});
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (isMock) return;
    try {
      setBusy(true);
      await patch(`/journeys/${candidate.journeyId}/candidates/${candidate.id}/notes`, { notes });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const isEliminated = candidate.status === 'ELIMINATED';
  const isWinner = candidate.status === 'WINNER';
  const seats =
    candidate.car.baseSpecs &&
    typeof candidate.car.baseSpecs === 'object' &&
    !Array.isArray(candidate.car.baseSpecs) &&
    'seats' in candidate.car.baseSpecs
      ? Number((candidate.car.baseSpecs as Record<string, unknown>).seats || 5)
      : 5;
  const brandTheme =
    candidate.car.brand.includes('理想')
      ? {
          icon: 'bg-[linear-gradient(135deg,#ffedd5,#fdba74)]',
          bar: 'bg-[linear-gradient(90deg,#ea580c,#f97316)]',
        }
      : candidate.car.brand.includes('小鹏')
        ? {
          icon: 'bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]',
          bar: 'bg-[linear-gradient(90deg,#10b981,#059669)]',
        }
        : {
            icon: 'bg-[var(--surface-subtle)]',
            bar: 'bg-[linear-gradient(90deg,#94a3b8,#475569)]',
          };
  const seatLabel = seats === 5 ? '五座' : seats === 6 ? '六座' : `${seats}座`;
  const priceLabel = isEliminated ? '超出预算' : '起售价';
  const matchTags = candidate.matchTags || [];
  const relevantDimensions = (candidate.relevantDimensions || []).slice(0, 3);
  const specs =
    candidate.car.baseSpecs && typeof candidate.car.baseSpecs === 'object' && !Array.isArray(candidate.car.baseSpecs)
      ? (candidate.car.baseSpecs as Record<string, unknown>)
      : {};
  const dimensionValues = relevantDimensions
    .map((dimension) => {
      const value = specs[dimension];
      if (typeof value === 'number') {
        return { label: dimension, value: `${value}` };
      }
      const alias = dimension.toLowerCase();
      const fallback =
        alias.includes('续航')
          ? typeof specs.range === 'number'
            ? `${specs.range} km`
            : null
          : alias.includes('空间')
            ? `${seatLabel} ${candidate.car.type}`
            : alias.includes('价格')
              ? candidate.car.msrp
                ? `${(candidate.car.msrp / 10000).toFixed(2)}万`
                : '暂无'
              : alias.includes('能耗')
                ? typeof specs.efficiency === 'number'
                  ? `${specs.efficiency}`
                  : '待补充'
                : null;
      return { label: dimension, value: fallback || '待补充' };
    })
    .filter((item) => item.value);

  useEffect(() => {
    if (isMock) {
      return;
    }

    const start = Date.now();
    void trackEvent(candidate.journeyId, 'CAR_VIEW', 'CAR', candidate.carId, {
      carId: candidate.carId,
      duration_sec: 0,
    });

    return () => {
      const durationSec = Math.max(0, Math.round((Date.now() - start) / 1000));
      void trackEvent(candidate.journeyId, 'CAR_VIEW', 'CAR', candidate.carId, {
        carId: candidate.carId,
        duration_sec: durationSec,
      });
    };
  }, [candidate.carId, candidate.journeyId, isMock]);

  return (
    <div data-testid="candidate-card" data-candidate-name={`${candidate.car.brand} ${candidate.car.model}`}>
      <article
        className={`rounded-[16px] border-[1.5px] px-[14px] py-[14px] shadow-[0_2px_10px_rgba(15,23,42,0.06)] ${
          isWinner
            ? 'border-[var(--success-border)] bg-[linear-gradient(180deg,var(--surface),var(--success-muted))]'
            : isEliminated
              ? 'border-[var(--border)] bg-[var(--surface-subtle)] opacity-70'
              : 'border-[var(--border)] bg-[var(--surface)]'
        }`}
      >
        <div className="flex items-start justify-between gap-[10px]">
          <div className="flex items-start gap-[10px]">
            <div
              className={`flex h-[34px] w-[46px] items-center justify-center rounded-[8px] text-[11px] font-bold text-[var(--text-soft)] ${brandTheme.icon}`}
            >
              {candidate.car.brand || candidate.car.model.slice(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[13px] font-bold text-[var(--text)]">{candidate.car.brand} {candidate.car.model}</h4>
                {isWinner ? (
                  <span className="rounded-full bg-[var(--success-text)] px-2 py-0.5 text-[9px] font-bold text-white">已选定</span>
                ) : null}
                {isEliminated ? (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">已淘汰</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {candidate.car.fuelType === 'PHEV' ? '增程' : candidate.car.fuelType === 'BEV' ? '纯电' : candidate.car.fuelType} · {candidate.car.type} · {seatLabel}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-[15px] font-extrabold ${isEliminated ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
              {candidate.car.msrp ? `${(candidate.car.msrp / 10000).toFixed(2)}万` : '暂无'}
            </p>
            <p className="text-[9px] text-[var(--text-muted)]">{priceLabel}</p>
          </div>
        </div>

        {matchTags.length > 0 ? (
          <div className={`mt-[10px] flex flex-wrap gap-[6px] ${emphasizeTags ? 'rounded-[10px] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-2' : ''}`}>
            {matchTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className={`rounded-full font-medium ${
                  emphasizeTags
                    ? 'border-[1.5px] border-[var(--accent-border)] bg-[var(--surface)] px-3 py-[5px] text-[11px] font-semibold text-[var(--accent-text)]'
                    : isEliminated
                      ? 'border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[4px] text-[10px] text-[var(--text-muted)]'
                      : 'border border-[var(--accent-border)] bg-[var(--accent-muted)] px-[10px] py-[4px] text-[10px] text-[var(--accent-text)]'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {dimensionValues.length > 0 ? (
          <div className="mt-[12px] grid gap-[8px]">
            {dimensionValues.map((item) => {
              const dimensionMatchesSomeTag = matchTags.some((tag) => {
                const t = tag.toLowerCase();
                const d = item.label.toLowerCase();
                return t.includes(d) || d.includes(t);
              });
              return (
                <div key={item.label} className="flex items-center justify-between rounded-[10px] bg-[var(--surface-subtle)] px-[10px] py-[8px] text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-soft)]">
                    {dimensionMatchesSomeTag ? (
                      <Star className="h-3.5 w-3.5 text-[var(--warning-text)]" aria-hidden="true" />
                    ) : null}
                    {item.label}
                  </span>
                  <span className="font-semibold text-[var(--text)]">{item.value}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {candidate.recommendReason ? (
          <blockquote className="mt-[12px] rounded-[12px] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-[10px] py-[9px] text-[11px] leading-[1.6] text-[var(--accent-text)]">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em]">
              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
              推荐理由
            </span>
            {candidate.recommendReason}
          </blockquote>
        ) : null}

        {isEliminated && candidate.eliminationReason ? (
          <p className="mt-[10px] text-[10px] text-[var(--text-muted)]">淘汰原因：{candidate.eliminationReason}</p>
        ) : null}

        {candidate.userNotes && !showNotes ? (
          <div className="mt-[10px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-[8px] text-[10px] text-[var(--text-soft)]">
            <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text)] text-[9px] text-white">
              <Check className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
            备注：{candidate.userNotes}
          </div>
        ) : null}

        <div className="mt-[12px] flex gap-[6px]">
          {isEliminated ? (
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-[10px] py-[6px] text-[10px] font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
            >
              恢复候选
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={markWinner}
                disabled={isMock || busy || candidate.status === 'WINNER'}
                className="flex-1 cursor-pointer rounded-[8px] bg-[var(--text)] px-[10px] py-[6px] text-[10px] font-bold text-[var(--surface)] hover:opacity-90 disabled:cursor-not-allowed"
              >
                选定
              </button>
              <button
                type="button"
                onClick={eliminate}
                disabled={isMock || busy || candidate.status === 'ELIMINATED'}
                className="flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] px-[10px] py-[6px] text-[10px] font-medium text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
              >
                淘汰
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            disabled={isMock}
            className="cursor-pointer rounded-[8px] border-[1.5px] border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-[6px] text-[10px] font-medium text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
          >
            备注
          </button>
        </div>
      </article>

      {showNotes ? (
        <div className="mt-[10px] space-y-[10px]">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-[10px] text-[11px] outline-none ring-[var(--accent-border)] focus:ring-2"
            placeholder="记录你的评价和顾虑..."
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={isMock || busy}
            className="cursor-pointer rounded-[8px] border border-[var(--border)] px-[10px] py-[6px] text-[10px] font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
          >
            保存备注
          </button>
        </div>
      ) : null}
    </div>
  );
}
