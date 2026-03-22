'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { del, post } from '@/lib/api';
import { usePublishedJourney } from '@/hooks/usePublishedJourney';
import { ReportView } from '@/components/community/JourneyDetail/ReportView';
import { StoryView } from '@/components/community/JourneyDetail/StoryView';
import { TemplateView } from '@/components/community/JourneyDetail/TemplateView';

type TabKey = 'story' | 'report' | 'template';

function tabClass(active: boolean) {
  return active
    ? 'rounded-xl bg-ink px-3 py-2 text-sm text-white'
    : 'rounded-xl border border-black/15 bg-white px-3 py-2 text-sm';
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
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-black/60">加载中...</main>;
  }
  if (error || !journey) {
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-red-600">内容不存在或已下架。</main>;
  }

  const hasStory = journey.publishedFormats.includes('story');
  const hasReport = journey.publishedFormats.includes('report');
  const hasTemplate = journey.publishedFormats.includes('template');

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="rounded-2xl border border-black/10 bg-white p-5 shadow-card">
        <h1 className="text-2xl font-bold">{journey.title}</h1>
        {journey.description ? <p className="mt-2 text-sm text-black/65">{journey.description}</p> : null}
        <div className="mt-3 flex items-center gap-2 text-xs text-black/60">
          <span>👍 {journey.likeCount}</span>
          <span>💬 {journey.commentCount}</span>
          <span>🔀 {journey.forkCount}</span>
          <button
            type="button"
            onClick={like}
            disabled={likeBusy}
            className="rounded-lg border border-black/15 px-2 py-1 text-xs"
          >
            点赞
          </button>
          <button
            type="button"
            onClick={unlike}
            disabled={likeBusy}
            className="rounded-lg border border-black/15 px-2 py-1 text-xs"
          >
            取消赞
          </button>
        </div>
      </header>

      <div className="flex gap-2">
        {hasStory ? (
          <button type="button" onClick={() => setTab('story')} className={tabClass(tab === 'story')}>
            叙事故事
          </button>
        ) : null}
        {hasReport ? (
          <button type="button" onClick={() => setTab('report')} className={tabClass(tab === 'report')}>
            结构化报告
          </button>
        ) : null}
        {hasTemplate ? (
          <button type="button" onClick={() => setTab('template')} className={tabClass(tab === 'template')}>
            可复用模板
          </button>
        ) : null}
      </div>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-card">
        {tab === 'story' ? <StoryView content={journey.storyContent} /> : null}
        {tab === 'report' ? <ReportView data={journey.reportData} /> : null}
        {tab === 'template' ? <TemplateView data={journey.templateData} publishedJourneyId={journey.id} /> : null}
      </section>
    </main>
  );
}
