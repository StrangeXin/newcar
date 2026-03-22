import { describe, expect, it } from 'vitest';
import { buildCarSearchWhere, toYuanFromWan } from '../src/services/car-query';

describe('Car Service Query Builder', () => {
  it('should convert wan to yuan correctly', () => {
    expect(toYuanFromWan(25)).toBe(250000);
    expect(toYuanFromWan(15.5)).toBe(155000);
  });

  it('should build fuel type filter', () => {
    const where = buildCarSearchWhere({ fuelType: 'BEV' });
    expect(where.fuelType).toBe('BEV');
  });

  it('should build budget range filter', () => {
    const where = buildCarSearchWhere({ budgetMin: 150000, budgetMax: 250000 });
    expect(where.msrp).toMatchObject({ gte: 150000, lte: 250000 });
  });

  it('should build keyword OR filter', () => {
    const where = buildCarSearchWhere({ q: '比亚迪' });
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR?.length).toBeGreaterThanOrEqual(2);
  });
});
