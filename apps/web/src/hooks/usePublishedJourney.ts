'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { CommunityJourney } from '@/types/api';

export function usePublishedJourney(id?: string) {
  const swr = useSWR<CommunityJourney>(id ? `/community/${id}` : null, get, {
    revalidateOnFocus: false,
  });

  return {
    journey: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
