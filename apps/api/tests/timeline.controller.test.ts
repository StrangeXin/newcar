import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../src/middleware/auth';

// Mock prisma
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    journey: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock timeline service
vi.mock('../src/services/timeline.service', () => ({
  timelineService: {
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    getEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

import { timelineController } from '../src/controllers/timeline.controller';
import { prisma } from '../src/lib/prisma';
import { timelineService } from '../src/services/timeline.service';

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
  // Default: journey exists and belongs to user
  vi.mocked(prisma.journey.findUnique).mockResolvedValue({
    userId: 'user-1',
  } as any);
});

describe('TimelineController', () => {
  describe('list', () => {
    it('calls timelineService.listEvents with correct params and returns events', async () => {
      const events = [{ id: 'e1' }, { id: 'e2' }];
      vi.mocked(timelineService.listEvents).mockResolvedValue(events as any);

      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        query: { limit: '10', cursor: 'abc' } as any,
      });
      const res = mockRes();

      await timelineController.list(req, res);

      expect(timelineService.listEvents).toHaveBeenCalledWith('j1', {
        limit: 10,
        cursor: 'abc',
      });
      expect(res.json).toHaveBeenCalledWith({ events });
    });

    it('returns 403 when user does not own the journey', async () => {
      vi.mocked(prisma.journey.findUnique).mockResolvedValue({
        userId: 'other-user',
      } as any);

      const req = mockReq({ params: { journeyId: 'j1' } as any });
      const res = mockRes();

      await timelineController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when journey not found', async () => {
      vi.mocked(prisma.journey.findUnique).mockResolvedValue(null);

      const req = mockReq({ params: { journeyId: 'j1' } as any });
      const res = mockRes();

      await timelineController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('create', () => {
    it('calls timelineService.createEvent and returns 201', async () => {
      const created = { id: 'e1', type: 'note', content: 'hello' };
      vi.mocked(timelineService.createEvent).mockResolvedValue(created as any);

      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        body: { type: 'note', content: 'hello' },
      });
      const res = mockRes();

      await timelineController.create(req, res);

      expect(timelineService.createEvent).toHaveBeenCalledWith({
        journeyId: 'j1',
        type: 'note',
        content: 'hello',
        metadata: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it('returns 400 when type or content is missing', async () => {
      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        body: { type: 'note' },
      });
      const res = mockRes();

      await timelineController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'type and content are required' });
    });
  });

  describe('get', () => {
    it('returns a single event by id', async () => {
      const event = { id: 'e1', content: 'test' };
      vi.mocked(timelineService.getEvent).mockResolvedValue(event as any);

      const req = mockReq({
        params: { journeyId: 'j1', eventId: 'e1' } as any,
      });
      const res = mockRes();

      await timelineController.get(req, res);

      expect(timelineService.getEvent).toHaveBeenCalledWith('j1', 'e1');
      expect(res.json).toHaveBeenCalledWith(event);
    });

    it('returns 404 when event not found', async () => {
      vi.mocked(timelineService.getEvent).mockResolvedValue(null as any);

      const req = mockReq({
        params: { journeyId: 'j1', eventId: 'e1' } as any,
      });
      const res = mockRes();

      await timelineController.get(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('updates event content', async () => {
      const updated = { id: 'e1', content: 'updated' };
      vi.mocked(timelineService.updateEvent).mockResolvedValue(updated as any);

      const req = mockReq({
        params: { journeyId: 'j1', eventId: 'e1' } as any,
        body: { content: 'updated' },
      });
      const res = mockRes();

      await timelineController.update(req, res);

      expect(timelineService.updateEvent).toHaveBeenCalledWith('e1', {
        content: 'updated',
      });
      expect(res.json).toHaveBeenCalledWith(updated);
    });
  });

  describe('remove', () => {
    it('deletes event and returns result', async () => {
      const deleted = { id: 'e1' };
      vi.mocked(timelineService.deleteEvent).mockResolvedValue(deleted as any);

      const req = mockReq({
        params: { journeyId: 'j1', eventId: 'e1' } as any,
      });
      const res = mockRes();

      await timelineController.remove(req, res);

      expect(timelineService.deleteEvent).toHaveBeenCalledWith('e1');
      expect(res.json).toHaveBeenCalledWith(deleted);
    });
  });
});
