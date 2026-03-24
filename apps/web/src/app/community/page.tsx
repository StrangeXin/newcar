'use client';

import { Suspense, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FeedFilterState, FeedFilters } from '@/components/community/FeedFilters';
import { JourneyFeedList } from '@/components/community/JourneyFeedList';
import { useCommunity } from '@/hooks/useCommunity';
import { PageHeader } from '@/components/ui/PageHeader';

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
      <header
        className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
        style={{ background: 'var(--bg-gradient), var(--surface)' }}
      >
        <PageHeader
          label="Community"
          title={<><Sparkles className="inline h-5 w-5 text-[var(--accent)]" aria-hidden="true" /> 社区广场</>}
          description="浏览真实购车历程，并从模板快速开始你的旅程。"
        />
      </header>

      <FeedFilters value={value} onChange={onFilterChange} />
      <JourneyFeedList items={items} isLoading={isLoading} />
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6 text-sm text-[var(--text-muted)]">加载中...</main>}>
      <CommunityPageContent />
    </Suspense>
  );
}
