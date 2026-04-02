import { describe, it, expect } from 'vitest';
import { rankByRelevance, UserPreferences } from '../src/services/car-ranking.service';

interface TestCar {
  id: string;
  brand: string;
  model: string;
  msrp: number | null;
  type: string;
  fuelType: string;
}

const CARS: TestCar[] = [
  { id: 'c1', brand: '理想', model: 'L6', msrp: 249800, type: 'SUV', fuelType: 'PHEV' },
  { id: 'c2', brand: '特斯拉', model: 'Model 3', msrp: 231900, type: 'SEDAN', fuelType: 'BEV' },
  { id: 'c3', brand: '问界', model: 'M9', msrp: 469800, type: 'SUV', fuelType: 'PHEV' },
  { id: 'c4', brand: '比亚迪', model: '海鸥', msrp: 69800, type: 'HATCHBACK', fuelType: 'BEV' },
  { id: 'c5', brand: '腾势', model: 'D9', msrp: 309800, type: 'MPV', fuelType: 'PHEV' },
];

describe('rankByRelevance', () => {
  it('无偏好 → 原序不变', () => {
    const result = rankByRelevance(CARS, {});
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('预算 20-30万 → 预算内的排前面', () => {
    const prefs: UserPreferences = { budgetMin: 200000, budgetMax: 300000 };
    const result = rankByRelevance(CARS, prefs);
    expect(result[0].id).toBe('c1');
    expect(result[1].id).toBe('c2');
    // 预算外的 c3(46.98万) 和 c4(6.98万) 排后面
    const bottomIds = result.slice(2).map((c) => c.id);
    expect(bottomIds).toContain('c3');
    expect(bottomIds).toContain('c4');
  });

  it('family 用途 → SUV/MPV 在前', () => {
    const prefs: UserPreferences = { useCases: ['family'] };
    const result = rankByRelevance(CARS, prefs);
    const topTypes = result.slice(0, 3).map((c) => c.type);
    expect(topTypes).toContain('SUV');
    expect(topTypes).toContain('MPV');
  });

  it('commute 用途 → SEDAN/HATCHBACK 在前', () => {
    const prefs: UserPreferences = { useCases: ['commute'] };
    const result = rankByRelevance(CARS, prefs);
    const topTypes = result.slice(0, 2).map((c) => c.type);
    expect(topTypes).toContain('SEDAN');
    expect(topTypes).toContain('HATCHBACK');
  });

  it('fuelType=BEV → 纯电在前', () => {
    const prefs: UserPreferences = { fuelTypePreference: ['BEV'] };
    const result = rankByRelevance(CARS, prefs);
    const topFuels = result.slice(0, 2).map((c) => c.fuelType);
    expect(topFuels).toEqual(['BEV', 'BEV']);
  });

  it('stylePreference=SUV → SUV 在前', () => {
    const prefs: UserPreferences = { stylePreference: 'SUV' };
    const result = rankByRelevance(CARS, prefs);
    const topTypes = result.slice(0, 2).map((c) => c.type);
    expect(topTypes).toEqual(['SUV', 'SUV']);
  });

  it('多维度组合 → 综合最匹配排第一', () => {
    const prefs: UserPreferences = {
      budgetMin: 200000,
      budgetMax: 300000,
      useCases: ['family'],
      fuelTypePreference: ['PHEV'],
      stylePreference: 'SUV',
    };
    const result = rankByRelevance(CARS, prefs);
    expect(result[0].id).toBe('c1');
  });

  it('msrp 为 null 的车不崩溃', () => {
    const carsWithNull = [...CARS, { id: 'c6', brand: '测试', model: 'X', msrp: null, type: 'SUV', fuelType: 'BEV' }];
    const prefs: UserPreferences = { budgetMin: 200000, budgetMax: 300000 };
    const result = rankByRelevance(carsWithNull, prefs);
    expect(result).toHaveLength(6);
  });
});
