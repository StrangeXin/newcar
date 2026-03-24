'use client';

import { Suspense, useMemo } from 'react';
import { Compass, Sparkles } from 'lucide-react';
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
      budget_range: searchParams.get('budget_range') || undefined,
      use_case: searchParams.get('use_case') || undefined,
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
    const budgetRange = next.budget_range;
    if (budgetRange) {
      const [min, max] = budgetRange.split('-');
      params.set('budget_min', min);
      params.set('budget_max', max);
    }
    if (next.use_case) {
      params.set('use_cases', next.use_case);
    }
    router.push(`/community${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-4 px-4 py-6">
      <header className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-card">
        <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Community
        </p>
        <h1 className="mt-2 inline-flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <Sparkles className="h-5 w-5 text-orange-600" aria-hidden="true" />
          社区广场
        </h1>
        <p className="mt-1 text-sm text-slate-600">浏览真实购车历程，并从模板快速开始你的旅程。</p>
      </header>

      <FeedFilters value={value} onChange={onFilterChange} />
      <JourneyFeedList items={items} isLoading={isLoading} />
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">加载中...</main>}>
      <CommunityPageContent />
    </Suspense>
  );
}
