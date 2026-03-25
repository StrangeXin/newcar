'use client';

import { useMemo, useState } from 'react';
import { Columns2, ListTree } from 'lucide-react';
import { useCandidates } from '@/hooks/useCandidates';
import { useSnapshot } from '@/hooks/useSnapshot';
import { useTimeline } from '@/hooks/useTimeline';
import { CandidateList } from './CandidateList';
import { TimelinePanel } from './TimelinePanel';

interface JourneyWorkspaceProps {
  journeyId: string;
}

export function JourneyWorkspace({ journeyId }: JourneyWorkspaceProps) {
  const [mobilePane, setMobilePane] = useState<'timeline' | 'candidates'>('timeline');
  const timeline = useTimeline(journeyId);
  const snapshot = useSnapshot(journeyId);
  const candidates = useCandidates(journeyId);

  const sortedCandidates = useMemo(() => candidates.candidates, [candidates.candidates]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[10px] overflow-hidden">
      <div className="flex items-center justify-between rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-workspace md:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent-text)]">Workspace</p>
          <p className="text-[12px] font-semibold text-[var(--text)]">时间线与候选车联动更新</p>
        </div>
        <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
          <button
            type="button"
            onClick={() => setMobilePane('timeline')}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${mobilePane === 'timeline' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-soft)]'}`}
          >
            <span className="inline-flex items-center gap-1">
              <ListTree className="h-3 w-3" aria-hidden="true" />
              时间线
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('candidates')}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${mobilePane === 'candidates' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-soft)]'}`}
          >
            <span className="inline-flex items-center gap-1">
              <Columns2 className="h-3 w-3" aria-hidden="true" />
              候选车
            </span>
          </button>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 gap-[10px] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-h-0">
          <TimelinePanel events={timeline.events} snapshot={snapshot.snapshot} isLoading={timeline.isLoading || snapshot.isLoading} />
        </div>
        <div className="min-h-0">
          <CandidateList candidates={sortedCandidates} isLoading={candidates.isLoading} refresh={candidates.refresh} />
        </div>
      </div>

      <div className="min-h-0 flex-1 lg:hidden">
        {mobilePane === 'timeline' ? (
          <TimelinePanel events={timeline.events} snapshot={snapshot.snapshot} isLoading={timeline.isLoading || snapshot.isLoading} />
        ) : (
          <CandidateList candidates={sortedCandidates} isLoading={candidates.isLoading} refresh={candidates.refresh} />
        )}
      </div>
    </div>
  );
}
