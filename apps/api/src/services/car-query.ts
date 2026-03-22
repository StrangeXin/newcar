import { Prisma } from '@prisma/client';

export interface CarSearchParams {
  brand?: string;
  fuelType?: string;
  carType?: string;
  budgetMin?: number;
  budgetMax?: number;
  q?: string;
  limit?: number;
  offset?: number;
}

export function toYuanFromWan(value?: number): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  return Math.round(value * 10000);
}

export function buildCarSearchWhere(params: CarSearchParams): Prisma.CarWhereInput {
  const where: Prisma.CarWhereInput = {};

  if (params.brand) {
    where.brand = { contains: params.brand, mode: 'insensitive' };
  }
  if (params.fuelType) {
    where.fuelType = params.fuelType;
  }
  if (params.carType) {
    where.type = params.carType;
  }

  if (params.budgetMin !== undefined || params.budgetMax !== undefined) {
    where.msrp = {};
    if (params.budgetMin !== undefined) {
      where.msrp.gte = params.budgetMin;
    }
    if (params.budgetMax !== undefined) {
      where.msrp.lte = params.budgetMax;
    }
  }

  if (params.q) {
    where.OR = [
      { brand: { contains: params.q, mode: 'insensitive' } },
      { model: { contains: params.q, mode: 'insensitive' } },
      { variant: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  return where;
}
