'use client';

import { Candidate } from '@/types/api';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
  candidates: Candidate[];
  isLoading?: boolean;
  refresh: () => Promise<unknown>;
}

export function CandidateList({ candidates, isLoading, refresh }: CandidateListProps) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-card">
      <h3 className="text-base font-bold">候选车型</h3>
      {isLoading ? <p className="mt-4 text-sm text-black/60">加载中...</p> : null}
      {!isLoading && candidates.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/5 p-3 text-sm text-black/55">暂无候选车型</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} onUpdated={refresh} />
        ))}
      </div>
    </section>
  );
}
