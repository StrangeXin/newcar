'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { CommunityJourney } from '@/types/api';

interface CommunityListResponse {
  items: CommunityJourney[];
  total: number;
  limit: number;
  offset: number;
}

export function useCommunity(queryString: string) {
  const path = `/community${queryString ? `?${queryString}` : ''}`;
  const swr = useSWR<CommunityListResponse>(path, get, {
    revalidateOnFocus: true,
  });

  return {
    data: swr.data,
    items: swr.data?.items || [],
    total: swr.data?.total || 0,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
