import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../src/middleware/auth';

// Mock prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    journey: {
      findUnique: vi.fn(),
    },
    publishedJourney: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock publish service
vi.mock('../src/services/publish.service', () => ({
  publishService: {
    publishJourney: vi.fn(),
    previewPublish: vi.fn(),
    regeneratePublishedContent: vi.fn(),
  },
}));

// Mock community service
vi.mock('../src/services/community.service', () => ({
  communityService: {
    invalidateCommunityListCache: vi.fn().mockResolvedValue(undefined),
  },
}));

import { publishedJourneyController } from '../src/controllers/published-journey.controller';
import { prisma } from '../src/lib/prisma';
import { publishService } from '../src/services/publish.service';

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    params: {},
    query: {},
    body: {},
    userId: 'user-1',
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublishedJourneyController', () => {
  describe('publish', () => {
    it('calls publishService.publishJourney with correct args and returns 201', async () => {
      vi.mocked(prisma.journey.findUnique).mockResolvedValue({
        id: 'j1',
        userId: 'user-1',
      } as any);
      const result = { id: 'pub1', title: 'My Journey' };
      vi.mocked(publishService.publishJourney).mockResolvedValue(result as any);

      const req = mockReq({
        params: { id: 'j1' } as any,
        body: {
          title: 'My Journey',
          description: 'desc',
          publishedFormats: ['story'],
          visibility: 'PUBLIC',
        },
      });
      const res = mockRes();

      await publishedJourneyController.publish(req, res);

      expect(publishService.publishJourney).toHaveBeenCalledWith('j1', {
        title: 'My Journey',
        description: 'desc',
        publishedFormats: ['story'],
        visibility: 'PUBLIC',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('returns 400 when publishedFormats is empty', async () => {
      const req = mockReq({
        params: { id: 'j1' } as any,
        body: {
          title: 'My Journey',
          publishedFormats: [],
        },
      });
      const res = mockRes();

      await publishedJourneyController.publish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'publishedFormats must be a non-empty array',
      });
    });

    it('returns 400 when title is missing', async () => {
      const req = mockReq({
        params: { id: 'j1' } as any,
        body: { publishedFormats: ['story'] },
      });
      const res = mockRes();

      await publishedJourneyController.publish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });

    it('returns 401 when userId is missing', async () => {
      const req = mockReq({
        params: { id: 'j1' } as any,
        userId: undefined,
        body: { title: 'x', publishedFormats: ['story'] },
      });
      const res = mockRes();

      await publishedJourneyController.publish(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('preview', () => {
    it('calls publishService.previewPublish and returns result', async () => {
      vi.mocked(prisma.journey.findUnique).mockResolvedValue({
        id: 'j1',
        userId: 'user-1',
      } as any);
      const preview = { story: 'content' };
      vi.mocked(publishService.previewPublish).mockResolvedValue(preview as any);

      const req = mockReq({
        params: { id: 'j1' } as any,
        query: { formats: 'story,report' } as any,
      });
      const res = mockRes();

      await publishedJourneyController.preview(req, res);

      expect(publishService.previewPublish).toHaveBeenCalledWith('j1', ['story', 'report']);
      expect(res.json).toHaveBeenCalledWith(preview);
    });
  });

  describe('regenerate', () => {
    it('calls publishService.regeneratePublishedContent', async () => {
      vi.mocked(prisma.publishedJourney.findUnique).mockResolvedValue({
        id: 'pub1',
        userId: 'user-1',
      } as any);
      const result = { id: 'pub1', storyContent: 'new' };
      vi.mocked(publishService.regeneratePublishedContent).mockResolvedValue(result as any);

      const req = mockReq({
        params: { id: 'pub1' } as any,
        body: { format: 'story' },
      });
      const res = mockRes();

      await publishedJourneyController.regenerate(req, res);

      expect(publishService.regeneratePublishedContent).toHaveBeenCalledWith('pub1', 'story');
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('returns 400 for invalid format', async () => {
      const req = mockReq({
        params: { id: 'pub1' } as any,
        body: { format: 'invalid' },
      });
      const res = mockRes();

      await publishedJourneyController.regenerate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid format' });
    });
  });

  describe('unpublish', () => {
    it('updates contentStatus to AUTHOR_DELETED', async () => {
      vi.mocked(prisma.publishedJourney.findUnique).mockResolvedValue({
        id: 'pub1',
        userId: 'user-1',
      } as any);
      const updated = { id: 'pub1', contentStatus: 'AUTHOR_DELETED' };
      vi.mocked(prisma.publishedJourney.update).mockResolvedValue(updated as any);

      const req = mockReq({ params: { id: 'pub1' } as any });
      const res = mockRes();

      await publishedJourneyController.unpublish(req, res);

      expect(prisma.publishedJourney.update).toHaveBeenCalledWith({
        where: { id: 'pub1' },
        data: { contentStatus: 'AUTHOR_DELETED' },
      });
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('returns 404 when published journey not found', async () => {
      vi.mocked(prisma.publishedJourney.findUnique).mockResolvedValue(null);

      const req = mockReq({ params: { id: 'pub1' } as any });
      const res = mockRes();

      await publishedJourneyController.unpublish(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getOne', () => {
    it('returns published journey', async () => {
      const published = {
        id: 'pub1',
        contentStatus: 'PUBLISHED',
        user: { id: 'u1', nickname: 'Nick', avatar: null },
        journey: { stage: 'AWARENESS', status: 'ACTIVE' },
      };
      vi.mocked(prisma.publishedJourney.findUnique).mockResolvedValue(published as any);
      vi.mocked(prisma.publishedJourney.update).mockResolvedValue({} as any);

      const req = mockReq({ params: { id: 'pub1' } as any });
      const res = mockRes();

      await publishedJourneyController.getOne(req, res);

      expect(res.json).toHaveBeenCalledWith(published);
    });

    it('returns 404 for deleted content', async () => {
      vi.mocked(prisma.publishedJourney.findUnique).mockResolvedValue({
        id: 'pub1',
        contentStatus: 'AUTHOR_DELETED',
      } as any);

      const req = mockReq({ params: { id: 'pub1' } as any });
      const res = mockRes();

      await publishedJourneyController.getOne(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
