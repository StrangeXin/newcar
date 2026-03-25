'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Send, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { useJourney } from '@/hooks/useJourney';
import { FormatSelector } from './FormatSelector';

interface PublishPreview {
  storyContent?: string | null;
  reportData?: unknown;
  templateData?: unknown;
}

export function PublishWizard() {
  const router = useRouter();
  const { journey, isLoading } = useJourney();
  const [step, setStep] = useState(1);
  const [formats, setFormats] = useState<string[]>(['story', 'report']);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>('PUBLIC');
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canNextStep1 = formats.length > 0;
  const canPublish = formats.length > 0 && title.trim().length > 0;
  const journeyId = journey?.id;

  const formatQuery = useMemo(() => formats.join(','), [formats]);

  const fetchPreview = async () => {
    if (!journeyId) {
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const data = await get<PublishPreview>(
        `/journeys/${journeyId}/publish/preview?formats=${encodeURIComponent(formatQuery)}`
      );
      setPreview(data);
      setStep(2);
      if (!title.trim()) {
        setTitle(journey.title);
      }
    } catch (err) {
      setError((err as Error).message || '加载预览失败');
    } finally {
      setLoadingPreview(false);
    }
  };

  const publish = async () => {
    if (!journeyId || !canPublish) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ id: string }>(`/journeys/${journeyId}/publish`, {
        title: title.trim(),
        description: description.trim() || undefined,
        publishedFormats: formats,
        visibility,
      });
      router.push(`/community/${result.id}`);
    } catch (err) {
      setError((err as Error).message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">正在加载旅程...</p>;
  }

  if (!journeyId) {
    return <p className="text-sm text-[var(--text-muted)]">暂无活跃旅程，先去创建旅程。</p>;
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-text)]">Publish Journey</p>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-[var(--text)]">
        <Send className="h-5 w-5 text-[var(--accent-text)]" aria-hidden="true" />
        发布历程
      </h1>

      {step === 1 ? (
        <div className="mt-4 space-y-4">
          <FormatSelector value={formats} onChange={setFormats} />
          {!canNextStep1 ? <p className="text-sm text-[var(--error)]">至少选择一种发布形式</p> : null}
          <button
            type="button"
            onClick={fetchPreview}
            disabled={!canNextStep1 || loadingPreview}
            className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {loadingPreview ? '生成预览中...' : '下一步：查看预览'}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <p className="flex items-center gap-1 text-sm font-semibold text-[var(--text)]">
              <Eye className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
              预览内容
            </p>
            {formats.includes('story') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-soft)]">{preview?.storyContent || '暂无'}</pre>
            ) : null}
            {formats.includes('report') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-soft)]">
                {JSON.stringify(preview?.reportData || {}, null, 2)}
              </pre>
            ) : null}
            {formats.includes('template') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-soft)]">
                {JSON.stringify(preview?.templateData || {}, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-[var(--text-soft)]">
              标题
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
              />
            </label>
            <label className="text-sm font-medium text-[var(--text-soft)]">
              <span className="mb-1 inline-flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-[var(--success-text)]" aria-hidden="true" />
                可见性
              </span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'UNLISTED')}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="UNLISTED">UNLISTED</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-[var(--text-soft)]">
            简介
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              上一步
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canPublish}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              下一步：确认发布
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--text-soft)]">将发布以下形式：{formats.join(', ')}</p>
          <p className="text-sm text-[var(--text-soft)]">可见性：{visibility}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-soft)] hover:border-[var(--border-soft)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回编辑
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={submitting || !canPublish}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {submitting ? '发布中...' : '确认发布'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[var(--error)]">{error}</p> : null}
    </section>
  );
}
