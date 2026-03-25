import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMessageMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: createMessageMock,
    },
  })),
}));

vi.mock('../src/config', () => ({
  config: {
    ai: {
      apiKey: 'test-key',
      baseURL: 'https://example.com',
      model: 'test-model',
      maxTokens: 1024,
    },
  },
}));

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    publishedJourney: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../src/lib/prisma';
import { moderationService } from '../src/services/moderation.service';

const mockedPrisma = prisma as any;

describe('ModerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('preReview', () => {
    it('returns { passed: true } when content is clean', async () => {
      createMessageMock.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ passed: true }),
          },
        ],
      });

      const result = await moderationService.preReview('我今天去4S店看了Model Y，空间很大');

      expect(result).toEqual({ passed: true });
      expect(createMessageMock).toHaveBeenCalledOnce();
    });

    it('returns { passed: false, reason } when content is flagged', async () => {
      createMessageMock.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              passed: false,
              reason: '内容包含商业广告推广',
            }),
          },
        ],
      });

      const result = await moderationService.preReview('快来买这款车吧，限时优惠');

      expect(result).toEqual({
        passed: false,
        reason: '内容包含商业广告推广',
      });
    });

    it('returns { passed: true } when AI response has no JSON match', async () => {
      createMessageMock.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'I cannot process this request',
          },
        ],
      });

      const result = await moderationService.preReview('some content');

      expect(result).toEqual({ passed: true });
    });

    it('returns { passed: true } when AI response content block is not text', async () => {
      createMessageMock.mockResolvedValue({
        content: [
          {
            type: 'image',
          },
        ],
      });

      const result = await moderationService.preReview('some content');

      // text is '', no JSON match => { passed: true }
      expect(result).toEqual({ passed: true });
    });

    it('handles AI API errors gracefully and returns passed: true as fallback', async () => {
      createMessageMock.mockRejectedValue(new Error('API rate limit exceeded'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await moderationService.preReview('some content');

      expect(result).toEqual({ passed: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        'ModerationService.preReview error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles JSON with extra text around it', async () => {
      createMessageMock.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '审核结果如下：\n{"passed": false, "reason": "虚假信息"}\n请注意',
          },
        ],
      });

      const result = await moderationService.preReview('some content');

      expect(result).toEqual({ passed: false, reason: '虚假信息' });
    });
  });

  describe('getReviewQueue', () => {
    it('returns pending items with pagination', async () => {
      const mockItems = [
        { id: 'pj-1', contentStatus: 'PENDING_REVIEW', user: { id: 'u1' }, journey: { id: 'j1' } },
        { id: 'pj-2', contentStatus: 'PENDING_REVIEW', user: { id: 'u2' }, journey: { id: 'j2' } },
      ];
      mockedPrisma.publishedJourney.findMany.mockResolvedValue(mockItems);
      mockedPrisma.publishedJourney.count.mockResolvedValue(5);

      const result = await moderationService.getReviewQueue(1, 10);

      expect(result).toEqual({
        items: mockItems,
        total: 5,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      expect(mockedPrisma.publishedJourney.findMany).toHaveBeenCalledWith({
        where: { contentStatus: 'PENDING_REVIEW' },
        skip: 0,
        take: 10,
        orderBy: { publishedAt: 'asc' },
        include: { user: true, journey: true },
      });
    });

    it('calculates skip correctly for page 2', async () => {
      mockedPrisma.publishedJourney.findMany.mockResolvedValue([]);
      mockedPrisma.publishedJourney.count.mockResolvedValue(0);

      await moderationService.getReviewQueue(2, 5);

      expect(mockedPrisma.publishedJourney.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 })
      );
    });

    it('calculates totalPages correctly', async () => {
      mockedPrisma.publishedJourney.findMany.mockResolvedValue([]);
      mockedPrisma.publishedJourney.count.mockResolvedValue(23);

      const result = await moderationService.getReviewQueue(1, 10);

      expect(result.totalPages).toBe(3);
    });
  });

  describe('approveContent', () => {
    it('updates content status to LIVE', async () => {
      const updated = { id: 'pj-1', contentStatus: 'LIVE' };
      mockedPrisma.publishedJourney.update.mockResolvedValue(updated);

      const result = await moderationService.approveContent('pj-1');

      expect(result).toEqual(updated);
      expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pj-1' },
        data: { contentStatus: 'LIVE' },
      });
    });
  });

  describe('rejectContent', () => {
    it('updates status to REJECTED with reason and merges existing tags', async () => {
      mockedPrisma.publishedJourney.findUnique.mockResolvedValue({
        tags: { featured: true },
      });
      const updated = {
        id: 'pj-1',
        contentStatus: 'REJECTED',
        tags: { featured: true, rejectionReason: '违规内容' },
      };
      mockedPrisma.publishedJourney.update.mockResolvedValue(updated);

      const result = await moderationService.rejectContent('pj-1', '违规内容');

      expect(result).toEqual(updated);
      expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pj-1' },
        data: {
          contentStatus: 'REJECTED',
          tags: {
            featured: true,
            rejectionReason: '违规内容',
          },
        },
      });
    });

    it('handles null existing tags', async () => {
      mockedPrisma.publishedJourney.findUnique.mockResolvedValue({ tags: null });
      mockedPrisma.publishedJourney.update.mockResolvedValue({});

      await moderationService.rejectContent('pj-1', '虚假信息');

      expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pj-1' },
        data: {
          contentStatus: 'REJECTED',
          tags: { rejectionReason: '虚假信息' },
        },
      });
    });

    it('handles missing record (findUnique returns null)', async () => {
      mockedPrisma.publishedJourney.findUnique.mockResolvedValue(null);
      mockedPrisma.publishedJourney.update.mockResolvedValue({});

      await moderationService.rejectContent('pj-1', 'reason');

      expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pj-1' },
        data: {
          contentStatus: 'REJECTED',
          tags: { rejectionReason: 'reason' },
        },
      });
    });

    it('handles array tags by treating as empty object', async () => {
      mockedPrisma.publishedJourney.findUnique.mockResolvedValue({ tags: ['tag1'] });
      mockedPrisma.publishedJourney.update.mockResolvedValue({});

      await moderationService.rejectContent('pj-1', 'reason');

      expect(mockedPrisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pj-1' },
        data: {
          contentStatus: 'REJECTED',
          tags: { rejectionReason: 'reason' },
        },
      });
    });
  });
});
