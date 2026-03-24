'use client';

import { Candidate } from '@/types/api';
import { CandidateCard } from './CandidateCard';
import { mockCandidates } from './workspace-mock-data';

interface CandidateListProps {
  candidates: Candidate[];
  isLoading?: boolean;
  refresh: () => Promise<unknown>;
}

export function CandidateList({ candidates, isLoading, refresh }: CandidateListProps) {
  const displayCandidates = candidates.length > 0 ? candidates : mockCandidates;

  return (
    <section
      data-testid="candidate-list"
      className="flex h-full min-h-0 flex-col rounded-ws-lg border border-slate-200 bg-white/90 p-ws14 shadow-workspace"
    >
      <div className="flex min-h-[28px] items-center justify-between gap-[10px]">
        <h3 className="text-[13px] font-extrabold text-slate-900">候选车型</h3>
        <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-[10px] py-1 text-[10px] font-semibold leading-[1.2] text-slate-500">
          {displayCandidates.length} 辆
        </span>
      </div>
      {isLoading ? <p className="mt-4 text-[11px] text-slate-500">加载中...</p> : null}
      <div className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto pr-1">
        {displayCandidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} onUpdated={refresh} />
        ))}
      </div>
    </section>
  );
}
