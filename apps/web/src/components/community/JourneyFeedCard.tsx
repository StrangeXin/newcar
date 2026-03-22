'use client';

import Link from 'next/link';
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
    <article className="rounded-2xl border border-black/10 bg-white/90 p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-black/60">{item.user?.nickname || '匿名用户'}</p>
        </div>
        <span className="rounded-full bg-black/5 px-2 py-1 text-xs text-black/65">
          {item.journey?.status === 'COMPLETED' ? '已购车' : '进行中'}
        </span>
      </div>

      {item.description ? <p className="mt-3 text-sm text-black/70">{item.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/15 px-2 py-1 text-xs">{budgetText}</span>
        {useCases.slice(0, 3).map((useCase) => (
          <span key={useCase} className="rounded-full border border-black/15 px-2 py-1 text-xs">
            {useCase}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-black/60">
          👍 {item.likeCount} · 💬 {item.commentCount} · 🔀 {item.forkCount}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/community/${item.id}`} className="text-xs font-semibold text-ink underline-offset-2 hover:underline">
            查看详情
          </Link>
          {item.publishedFormats.includes('template') ? <ForkButton publishedJourneyId={item.id} /> : null}
        </div>
      </div>
    </article>
  );
}
