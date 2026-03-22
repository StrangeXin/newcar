'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { JourneySnapshot } from '@/types/api';

export function useSnapshot(journeyId?: string) {
  const key = journeyId ? `/snapshots/${journeyId}/snapshot` : null;
  const swr = useSWR<JourneySnapshot>(key, get, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  return {
    snapshot: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
