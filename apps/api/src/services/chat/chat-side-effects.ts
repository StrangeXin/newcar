/**
 * Chat side-effect dispatch — timeline event creation for each
 * side-effect type emitted by the AI tool pipeline.
 */

import { JourneyStage } from '@newcar/shared';
import { buildTimelineEventContent, TIMELINE_EVENT_TYPES, timelineService } from '../timeline.service';
import type { ChatSideEffect } from '../../tools/chat-tools';

export interface SideEffectResult {
  data: Record<string, unknown>;
  timelineEvent?: unknown;
  patch?: {
    candidates?: unknown[];
    stage?: string;
    requirements?: Record<string, unknown>;
  };
}

export async function createTimelineEventForSideEffect(
  journeyId: string,
  event: ChatSideEffect['event'],
  data: unknown,
): Promise<SideEffectResult> {
  const payload =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  if (event === 'candidate_added') {
    const candidate = (payload.candidate as Record<string, unknown> | undefined) || payload;
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.CANDIDATE_ADDED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.CANDIDATE_ADDED, candidate),
      metadata: {
        candidateId: String(candidate.id || payload.id || ''),
        carId: String(candidate.carId || ''),
        carName: candidate.car
          ? `${String((candidate.car as Record<string, unknown>).brand || '')} ${String((candidate.car as Record<string, unknown>).model || '')}`.trim()
          : undefined,
        matchTags: candidate.matchTags,
        recommendReason: candidate.recommendReason,
        relevantDimensions: candidate.relevantDimensions,
      },
    });

    return { data: payload, timelineEvent };
  }

  if (event === 'candidate_eliminated') {
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.CANDIDATE_ELIMINATED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.CANDIDATE_ELIMINATED, payload),
      metadata: {
        candidateId: String(payload.candidateId || payload.id || ''),
        eliminationReason: payload.eliminationReason,
      },
    });

    return { data: payload, timelineEvent };
  }

  if (event === 'candidate_winner') {
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.CANDIDATE_WINNER,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.CANDIDATE_WINNER, payload),
      metadata: {
        candidateId: String(payload.candidateId || payload.id || ''),
      },
    });

    return { data: payload, timelineEvent };
  }

  if (event === 'journey_updated') {
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.REQUIREMENT_UPDATED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.REQUIREMENT_UPDATED, payload),
      metadata: {
        requirements: payload,
      },
    });

    return { data: payload, timelineEvent, patch: { requirements: payload } };
  }

  if (event === 'stage_changed') {
    const stage = String(payload.stage || '');
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.STAGE_CHANGED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.STAGE_CHANGED, { stage }),
      metadata: { stage },
    });

    return { data: payload, timelineEvent, patch: { stage } };
  }

  if (event === 'publish_suggestion') {
    const stage = String(payload.stage || '');
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.PUBLISH_SUGGESTION,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.PUBLISH_SUGGESTION, { stage }),
      metadata: { stage },
    });

    return { data: payload, timelineEvent };
  }

  if (event === 'journey_published') {
    const timelineEvent = await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.JOURNEY_PUBLISHED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.JOURNEY_PUBLISHED, payload),
      metadata: payload,
    });

    return { data: payload, timelineEvent };
  }

  return { data: payload };
}

export function shouldSuggestPublish(stage?: string): boolean {
  return stage === JourneyStage.DECISION || stage === JourneyStage.PURCHASE;
}
