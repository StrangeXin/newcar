'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { BookText, ClipboardList, CopyCheck, GitFork, Heart, MessageCircle, ThumbsUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { del, patch, post } from '@/lib/api';
import { usePublishedJourney } from '@/hooks/usePublishedJourney';
import { useJourney } from '@/hooks/useJourney';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LocaleToggle } from '@/components/ui/LocaleToggle';
import { StoryView } from '@/components/community/JourneyDetail/StoryView';
import { TemplateView } from '@/components/community/JourneyDetail/TemplateView';
import { ReportData, StoryTimeline, TemplateData } from '@/types/api';

const ReportView = dynamic(
  () => import('@/components/community/JourneyDetail/ReportView').then((mod) => mod.ReportView),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />,
  }
);

type TabKey = 'story' | 'report' | 'template';

function parseStoryDraft(content?: string | StoryTimeline | null) {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  return JSON.stringify(content, null, 2);
}

function parseStructuredDraft(data?: unknown) {
  if (!data) return '';
  return JSON.stringify(data, null, 2);
}

function tabClass(active: boolean) {
  return active
    ? 'cursor-pointer rounded-xl bg-[var(--accent-text)] px-3 py-2 text-sm text-white'
    : 'cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-soft)] hover:border-[var(--border-soft)]';
}

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { journey, isLoading, error, refresh } = usePublishedJourney(id);
  const { journey: activeJourney } = useJourney();
  const [tab, setTab] = useState<TabKey>('story');
  const [likeBusy, setLikeBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [visibilityDraft, setVisibilityDraft] = useState<'PUBLIC' | 'UNLISTED'>('PUBLIC');
  const [storyDraft, setStoryDraft] = useState('');
  const [reportDraft, setReportDraft] = useState('');
  const [templateDraft, setTemplateDraft] = useState('');
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const isAuthor = useMemo(
    () => Boolean(activeJourney?.userId && journey?.user?.id && activeJourney.userId === journey.user.id),
    [activeJourney?.userId, journey?.user?.id]
  );

  useEffect(() => {
    if (!journey) return;
    setTitleDraft(journey.title);
    setDescriptionDraft(journey.description || '');
    setSummaryDraft(journey.publishSummary || '');
    setVisibilityDraft(journey.visibility);
    setStoryDraft(parseStoryDraft(journey.storyContent));
    setReportDraft(parseStructuredDraft(journey.reportData));
    setTemplateDraft(parseStructuredDraft(journey.templateData));
  }, [journey]);

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

  const saveMeta = async () => {
    if (!journey) return;
    setEditBusy(true);
    setEditMessage(null);
    try {
      await patch(`/published-journeys/${journey.id}`, {
        title: titleDraft,
        description: descriptionDraft,
        publishSummary: summaryDraft,
        visibility: visibilityDraft,
      });
      await refresh();
      setEditMessage('基础信息已保存。');
    } finally {
      setEditBusy(false);
    }
  };

  const saveContentBlock = async (format: TabKey) => {
    if (!journey) return;
    setEditBusy(true);
    setEditMessage(null);
    try {
      if (format === 'story') {
        let parsed: StoryTimeline | string | null = null;
        if (storyDraft.trim()) {
          try {
            parsed = JSON.parse(storyDraft) as StoryTimeline;
          } catch {
            parsed = storyDraft;
          }
        }
        await patch(`/published-journeys/${journey.id}`, { storyContent: parsed });
        setEditMessage('故事内容已保存。');
      }

      if (format === 'report') {
        const parsed = reportDraft.trim() ? (JSON.parse(reportDraft) as ReportData) : null;
        await patch(`/published-journeys/${journey.id}`, { reportData: parsed });
        setEditMessage('报告内容已保存。');
      }

      if (format === 'template') {
        const parsed = templateDraft.trim() ? (JSON.parse(templateDraft) as TemplateData) : null;
        await patch(`/published-journeys/${journey.id}`, { templateData: parsed });
        setEditMessage('模板内容已保存。');
      }
      await refresh();
    } catch (error) {
      setEditMessage((error as Error).message || '保存失败，请检查 JSON 格式。');
    } finally {
      setEditBusy(false);
    }
  };

  const toggleFormat = async (format: TabKey) => {
    if (!journey) return;
    setEditBusy(true);
    setEditMessage(null);
    try {
      const nextFormats = journey.publishedFormats.includes(format)
        ? journey.publishedFormats.filter((item) => item !== format)
        : [...journey.publishedFormats, format];
      await patch(`/published-journeys/${journey.id}`, {
        publishedFormats: nextFormats,
      });
      await refresh();
      setEditMessage(`已更新 ${format} 的显示状态。`);
    } finally {
      setEditBusy(false);
    }
  };

  const regenerate = async (format: TabKey | 'summary') => {
    if (!journey) return;
    setEditBusy(true);
    setEditMessage(null);
    try {
      await post(`/published-journeys/${journey.id}/regenerate`, { format });
      await refresh();
      setEditMessage(format === 'summary' ? '摘要已重新生成。' : `${format} 已重新生成。`);
    } finally {
      setEditBusy(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-[var(--text-muted)]">加载中...</main>;
  }
  if (error || !journey) {
    return <main className="mx-auto max-w-5xl px-4 py-6 text-sm text-[var(--error)]">内容不存在或已下架。</main>;
  }

  const hasStory = journey.publishedFormats.includes('story');
  const hasReport = journey.publishedFormats.includes('report');
  const hasTemplate = journey.publishedFormats.includes('template');

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <ThemeToggle />
          <LocaleToggle />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">{journey.title}</h1>
        {journey.description ? <p className="mt-2 text-sm text-[var(--text-soft)]">{journey.description}</p> : null}
        {journey.publishSummary ? (
          <p className="mt-3 rounded-[14px] border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-3 text-sm leading-6 text-[var(--accent-text)]">
            "{journey.publishSummary}"
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-soft)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1">
            <Heart className="h-3 w-3" aria-hidden="true" /> {journey.likeCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1">
            <MessageCircle className="h-3 w-3" aria-hidden="true" /> {journey.commentCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1">
            <GitFork className="h-3 w-3" aria-hidden="true" /> {journey.forkCount}
          </span>
          <button
            type="button"
            onClick={like}
            disabled={likeBusy}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
          >
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            点赞
          </button>
          <button
            type="button"
            onClick={unlike}
            disabled={likeBusy}
            className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)] disabled:cursor-not-allowed"
          >
            取消赞
          </button>
        </div>
      </header>

      {isAuthor ? (
        <section className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-5 shadow-card">
          <h2 className="text-sm font-bold text-[var(--accent-text)]">作者编辑区</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-[var(--text-soft)]">
              标题
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
            <label className="text-sm font-medium text-[var(--text-soft)]">
              可见性
              <select
                value={visibilityDraft}
                onChange={(event) => setVisibilityDraft(event.target.value as 'PUBLIC' | 'UNLISTED')}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="UNLISTED">UNLISTED</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[var(--text-soft)] md:col-span-2">
              简介
              <textarea
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
            <label className="text-sm font-medium text-[var(--text-soft)] md:col-span-2">
              决策摘要
              <textarea
                value={summaryDraft}
                onChange={(event) => setSummaryDraft(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveMeta}
              disabled={editBusy}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {editBusy ? '保存中...' : '保存内容'}
            </button>
            <button
              type="button"
              onClick={() => regenerate('summary')}
              disabled={editBusy}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] disabled:opacity-60"
            >
              重新生成摘要
            </button>
            <button
              type="button"
              onClick={() => regenerate('story')}
              disabled={editBusy}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] disabled:opacity-60"
            >
              重写故事
            </button>
            <button
              type="button"
              onClick={() => regenerate('report')}
              disabled={editBusy}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] disabled:opacity-60"
            >
              重写报告
            </button>
            <button
              type="button"
              onClick={() => regenerate('template')}
              disabled={editBusy}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] disabled:opacity-60"
            >
              重写模板
            </button>
          </div>
          {editMessage ? <p className="mt-3 text-xs font-medium text-[var(--accent-text)]">{editMessage}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {(['story', 'report', 'template'] as TabKey[]).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => toggleFormat(format)}
                disabled={editBusy}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-semibold text-[var(--text-soft)] disabled:opacity-60"
              >
                {journey.publishedFormats.includes(format) ? `隐藏 ${format}` : `显示 ${format}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        {isAuthor && tab === 'story' ? (
          <div className="mb-5 rounded-[16px] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--accent-text)]">编辑故事 JSON</h3>
              <button
                type="button"
                onClick={() => saveContentBlock('story')}
                disabled={editBusy}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                保存故事
              </button>
            </div>
            <textarea
              value={storyDraft}
              onChange={(event) => setStoryDraft(event.target.value)}
              className="mt-3 min-h-56 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-mono text-xs text-[var(--text)]"
            />
          </div>
        ) : null}
        {isAuthor && tab === 'report' ? (
          <div className="mb-5 rounded-[16px] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--accent-text)]">编辑报告 JSON</h3>
              <button
                type="button"
                onClick={() => saveContentBlock('report')}
                disabled={editBusy}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                保存报告
              </button>
            </div>
            <textarea
              value={reportDraft}
              onChange={(event) => setReportDraft(event.target.value)}
              className="mt-3 min-h-56 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-mono text-xs text-[var(--text)]"
            />
          </div>
        ) : null}
        {isAuthor && tab === 'template' ? (
          <div className="mb-5 rounded-[16px] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--accent-text)]">编辑模板 JSON</h3>
              <button
                type="button"
                onClick={() => saveContentBlock('template')}
                disabled={editBusy}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                保存模板
              </button>
            </div>
            <textarea
              value={templateDraft}
              onChange={(event) => setTemplateDraft(event.target.value)}
              className="mt-3 min-h-56 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 font-mono text-xs text-[var(--text)]"
            />
          </div>
        ) : null}
        {tab === 'story' ? <StoryView content={journey.storyContent} /> : null}
        {tab === 'report' ? <ReportView data={journey.reportData} /> : null}
        {tab === 'template' ? <TemplateView data={journey.templateData} publishedJourneyId={journey.id} /> : null}
      </section>
    </main>
  );
}
