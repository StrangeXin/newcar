'use client';

import { useEffect, useState } from 'react';
import { patch, post } from '@/lib/api';
import { trackEvent } from '@/lib/behavior';
import { Candidate } from '@/types/api';

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
          icon: 'bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]',
          bar: 'bg-[linear-gradient(90deg,#6366f1,#8b5cf6)]',
          score: 'text-[#6366f1]',
        }
      : candidate.car.brand.includes('小鹏')
        ? {
            icon: 'bg-[linear-gradient(135deg,#d1fae5,#6ee7b7)]',
            bar: 'bg-[linear-gradient(90deg,#10b981,#059669)]',
            score: 'text-[#10b981]',
          }
        : {
            icon: 'bg-[#f3f4f6]',
            bar: 'bg-[linear-gradient(90deg,#9ca3af,#6b7280)]',
            score: 'text-[#9ca3af]',
          };
  const seatLabel = seats === 5 ? '五座' : seats === 6 ? '六座' : `${seats}座`;
  const priceLabel = isEliminated ? '超出预算' : '起售价';
  const noteTone = isEliminated ? 'bg-[#f9fafb] text-[#6b7280] border border-dashed border-[#e5e7eb]' : 'bg-[#f5f3ff] text-[#7c3aed]';

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
    <article
      data-testid="candidate-card"
      data-candidate-name={`${candidate.car.brand} ${candidate.car.model}`}
      className={`rounded-[10px] border-[1.5px] border-[#f0f0f0] bg-white px-[14px] py-[14px] shadow-[0_1px_6px_rgba(0,0,0,0.07)] transition ${isEliminated ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-[10px]">
        <div className="flex items-start gap-[10px]">
          <div className={`flex h-[34px] w-[46px] items-center justify-center rounded-[8px] text-[20px] text-white ${brandTheme.icon}`}>
            🚗
          </div>
          <div>
            <h4 className={`text-[12px] font-bold text-ink ${isEliminated ? 'line-through text-[#9ca3af]' : ''}`}>
              {candidate.car.brand} {candidate.car.model}
            </h4>
            <p className="mt-0.5 text-[10px] text-[#6b7280]">
              {candidate.car.fuelType === 'PHEV' ? '增程' : candidate.car.fuelType === 'BEV' ? '纯电' : candidate.car.fuelType} · {seatLabel} {candidate.car.type}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-[14px] font-extrabold ${isEliminated ? 'text-[#9ca3af]' : 'text-[#111]'}`}>{candidate.car.msrp ? `${(candidate.car.msrp / 10000).toFixed(2)}万` : '暂无'}</p>
          <p className="text-[9px] text-[#9ca3af]">{priceLabel}</p>
        </div>
      </div>

      <div className="mt-[10px]">
        <div className="mb-1 flex items-center justify-between text-[9px] text-black/60">
          <span className="font-bold uppercase tracking-[0.05em] text-[#6b7280]">AI 匹配度</span>
          <span className={`text-[11px] font-extrabold ${brandTheme.score}`}>{score}%</span>
        </div>
        <div className="h-[3px] rounded-full bg-[#e5e7eb]">
          <div className={`h-[3px] rounded-full transition-all ${brandTheme.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className={`mt-[10px] rounded-[8px] px-[10px] py-[6px] text-[10px] leading-[1.5] ${noteTone}`}>
        {isEliminated
          ? candidate.eliminationReason || '这款车当前被移出候选。'
          : `💡 ${candidate.userNotes || '符合家用通勤需求，值得继续观察。'}`}
      </div>

      <div className="mt-[10px] flex gap-[6px]">
        {isEliminated ? (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="flex-1 rounded-[8px] border-[1.5px] border-[#e5e7eb] bg-white px-[10px] py-[6px] text-[10px] font-semibold text-[#6b7280]"
          >
            恢复候选
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={markWinner}
              disabled={isMock || busy || candidate.status === 'WINNER'}
              className="flex-1 rounded-[8px] bg-[#111] px-[10px] py-[6px] text-[10px] font-bold text-white"
            >
              选定
            </button>
            <button
              type="button"
              onClick={eliminate}
              disabled={isMock || busy || candidate.status === 'ELIMINATED'}
              className="flex-1 rounded-[8px] border-[1.5px] border-[#e5e7eb] bg-white px-[10px] py-[6px] text-[10px] font-medium text-[#6b7280]"
            >
              淘汰
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          disabled={isMock}
          className="rounded-[8px] border-[1.5px] border-[#e5e7eb] bg-[#f9fafb] px-[10px] py-[6px] text-[10px] font-medium text-[#374151]"
        >
          ✏️
        </button>
      </div>

      {showNotes ? (
        <div className="mt-[10px] space-y-[10px]">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-[8px] border border-black/15 bg-white px-[10px] py-[10px] text-[11px] outline-none ring-ember/30 focus:ring-2"
            placeholder="记录你的评价和顾虑..."
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={isMock || busy}
            className="rounded-[8px] border border-black/20 px-[10px] py-[6px] text-[10px] font-semibold"
          >
            保存备注
          </button>
        </div>
      ) : null}
    </article>
  );
}
