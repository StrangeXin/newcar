'use client';

import { useState } from 'react';
import { CheckCircle2, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api';
import { useJourney } from '@/hooks/useJourney';

export function PublishWizard() {
  const router = useRouter();
  const { journey, isLoading } = useJourney();
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>('PUBLIC');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const journeyId = journey?.id;

  const publish = async () => {
    if (!journeyId || !journey?.title) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ id: string }>(`/journeys/${journeyId}/publish`, {
        title: journey.title,
        description: description.trim() || undefined,
        publishedFormats: ['story', 'report', 'template'],
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
        <Send className="h-5 w-5 text-[var(--accent-text)]" strokeWidth={1.85} aria-hidden="true" />
        一键发布旅程
      </h1>
      <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-text)]">
          <Sparkles className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
          AI 会并行生成 story、report、template 三种格式，然后直接发布到社区
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--accent-text)]/90">
          <li>默认标题：{journey?.title || '当前旅程标题'}</li>
          <li>默认可见性：{visibility}</li>
          <li>默认格式：story + report + template</li>
        </ul>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-[var(--text-soft)]">
          <span className="mb-1 inline-flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-[var(--success-text)]" strokeWidth={1.85} aria-hidden="true" />
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

        <label className="text-sm font-medium text-[var(--text-soft)]">
          简介（可选）
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] outline-none ring-[var(--accent-border)] focus:ring-2"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={submitting || !journey?.title}
          className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
          {submitting ? '生成并发布中...' : '一键发布到社区'}
        </button>
        <span className="text-xs text-[var(--text-muted)]">失败时你仍然可以回到社区页继续编辑或重新生成内容。</span>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--error)]">{error}</p> : null}
    </section>
  );
}
