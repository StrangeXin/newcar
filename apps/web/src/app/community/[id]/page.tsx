'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BookText, ClipboardList, CopyCheck, GitFork, Heart, MessageCircle, ThumbsUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { del, post } from '@/lib/api';
import { usePublishedJourney } from '@/hooks/usePublishedJourney';
import { StoryView } from '@/components/community/JourneyDetail/StoryView';
import { TemplateView } from '@/components/community/JourneyDetail/TemplateView';

const ReportView = dynamic(
  () => import('@/components/community/JourneyDetail/ReportView').then((mod) => mod.ReportView),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-slate-100" />,
  }
);

type TabKey = 'story' | 'report' | 'template';

function tabClass(active: boolean) {
  return active
    ? 'cursor-pointer rounded-xl bg-sky-700 px-3 py-2 text-sm text-white'
    : 'cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400';
}

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { journey, isLoading, error, refresh } = usePublishedJourney(id);
  const [tab, setTab] = useState<TabKey>('story');
  const [likeBusy, setLikeBusy] = useState(false);

  const like = async () => {
    setLikeBusy(true);
    try {
      await post(`/community/${id}/like`);
      await refresh();
    } finally {
      setLikeBusy(false);
    }
  };

  const unlike = async () => {
    setLikeBusy(true);
    try {
      await del(`/community/${id}/like`);
      await refresh();
    } finally {
      setLikeBusy(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">加载中...</main>;
  }
  if (error || !journey) {
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-red-700">内容不存在或已下架。</main>;
  }

  const hasStory = journey.publishedFormats.includes('story');
  const hasReport = journey.publishedFormats.includes('report');
  const hasTemplate = journey.publishedFormats.includes('template');

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h1 className="text-2xl font-extrabold text-slate-900">{journey.title}</h1>
        {journey.description ? <p className="mt-2 text-sm text-slate-600">{journey.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            <Heart className="h-3 w-3" aria-hidden="true" /> {journey.likeCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            <MessageCircle className="h-3 w-3" aria-hidden="true" /> {journey.commentCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
            <GitFork className="h-3 w-3" aria-hidden="true" /> {journey.forkCount}
          </span>
          <button
            type="button"
            onClick={like}
            disabled={likeBusy}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed"
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            点赞
          </button>
          <button
            type="button"
            onClick={unlike}
            disabled={likeBusy}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed"
          >
            取消赞
          </button>
        </div>
      </header>

      <div className="flex gap-2">
        {hasStory ? (
          <button type="button" onClick={() => setTab('story')} className={tabClass(tab === 'story')}>
            <BookText className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            叙事故事
          </button>
        ) : null}
        {hasReport ? (
          <button type="button" onClick={() => setTab('report')} className={tabClass(tab === 'report')}>
            <ClipboardList className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            结构化报告
          </button>
        ) : null}
        {hasTemplate ? (
          <button type="button" onClick={() => setTab('template')} className={tabClass(tab === 'template')}>
            <CopyCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            可复用模板
          </button>
        ) : null}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        {tab === 'story' ? <StoryView content={journey.storyContent} /> : null}
        {tab === 'report' ? <ReportView data={journey.reportData} /> : null}
        {tab === 'template' ? <TemplateView data={journey.templateData} publishedJourneyId={journey.id} /> : null}
      </section>
    </main>
  );
}
