'use client';

import { CommunityJourney } from '@/types/api';
import { JourneyFeedCard } from './JourneyFeedCard';

interface JourneyFeedListProps {
  items: CommunityJourney[];
  isLoading: boolean;
}

export function JourneyFeedList({ items, isLoading }: JourneyFeedListProps) {
  if (isLoading) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow-card)]">
        社区内容加载中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow-card)]">
        暂无社区内容，稍后再来看看。
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <JourneyFeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
