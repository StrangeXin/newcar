'use client';

import Link from 'next/link';
import { CircleDollarSign, Clock3, GitFork, Heart, MessageCircle, Route } from 'lucide-react';
import { CommunityJourney } from '@/types/api';
import { ForkButton } from './ForkButton';

interface JourneyFeedCardProps {
  item: CommunityJourney;
}

export function JourneyFeedCard({ item }: JourneyFeedCardProps) {
  const tags = (item.tags || {}) as Record<string, unknown>;
  const useCases = Array.isArray(tags.useCases) ? tags.useCases.map(String) : [];
  const candidateNames = Array.isArray(tags.candidateNames) ? tags.candidateNames.map(String).slice(0, 3) : [];
  const budgetText =
    typeof tags.budgetMin === 'number' && typeof tags.budgetMax === 'number'
      ? `${tags.budgetMin}-${tags.budgetMax}万`
      : '预算未标注';

  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--text)]">{item.title}</p>
          <p className="text-xs text-[var(--text-muted)]">{item.user?.nickname || '匿名用户'}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-soft)]">
          {item.journey?.status === 'COMPLETED' ? <CircleDollarSign className="h-3 w-3" aria-hidden="true" /> : <Clock3 className="h-3 w-3" aria-hidden="true" />}
          {item.journey?.status === 'COMPLETED' ? '已购车' : '进行中'}
        </span>
      </div>

      {candidateNames.length > 0 ? (
        <p className="mt-3 text-sm font-semibold text-[var(--text)]">{candidateNames.join('  vs  ')}</p>
      ) : null}

      {item.publishSummary ? (
        <p className="mt-3 rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-3 text-sm leading-6 text-[var(--accent-text)]">
          "{item.publishSummary}"
        </p>
      ) : item.description ? (
        <p className="mt-3 text-sm text-[var(--text-soft)]">{item.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-soft)]">
          <CircleDollarSign className="h-3 w-3" aria-hidden="true" />
          {budgetText}
        </span>
        {useCases.slice(0, 3).map((useCase) => (
          <span key={useCase} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-soft)]">
            <Route className="h-3 w-3" aria-hidden="true" />
            {useCase}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{item.likeCount}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden="true" />{item.commentCount}</span>
          <span className="inline-flex items-center gap-1"><GitFork className="h-3 w-3" aria-hidden="true" />{item.forkCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/community/${item.id}`}
            className="text-xs font-semibold text-[var(--accent)] underline-offset-2 hover:text-[var(--accent-hover)] hover:underline"
          >
            查看详情
          </Link>
          {item.publishedFormats.includes('template') ? <ForkButton publishedJourneyId={item.id} /> : null}
        </div>
      </div>
    </article>
  );
}
