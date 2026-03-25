'use client';

import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api';
import { CommunityJourney } from '@/types/api';

interface CommunityListResponse {
  items: CommunityJourney[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

export function useCommunity(queryString: string) {
  const [items, setItems] = useState<CommunityJourney[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const path = useMemo(
    () => `/community${queryString ? `?${queryString}&limit=${PAGE_SIZE}&offset=${offset}` : `?limit=${PAGE_SIZE}&offset=${offset}`}`,
    [queryString, offset]
  );

  useEffect(() => {
    setItems([]);
    setTotal(0);
    setOffset(0);
    setError(undefined);
    setIsLoading(true);
  }, [queryString]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (offset === 0) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const data = await get<CommunityListResponse>(path);
        if (cancelled) {
          return;
        }

        setItems((current) => (offset === 0 ? data.items : [...current, ...data.items]));
        setTotal(data.total);
        setError(undefined);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [offset, path]);

  return {
    items,
    total,
    isLoading,
    isLoadingMore,
    hasMore: items.length < total,
    error,
    loadMore: () => {
      if (isLoading || isLoadingMore || items.length >= total) return;
      setOffset((current) => current + PAGE_SIZE);
    },
    refresh: () => {
      setOffset(0);
      setItems([]);
      setTotal(0);
      setError(undefined);
      setIsLoading(true);
    },
  };
}
