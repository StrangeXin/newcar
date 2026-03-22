'use client';

import { useMemo, useState } from 'react';
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
    return <p className="text-sm text-black/60">正在加载旅程...</p>;
  }

  if (!journeyId) {
    return <p className="text-sm text-black/60">暂无活跃旅程，先去创建旅程。</p>;
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ember">Publish Journey</p>
      <h1 className="mt-2 text-2xl font-bold">发布历程</h1>

      {step === 1 ? (
        <div className="mt-4 space-y-4">
          <FormatSelector value={formats} onChange={setFormats} />
          {!canNextStep1 ? <p className="text-sm text-red-600">至少选择一种发布形式</p> : null}
          <button
            type="button"
            onClick={fetchPreview}
            disabled={!canNextStep1 || loadingPreview}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loadingPreview ? '生成预览中...' : '下一步：查看预览'}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-sm font-semibold">预览内容</p>
            {formats.includes('story') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-black/70">{preview?.storyContent || '暂无'}</pre>
            ) : null}
            {formats.includes('report') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-black/70">
                {JSON.stringify(preview?.reportData || {}, null, 2)}
              </pre>
            ) : null}
            {formats.includes('template') ? (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-black/70">
                {JSON.stringify(preview?.templateData || {}, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-black/70">
              标题
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-black/70">
              可见性
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'UNLISTED')}
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="UNLISTED">UNLISTED</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-black/70">
            简介
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold"
            >
              上一步
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canPublish}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              下一步：确认发布
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-black/70">将发布以下形式：{formats.join(', ')}</p>
          <p className="text-sm text-black/70">可见性：{visibility}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold"
            >
              返回编辑
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={submitting || !canPublish}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? '发布中...' : '确认发布'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
