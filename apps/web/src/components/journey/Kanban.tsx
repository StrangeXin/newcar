'use client';
import { useCandidates } from '@/hooks/useCandidates';
import { AiSummary } from './AiSummary';
import { CandidateList } from './CandidateList';
import { TodayUpdates } from './TodayUpdates';

interface KanbanProps {
  journeyId: string;
}

export function Kanban({ journeyId }: KanbanProps) {
  const { candidates, isLoading, refresh } = useCandidates(journeyId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-[10px] overflow-hidden">
      <div className="shrink-0">
        <TodayUpdates />
      </div>
      <div className="shrink-0">
        <AiSummary journeyId={journeyId} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <CandidateList candidates={candidates} isLoading={isLoading} refresh={refresh} />
      </div>
    </div>
  );
}
