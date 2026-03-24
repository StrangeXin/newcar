'use client';

import { useEffect, useState } from 'react';
import { patch, post } from '@/lib/api';
import { trackEvent } from '@/lib/behavior';
import { Candidate } from '@/types/api';
import { VehicleCardShell } from '@/components/cars/VehicleCardShell';

interface CandidateCardProps {
  candidate: Candidate;
  onUpdated: () => Promise<unknown>;
}

export function CandidateCard({ candidate, onUpdated }: CandidateCardProps) {
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

  const score = Math.round((candidate.aiMatchScore || 0) * 100);
  const isEliminated = candidate.status === 'ELIMINATED';
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
            icon: 'bg-slate-100',
            bar: 'bg-[linear-gradient(90deg,#94a3b8,#475569)]',
          };
  const seatLabel = seats === 5 ? '五座' : seats === 6 ? '六座' : `${seats}座`;
  const priceLabel = isEliminated ? '超出预算' : '起售价';
  const noteTone = isEliminated
    ? 'border border-dashed border-slate-200 bg-slate-50 text-slate-500'
    : 'bg-sky-50 text-sky-800';

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
      <VehicleCardShell
        iconLabel={candidate.car.brand || candidate.car.model.slice(0, 2)}
        iconBgClassName={brandTheme.icon}
        title={`${candidate.car.brand} ${candidate.car.model}`}
        subtitle={`${candidate.car.fuelType === 'PHEV' ? '增程' : candidate.car.fuelType === 'BEV' ? '纯电' : candidate.car.fuelType} · ${seatLabel} ${candidate.car.type}`}
        rightMeta={(
          <div className="text-right">
            <p className={`text-[14px] font-extrabold ${isEliminated ? 'text-slate-400' : 'text-slate-900'}`}>
              {candidate.car.msrp ? `${(candidate.car.msrp / 10000).toFixed(2)}万` : '暂无'}
            </p>
            <p className="text-[9px] text-slate-400">{priceLabel}</p>
          </div>
        )}
        progressPercent={score}
        progressLabel={`${score}%`}
        progressBarClassName={brandTheme.bar}
        note={
          isEliminated
            ? candidate.eliminationReason || '这款车当前被移出候选。'
            : `备注：${candidate.userNotes || '符合家用通勤需求，值得继续观察。'}`
        }
        noteClassName={noteTone}
        dimmed={isEliminated}
        actions={(
          <>
            {isEliminated ? (
              <button
                type="button"
                onClick={restore}
                disabled={busy}
                className="flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-slate-300 bg-white px-[10px] py-[6px] text-[10px] font-semibold text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed"
              >
                恢复候选
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={markWinner}
                  disabled={isMock || busy || candidate.status === 'WINNER'}
                  className="flex-1 cursor-pointer rounded-[8px] bg-slate-900 px-[10px] py-[6px] text-[10px] font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed"
                >
                  选定
                </button>
                <button
                  type="button"
                  onClick={eliminate}
                  disabled={isMock || busy || candidate.status === 'ELIMINATED'}
                  className="flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-slate-300 bg-white px-[10px] py-[6px] text-[10px] font-medium text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed"
                >
                  淘汰
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              disabled={isMock}
              className="cursor-pointer rounded-[8px] border-[1.5px] border-slate-300 bg-slate-50 px-[10px] py-[6px] text-[10px] font-medium text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed"
            >
              备注
            </button>
          </>
        )}
      />

      {showNotes ? (
        <div className="mt-[10px] space-y-[10px]">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-[8px] border border-slate-300 bg-white px-[10px] py-[10px] text-[11px] outline-none ring-sky-300 focus:ring-2"
            placeholder="记录你的评价和顾虑..."
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={isMock || busy}
            className="cursor-pointer rounded-[8px] border border-slate-300 px-[10px] py-[6px] text-[10px] font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed"
          >
            保存备注
          </button>
        </div>
      ) : null}
    </div>
  );
}
