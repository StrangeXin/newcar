export const JOURNEY_SIDE_EFFECT_EVENT = 'journey:side-effect';

export type JourneySideEffectEvent =
  | { event: 'candidate_added'; journeyId: string; data: unknown }
  | { event: 'journey_updated'; journeyId: string; data: unknown }
  | { event: 'stage_changed'; journeyId: string; data: unknown };

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
