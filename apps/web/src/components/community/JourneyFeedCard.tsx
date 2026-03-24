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
  const budgetText =
    typeof tags.budgetMin === 'number' && typeof tags.budgetMax === 'number'
      ? `${tags.budgetMin}-${tags.budgetMax}万`
      : '预算未标注';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">{item.user?.nickname || '匿名用户'}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
          {item.journey?.status === 'COMPLETED' ? <CircleDollarSign className="h-3 w-3" aria-hidden="true" /> : <Clock3 className="h-3 w-3" aria-hidden="true" />}
          {item.journey?.status === 'COMPLETED' ? '已购车' : '进行中'}
        </span>
      </div>

      {item.description ? <p className="mt-3 text-sm text-slate-600">{item.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
          <CircleDollarSign className="h-3 w-3" aria-hidden="true" />
          {budgetText}
        </span>
        {useCases.slice(0, 3).map((useCase) => (
          <span key={useCase} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
            <Route className="h-3 w-3" aria-hidden="true" />
            {useCase}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{item.likeCount}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden="true" />{item.commentCount}</span>
          <span className="inline-flex items-center gap-1"><GitFork className="h-3 w-3" aria-hidden="true" />{item.forkCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/community/${item.id}`}
            className="text-xs font-semibold text-sky-700 underline-offset-2 hover:text-sky-800 hover:underline"
          >
            查看详情
          </Link>
          {item.publishedFormats.includes('template') ? <ForkButton publishedJourneyId={item.id} /> : null}
        </div>
      </div>
    </article>
  );
}
