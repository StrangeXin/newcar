'use client';

import type { UserSubscriptionInfo, QuotaStatus } from '@newcar/shared';
import UsageProgressBar from './UsageProgressBar';

interface CurrentPlanCardProps {
  subscription: UserSubscriptionInfo;
  quota: QuotaStatus;
  onUpgradeClick: () => void;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

export default function CurrentPlanCard({ subscription, quota, onUpgradeClick }: CurrentPlanCardProps) {
  const plan = subscription.plan;
  const isPremium = plan.name === 'PREMIUM';
  const resetDate = new Date(subscription.monthlyResetAt).toLocaleDateString('zh-CN');

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{plan.displayName}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {plan.price === 0 ? '免费' : `¥${(plan.price / 100).toFixed(0)}/月`}
            <span className="ml-2">· 下次重置: {resetDate}</span>
          </p>
        </div>
        {!isPremium && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            升级套餐
          </button>
        )}
      </div>

      <div className="space-y-4">
        <UsageProgressBar
          label="本月对话"
          used={quota.conversations.used}
          limit={quota.conversations.limit}
          formatValue={(v) => `${v} 次`}
        />
        <UsageProgressBar
          label="本月报告"
          used={quota.reports.used}
          limit={quota.reports.limit}
          formatValue={(v) => `${v} 份`}
        />
        <UsageProgressBar
          label="本月 Token"
          used={quota.tokens.used}
          limit={quota.tokens.limit}
          formatValue={formatTokens}
        />
      </div>
    </div>
  );
}
