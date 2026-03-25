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

import { timelineService } from '../src/services/timeline.service';

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
});
