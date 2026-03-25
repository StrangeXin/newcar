'use client';

import { useEffect, useState } from 'react';
import { Bell, Clock3, Landmark, MessageSquare, ShieldAlert, Star, Tag } from 'lucide-react';
import { patch } from '@/lib/api';
import { useNotifications } from '@/hooks/useNotifications';
import { JOURNEY_SIDE_EFFECT_EVENT } from '@/lib/journey-workspace-events';
import { mockNotifications } from './workspace-mock-data';

const TYPE_META: Record<string, { label: string; tone: string }> = {
  PRICE_DROP: { label: '降价', tone: 'border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-text)]' },
  NEW_VARIANT: { label: '新款', tone: 'border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent-text)]' },
  NEW_REVIEW: { label: '口碑', tone: 'border-[var(--info)]/20 bg-[var(--info)]/10 text-[var(--info)]' },
  POLICY_UPDATE: { label: '政策', tone: 'border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-text)]' },
  OTA_RECALL: { label: '提醒', tone: 'border-[var(--error)]/20 bg-[var(--error)]/10 text-[var(--error)]' },
};

function TypeIcon({ type }: { type: string }) {
  if (type === 'PRICE_DROP') return <Tag className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === 'NEW_VARIANT') return <Star className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === 'NEW_REVIEW') return <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === 'POLICY_UPDATE') return <Landmark className="h-3.5 w-3.5" aria-hidden="true" />;
  if (type === 'OTA_RECALL') return <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Bell className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function TodayUpdates() {
  const { notifications, isLoading, refresh } = useNotifications();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const unread = notifications.filter((item) => !item.isRead);
  const displayItems = unread.length > 0 ? unread : mockNotifications;

  useEffect(() => {
    const handleSideEffect = () => {
      void refresh();
    };
    window.addEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
    return () => window.removeEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
  }, [refresh]);

  async function markRead(notificationId: string) {
    try {
      setProcessingId(notificationId);
      await patch(`/notifications/${notificationId}/read`, {});
      await refresh();
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="rounded-ws-lg border border-[var(--border)] bg-[var(--surface)] p-ws14 shadow-workspace">
      <div className="flex min-h-[28px] items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--text)]">
          <Bell className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
          今日新动态
        </h3>
        <span className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-1 text-[10px] font-semibold leading-[1.2] text-[var(--text-muted)]">
          {displayItems.length} 条未读
        </span>
      </div>
      {isLoading ? <p className="mt-4 text-[11px] text-[var(--text-muted)]">加载中...</p> : null}
      <ul className="mt-[10px] space-y-[10px]">
        {displayItems.map((item) => (
          <li key={item.id} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] px-[10px] py-[10px] transition hover:border-[var(--border-soft)]">
            <button
              type="button"
              onClick={() => markRead(item.id)}
              disabled={processingId === item.id || item.id.startsWith('mock-')}
              className="w-full cursor-pointer text-left disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-[10px]">
                <p className="flex items-center gap-2 text-[11px] font-bold text-[var(--text)]">
                  <span
                    className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                      TYPE_META[item.type]?.tone || 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-soft)]'
                    }`}
                  >
                    <TypeIcon type={item.type} />
                    {TYPE_META[item.type]?.label || '通知'}
                  </span>
                  {item.title}
                </p>
                <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-[1.4] text-[var(--text-soft)]">{item.body || '查看详情'}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
