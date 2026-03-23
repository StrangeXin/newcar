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
    <div className="grid gap-3 xl:gap-4">
      <TodayUpdates />
      <AiSummary journeyId={journeyId} />
      <CandidateList candidates={candidates} isLoading={isLoading} refresh={refresh} />
    </div>
  );
}
