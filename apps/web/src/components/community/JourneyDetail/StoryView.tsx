import { StoryTimeline } from '@/types/api';

interface StoryViewProps {
  content?: string | StoryTimeline | null;
}

function parseStoryTimeline(content?: string | StoryTimeline | null): StoryTimeline | null {
  if (!content) return null;
  if (typeof content === 'object' && Array.isArray(content.stages)) {
    return content;
  }
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as StoryTimeline;
      if (Array.isArray(parsed.stages)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function StoryView({ content }: StoryViewProps) {
  const structured = parseStoryTimeline(content);

  if (structured?.stages?.length) {
    return (
      <div className="space-y-6">
        {structured.stages.map((stage) => (
          <article key={`${stage.stage}-${stage.headline}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-[var(--accent)]" />
              <span className="mt-2 min-h-0 flex-1 w-px bg-[var(--border)]" />
            </div>
            <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-4">
              <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em] text-[var(--accent-text)]">{stage.stage}</p>
              <h3 className="mt-1 text-[length:var(--text-md)] font-bold text-[var(--text)]">{stage.headline}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--text-soft)]">{stage.narrative}</p>
              {stage.candidates?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage.candidates.map((candidate) => (
                    <span key={candidate} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[length:var(--text-xs)] text-[var(--text-soft)]">
                      {candidate}
                    </span>
                  ))}
                </div>
              ) : null}
              {stage.keyDimension ? <p className="mt-3 text-[length:var(--text-xs)] font-medium text-[var(--text-muted)]">关键关注点：{stage.keyDimension}</p> : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (!content) {
    return <p className="text-sm text-[var(--text-muted)]">暂无叙事故事内容。</p>;
  }

  return <article className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">{typeof content === 'string' ? content : ''}</article>;
}
