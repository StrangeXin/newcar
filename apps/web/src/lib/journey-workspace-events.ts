import type { TimelineEvent } from '@/types/api';

export const JOURNEY_SIDE_EFFECT_EVENT = 'journey:side-effect';

export type JourneySideEffectEvent =
  | { event: 'candidate_added'; journeyId: string; data: unknown }
  | { event: 'candidate_eliminated'; journeyId: string; data: unknown }
  | { event: 'candidate_winner'; journeyId: string; data: unknown }
  | { event: 'journey_updated'; journeyId: string; data: unknown }
  | { event: 'stage_changed'; journeyId: string; data: unknown }
  | { event: 'ai_insight'; journeyId: string; data: unknown }
  | { event: 'publish_suggestion'; journeyId: string; data: unknown }
  | { event: 'journey_published'; journeyId: string; data: unknown }
  | { event: 'timeline_event'; journeyId: string; data: TimelineEvent };

export function dispatchJourneySideEffect(detail: JourneySideEffectEvent) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<JourneySideEffectEvent>(JOURNEY_SIDE_EFFECT_EVENT, {
      detail,
    })
  );
}
