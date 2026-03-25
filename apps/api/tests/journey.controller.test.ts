import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../src/middleware/auth';

// Mock journey service
vi.mock('../src/services/journey.service', () => ({
  journeyService: {
    createJourney: vi.fn(),
    getActiveJourney: vi.fn(),
    advanceStage: vi.fn(),
    pauseJourney: vi.fn(),
    completeJourney: vi.fn(),
    recordBehaviorEvent: vi.fn(),
  },
}));

// Mock @newcar/shared to provide JourneyStage enum
vi.mock('@newcar/shared', () => ({
  JourneyStage: {
    AWARENESS: 'AWARENESS',
    CONSIDERATION: 'CONSIDERATION',
    COMPARISON: 'COMPARISON',
    DECISION: 'DECISION',
    PURCHASE: 'PURCHASE',
  },
}));

import { journeyController } from '../src/controllers/journey.controller';
import { journeyService } from '../src/services/journey.service';

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    params: {},
    query: {},
    body: {},
    userId: 'user-1',
    sessionId: 'session-1',
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

describe('JourneyController', () => {
  describe('createJourney', () => {
    it('calls journeyService.createJourney and returns 201', async () => {
      const journey = { id: 'j1', title: 'My Car' };
      vi.mocked(journeyService.createJourney).mockResolvedValue(journey as any);

      const req = mockReq({
        body: { title: 'My Car', requirements: { budget: 200000 } },
      });
      const res = mockRes();

      await journeyController.createJourney(req, res);

      expect(journeyService.createJourney).toHaveBeenCalledWith('user-1', {
        title: 'My Car',
        requirements: { budget: 200000 },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(journey);
    });

    it('returns 401 when userId is missing', async () => {
      const req = mockReq({ userId: undefined, body: { title: 'x' } });
      const res = mockRes();

      await journeyController.createJourney(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 400 when title is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await journeyController.createJourney(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });
  });

  describe('getActiveJourney', () => {
    it('returns journey when found', async () => {
      const journey = { id: 'j1', status: 'ACTIVE' };
      vi.mocked(journeyService.getActiveJourney).mockResolvedValue(journey as any);

      const req = mockReq();
      const res = mockRes();

      await journeyController.getActiveJourney(req, res);

      expect(journeyService.getActiveJourney).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(journey);
    });

    it('returns 404 when no active journey', async () => {
      vi.mocked(journeyService.getActiveJourney).mockResolvedValue(null as any);

      const req = mockReq();
      const res = mockRes();

      await journeyController.getActiveJourney(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No active journey found' });
    });
  });

  describe('advanceStage', () => {
    it('calls journeyService.advanceStage with target stage', async () => {
      const journey = { id: 'j1', stage: 'CONSIDERATION' };
      vi.mocked(journeyService.advanceStage).mockResolvedValue(journey as any);

      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        body: { stage: 'CONSIDERATION' },
      });
      const res = mockRes();

      await journeyController.advanceStage(req, res);

      expect(journeyService.advanceStage).toHaveBeenCalledWith('j1', 'CONSIDERATION');
      expect(res.json).toHaveBeenCalledWith(journey);
    });

    it('returns 400 for invalid stage', async () => {
      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        body: { stage: 'INVALID_STAGE' },
      });
      const res = mockRes();

      await journeyController.advanceStage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid stage' });
    });
  });

  describe('recordBehaviorEvent', () => {
    it('calls journeyService.recordBehaviorEvent and returns 201', async () => {
      const event = { id: 'ev1', type: 'VIEW' };
      vi.mocked(journeyService.recordBehaviorEvent).mockResolvedValue(event as any);

      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        body: {
          type: 'VIEW',
          targetType: 'CAR',
          targetId: 'car-1',
          metadata: { source: 'list' },
        },
      });
      const res = mockRes();

      await journeyController.recordBehaviorEvent(req, res);

      expect(journeyService.recordBehaviorEvent).toHaveBeenCalledWith({
        journeyId: 'j1',
        userId: 'user-1',
        sessionId: 'session-1',
        type: 'VIEW',
        targetType: 'CAR',
        targetId: 'car-1',
        metadata: { source: 'list' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(event);
    });

    it('returns 400 when sessionId is missing', async () => {
      const req = mockReq({
        params: { journeyId: 'j1' } as any,
        sessionId: undefined,
        body: { type: 'VIEW' },
      });
      const res = mockRes();

      await journeyController.recordBehaviorEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing session' });
    });
  });
});
