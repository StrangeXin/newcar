import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddCandidate = vi.fn();
const mockSearchCars = vi.fn();
const mockGetCarById = vi.fn();

vi.mock('../src/services/car-candidate.service', () => ({
  carCandidateService: {
    addCandidate: (...args: unknown[]) => mockAddCandidate(...args),
  },
}));

vi.mock('../src/services/car.service', () => ({
  carService: {
    getCarById: (...args: unknown[]) => mockGetCarById(...args),
    searchCars: (...args: unknown[]) => mockSearchCars(...args),
  },
}));

import { runAddCandidate } from '../src/tools/add-candidate.tool';

describe('add_candidate enhanced payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes enhanced recommendation fields to candidate persistence', async () => {
    mockGetCarById.mockResolvedValue({
      id: 'car-1',
      brand: '理想',
      model: 'L6',
      variant: 'Max',
      msrp: 239800,
      fuelType: 'PHEV',
      type: 'SUV',
    });
    mockAddCandidate.mockResolvedValue({
      id: 'candidate-1',
      carId: 'car-1',
      journeyId: 'journey-1',
      car: { id: 'car-1', brand: '理想', model: 'L6' },
    });

    const result = await runAddCandidate('journey-1', {
      carId: 'car-1',
      matchTags: ['符合预算', '家用首选'],
      recommendReason: '兼顾空间和续航',
      relevantDimensions: ['续航', '空间'],
      userNotes: '优先考虑家用',
      priceAtAdd: 239800,
    });

    expect(mockAddCandidate).toHaveBeenCalledWith({
      journeyId: 'journey-1',
      carId: 'car-1',
      addedReason: expect.any(String),
      matchTags: ['符合预算', '家用首选'],
      recommendReason: '兼顾空间和续航',
      relevantDimensions: ['续航', '空间'],
      userNotes: '优先考虑家用',
      priceAtAdd: 239800,
    });
    expect(result.sideEffects[0].event).toBe('candidate_added');
  });

  it('normalizeStringArray handles non-array input → matchTags/relevantDimensions become undefined', async () => {
    mockGetCarById.mockResolvedValue({
      id: 'car-2',
      brand: '小鹏',
      model: 'G6',
    });
    mockAddCandidate.mockResolvedValue({
      id: 'candidate-2',
      carId: 'car-2',
    });

    await runAddCandidate('journey-1', {
      carId: 'car-2',
      matchTags: 'not-an-array',
      relevantDimensions: 42,
    });

    expect(mockAddCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        matchTags: undefined,
        relevantDimensions: undefined,
      })
    );
  });

  it('normalizeStringArray trims and filters empty strings', async () => {
    mockGetCarById.mockResolvedValue({
      id: 'car-3',
      brand: '问界',
      model: 'M7',
    });
    mockAddCandidate.mockResolvedValue({
      id: 'candidate-3',
      carId: 'car-3',
    });

    await runAddCandidate('journey-1', {
      carId: 'car-3',
      matchTags: ['  预算命中  ', '', '  ', '家用首选'],
      relevantDimensions: ['空间', '  ', '续航  '],
    });

    expect(mockAddCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        matchTags: ['预算命中', '家用首选'],
        relevantDimensions: ['空间', '续航'],
      })
    );
  });
});
