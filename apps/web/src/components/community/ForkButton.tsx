'use client';

import { useState } from 'react';
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
        type="button"
        onClick={fork}
        disabled={loading}
        className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {loading ? '创建中...' : '从此出发'}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
