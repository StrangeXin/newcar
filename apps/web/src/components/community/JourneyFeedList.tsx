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
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-500 shadow-card">
        社区内容加载中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-500 shadow-card">
        暂无社区内容，稍后再来看看。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <JourneyFeedCard key={item.id} item={item} />
      ))}
    </div>
  );
}
