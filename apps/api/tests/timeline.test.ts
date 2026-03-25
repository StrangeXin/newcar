import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    timelineEvent: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

import { buildTimelineEventContent, timelineService } from '../src/services/timeline.service';

describe('buildTimelineEventContent', () => {
  it('CANDIDATE_ADDED produces correct content with car brand+model', () => {
    const result = buildTimelineEventContent('CANDIDATE_ADDED', {
      car: { brand: '理想', model: 'L6', variant: 'Max' },
    });
    expect(result).toBe('AI 推荐了 理想 L6 Max');
  });

  it('CANDIDATE_ADDED falls back when no candidate info', () => {
    const result = buildTimelineEventContent('CANDIDATE_ADDED', {});
    expect(result).toBe('AI 推荐了 一款车型');
  });

  it('CANDIDATE_ADDED uses carName when no car object', () => {
    const result = buildTimelineEventContent('CANDIDATE_ADDED', { carName: '比亚迪 海豹' });
    expect(result).toBe('AI 推荐了 比亚迪 海豹');
  });

  it('CANDIDATE_ADDED uses brand/model/variant fields', () => {
    const result = buildTimelineEventContent('CANDIDATE_ADDED', { brand: 'Tesla', model: 'Model Y' });
    expect(result).toBe('AI 推荐了 Tesla Model Y');
  });

  it('CANDIDATE_ELIMINATED includes car name', () => {
    const result = buildTimelineEventContent('CANDIDATE_ELIMINATED', {
      car: { brand: '小鹏', model: 'G6' },
    });
    expect(result).toBe('候选车 小鹏 G6 已被淘汰');
  });

  it('CANDIDATE_ELIMINATED falls back when no candidate info', () => {
    const result = buildTimelineEventContent('CANDIDATE_ELIMINATED', {});
    expect(result).toBe('候选车 已淘汰车型 已被淘汰');
  });

  it('CANDIDATE_WINNER produces correct winner text', () => {
    const result = buildTimelineEventContent('CANDIDATE_WINNER', {
      car: { brand: '比亚迪', model: '海豹', variant: 'DM-i' },
    });
    expect(result).toBe('候选车 比亚迪 海豹 DM-i 已被选定');
  });

  it('CANDIDATE_WINNER falls back when no candidate info', () => {
    const result = buildTimelineEventContent('CANDIDATE_WINNER', {});
    expect(result).toBe('候选车 已选定车型 已被选定');
  });

  it('STAGE_CHANGED includes stage label', () => {
    const result = buildTimelineEventContent('STAGE_CHANGED', { stage: 'DECISION' });
    expect(result).toBe('旅程阶段推进至 决策期');
  });

  it('STAGE_CHANGED with unknown stage uses stage string', () => {
    const result = buildTimelineEventContent('STAGE_CHANGED', { stage: 'CUSTOM_STAGE' });
    expect(result).toBe('旅程阶段推进至 CUSTOM_STAGE');
  });

  it('AI_INSIGHT uses metadata.content', () => {
    const result = buildTimelineEventContent('AI_INSIGHT', { content: '这款车空间表现优秀' });
    expect(result).toBe('这款车空间表现优秀');
  });

  it('AI_INSIGHT uses metadata.insight as fallback', () => {
    const result = buildTimelineEventContent('AI_INSIGHT', { insight: '价格合理' });
    expect(result).toBe('价格合理');
  });

  it('AI_INSIGHT falls back to default text', () => {
    const result = buildTimelineEventContent('AI_INSIGHT', {});
    expect(result).toBe('AI 生成了一条洞察');
  });

  it('PRICE_CHANGE includes car name', () => {
    const result = buildTimelineEventContent('PRICE_CHANGE', {
      car: { brand: '理想', model: 'L7' },
    });
    expect(result).toBe('理想 L7 价格有变化');
  });

  it('PRICE_CHANGE falls back when no candidate info', () => {
    const result = buildTimelineEventContent('PRICE_CHANGE', {});
    expect(result).toBe('车型 价格有变化');
  });

  it('USER_ACTION uses metadata.content', () => {
    const result = buildTimelineEventContent('USER_ACTION', { content: '用户预约了试驾' });
    expect(result).toBe('用户预约了试驾');
  });

  it('USER_ACTION falls back to default text', () => {
    const result = buildTimelineEventContent('USER_ACTION', {});
    expect(result).toBe('用户执行了一个操作');
  });

  it('JOURNEY_PUBLISHED produces correct text', () => {
    const result = buildTimelineEventContent('JOURNEY_PUBLISHED', {});
    expect(result).toBe('旅程已发布');
  });

  it('PUBLISH_SUGGESTION produces correct text with stage', () => {
    const result = buildTimelineEventContent('PUBLISH_SUGGESTION', { stage: 'PURCHASE' });
    expect(result).toBe('当前阶段已进入 购买期，可以考虑发布旅程总结');
  });

  it('Unknown type uses payload.content as fallback', () => {
    const result = buildTimelineEventContent('SOME_UNKNOWN_TYPE', { content: '自定义内容' });
    expect(result).toBe('自定义内容');
  });

  it('Unknown type without content falls back to type string', () => {
    const result = buildTimelineEventContent('SOME_UNKNOWN_TYPE', {});
    expect(result).toBe('SOME_UNKNOWN_TYPE');
  });

  it('REQUIREMENT_UPDATED produces correct text', () => {
    const result = buildTimelineEventContent('REQUIREMENT_UPDATED', {});
    expect(result).toBe('旅程需求已更新');
  });
});

describe('getStageLabel (via STAGE_CHANGED)', () => {
  it.each([
    ['AWARENESS', '认知期'],
    ['CONSIDERATION', '考虑期'],
    ['COMPARISON', '对比期'],
    ['DECISION', '决策期'],
    ['PURCHASE', '购买期'],
  ])('stage %s returns %s', (stage, expected) => {
    const result = buildTimelineEventContent('STAGE_CHANGED', { stage });
    expect(result).toBe(`旅程阶段推进至 ${expected}`);
  });

  it('unknown stage returns the stage string as-is', () => {
    const result = buildTimelineEventContent('STAGE_CHANGED', { stage: 'NEGOTIATION' });
    expect(result).toBe('旅程阶段推进至 NEGOTIATION');
  });

  it('empty stage returns 未知阶段', () => {
    const result = buildTimelineEventContent('STAGE_CHANGED', {});
    expect(result).toBe('旅程阶段推进至 未知阶段');
  });
});

describe('TimelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a timeline event with normalized metadata', async () => {
    const event = {
      id: 'te-1',
      journeyId: 'j-1',
      type: 'CANDIDATE_ADDED',
      content: 'AI 推荐了理想 L6',
      metadata: { candidateId: 'c-1' },
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValue(event);

    const result = await timelineService.createEvent({
      journeyId: 'j-1',
      type: 'CANDIDATE_ADDED',
      content: 'AI 推荐了理想 L6',
      metadata: { candidateId: 'c-1' },
    });

    expect(result).toEqual(event);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        journeyId: 'j-1',
        type: 'CANDIDATE_ADDED',
        content: 'AI 推荐了理想 L6',
        metadata: { candidateId: 'c-1' },
      },
    });
  });

  it('lists timeline events with cursor pagination', async () => {
    mockFindMany.mockResolvedValue([]);

    await timelineService.listEvents('j-1', { limit: 75, cursor: 'te-0' });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { journeyId: 'j-1' },
      orderBy: { createdAt: 'desc' },
      take: 75,
      cursor: { id: 'te-0' },
      skip: 1,
    });
  });

  it('gets updates and deletes events', async () => {
    mockFindFirst.mockResolvedValue({ id: 'te-1', journeyId: 'j-1' });
    mockUpdate.mockResolvedValue({ id: 'te-1', journeyId: 'j-1', content: 'updated' });
    mockDelete.mockResolvedValue({ id: 'te-1', journeyId: 'j-1' });

    const existing = await timelineService.getEvent('j-1', 'te-1');
    const updated = await timelineService.updateEvent('te-1', { content: 'updated' });
    const removed = await timelineService.deleteEvent('te-1');

    expect(existing).toEqual({ id: 'te-1', journeyId: 'j-1' });
    expect(updated).toEqual({ id: 'te-1', journeyId: 'j-1', content: 'updated' });
    expect(removed).toEqual({ id: 'te-1', journeyId: 'j-1' });
  });

  describe('listEvents pagination', () => {
    it('clamps limit of 0 to 1', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1', { limit: 0 });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 })
      );
    });

    it('clamps limit of 101 to 100', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1', { limit: 101 });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('defaults limit to 50 when undefined', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1', {});
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('defaults limit to 50 when no options provided', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1');
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('includes cursor and skip when cursor is provided', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1', { cursor: 'cursor-id' });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      );
    });

    it('does not include cursor/skip when no cursor', async () => {
      mockFindMany.mockResolvedValue([]);
      await timelineService.listEvents('j-1', { limit: 10 });
      const callArg = mockFindMany.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('cursor');
      expect(callArg).not.toHaveProperty('skip');
    });

    it('returns empty array for empty result set', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await timelineService.listEvents('j-1');
      expect(result).toEqual([]);
    });
  });

  describe('normalizeMetadata (via createEvent)', () => {
    it('null metadata becomes empty object', async () => {
      mockCreate.mockResolvedValue({ id: 'te-2' });
      await timelineService.createEvent({
        journeyId: 'j-1',
        type: 'CANDIDATE_ADDED',
        content: 'test',
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: {} }),
        })
      );
    });

    it('undefined metadata becomes empty object', async () => {
      mockCreate.mockResolvedValue({ id: 'te-2' });
      await timelineService.createEvent({
        journeyId: 'j-1',
        type: 'CANDIDATE_ADDED',
        content: 'test',
        metadata: undefined,
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: {} }),
        })
      );
    });

    it('valid object passes through', async () => {
      mockCreate.mockResolvedValue({ id: 'te-2' });
      await timelineService.createEvent({
        journeyId: 'j-1',
        type: 'CANDIDATE_ADDED',
        content: 'test',
        metadata: { key: 'value', nested: { a: 1 } },
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: { key: 'value', nested: { a: 1 } },
          }),
        })
      );
    });
  });
});
