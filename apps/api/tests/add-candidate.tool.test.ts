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

  /* ------------------------------------------------------------------ */
  /* New test cases                                                      */
  /* ------------------------------------------------------------------ */

  it('direct carId lookup succeeds (valid car ID)', async () => {
    mocks.getCarById.mockResolvedValueOnce({
      id: 'car-byd-seal',
      brand: '比亚迪',
      model: '海豹',
      msrp: 189800,
    });
    mocks.addCandidate.mockResolvedValueOnce({
      id: 'candidate-3',
      carId: 'car-byd-seal',
      car: { brand: '比亚迪', model: '海豹' },
    });

    const result = await runAddCandidate('journey-1', { carId: 'car-byd-seal' });

    expect(mocks.getCarById).toHaveBeenCalledWith('car-byd-seal');
    expect(mocks.searchCars).not.toHaveBeenCalled();
    expect(mocks.addCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: 'journey-1',
        carId: 'car-byd-seal',
      })
    );
    expect(result.output).toEqual(expect.objectContaining({ id: 'candidate-3' }));
  });

  it('car not found returns error object instead of throwing', async () => {
    mocks.getCarById.mockResolvedValueOnce(null);
    mocks.searchCars.mockResolvedValue([]);

    const result = await runAddCandidate('journey-1', { carId: 'nonexistent' });
    expect(result.output).toHaveProperty('error', true);
    expect(result.sideEffects).toHaveLength(0);
  });

  it('compact brand+model search: "深蓝S7" finds car via fuzzy normalization', async () => {
    mocks.getCarById.mockResolvedValueOnce(null);
    // normalizeCarQuery("深蓝S7") → ["深蓝S7", "深蓝 S7"]
    // First expanded query returns empty, second ("深蓝 S7") returns result
    mocks.searchCars.mockResolvedValueOnce([]);
    mocks.searchCars.mockResolvedValueOnce([
      { id: 'car-deepal-s7', brand: '深蓝', model: 'S7' },
    ]);
    mocks.addCandidate.mockResolvedValueOnce({
      id: 'candidate-4',
      carId: 'car-deepal-s7',
    });

    await runAddCandidate('journey-1', { carId: '深蓝S7' });

    expect(mocks.searchCars).toHaveBeenCalledWith(expect.objectContaining({ q: '深蓝 S7' }));
    expect(mocks.addCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ carId: 'car-deepal-s7' })
    );
  });

  it('space-separated search: "理想 L6" finds car via fuzzy normalization', async () => {
    // normalizeCarQuery("理想 L6") → ["理想 L6"]
    // First query returns result directly
    mocks.searchCars.mockResolvedValueOnce([
      { id: 'car-li-l6', brand: '理想', model: 'L6' },
    ]);
    mocks.addCandidate.mockResolvedValueOnce({
      id: 'candidate-5',
      carId: 'car-li-l6',
    });

    await runAddCandidate('journey-1', { query: '理想 L6' });

    expect(mocks.searchCars).toHaveBeenCalledWith(expect.objectContaining({ q: '理想 L6' }));
  });

  it('side effects return correct shape: { event: candidate_added, data: candidate }', async () => {
    vi.clearAllMocks();
    const carObj = {
      id: 'car-test-x',
      brand: 'Test',
      model: 'X',
    };
    mocks.getCarById.mockResolvedValueOnce(carObj);
    const candidateObj = {
      id: 'candidate-6',
      carId: 'car-test-x',
      journeyId: 'journey-1',
      car: { brand: 'Test', model: 'X' },
    };
    mocks.addCandidate.mockResolvedValueOnce(candidateObj);

    const result = await runAddCandidate('journey-1', { carId: 'car-test-x' });

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({
      event: 'candidate_added',
      data: candidateObj,
    });
  });
});
