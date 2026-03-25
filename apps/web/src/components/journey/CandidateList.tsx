'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Candidate } from '@/types/api';
import { CandidateCard } from './CandidateCard';
import { ComparisonMatrix } from './ComparisonMatrix';
import { mockCandidates } from './workspace-mock-data';

interface CandidateListProps {
  candidates: Candidate[];
  isLoading?: boolean;
  refresh: () => Promise<unknown>;
}

export function CandidateList({ candidates, isLoading, refresh }: CandidateListProps) {
  const displayCandidates = candidates.length > 0 ? candidates : mockCandidates;
  const [showEliminated, setShowEliminated] = useState(false);
  const activeOrWinner = useMemo(
    () => displayCandidates.filter((candidate) => candidate.status !== 'ELIMINATED'),
    [displayCandidates]
  );
  const eliminated = useMemo(
    () => displayCandidates.filter((candidate) => candidate.status === 'ELIMINATED'),
    [displayCandidates]
  );

  return (
    <section
      data-testid="candidate-list"
      className="flex h-full min-h-0 flex-col rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-ws14 shadow-workspace"
    >
      <div className="flex min-h-[28px] items-center justify-between gap-[10px]">
        <h3 className="text-[13px] font-extrabold text-[var(--text)]">候选车型</h3>
        <span className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-1 text-[10px] font-semibold leading-[1.2] text-[var(--text-muted)]">
          {displayCandidates.length} 辆
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-[1.6] text-[var(--text-muted)]">
        候选车会根据最终选择、实时关注度和 AI 匹配度自动排序，重点展示你最在意的维度。
      </p>
      {isLoading ? <p className="mt-4 text-[11px] text-[var(--text-muted)]">加载中...</p> : null}
      <div className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto pr-1">
        {activeOrWinner.length >= 2 ? <ComparisonMatrix candidates={activeOrWinner} /> : null}
        {activeOrWinner.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} onUpdated={refresh} />
        ))}
        {eliminated.length > 0 ? (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
            <button
              type="button"
              onClick={() => setShowEliminated((value) => !value)}
              className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-[var(--text-soft)]"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                已淘汰车型
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                {eliminated.length} 辆
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showEliminated ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
            {showEliminated ? (
              <div className="mt-3 space-y-[10px]">
                {eliminated.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onUpdated={refresh} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
