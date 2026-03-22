'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { Journey } from '@/types/api';

export function useJourney() {
  const swr = useSWR<Journey>('/journeys/active', get, {
    revalidateOnFocus: false,
  });

  return {
    journey: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
