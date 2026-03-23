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
    <section className="rounded-[16px] border border-black/10 bg-white/90 p-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] xl:px-4 xl:py-[14px]">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-[#111]">今日新动态</h3>
        <span className="rounded-full bg-[#f3f4f6] px-2 py-[2px] text-[10px] font-semibold text-black/50">{unread.length} 条未读</span>
      </div>
      {isLoading ? <p className="mt-4 text-sm text-black/60">加载中...</p> : null}
      {!isLoading && unread.length === 0 ? (
        <p className="mt-4 rounded-xl bg-black/5 p-3 text-sm text-black/55">今日暂无新动态</p>
      ) : null}
      <ul className="mt-3 space-y-[7px]">
        {unread.map((item) => (
          <li key={item.id} className="rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-[11px] py-[9px] transition hover:border-black/15">
            <button
              type="button"
              onClick={() => markRead(item.id)}
              disabled={processingId === item.id}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
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
