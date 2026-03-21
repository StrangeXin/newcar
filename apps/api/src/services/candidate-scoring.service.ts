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

export class CandidateScoringService {
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
    }

    const topScore = scores.length > 0 ? Math.max(...scores, 0) : 0;
    await prisma.journey.update({
      where: { id: journeyId },
      data: { aiConfidenceScore: topScore },
    });
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

  async recalculateAllScores(journeyId: string): Promise<void> {
    await this.scoreCandidates(journeyId);
  }
}

export const candidateScoringService = new CandidateScoringService();
