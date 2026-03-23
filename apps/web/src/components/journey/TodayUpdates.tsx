'use client';

import { useEffect, useState } from 'react';
import { patch } from '@/lib/api';
import { useNotifications } from '@/hooks/useNotifications';
import { JOURNEY_SIDE_EFFECT_EVENT } from '@/lib/journey-workspace-events';
import { mockNotifications } from './workspace-mock-data';

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
    <section className="rounded-ws-lg border border-workspace-border bg-workspace-surface p-ws14 shadow-workspace">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-[#111]">今日新动态</h3>
        <span className="inline-flex items-center justify-center rounded-full border border-workspace-chipBorder bg-workspace-chipBg px-[10px] py-1 text-[10px] font-semibold leading-[1.2] text-black/50">
          {displayItems.length} 条未读
        </span>
      </div>
      {isLoading ? <p className="mt-4 text-[11px] text-black/60">加载中...</p> : null}
      <ul className="mt-[10px] space-y-[10px]">
        {displayItems.map((item) => (
          <li key={item.id} className="rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-[10px] py-[10px] transition hover:border-black/15">
            <button
              type="button"
              onClick={() => markRead(item.id)}
              disabled={processingId === item.id || item.id.startsWith('mock-')}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-[10px]">
                <p className="text-[11px] font-bold text-ink">
                  <span className="mr-2">{TYPE_ICON[item.type] || '📢'}</span>
                  {item.title}
                </p>
                <span className="text-[9px] text-[#9ca3af]">
                  {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-[1.4] text-black/65">{item.body || '查看详情'}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
