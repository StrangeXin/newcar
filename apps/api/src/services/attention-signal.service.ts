import { AttentionSignal } from '@newcar/shared';
import { prisma } from '../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_CHANGE_THRESHOLD = 0.03;

export class AttentionSignalService {
  async checkPriceChanges(candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const yesterday = new Date(Date.now() - DAY_MS);
    const today = new Date();

    const priceSnapshots = await prisma.carPriceSnapshot.findMany({
      where: {
        carId: { in: candidateCarIds },
        capturedAt: { gte: yesterday, lt: today },
      },
      orderBy: { capturedAt: 'asc' },
    });

    const byCar = new Map<string, any[]>();
    for (const snapshot of priceSnapshots) {
      const list = byCar.get(snapshot.carId) || [];
      list.push(snapshot);
      byCar.set(snapshot.carId, list);
    }

    for (const [carId, snapshots] of byCar) {
      if (snapshots.length < 2) {
        continue;
      }

      const oldest = snapshots[0];
      const newest = snapshots[snapshots.length - 1];

      if (oldest.msrp !== newest.msrp) {
        const change = (newest.msrp - oldest.msrp) / oldest.msrp;
        if (Math.abs(change) >= PRICE_CHANGE_THRESHOLD) {
          signals.push({
            carId,
            signalType: 'PRICE_DROP',
            description: change < 0 ? `降价${Math.abs(Math.round(change * 100))}%` : `涨价${Math.round(change * 100)}%`,
            delta: newest.msrp - oldest.msrp,
            oldValue: String(oldest.msrp),
            newValue: String(newest.msrp),
          });
        }
      }
    }

    return signals;
  }

  async checkNewVariants(_candidateCarIds: string[]): Promise<AttentionSignal[]> {
    return [];
  }

  async checkNewReviews(candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const yesterday = new Date(Date.now() - DAY_MS);

    const newReviews = await prisma.carReview.findMany({
      where: {
        carId: { in: candidateCarIds },
        ingestedAt: { gte: yesterday },
      },
      take: 10,
    });

    for (const review of newReviews) {
      signals.push({
        carId: review.carId,
        signalType: 'NEW_REVIEW',
        description: review.title || '有新的评测文章',
        newValue: review.aiSummary || review.content?.slice(0, 50),
      });
    }

    return signals;
  }

  async checkPolicyUpdates(userCity: string, candidateCarIds: string[]): Promise<AttentionSignal[]> {
    const signals: AttentionSignal[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const relevantPolicies = await prisma.carPolicy.findMany({
      where: {
        region: userCity,
        validFrom: { lte: today },
        validUntil: { gte: today },
        OR: [{ carId: { in: candidateCarIds } }, { carId: null }],
      },
    });

    for (const policy of relevantPolicies) {
      signals.push({
        carId: policy.carId || 'all',
        signalType: 'POLICY_UPDATE',
        description: `${policy.policyType}: 补贴${policy.subsidyAmount}元`,
        newValue: policy.policyType,
      });
    }

    return signals;
  }

  async getAttentionSignals(journeyId: string, userCity?: string): Promise<AttentionSignal[]> {
    const candidates = await prisma.carCandidate.findMany({
      where: { journeyId, status: 'ACTIVE' },
      select: { carId: true },
    });

    const carIds = candidates.map((candidate) => candidate.carId);
    if (carIds.length === 0) {
      return [];
    }

    const [prices, reviews, policies] = await Promise.all([
      this.checkPriceChanges(carIds),
      this.checkNewReviews(carIds),
      userCity ? this.checkPolicyUpdates(userCity, carIds) : Promise.resolve([]),
    ]);

    return [...prices, ...reviews, ...policies].slice(0, 3);
  }
}

export const attentionSignalService = new AttentionSignalService();
