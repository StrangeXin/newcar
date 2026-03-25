'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { get } from '@/lib/api';
import { JOURNEY_SIDE_EFFECT_EVENT, JourneySideEffectEvent } from '@/lib/journey-workspace-events';
import { Candidate } from '@/types/api';

interface CandidateResponse {
  candidates: Candidate[];
}

export function useCandidates(journeyId?: string) {
  const key = journeyId ? `/journeys/${journeyId}/candidates` : null;
  const swr = useSWR<CandidateResponse>(key, get, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!journeyId) {
      return;
    }

    const handleSideEffect = (event: Event) => {
      const detail = (event as CustomEvent<JourneySideEffectEvent>).detail;
      if (
        detail?.journeyId === journeyId &&
        (detail.event === 'candidate_added' ||
          detail.event === 'candidate_eliminated' ||
          detail.event === 'candidate_winner')
      ) {
        void swr.mutate();
      }
    };

    window.addEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
    return () => window.removeEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
  }, [journeyId, swr]);

  return {
    candidates: swr.data?.candidates || [],
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
