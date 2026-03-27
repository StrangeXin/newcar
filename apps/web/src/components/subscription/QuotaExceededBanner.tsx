'use client';

interface QuotaExceededBannerProps {
  type: 'conversation' | 'report';
  currentPlan: string;
  onUpgradeClick: () => void;
}

const MESSAGES: Record<string, Record<string, string>> = {
  conversation: {
    title: '本月对话次数已用完',
    description: '下月自动重置，或升级套餐获得更多次数',
    freeHint: 'Pro 版每月 200 次对话 + 高级 AI 模型，仅 ¥29/月',
  },
  report: {
    title: '本月报告份数已用完',
    description: '升级套餐获取更多报告额度',
    freeHint: '升级到 Pro 解锁分析报告功能',
  },
};

export default function QuotaExceededBanner({
  type,
  currentPlan,
  onUpgradeClick,
}: QuotaExceededBannerProps) {
  const msg = MESSAGES[type];
  const isFree = currentPlan === 'FREE';

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-50/10 p-4 space-y-2">
      <p className="font-medium text-[var(--text-primary)]">{msg.title}</p>
      <p className="text-sm text-[var(--text-secondary)]">{msg.description}</p>
      {isFree && (
        <p className="text-sm text-[var(--accent)]">{msg.freeHint}</p>
      )}
      <button
        onClick={onUpgradeClick}
        className="mt-2 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        升级套餐
      </button>
    </div>
  );
}
