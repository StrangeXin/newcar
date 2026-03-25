export enum TimelineEventType {
  CANDIDATE_ADDED = 'CANDIDATE_ADDED',
  CANDIDATE_ELIMINATED = 'CANDIDATE_ELIMINATED',
  CANDIDATE_WINNER = 'CANDIDATE_WINNER',
  STAGE_CHANGED = 'STAGE_CHANGED',
  REQUIREMENT_UPDATED = 'REQUIREMENT_UPDATED',
  AI_INSIGHT = 'AI_INSIGHT',
  PRICE_CHANGE = 'PRICE_CHANGE',
  USER_ACTION = 'USER_ACTION',
  PUBLISH_SUGGESTION = 'PUBLISH_SUGGESTION',
  JOURNEY_PUBLISHED = 'JOURNEY_PUBLISHED',
}

export interface TimelineEventData {
  id: string;
  journeyId: string;
  type: TimelineEventType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
