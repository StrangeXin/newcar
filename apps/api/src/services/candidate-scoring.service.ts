import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface Requirements {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  dailyKm?: number;
  stylePreference?: string;
}

interface CarLike {
  msrp: number | null;
  fuelType: string;
  type: string;
}

interface CandidateLike {
  id: string;
  carId: string;
  status: string;
  aiMatchScore?: number | null;
  userInterestScore?: number | null;
  candidateRankScore?: number | null;
  car: CarLike & { id?: string };
}

export class CandidateScoringService {
  private rankScoreUpdatedAt = new Map<string, number>();
  private readonly rankThrottleMs = 5 * 60 * 1000;

  async scoreCandidates(journeyId: string): Promise<void> {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: {
          include: { car: true },
        },
      },
    });

    if (!journey) {
      throw new Error('Journey not found');
    }
    if (journey.candidates.length === 0) {
      return;
    }

    const requirements = ((journey.requirements as Requirements) || {}) as Requirements;
    const scores: number[] = [];

    for (const candidate of journey.candidates) {
      const score = this.calculateMatchScore(candidate.car, requirements);
      await prisma.carCandidate.update({
        where: { id: candidate.id },
        data: { aiMatchScore: score },
      });
      scores.push(score);
      await this.updateRankScore(journeyId, candidate.id, { force: true });
    }

    const topScore = scores.length > 0 ? Math.max(...scores, 0) : 0;
    await prisma.journey.update({
      where: { id: journeyId },
      data: { aiConfidenceScore: topScore },
    });
  }

  async updateRankScore(journeyId: string, candidateId?: string, options: { force?: boolean } = {}) {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: {
          include: { car: true },
        },
        behaviorEvents: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });

    if (!journey) {
      throw new Error('Journey not found');
    }

    const candidates: CandidateLike[] = candidateId
      ? (journey.candidates || []).filter((candidate: CandidateLike) => candidate.id === candidateId)
      : (journey.candidates || []);

    for (const candidate of candidates) {
      const lastUpdatedAt = this.rankScoreUpdatedAt.get(candidate.id) || 0;
      if (!options.force && Date.now() - lastUpdatedAt < this.rankThrottleMs) {
        continue;
      }

      const score = this.calculateRankScore(candidate, journey.requirements as Requirements, journey.behaviorEvents || []);
      await prisma.carCandidate.update({
        where: { id: candidate.id },
        data: { candidateRankScore: score },
      });
      this.rankScoreUpdatedAt.set(candidate.id, Date.now());
    }
  }

  private calculateMatchScore(car: CarLike, requirements: Requirements): number {
    let score = 0.5;

    if (requirements.budgetMin && requirements.budgetMax && car.msrp) {
      const msrpInWan = car.msrp / 10000;
      if (msrpInWan >= requirements.budgetMin && msrpInWan <= requirements.budgetMax) {
        score += 0.2;
      } else if (msrpInWan < requirements.budgetMin) {
        score -= 0.1 * (requirements.budgetMin - msrpInWan);
      } else {
        score -= 0.1 * (msrpInWan - requirements.budgetMax);
      }
    }

    if (requirements.fuelTypePreference && requirements.fuelTypePreference.length > 0) {
      if (requirements.fuelTypePreference.includes(car.fuelType)) {
        score += 0.15;
      } else {
        score -= 0.1;
      }
    }

    if (requirements.useCases && requirements.useCases.length > 0) {
      if (requirements.useCases.includes('family') && ['SUV', 'MPV'].includes(car.type)) {
        score += 0.1;
      }
      if (requirements.useCases.includes('commute') && ['HATCHBACK', 'SEDAN'].includes(car.type)) {
        score += 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateRankScore(
    candidate: CandidateLike,
    requirements: Requirements,
    behaviorEvents: Array<{
      targetId?: string | null;
      metadata?: unknown;
      aiWeight?: number | null;
    }>
  ): number {
    if (candidate.status === 'WINNER') {
      return 1;
    }
    if (candidate.status === 'ELIMINATED') {
      return 0;
    }

    const aiScore = this.clamp01(Number(candidate.aiMatchScore ?? this.calculateMatchScore(candidate.car, requirements)));
    const interestScore = this.clamp01(Number(candidate.userInterestScore ?? 0));

    const behaviorScore = behaviorEvents
      .filter((event) => {
        if (event.targetId && event.targetId === candidate.id) return true;
        if (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)) {
          const metadata = event.metadata as Record<string, unknown>;
          return metadata.candidateId === candidate.id || metadata.carId === candidate.carId;
        }
        return false;
      })
      .reduce((sum, event) => sum + Number(event.aiWeight ?? 0), 0);

    const behaviorBoost = Math.min(0.25, behaviorScore / 20);
    const raw = aiScore * 0.6 + interestScore * 0.2 + behaviorBoost + 0.1;
    return this.clamp01(raw);
  }

  private clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  async recalculateAllScores(journeyId: string): Promise<void> {
    await this.scoreCandidates(journeyId);
  }
}

export const candidateScoringService = new CandidateScoringService();
