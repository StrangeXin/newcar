'use client';

import useSWR from 'swr';
import { get } from '@/lib/api';
import { Candidate } from '@/types/api';

interface CandidateResponse {
  candidates: Candidate[];
}

export function useCandidates(journeyId?: string) {
  const key = journeyId ? `/journeys/${journeyId}/candidates` : null;
  const swr = useSWR<CandidateResponse>(key, get, {
    revalidateOnFocus: false,
  });

  return {
    candidates: swr.data?.candidates || [],
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
