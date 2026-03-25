import { prisma } from '../lib/prisma';

export const TIMELINE_EVENT_TYPES = {
  CANDIDATE_ADDED: 'CANDIDATE_ADDED',
  CANDIDATE_ELIMINATED: 'CANDIDATE_ELIMINATED',
  CANDIDATE_WINNER: 'CANDIDATE_WINNER',
  STAGE_CHANGED: 'STAGE_CHANGED',
  REQUIREMENT_UPDATED: 'REQUIREMENT_UPDATED',
  AI_INSIGHT: 'AI_INSIGHT',
  PRICE_CHANGE: 'PRICE_CHANGE',
  USER_ACTION: 'USER_ACTION',
  PUBLISH_SUGGESTION: 'PUBLISH_SUGGESTION',
  JOURNEY_PUBLISHED: 'JOURNEY_PUBLISHED',
} as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[keyof typeof TIMELINE_EVENT_TYPES];

export interface TimelineEventRecord {
  id: string;
  journeyId: string;
  type: TimelineEventType | string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateTimelineEventInput {
  journeyId: string;
  type: TimelineEventType | string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ListTimelineEventsOptions {
  limit?: number;
  cursor?: string;
}

function normalizeMetadata(metadata?: Record<string, unknown>) {
  return (metadata || {}) as Record<string, unknown>;
}

function getCandidateLabel(candidate: {
  car?: { brand?: string; model?: string; variant?: string | null } | null;
  carName?: string;
  brand?: string;
  model?: string;
  variant?: string | null;
}) {
  if (candidate.car) {
    return [candidate.car.brand, candidate.car.model, candidate.car.variant].filter(Boolean).join(' ').trim();
  }

  if (candidate.carName) {
    return candidate.carName;
  }

  return [candidate.brand, candidate.model, candidate.variant].filter(Boolean).join(' ').trim();
}

function getStageLabel(stage?: string | null) {
  switch (stage) {
    case 'AWARENESS':
      return '认知期';
    case 'CONSIDERATION':
      return '考虑期';
    case 'COMPARISON':
      return '对比期';
    case 'DECISION':
      return '决策期';
    case 'PURCHASE':
      return '购买期';
    default:
      return stage || '未知阶段';
  }
}

export function buildTimelineEventContent(
  type: TimelineEventType | string,
  payload: Record<string, unknown> = {}
) {
  switch (type) {
    case TIMELINE_EVENT_TYPES.CANDIDATE_ADDED:
      return `AI 推荐了 ${getCandidateLabel(payload as Record<string, any>) || '一款车型'}`;
    case TIMELINE_EVENT_TYPES.CANDIDATE_ELIMINATED:
      return `候选车 ${getCandidateLabel(payload as Record<string, any>) || '已淘汰车型'} 已被淘汰`;
    case TIMELINE_EVENT_TYPES.CANDIDATE_WINNER:
      return `候选车 ${getCandidateLabel(payload as Record<string, any>) || '已选定车型'} 已被选定`;
    case TIMELINE_EVENT_TYPES.STAGE_CHANGED:
      return `旅程阶段推进至 ${getStageLabel(String(payload.stage || ''))}`;
    case TIMELINE_EVENT_TYPES.REQUIREMENT_UPDATED:
      return '旅程需求已更新';
    case TIMELINE_EVENT_TYPES.AI_INSIGHT:
      return String(payload.content || payload.insight || 'AI 生成了一条洞察');
    case TIMELINE_EVENT_TYPES.PRICE_CHANGE:
      return `${getCandidateLabel(payload as Record<string, any>) || '车型'} 价格有变化`;
    case TIMELINE_EVENT_TYPES.USER_ACTION:
      return String(payload.content || '用户执行了一个操作');
    case TIMELINE_EVENT_TYPES.PUBLISH_SUGGESTION:
      return `当前阶段已进入 ${getStageLabel(String(payload.stage || ''))}，可以考虑发布旅程总结`;
    case TIMELINE_EVENT_TYPES.JOURNEY_PUBLISHED:
      return '旅程已发布';
    default:
      return String(payload.content || type);
  }
}

export class TimelineService {
  async createEvent(input: CreateTimelineEventInput): Promise<TimelineEventRecord> {
    return (prisma as any).timelineEvent.create({
      data: {
        journeyId: input.journeyId,
        type: input.type,
        content: input.content,
        metadata: normalizeMetadata(input.metadata),
      },
    });
  }

  async listEvents(journeyId: string, options: ListTimelineEventsOptions = {}): Promise<TimelineEventRecord[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));

    return (prisma as any).timelineEvent.findMany({
      where: { journeyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    });
  }

  async getEvent(journeyId: string, eventId: string): Promise<TimelineEventRecord | null> {
    return (prisma as any).timelineEvent.findFirst({
      where: {
        id: eventId,
        journeyId,
      },
    });
  }

  async updateEvent(
    eventId: string,
    input: Partial<Pick<CreateTimelineEventInput, 'type' | 'content' | 'metadata'>>
  ): Promise<TimelineEventRecord> {
    return (prisma as any).timelineEvent.update({
      where: { id: eventId },
      data: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.content ? { content: input.content } : {}),
        ...(input.metadata ? { metadata: normalizeMetadata(input.metadata) } : {}),
      },
    });
  }

  async deleteEvent(eventId: string): Promise<TimelineEventRecord> {
    return (prisma as any).timelineEvent.delete({
      where: { id: eventId },
    });
  }
}

export const timelineService = new TimelineService();
