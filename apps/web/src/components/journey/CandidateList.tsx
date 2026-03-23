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
    <section className="rounded-[16px] border border-black/10 bg-white/90 p-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] xl:px-4 xl:py-[14px]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-extrabold text-[#111]">候选车型</h3>
        <span className="rounded-full bg-[#f3f4f6] px-2 py-[2px] text-[10px] font-semibold text-black/50">{candidates.length} 辆</span>
      </div>
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
