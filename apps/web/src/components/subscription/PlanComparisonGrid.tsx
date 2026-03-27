'use client';

import type { SubscriptionPlanInfo } from '@newcar/shared';

interface PlanComparisonGridProps {
  plans: SubscriptionPlanInfo[];
  currentPlanName: string;
  onSelectPlan: (planName: string) => void;
  upgrading: boolean;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

const PLAN_FEATURES: Record<string, { label: string; key: string }[]> = {
  FREE: [
    { label: 'AI 基础对话', key: 'basicChat' },
  ],
  PRO: [
    { label: 'AI 基础对话', key: 'basicChat' },
    { label: '高级 AI 模型', key: 'advancedChat' },
    { label: '分析报告', key: 'reports' },
  ],
  PREMIUM: [
    { label: 'AI 基础对话', key: 'basicChat' },
    { label: '最强 AI 模型', key: 'advancedChat' },
    { label: '分析报告', key: 'reports' },
    { label: '优先响应', key: 'priorityResponse' },
  ],
};

export default function PlanComparisonGrid({
  plans,
  currentPlanName,
  onSelectPlan,
  upgrading,
}: PlanComparisonGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {plans.map((plan) => {
        const isCurrent = plan.name === currentPlanName;
        const isUpgrade = plan.sortOrder > (plans.find((p) => p.name === currentPlanName)?.sortOrder ?? -1);
        const isRecommended = plan.name === 'PRO';
        const features = PLAN_FEATURES[plan.name] ?? [];

        return (
          <div
            key={plan.id}
            className={`relative rounded-xl border p-5 space-y-4 ${
              isRecommended
                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20'
                : 'border-[var(--border)]'
            } bg-[var(--bg-secondary)]`}
          >
            {isRecommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--accent)] text-white text-xs font-medium">
                推荐
              </span>
            )}

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.displayName}</h3>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {plan.price === 0 ? '免费' : `¥${(plan.price / 100).toFixed(0)}`}
                {plan.price > 0 && <span className="text-sm font-normal text-[var(--text-secondary)]">/月</span>}
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>对话次数</span>
                <span className="font-medium text-[var(--text-primary)]">{plan.monthlyConversationLimit}/月</span>
              </li>
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>Token 额度</span>
                <span className="font-medium text-[var(--text-primary)]">{formatTokens(plan.monthlyTokenLimit)}/月</span>
              </li>
              <li className="flex justify-between text-[var(--text-secondary)]">
                <span>分析报告</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {plan.monthlyReportLimit === 0 ? '—' : `${plan.monthlyReportLimit} 份/月`}
                </span>
              </li>
            </ul>

            <div className="border-t border-[var(--border)] pt-3">
              <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                {features.map((f) => (
                  <li key={f.key} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => onSelectPlan(plan.name)}
              disabled={isCurrent || !isUpgrade || upgrading}
              className={`w-full py-2 rounded-lg font-medium transition-opacity ${
                isCurrent
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-default'
                  : isUpgrade
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              }`}
            >
              {isCurrent ? '当前套餐' : isUpgrade ? (upgrading ? '升级中...' : '升级') : '—'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
