'use client';

import { useCallback, useMemo, useState } from 'react';
import { CarFront, ChevronUp, X } from 'lucide-react';
import { useCandidates } from '@/hooks/useCandidates';
import { useSnapshot } from '@/hooks/useSnapshot';
import { useTimeline } from '@/hooks/useTimeline';
import { JourneyStage } from '@/types/api';
import { CandidateList } from './CandidateList';
import { TimelinePanel } from './TimelinePanel';

interface JourneyWorkspaceProps {
  journeyId: string;
  stage: JourneyStage;
}

export function JourneyWorkspace({ journeyId, stage }: JourneyWorkspaceProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeline = useTimeline(journeyId);
  const snapshot = useSnapshot(journeyId);
  const candidates = useCandidates(journeyId);

  const sortedCandidates = useMemo(() => {
    const list = [...candidates.candidates];
    const statusOrder: Record<string, number> = { WINNER: 0, ACTIVE: 1, ELIMINATED: 2 };
    return list.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 1;
      const sb = statusOrder[b.status] ?? 1;
      if (sa !== sb) return sa - sb;
      if (sa === 1) {
        const ra = (a as { candidateRankScore?: number | null }).candidateRankScore ?? 0;
        const rb = (b as { candidateRankScore?: number | null }).candidateRankScore ?? 0;
        return rb - ra;
      }
      return 0;
    });
  }, [candidates.candidates]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <div data-testid="journey-workspace" className="flex h-full min-h-0 flex-col gap-[10px] overflow-hidden">
      {/* Desktop: side-by-side grid */}
      <div className="hidden min-h-0 flex-1 gap-[10px] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-h-0">
          <TimelinePanel events={timeline.events} snapshot={snapshot.snapshot} isLoading={timeline.isLoading || snapshot.isLoading} />
        </div>
        <div className="min-h-0">
          <CandidateList candidates={sortedCandidates} isLoading={candidates.isLoading} refresh={candidates.refresh} stage={stage} />
        </div>
      </div>

      {/* Mobile: timeline always visible + bottom sheet for candidates */}
      <div className="relative min-h-0 flex-1 lg:hidden">
        <div className="h-full pb-12">
          <TimelinePanel events={timeline.events} snapshot={snapshot.snapshot} isLoading={timeline.isLoading || snapshot.isLoading} />
        </div>

        {/* Bottom handle bar */}
        <button
          type="button"
          onClick={openSheet}
          data-testid="mobile-candidate-handle"
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 rounded-t-[var(--radius-xl)] border border-b-0 border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-workspace"
        >
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.85} aria-hidden="true" />
          <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text)]">
            <CarFront className="mr-1 inline-block h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.85} aria-hidden="true" />
            候选车
          </span>
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[length:var(--text-xs)] font-bold text-white">
            {sortedCandidates.length}
          </span>
        </button>

        {/* Backdrop overlay */}
        {sheetOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={closeSheet}
            aria-hidden="true"
          />
        )}

        {/* Bottom sheet */}
        <div
          data-testid="mobile-candidate-sheet"
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-[var(--radius-2xl)] border-t border-[var(--border)] bg-[var(--surface)] shadow-workspace transition-transform duration-300 ease-in-out ${
            sheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Sheet header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <CarFront className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.85} aria-hidden="true" />
              <span className="text-[length:var(--text-sm)] font-bold text-[var(--text)]">候选车</span>
              <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[length:var(--text-xs)] font-semibold text-[var(--accent-text)]">
                {sortedCandidates.length}
              </span>
            </div>
            <button type="button" onClick={closeSheet} className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]">
              <X className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
              <span className="sr-only">关闭</span>
            </button>
          </div>
          {/* Sheet body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <CandidateList candidates={sortedCandidates} isLoading={candidates.isLoading} refresh={candidates.refresh} stage={stage} />
          </div>
        </div>
      </div>
    </div>
  );
}
