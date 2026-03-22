'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { NotificationItem } from '@/types/api';

export function useNotifications() {
  const swr = useSWR<NotificationItem[]>('/notifications', get, {
    refreshInterval: 2 * 60 * 1000,
    revalidateOnFocus: true,
  });

  return {
    notifications: swr.data || [],
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
