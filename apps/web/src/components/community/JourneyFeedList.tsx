'use client';

import { CommunityJourney } from '@/types/api';
import { JourneyFeedCard } from './JourneyFeedCard';

interface JourneyFeedListProps {
  items: CommunityJourney[];
  isLoading: boolean;
}

export function JourneyFeedList({ items, isLoading }: JourneyFeedListProps) {
  if (isLoading) {
    return <p className="text-sm text-black/60">社区内容加载中...</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-black/60">暂无社区内容，稍后再来看看。</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <JourneyFeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
