'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { get } from '@/lib/api';
import { JOURNEY_SIDE_EFFECT_EVENT, JourneySideEffectEvent } from '@/lib/journey-workspace-events';
import { TimelineEvent } from '@/types/api';

interface TimelineResponse {
  events: TimelineEvent[];
}

export function useTimeline(journeyId?: string) {
  const key = journeyId ? `/journeys/${journeyId}/timeline?limit=100` : null;
  const swr = useSWR<TimelineResponse>(key, get, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!journeyId) {
      return;
    }

    const handleSideEffect = (event: Event) => {
      const detail = (event as CustomEvent<JourneySideEffectEvent>).detail;
      if (!detail || detail.journeyId !== journeyId) {
        return;
      }

      if (detail.event === 'timeline_event') {
        const nextEvent = detail.data as TimelineEvent;
        void swr.mutate((current) => {
          const existing = current?.events || [];
          if (existing.some((item) => item.id === nextEvent.id)) {
            return current;
          }
          return {
            events: [nextEvent, ...existing].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
          };
        }, false);
        return;
      }

      void swr.mutate();
    };

    window.addEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
    return () => window.removeEventListener(JOURNEY_SIDE_EFFECT_EVENT, handleSideEffect);
  }, [journeyId, swr]);

  return {
    events: swr.data?.events || [],
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
    refresh: swr.mutate,
  };
}
