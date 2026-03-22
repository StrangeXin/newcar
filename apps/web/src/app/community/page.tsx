'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FeedFilterState, FeedFilters } from '@/components/community/FeedFilters';
import { JourneyFeedList } from '@/components/community/JourneyFeedList';
import { useCommunity } from '@/hooks/useCommunity';

function CommunityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { items, isLoading } = useCommunity(queryString);

  const value = useMemo<FeedFilterState>(
    () => ({
      fuel_type: searchParams.get('fuel_type') || undefined,
      result: searchParams.get('result') || undefined,
      has_template: searchParams.get('has_template') || undefined,
      sort: searchParams.get('sort') || 'relevance',
    }),
    [searchParams]
  );

  const onFilterChange = (next: FeedFilterState) => {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, val]) => {
      if (val) {
        params.set(key, val);
      }
    });
    router.push(`/community${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-4 px-4 py-5">
      <header>
        <h1 className="text-2xl font-bold">社区广场</h1>
        <p className="mt-1 text-sm text-black/60">浏览真实购车历程，并从模板快速开始你的旅程。</p>
      </header>

      <FeedFilters value={value} onChange={onFilterChange} />
      <JourneyFeedList items={items} isLoading={isLoading} />
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-5 text-sm text-black/60">加载中...</main>}>
      <CommunityPageContent />
    </Suspense>
  );
}
