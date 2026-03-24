'use client';

import { Suspense, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FeedFilterState, FeedFilters } from '@/components/community/FeedFilters';
import { JourneyFeedList } from '@/components/community/JourneyFeedList';
import { useCommunity } from '@/hooks/useCommunity';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommunityJourney } from '@/types/api';

const MOCK_JOURNEYS: CommunityJourney[] = [
  {
    id: 'mock-1',
    journeyId: 'j1',
    title: '家用 SUV 选购之路：从迷茫到提车理想 L6',
    description: '预算25万，从完全不懂车到最终选定理想L6的完整过程。对比了问界M7、小鹏G6，最终因增程无续航焦虑而选择理想。',
    publishedFormats: ['story', 'template'],
    tags: { budgetMin: 20, budgetMax: 28, useCases: ['家用', '通勤'] },
    visibility: 'PUBLIC',
    viewCount: 1842,
    likeCount: 256,
    commentCount: 43,
    forkCount: 89,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-20T10:00:00Z',
    user: { id: 'u1', nickname: '老张选车记' },
    journey: { id: 'j1', status: 'COMPLETED', stage: 'PURCHASE' },
  },
  {
    id: 'mock-2',
    journeyId: 'j2',
    title: '新手妈妈的第一台车：安全是唯一标准',
    description: '宝宝刚出生，需要一台安全性拉满的车。从沃尔沃XC60到极氪007，AI帮我从C-NCAP和E-NCAP数据中找到了答案。',
    publishedFormats: ['story'],
    tags: { budgetMin: 25, budgetMax: 35, useCases: ['家用', '安全'] },
    visibility: 'PUBLIC',
    viewCount: 923,
    likeCount: 178,
    commentCount: 31,
    forkCount: 24,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-19T14:30:00Z',
    user: { id: 'u2', nickname: '小鱼妈妈' },
    journey: { id: 'j2', status: 'COMPLETED', stage: 'PURCHASE' },
  },
  {
    id: 'mock-3',
    journeyId: 'j3',
    title: '30万预算越野车深度对比：坦克300 vs 方程豹豹5',
    description: '周末喜欢去户外，需要有一定越野能力但日常通勤也舒适的车型。',
    publishedFormats: ['report', 'template'],
    tags: { budgetMin: 25, budgetMax: 35, useCases: ['越野', '通勤'] },
    visibility: 'PUBLIC',
    viewCount: 2105,
    likeCount: 312,
    commentCount: 67,
    forkCount: 156,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-18T09:15:00Z',
    user: { id: 'u3', nickname: '野路子' },
    journey: { id: 'j3', status: 'ACTIVE', stage: 'COMPARISON' },
  },
  {
    id: 'mock-4',
    journeyId: 'j4',
    title: '纯电通勤之选：比亚迪海豹 vs 特斯拉 Model 3',
    description: '每天通勤60km，家里有充电桩，纯电是最优解。但选国产还是特斯拉？AI从使用成本、保值率、智驾体验三个维度帮我分析。',
    publishedFormats: ['story'],
    tags: { budgetMin: 18, budgetMax: 25, useCases: ['通勤'] },
    visibility: 'PUBLIC',
    viewCount: 1567,
    likeCount: 203,
    commentCount: 52,
    forkCount: 45,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-17T16:45:00Z',
    user: { id: 'u4', nickname: '电动老司机' },
    journey: { id: 'j4', status: 'COMPLETED', stage: 'PURCHASE' },
  },
  {
    id: 'mock-5',
    journeyId: 'j5',
    title: '人生第一台车：10万预算怎么选？',
    description: '刚毕业的打工人，预算有限但不想将就。从秦PLUS到缤果，每一分钱都要花在刀刃上。',
    publishedFormats: ['story', 'template'],
    tags: { budgetMin: 8, budgetMax: 12, useCases: ['通勤', '日常'] },
    visibility: 'PUBLIC',
    viewCount: 3201,
    likeCount: 489,
    commentCount: 112,
    forkCount: 267,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-16T11:20:00Z',
    user: { id: 'u5', nickname: '省钱达人' },
    journey: { id: 'j5', status: 'COMPLETED', stage: 'PURCHASE' },
  },
  {
    id: 'mock-6',
    journeyId: 'j6',
    title: '商务座驾升级：从帕萨特到蔚来 ET7',
    description: '做业务需要有面子的车，从传统BBA到新势力，AI帮我算了一笔账：ET7的BaaS方案让月供降了40%。',
    publishedFormats: ['report'],
    tags: { budgetMin: 35, budgetMax: 50, useCases: ['商务'] },
    visibility: 'PUBLIC',
    viewCount: 876,
    likeCount: 134,
    commentCount: 28,
    forkCount: 12,
    contentStatus: 'APPROVED',
    publishedAt: '2026-03-15T08:00:00Z',
    user: { id: 'u6', nickname: '业务老王' },
    journey: { id: 'j6', status: 'ACTIVE', stage: 'DECISION' },
  },
];

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

  const displayItems = items.length > 0 ? items : (isLoading ? [] : MOCK_JOURNEYS);

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
      <JourneyFeedList items={displayItems} isLoading={isLoading} />
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
