'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, MessageSquare, Sparkles, Trophy } from 'lucide-react';
import { Candidate, JourneyStage } from '@/types/api';
import { CandidateCard } from './CandidateCard';
import { ComparisonMatrix } from './ComparisonMatrix';
import { mockCandidates } from './workspace-mock-data';

interface CandidateListProps {
  candidates: Candidate[];
  isLoading?: boolean;
  refresh: () => Promise<unknown>;
  stage?: JourneyStage;
}

export function CandidateList({ candidates, isLoading, refresh, stage = 'AWARENESS' }: CandidateListProps) {
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
  const winner = useMemo(
    () => displayCandidates.find((candidate) => candidate.status === 'WINNER'),
    [displayCandidates]
  );

  const showAwarenessGuide = stage === 'AWARENESS' && activeOrWinner.length === 0 && !isLoading;
  const showComparisonProminent = stage === 'COMPARISON';
  const showDecisionNarrow = stage === 'DECISION' && activeOrWinner.length > 3;
  const showPurchaseWinner = stage === 'PURCHASE' && winner;

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

      {/* AWARENESS stage: friendly guidance when no candidates yet */}
      {showAwarenessGuide ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[var(--accent-border)] bg-[var(--accent-muted)] px-5 py-8 text-center">
          <MessageSquare className="h-8 w-8 text-[var(--accent-text)]" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-[var(--text)]">开始和 AI 聊聊你的需求吧</p>
          <p className="text-[11px] leading-[1.6] text-[var(--text-muted)]">
            候选车会自动出现在这里，AI 会根据你的偏好逐步推荐合适的车型。
          </p>
        </div>
      ) : null}

      {/* PURCHASE stage: highlight the winner at the top */}
      {showPurchaseWinner ? (
        <div className="mt-3 rounded-[14px] border-2 border-[var(--success-border)] bg-[var(--success-muted)] px-4 py-3">
          <p className="flex items-center gap-2 text-[12px] font-bold text-[var(--success-text)]">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            恭喜做出了最终选择！
          </p>
          <p className="mt-1 text-[14px] font-extrabold text-[var(--text)]">
            {winner.car.brand} {winner.car.model}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            接下来可以关注优惠信息和购买渠道，AI 会继续为你提供购买指导。
          </p>
        </div>
      ) : null}

      {/* DECISION stage: suggest narrowing down */}
      {showDecisionNarrow ? (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-[var(--warning-border)] bg-[var(--warning-muted)] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-text)]" aria-hidden="true" />
          <p className="text-[11px] leading-[1.6] text-[var(--warning-text)]">
            当前还有 {activeOrWinner.length} 款候选车，建议缩小到 2-3 款再做最终决定。
          </p>
        </div>
      ) : null}

      <div className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto pr-1">
        {/* COMPARISON stage: show comparison matrix prominently */}
        {showComparisonProminent && activeOrWinner.length >= 2 ? (
          <div className="rounded-[16px] border-2 border-[var(--accent-border)] p-0.5">
            <ComparisonMatrix candidates={activeOrWinner} />
          </div>
        ) : activeOrWinner.length >= 2 ? (
          <ComparisonMatrix candidates={activeOrWinner} />
        ) : null}
        {activeOrWinner.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onUpdated={refresh}
            emphasizeTags={stage === 'CONSIDERATION'}
          />
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
