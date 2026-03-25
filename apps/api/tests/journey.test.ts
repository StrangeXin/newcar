import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JourneyStage, JourneyStatus } from '@newcar/shared';

// --- Pure logic tests (original) ---
describe('Journey', () => {
  it('should validate stage progression order', () => {
    const stageOrder = ['AWARENESS', 'CONSIDERATION', 'COMPARISON', 'DECISION', 'PURCHASE'];
    const currentIndex = stageOrder.indexOf('CONSIDERATION');
    const newIndex = stageOrder.indexOf('AWARENESS');

    expect(newIndex < currentIndex).toBe(true);
  });

  it('should calculate ai weight correctly for 5 min duration', () => {
    const baseWeight = 1.0;
    const durationSec = 300;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(1.0);
  });

  it('should calculate ai weight with short duration', () => {
    const baseWeight = 1.0;
    const durationSec = 60;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(0.6);
  });
});

// --- Service-level tests with mocked prisma ---
const mockedPrisma = {
  journey: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  behaviorEvent: {
    create: vi.fn(),
  },
  publishedJourney: {
    updateMany: vi.fn(),
  },
};

vi.mock('../src/lib/prisma', () => ({
  prisma: mockedPrisma,
}));

describe('JourneyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createJourney: creates with correct defaults (status ACTIVE, stage AWARENESS)', async () => {
    mockedPrisma.journey.findFirst.mockResolvedValue(null);
    const created = {
      id: 'j-1',
      userId: 'user-1',
      title: 'My Journey',
      requirements: {},
      stage: JourneyStage.AWARENESS,
      status: JourneyStatus.ACTIVE,
    };
    mockedPrisma.journey.create.mockResolvedValue(created);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.createJourney('user-1', { title: 'My Journey' });

    expect(result).toEqual(created);
    expect(mockedPrisma.journey.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'My Journey',
        requirements: {},
        stage: JourneyStage.AWARENESS,
        status: JourneyStatus.ACTIVE,
      },
    });
  });

  it('createJourney: throws when user already has an active journey', async () => {
    mockedPrisma.journey.findFirst.mockResolvedValue({ id: 'existing' });

    const { journeyService } = await import('../src/services/journey.service');
    await expect(
      journeyService.createJourney('user-1', { title: 'Another' })
    ).rejects.toThrow('User already has an active journey');
  });

  it('getActiveJourney: returns active journey for user', async () => {
    const journey = {
      id: 'j-1',
      userId: 'user-1',
      status: JourneyStatus.ACTIVE,
      candidates: [],
      snapshots: [],
    };
    mockedPrisma.journey.findFirst.mockResolvedValue(journey);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.getActiveJourney('user-1');

    expect(result).toEqual(journey);
    expect(mockedPrisma.journey.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: JourneyStatus.ACTIVE },
      include: {
        candidates: { include: { car: true } },
        snapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    });
  });

  it('getActiveJourney: returns null when none exists', async () => {
    mockedPrisma.journey.findFirst.mockResolvedValue(null);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.getActiveJourney('user-no-journey');

    expect(result).toBeNull();
  });

  it('advanceStage: advances from AWARENESS to CONSIDERATION', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue({
      id: 'j-1',
      stage: JourneyStage.AWARENESS,
    });
    const updated = { id: 'j-1', stage: JourneyStage.CONSIDERATION };
    mockedPrisma.journey.update.mockResolvedValue(updated);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.advanceStage('j-1', JourneyStage.CONSIDERATION);

    expect(result).toEqual(updated);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        stage: JourneyStage.CONSIDERATION,
        lastActivityAt: expect.any(Date),
      },
    });
  });

  it('advanceStage: rejects invalid stage transition (AWARENESS -> DECISION is allowed, but backwards is not)', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue({
      id: 'j-1',
      stage: JourneyStage.DECISION,
    });

    const { journeyService } = await import('../src/services/journey.service');
    await expect(
      journeyService.advanceStage('j-1', JourneyStage.AWARENESS)
    ).rejects.toThrow('Cannot move backwards in journey stage');
  });

  it('advanceStage: throws when journey not found', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(null);

    const { journeyService } = await import('../src/services/journey.service');
    await expect(
      journeyService.advanceStage('nonexistent', JourneyStage.CONSIDERATION)
    ).rejects.toThrow('Journey not found');
  });

  it('pauseJourney: sets status PAUSED', async () => {
    const paused = { id: 'j-1', status: JourneyStatus.PAUSED };
    mockedPrisma.journey.update.mockResolvedValue(paused);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.pauseJourney('j-1');

    expect(result).toEqual(paused);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        status: JourneyStatus.PAUSED,
        lastActivityAt: expect.any(Date),
      },
    });
  });

  it('completeJourney: sets status COMPLETED', async () => {
    const completed = { id: 'j-1', status: JourneyStatus.COMPLETED };
    mockedPrisma.journey.update.mockResolvedValue(completed);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.completeJourney('j-1');

    expect(result).toEqual(completed);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        status: JourneyStatus.COMPLETED,
        completedAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      },
    });
  });

  it('abandonJourney: sets status ABANDONED', async () => {
    const abandoned = { id: 'j-1', status: JourneyStatus.ABANDONED };
    mockedPrisma.journey.update.mockResolvedValue(abandoned);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.abandonJourney('j-1');

    expect(result).toEqual(abandoned);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        status: JourneyStatus.ABANDONED,
        lastActivityAt: expect.any(Date),
      },
    });
  });

  it('recordBehaviorEvent: creates behavior event with correct fields', async () => {
    const eventData = {
      journeyId: 'j-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      type: 'CAR_VIEW',
      targetType: 'car',
      targetId: 'car-1',
      metadata: { duration_sec: 120 },
    };
    const created = { id: 'be-1', ...eventData, aiWeight: 0.7 };
    mockedPrisma.behaviorEvent.create.mockResolvedValue(created);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.recordBehaviorEvent(eventData);

    expect(result).toEqual(created);
    expect(mockedPrisma.behaviorEvent.create).toHaveBeenCalledWith({
      data: {
        journeyId: 'j-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        type: 'CAR_VIEW',
        targetType: 'car',
        targetId: 'car-1',
        metadata: { duration_sec: 120 },
        aiWeight: expect.any(Number),
      },
    });
  });

  it('updateRequirements: updates journey requirements', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue({
      id: 'j-1',
      requirements: { budgetMin: 100000 },
    });
    const updated = {
      id: 'j-1',
      requirements: { budgetMin: 100000, budgetMax: 200000, useCases: ['commute'] },
    };
    mockedPrisma.journey.update.mockResolvedValue(updated);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.updateRequirements('j-1', {
      budgetMax: 200000,
      useCases: ['commute'],
    });

    expect(result).toEqual(updated);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        requirements: {
          budgetMin: 100000,
          budgetMax: 200000,
          useCases: ['commute'],
        },
        lastActivityAt: expect.any(Date),
      },
    });
  });

  it('updateRequirements: throws when journey not found', async () => {
    mockedPrisma.journey.findUnique.mockResolvedValue(null);

    const { journeyService } = await import('../src/services/journey.service');
    await expect(
      journeyService.updateRequirements('nonexistent', { budgetMax: 200000 })
    ).rejects.toThrow('Journey not found');
  });

  it('updateAiConfidenceScore: updates score', async () => {
    const updated = { id: 'j-1', aiConfidenceScore: 0.85 };
    mockedPrisma.journey.update.mockResolvedValue(updated);

    const { journeyService } = await import('../src/services/journey.service');
    const result = await journeyService.updateAiConfidenceScore('j-1', 0.85);

    expect(result).toEqual(updated);
    expect(mockedPrisma.journey.update).toHaveBeenCalledWith({
      where: { id: 'j-1' },
      data: {
        aiConfidenceScore: 0.85,
        lastActivityAt: expect.any(Date),
      },
    });
  });
});
