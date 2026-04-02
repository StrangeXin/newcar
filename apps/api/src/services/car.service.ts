import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { buildCarSearchWhere, CarSearchParams, toYuanFromWan } from './car-query';
import { rankByRelevance, UserPreferences } from './car-ranking.service';

interface CreatePriceSnapshotInput {
  region?: string;
  msrp: number;
  dealerDiscount?: number;
  effectivePrice?: number;
  source?: string;
  policyIds?: string[];
}

interface CreatePolicyInput {
  carId?: string;
  region: string;
  policyType: string;
  subsidyAmount: number;
  eligibilityCriteria?: Prisma.InputJsonValue;
  validFrom: Date;
  validUntil: Date;
  sourceUrl?: string;
}

export { CarSearchParams, toYuanFromWan, buildCarSearchWhere } from './car-query';

export class CarService {
  async searchCars(params: CarSearchParams, preferences?: UserPreferences) {
    const where = buildCarSearchWhere(params);
    const take = Math.max(1, Math.min(params.limit ?? 20, 100));
    const skip = Math.max(0, params.offset ?? 0);

    const cars = await prisma.car.findMany({
      where,
      take,
      skip,
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (preferences && Object.keys(preferences).length > 0) {
      return rankByRelevance(cars, preferences);
    }
    return cars;
  }

  async getCarById(id: string) {
    return prisma.car.findUnique({
      where: { id },
    });
  }

  async getCarPrice(carId: string, region?: string) {
    return prisma.carPriceSnapshot.findFirst({
      where: {
        carId,
        ...(region ? { region } : {}),
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async getCarReviews(carId: string, limit = 20) {
    return prisma.carReview.findMany({
      where: { carId },
      orderBy: { ingestedAt: 'desc' },
      take: Math.max(1, Math.min(limit, 100)),
    });
  }

  async getPolicies(region: string, carId?: string, activeOnly = true) {
    const now = new Date();
    return prisma.carPolicy.findMany({
      where: {
        region,
        ...(activeOnly
          ? {
              validFrom: { lte: now },
              validUntil: { gte: now },
            }
          : {}),
        ...(carId ? { OR: [{ carId }, { carId: null }] } : {}),
      },
      orderBy: [{ validUntil: 'asc' }, { subsidyAmount: 'desc' }],
    });
  }

  async createPriceSnapshot(carId: string, data: CreatePriceSnapshotInput) {
    return prisma.carPriceSnapshot.create({
      data: {
        carId,
        region: data.region,
        msrp: data.msrp,
        dealerDiscount: data.dealerDiscount,
        effectivePrice: data.effectivePrice,
        source: data.source,
        policyIds: data.policyIds || [],
      },
    });
  }

  async createPolicy(data: CreatePolicyInput) {
    return prisma.carPolicy.create({
      data: {
        carId: data.carId,
        region: data.region,
        policyType: data.policyType,
        subsidyAmount: data.subsidyAmount,
        eligibilityCriteria: data.eligibilityCriteria,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        sourceUrl: data.sourceUrl,
      },
    });
  }
}

export const carService = new CarService();
