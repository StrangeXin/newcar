'use client';

import { useEffect, useState } from 'react';
import { patch, post } from '@/lib/api';
import { trackEvent } from '@/lib/behavior';
import { Candidate } from '@/types/api';

interface CandidateCardProps {
  candidate: Candidate;
  onUpdated: () => Promise<unknown>;
}

const STATUS_LABEL: Record<Candidate['status'], string> = {
  ACTIVE: '活跃',
  ELIMINATED: '已淘汰',
  WINNER: '已选定',
};

export function CandidateCard({ candidate, onUpdated }: CandidateCardProps) {
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(candidate.userNotes || '');

  async function eliminate() {
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
    try {
      setBusy(true);
      await post(`/journeys/${candidate.journeyId}/candidates/${candidate.id}/winner`, {});
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    try {
      setBusy(true);
      await patch(`/journeys/${candidate.journeyId}/candidates/${candidate.id}/notes`, { notes });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  const score = Math.round((candidate.aiMatchScore || 0) * 100);
  const displayPrice = candidate.priceAtAdd || candidate.car.msrp || 0;
  const isEliminated = candidate.status === 'ELIMINATED';
  const seats =
    candidate.car.baseSpecs &&
    typeof candidate.car.baseSpecs === 'object' &&
    !Array.isArray(candidate.car.baseSpecs) &&
    'seats' in candidate.car.baseSpecs
      ? Number((candidate.car.baseSpecs as Record<string, unknown>).seats || 5)
      : 5;

  useEffect(() => {
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
  }, [candidate.carId, candidate.journeyId]);

  return (
    <article
      data-testid="candidate-card"
      data-candidate-name={`${candidate.car.brand} ${candidate.car.model}`}
      className={`rounded-[12px] border-[1.5px] border-[#f0f0f0] bg-white px-[14px] py-3 shadow-[0_1px_6px_rgba(0,0,0,0.07)] transition ${isEliminated ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-[34px] w-[46px] items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,#dbeafe,#93c5fd)] text-[20px] text-white">
            🚗
          </div>
          <div>
            <h4 className={`text-[12px] font-bold text-ink ${isEliminated ? 'line-through' : ''}`}>
              {candidate.car.brand} {candidate.car.model}
            </h4>
            <p className="mt-0.5 text-[10px] text-[#6b7280]">
              {candidate.car.fuelType === 'PHEV' ? '增程' : candidate.car.fuelType} · {seats}座 {candidate.car.type}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-extrabold text-[#111]">{candidate.car.msrp ? `${(candidate.car.msrp / 10000).toFixed(2)}万` : '暂无'}</p>
          <p className="text-[9px] text-[#9ca3af]">起售价</p>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-[3px] flex items-center justify-between text-[9px] text-black/60">
          <span className="font-bold uppercase tracking-[0.05em] text-[#6b7280]">AI 匹配度</span>
          <span className="text-[11px] font-extrabold text-[#6366f1]">{score}%</span>
        </div>
        <div className="h-[3px] rounded-full bg-[#e5e7eb]">
          <div className="h-[3px] rounded-full bg-[linear-gradient(90deg,#6366f1,#8b5cf6)] transition-all" style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="mt-[7px] rounded-[7px] bg-[#f5f3ff] px-[9px] py-[5px] text-[10px] leading-[1.5] text-[#7c3aed]">
        {isEliminated
          ? candidate.eliminationReason || '这款车当前被移出候选。'
          : candidate.userNotes || 'AI 认为它和你的当前需求匹配度较高，值得继续观察。'}
      </div>

      <div className="mt-2 flex gap-[5px]">
        {isEliminated ? (
          <button
            type="button"
            onClick={restore}
            disabled={busy}
            className="flex-1 rounded-[7px] border-[1.5px] border-[#e5e7eb] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#6b7280]"
          >
            恢复候选
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={markWinner}
              disabled={busy || candidate.status === 'WINNER'}
              className="flex-1 rounded-[7px] bg-[#111] px-3 py-1.5 text-[10px] font-bold text-white"
            >
              选定
            </button>
            <button
              type="button"
              onClick={eliminate}
              disabled={busy || candidate.status === 'ELIMINATED'}
              className="flex-1 rounded-[7px] border-[1.5px] border-[#e5e7eb] bg-white px-3 py-1.5 text-[10px] font-medium text-[#6b7280]"
            >
              淘汰
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="rounded-[7px] border-[1.5px] border-[#e5e7eb] bg-[#f9fafb] px-[9px] py-1.5 text-[10px] font-medium text-[#374151]"
        >
          ✏️
        </button>
      </div>

      {showNotes ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-[7px] border border-black/15 bg-white px-3 py-2 text-[11px] outline-none ring-ember/30 focus:ring-2"
            placeholder="记录你的评价和顾虑..."
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={busy}
            className="rounded-[7px] border border-black/20 px-3 py-1.5 text-[10px] font-semibold"
          >
            保存备注
          </button>
        </div>
      ) : null}
    </article>
  );
}
