import { Prisma } from '@prisma/client';
import { JourneyStage, JourneyStatus } from '@newcar/shared';
import { prisma } from '../lib/prisma';

export class JourneyService {
  async createJourney(userId: string, data: { title: string; requirements?: unknown }) {
    const existingJourney = await prisma.journey.findFirst({
      where: {
        userId,
        status: JourneyStatus.ACTIVE,
      },
    });

    if (existingJourney) {
      throw new Error('User already has an active journey. Complete or pause it first.');
    }

    return prisma.journey.create({
      data: {
        userId,
        title: data.title,
        requirements: data.requirements || {},
        stage: JourneyStage.AWARENESS,
        status: JourneyStatus.ACTIVE,
      },
    });
  }

  async getActiveJourney(userId: string) {
    return prisma.journey.findFirst({
      where: {
        userId,
        status: JourneyStatus.ACTIVE,
      },
      include: {
        candidates: {
          include: { car: true },
        },
        snapshots: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async advanceStage(journeyId: string, newStage: JourneyStage) {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
    });

    if (!journey) {
      throw new Error('Journey not found');
    }

    const stageOrder = [
      JourneyStage.AWARENESS,
      JourneyStage.CONSIDERATION,
      JourneyStage.COMPARISON,
      JourneyStage.DECISION,
      JourneyStage.PURCHASE,
    ];

    const currentIndex = stageOrder.indexOf(journey.stage as JourneyStage);
    const newIndex = stageOrder.indexOf(newStage);

    if (newIndex < currentIndex) {
      throw new Error('Cannot move backwards in journey stage');
    }

    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        stage: newStage,
        lastActivityAt: new Date(),
      },
    });
  }

  async pauseJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.PAUSED,
        lastActivityAt: new Date(),
      },
    });
  }

  async completeJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.COMPLETED,
        completedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async abandonJourney(journeyId: string) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        status: JourneyStatus.ABANDONED,
        lastActivityAt: new Date(),
      },
    });
  }

  async recordBehaviorEvent(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    type: string;
    targetType?: string;
    targetId?: string;
    metadata?: unknown;
  }) {
    const aiWeight = this.calculateAiWeight(data.type, data.metadata);

    return prisma.behaviorEvent.create({
      data: {
        journeyId: data.journeyId,
        userId: data.userId,
        sessionId: data.sessionId,
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata as Prisma.InputJsonValue,
        aiWeight,
      },
    });
  }

  async checkExpiredJourneys() {
    const EXPIRY_DAYS = 90;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - EXPIRY_DAYS);

    const expiredJourneys = await prisma.journey.findMany({
      where: {
        status: {
          in: [JourneyStatus.ACTIVE, JourneyStatus.PAUSED],
        },
        lastActivityAt: {
          lt: expiryDate,
        },
      },
    });

    const results = [];
    for (const journey of expiredJourneys) {
      const updated = await prisma.journey.update({
        where: { id: journey.id },
        data: { status: JourneyStatus.ABANDONED },
      });
      results.push(updated);

      // 同时更新关联的 PublishedJourney 状态
      await prisma.publishedJourney.updateMany({
        where: { journeyId: journey.id },
        data: { contentStatus: 'JOURNEY_ABANDONED' },
      });
    }

    return results;
  }

  async getJourneyDetail(journeyId: string) {
    return prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: {
          include: { car: true },
        },
        snapshots: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        behaviorEvents: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });
  }

  async updateRequirements(journeyId: string, requirements: {
    budgetMin?: number;
    budgetMax?: number;
    useCases?: string[];
    fuelTypePreference?: string[];
    dailyKm?: number;
    stylePreference?: string;
  }) {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
    });

    if (!journey) {
      throw new Error('Journey not found');
    }

    const currentRequirements = (journey.requirements as Record<string, unknown>) || {};

    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        requirements: {
          ...currentRequirements,
          ...requirements,
        },
        lastActivityAt: new Date(),
      },
    });
  }

  async updateAiConfidenceScore(journeyId: string, score: number) {
    return prisma.journey.update({
      where: { id: journeyId },
      data: {
        aiConfidenceScore: score,
        lastActivityAt: new Date(),
      },
    });
  }

  private calculateAiWeight(type: string, metadata?: unknown): number {
    const baseWeights: Record<string, number> = {
      CAR_VIEW: 1.0,
      COMPARISON_OPEN: 1.2,
      SPEC_TAB: 0.8,
      REVIEW_READ: 0.7,
      PRICE_CHECK: 1.1,
      DEALER_LOCATE: 1.5,
      VIDEO_WATCH: 0.6,
      PAGE_VIEW: 0.3,
      COMMUNITY_POST_VIEW: 0.4,
    };

    const baseWeight = baseWeights[type] || 0.5;
    const durationSec =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata) && 'duration_sec' in metadata
        ? Number((metadata as Record<string, unknown>).duration_sec || 0)
        : 0;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);

    return baseWeight * (0.5 + 0.5 * durationFactor);
  }
}

export const journeyService = new JourneyService();
