'use client';

import Link from 'next/link';
import { Brain, CarFront, CheckCircle2, DollarSign, Flag, Lightbulb, NotebookPen, Sparkles, User, XCircle } from 'lucide-react';
import { JourneySnapshot, TimelineEvent } from '@/types/api';

interface TimelinePanelProps {
  events: TimelineEvent[];
  snapshot?: JourneySnapshot | null;
  isLoading?: boolean;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

function getMeta(event: TimelineEvent) {
  switch (event.type) {
    case 'CANDIDATE_ADDED':
      return {
        icon: CarFront,
        tone: 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-text)]',
        title: 'AI 推荐候选',
      };
    case 'CANDIDATE_ELIMINATED':
      return {
        icon: XCircle,
        tone: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]',
        title: '淘汰候选',
      };
    case 'CANDIDATE_WINNER':
      return {
        icon: CheckCircle2,
        tone: 'border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-text)]',
        title: '最终选择',
      };
    case 'STAGE_CHANGED':
      return {
        icon: Flag,
        tone: 'border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-text)]',
        title: '阶段推进',
      };
    case 'REQUIREMENT_UPDATED':
      return {
        icon: NotebookPen,
        tone: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-soft)]',
        title: '需求更新',
      };
    case 'AI_INSIGHT':
      return {
        icon: Brain,
        tone: 'border-[var(--accent-border)] bg-[var(--surface)] text-[var(--accent-text)]',
        title: 'AI 洞察',
      };
    case 'PRICE_CHANGE':
      return {
        icon: DollarSign,
        tone: 'border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-text)]',
        title: '价格变动',
      };
    case 'USER_ACTION':
      return {
        icon: User,
        tone: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-soft)]',
        title: '用户操作',
      };
    case 'PUBLISH_SUGGESTION':
      return {
        icon: Sparkles,
        tone: 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-text)]',
        title: 'AI 建议',
      };
    default:
      return {
        icon: Lightbulb,
        tone: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-soft)]',
        title: '旅程事件',
      };
  }
}

const stageSummaryMap: Record<string, string> = {
  AWARENESS: '开始了解你的用车需求',
  CONSIDERATION: '开始探索合适的车型',
  COMPARISON: '进入深度对比阶段',
  DECISION: '即将做出最终选择',
  PURCHASE: '恭喜做出了决定！',
};

function getStageSummary(event: TimelineEvent): string | null {
  if (typeof event.metadata?.summary === 'string' && event.metadata.summary) {
    return event.metadata.summary;
  }
  const toStage = typeof event.metadata?.toStage === 'string' ? event.metadata.toStage : null;
  if (toStage && stageSummaryMap[toStage]) {
    return stageSummaryMap[toStage];
  }
  // Try to infer from event content
  for (const [key, value] of Object.entries(stageSummaryMap)) {
    if (event.content?.includes(key)) {
      return value;
    }
  }
  return null;
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const meta = getMeta(event);
  const Icon = meta.icon;
  const tags = Array.isArray(event.metadata?.matchTags) ? event.metadata.matchTags.slice(0, 3).map(String) : [];
  const reason = typeof event.metadata?.recommendReason === 'string' ? event.metadata.recommendReason : '';
  const eliminationReason = typeof event.metadata?.eliminationReason === 'string' ? event.metadata.eliminationReason : '';

  if (event.type === 'STAGE_CHANGED') {
    const summary = getStageSummary(event);
    return (
      <div className="-mx-4 flex flex-col items-center gap-1 bg-[var(--warning-muted)] px-4 py-3">
        <div className="flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-[var(--warning-border)]" />
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[length:var(--text-sm)] font-bold text-[var(--warning-text)]">
            <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
            {event.content}
          </span>
          <span className="h-px flex-1 bg-[var(--warning-border)]" />
        </div>
        {summary ? (
          <p className="text-[length:var(--text-xs)] leading-[1.5] text-[var(--warning-text)] opacity-80">
            {summary}
          </p>
        ) : null}
      </div>
    );
  }

  if (event.type === 'PUBLISH_SUGGESTION') {
    return (
      <article className={`rounded-[var(--radius-2xl)] border px-4 py-4 ${meta.tone}`}>
        <p className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em]">
          <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
          {meta.title}
        </p>
        <p className="mt-2 text-[length:var(--text-sm)] font-semibold leading-6">{event.content}</p>
        <p className="mt-2 text-[length:var(--text-xs)] leading-5 opacity-90">
          你的旅程已经进入可以沉淀经验的阶段，现在可以一键发布到社区，帮助正在纠结的人更快做决定。
        </p>
        <Link
          href="/journey/publish"
          className="mt-4 inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2 text-[length:var(--text-xs)] font-semibold text-white hover:opacity-90"
        >
          一键发布到社区
        </Link>
      </article>
    );
  }

  return (
    <article className={`rounded-[var(--radius-xl)] border px-4 py-4 ${meta.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em]">
            <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
            {meta.title}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] font-semibold">{event.content}</p>
        </div>
        <span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-current/15 px-2.5 py-1 text-[length:var(--text-xs)] font-medium">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {reason ? (
        <blockquote className="mt-3 border-l-2 border-current/20 pl-3 text-[length:var(--text-sm)] leading-6 opacity-90">
          &ldquo;{reason}&rdquo;
        </blockquote>
      ) : null}
      {eliminationReason ? (
        <p className="mt-3 text-[length:var(--text-xs)] opacity-80">
          {'原因：'}
          {eliminationReason}
        </p>
      ) : null}
    </article>
  );
}

function DailySnapshotCard({ snapshot }: { snapshot: JourneySnapshot }) {
  return (
    <article className="rounded-[var(--radius-2xl)] border border-[var(--accent-border)] bg-[linear-gradient(180deg,var(--surface),var(--accent-muted))] px-5 py-5 text-[var(--text)] shadow-workspace">
      <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em] text-[var(--accent-text)]">每日总结</p>
      <p className="mt-2 text-[length:var(--text-base)] font-semibold leading-7">{snapshot.narrativeSummary || '今天的旅程仍在推进中。'}</p>
      {Array.isArray(snapshot.keyInsights) && snapshot.keyInsights.length > 0 ? (
        <ul className="mt-4 space-y-2 text-[length:var(--text-sm)] text-[var(--text-soft)]">
          {snapshot.keyInsights.slice(0, 3).map((item) => (
            <li key={item.insight} className="rounded-[var(--radius-lg)] bg-[var(--surface)]/45 px-3 py-2">
              <p className="font-semibold text-[var(--text)]">{item.insight}</p>
              <p className="mt-1 leading-5">{item.evidence}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(snapshot.nextSuggestedActions) && snapshot.nextSuggestedActions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {snapshot.nextSuggestedActions.slice(0, 3).map((item) => (
            <span key={item} className="rounded-full border border-[var(--accent-border)] bg-[color:var(--surface)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[var(--accent-text)]">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function TimelinePanel({ events, snapshot, isLoading }: TimelinePanelProps) {
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const key = formatDateLabel(event.createdAt);
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});

  const days = Object.entries(grouped);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-ws14 shadow-workspace">
      <div className="flex min-h-[28px] items-center justify-between gap-[10px]">
        <div>
          <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.1em] text-[var(--accent-text)]">Timeline</p>
          <h3 className="text-[length:var(--text-md)] font-extrabold text-[var(--text)]">旅程主轴</h3>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-1 text-[length:var(--text-xs)] font-semibold text-[var(--text-muted)]">
          {events.length} 条事件
        </span>
      </div>
      {isLoading ? <p className="mt-4 text-[length:var(--text-xs)] text-[var(--text-muted)]">正在同步时间线...</p> : null}
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {snapshot ? <DailySnapshotCard snapshot={snapshot} /> : null}
        {days.length === 0 && !snapshot ? (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-6 text-[length:var(--text-sm)] text-[var(--text-muted)]">
            还没有时间线事件。继续聊天后，AI 推荐、阶段推进和需求更新都会出现在这里。
          </div>
        ) : null}
        {days.map(([day, dayEvents]) => (
          <div key={day} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-3 w-3 rounded-full bg-[var(--accent)]" />
              <span className="mt-2 min-h-0 flex-1 w-px bg-[var(--border)]" />
            </div>
            <div className="space-y-3">
              <p className="text-[length:var(--text-xs)] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day}</p>
              {dayEvents.map((event) => (
                <TimelineEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
