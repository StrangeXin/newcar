'use client';

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api';
import type { SubscriptionPlanInfo, UserSubscriptionInfo, QuotaStatus } from '@newcar/shared';
import CurrentPlanCard from '@/components/subscription/CurrentPlanCard';
import PlanComparisonGrid from '@/components/subscription/PlanComparisonGrid';

interface SubscriptionResponse {
  subscription: UserSubscriptionInfo;
  quota: QuotaStatus;
}

interface PlansResponse {
  plans: SubscriptionPlanInfo[];
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<UserSubscriptionInfo | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanInfo[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        get<SubscriptionResponse>('/subscription/current'),
        get<PlansResponse>('/subscription/plans'),
      ]);
      setSubscription(subRes.subscription);
      setQuota(subRes.quota);
      setPlans(plansRes.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (planName: string) => {
    setUpgrading(true);
    setError(null);
    try {
      const res = await post<SubscriptionResponse>('/subscription/upgrade', { planName });
      setSubscription(res.subscription);
      setQuota(res.quota);
      setShowComparison(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '升级失败');
    } finally {
      setUpgrading(false);
    }
  };

  if (!subscription || !quota) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48" />
          <div className="h-48 bg-[var(--bg-tertiary)] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">套餐管理</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">管理你的 AI 助理订阅和用量</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-50/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <CurrentPlanCard
        subscription={subscription}
        quota={quota}
        onUpgradeClick={() => setShowComparison(true)}
      />

      {showComparison && plans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">选择套餐</h2>
          <PlanComparisonGrid
            plans={plans}
            currentPlanName={subscription.plan.name}
            onSelectPlan={handleUpgrade}
            upgrading={upgrading}
          />
        </div>
      )}
    </div>
  );
}
