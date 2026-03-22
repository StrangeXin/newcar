'use client';

import { useCandidates } from '@/hooks/useCandidates';
import { AiSummary } from './AiSummary';
import { CandidateList } from './CandidateList';
import { ComparisonMatrix } from './ComparisonMatrix';
import { TodayUpdates } from './TodayUpdates';

interface KanbanProps {
  journeyId: string;
}

export function Kanban({ journeyId }: KanbanProps) {
  const { candidates, isLoading, refresh } = useCandidates(journeyId);

  return (
    <div className="space-y-4">
      <TodayUpdates />
      <AiSummary journeyId={journeyId} />
      <CandidateList candidates={candidates} isLoading={isLoading} refresh={refresh} />
      <ComparisonMatrix candidates={candidates} />
    </div>
  );
}
