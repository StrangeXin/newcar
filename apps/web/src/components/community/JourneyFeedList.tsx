'use client';

import { useEffect, useRef } from 'react';
import { CommunityJourney } from '@/types/api';
import { JourneyFeedCard } from './JourneyFeedCard';

interface JourneyFeedListProps {
  items: CommunityJourney[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function JourneyFeedList({ items, isLoading, isLoadingMore, hasMore, onLoadMore }: JourneyFeedListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    }, { rootMargin: '240px 0px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, items.length]);

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
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <JourneyFeedCard key={item.id} item={item} />
        ))}
      </div>
      {hasMore ? <div ref={sentinelRef} className="h-6 w-full" /> : null}
      {isLoadingMore ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)] shadow-[var(--shadow-card)]">
          正在加载更多社区内容...
        </div>
      ) : null}
    </div>
  );
}
