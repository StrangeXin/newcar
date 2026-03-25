'use client';

import { useState } from 'react';
import { GitFork } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api';

interface ForkButtonProps {
  publishedJourneyId: string;
}

export function ForkButton({ publishedJourneyId }: ForkButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fork = async () => {
    setLoading(true);
    setError(null);
    try {
      await post(`/community/${publishedJourneyId}/fork`);
      router.push('/journey');
    } catch (err) {
      setError((err as Error).message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        data-testid="fork-button"
        type="button"
        onClick={fork}
        disabled={loading}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GitFork className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
        {loading ? '创建中...' : '从此出发，开始我的旅程'}
      </button>
      {error ? <p className="mt-1 text-xs text-[var(--error)]">{error}</p> : null}
    </div>
  );
}
