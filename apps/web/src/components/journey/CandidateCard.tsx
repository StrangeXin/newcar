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
    <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-ink">
            {candidate.car.brand} {candidate.car.model}
          </h4>
          <p className="mt-1 text-sm text-black/60">{candidate.car.variant}</p>
        </div>
        <span className="rounded-full border border-black/15 bg-pearl px-2 py-1 text-xs font-semibold">
          {STATUS_LABEL[candidate.status]}
        </span>
      </div>

      <p className="mt-3 text-sm text-black/70">价格：¥{displayPrice.toLocaleString('zh-CN')}</p>
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-xs text-black/60">
          <span>AI 匹配分</span>
          <span>{score}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/10">
          <div className="h-2 rounded-full bg-pine transition-all" style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={eliminate}
          disabled={busy || candidate.status === 'ELIMINATED'}
          className="rounded-lg border border-black/20 px-3 py-1.5 text-xs font-semibold"
        >
          淘汰
        </button>
        <button
          type="button"
          onClick={markWinner}
          disabled={busy || candidate.status === 'WINNER'}
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
        >
          选定
        </button>
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="rounded-lg border border-dashed border-black/30 px-3 py-1.5 text-xs font-semibold"
        >
          {showNotes ? '收起备注' : '编辑备注'}
        </button>
      </div>

      {showNotes ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-ember/30 focus:ring-2"
            placeholder="记录你的评价和顾虑..."
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={busy}
            className="rounded-lg border border-black/20 px-3 py-1.5 text-xs font-semibold"
          >
            保存备注
          </button>
        </div>
      ) : null}
    </article>
  );
}
