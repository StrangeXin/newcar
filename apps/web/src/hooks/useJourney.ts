'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { Journey } from '@/types/api';

export function useJourney() {
  const swr = useSWR<Journey | null>(
    '/journeys/active',
    async (path: string) => {
      try {
        return await get<Journey>(path);
      } catch (error) {
        const message = (error as Error).message || '';
        if (message.includes('No active journey found')) {
          return null;
        }
        throw error;
      }
    },
    {
    revalidateOnFocus: false,
  });

  return {
    journey: swr.data,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
