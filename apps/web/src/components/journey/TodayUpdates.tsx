'use client';

import { useEffect, useState } from 'react';
import { patch } from '@/lib/api';
import { useNotifications } from '@/hooks/useNotifications';
import { JOURNEY_SIDE_EFFECT_EVENT } from '@/lib/journey-workspace-events';

const TYPE_ICON: Record<string, string> = {
  PRICE_DROP: '📉',
  NEW_VARIANT: '🆕',
  NEW_REVIEW: '📝',
  POLICY_UPDATE: '🏛️',
  OTA_RECALL: '⚠️',
};

export function TodayUpdates() {
  const { notifications, isLoading, refresh } = useNotifications();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const unread = notifications.filter((item) => !item.isRead);

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
    <section className="rounded-[18px] border border-black/10 bg-white/90 p-4 shadow-card xl:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">今日新动态</h3>
        <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-black/50">{unread.length} 条未读</span>
      </div>
      {isLoading ? <p className="mt-4 text-sm text-black/60">加载中...</p> : null}
      {!isLoading && unread.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/5 p-3 text-sm text-black/55">今日暂无新动态</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {unread.map((item) => (
          <li key={item.id} className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-3 transition hover:border-black/15">
            <button
              type="button"
              onClick={() => markRead(item.id)}
              disabled={processingId === item.id}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  <span className="mr-2">{TYPE_ICON[item.type] || '📢'}</span>
                  {item.title}
                </p>
                <span className="text-xs text-black/45">
                  {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-sm text-black/65">{item.body || '查看详情'}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
