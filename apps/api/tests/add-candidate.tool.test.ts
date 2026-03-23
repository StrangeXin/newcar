import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddedReason } from '@newcar/shared';

const mocks = vi.hoisted(() => ({
  addCandidate: vi.fn(),
  getCarById: vi.fn(),
  searchCars: vi.fn(),
}));

vi.mock('../src/services/car-candidate.service', () => ({
  carCandidateService: {
    addCandidate: mocks.addCandidate,
  },
}));

vi.mock('../src/services/car.service', () => ({
  carService: {
    getCarById: mocks.getCarById,
    searchCars: mocks.searchCars,
  },
}));

import { runAddCandidate } from '../src/tools/add-candidate.tool';

describe('runAddCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to model-name search when carId is actually a car name', async () => {
    mocks.getCarById.mockResolvedValueOnce(null);
    mocks.searchCars.mockResolvedValueOnce([]);
    mocks.searchCars.mockResolvedValueOnce([
      {
        id: 'car-deepal-s7',
        brand: '深蓝',
        model: 'S7',
      },
    ]);
    mocks.addCandidate.mockResolvedValueOnce({
      id: 'candidate-1',
      carId: 'car-deepal-s7',
      car: { brand: '深蓝', model: 'S7' },
    });

    const result = await runAddCandidate('journey-1', { carId: '深蓝S7' });

    expect(mocks.addCandidate).toHaveBeenCalledWith({
      journeyId: 'journey-1',
      carId: 'car-deepal-s7',
      addedReason: AddedReason.AI_RECOMMENDED,
      userNotes: undefined,
      priceAtAdd: undefined,
    });
    expect(result.sideEffects[0]?.event).toBe('candidate_added');
  });

  it('supports explicit query input when no carId is provided', async () => {
    mocks.searchCars.mockResolvedValueOnce([
      {
        id: 'car-li-l6',
        brand: '理想',
        model: 'L6',
      },
    ]);
    mocks.addCandidate.mockResolvedValueOnce({
      id: 'candidate-2',
      carId: 'car-li-l6',
      car: { brand: '理想', model: 'L6' },
    });

    await runAddCandidate('journey-2', {
      query: '理想 L6',
      userNotes: '重点看空间',
      priceAtAdd: 249800,
    });

    expect(mocks.addCandidate).toHaveBeenCalledWith({
      journeyId: 'journey-2',
      carId: 'car-li-l6',
      addedReason: AddedReason.AI_RECOMMENDED,
      userNotes: '重点看空间',
      priceAtAdd: 249800,
    });
  });
});
