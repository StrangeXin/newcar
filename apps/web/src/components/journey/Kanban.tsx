'use client';

import dynamic from 'next/dynamic';
import { useCandidates } from '@/hooks/useCandidates';
import { AiSummary } from './AiSummary';
import { CandidateList } from './CandidateList';
import { TodayUpdates } from './TodayUpdates';

const ComparisonMatrix = dynamic(
  () => import('./ComparisonMatrix').then((mod) => mod.ComparisonMatrix),
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-48 bg-gray-100 rounded-lg" />,
  }
);

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
      <ComparisonMatrix candidates={candidates} />
    </div>
  );
}
