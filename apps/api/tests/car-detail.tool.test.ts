import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCarService = {
  getCarById: vi.fn(),
  searchCars: vi.fn(),
  getCarPrice: vi.fn(),
  getCarReviews: vi.fn(),
};

vi.mock('../src/services/car.service', () => ({
  carService: mockCarService,
}));

describe('car_detail tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns details when query is a compact model name', async () => {
    const car = {
      id: 'car-deepal-s7',
      brand: '深蓝',
      model: 'S7',
      variant: '基础版',
      type: 'SUV',
      fuelType: 'PHEV',
      msrp: 140000,
      baseSpecs: { seats: 5 },
    };

    mockCarService.getCarById.mockResolvedValue(null);
    mockCarService.searchCars.mockResolvedValue([car]);
    mockCarService.getCarPrice.mockResolvedValue(null);
    mockCarService.getCarReviews.mockResolvedValue([]);

    const { runCarDetail } = await import('../src/tools/car-detail.tool');
    const result = await runCarDetail({ carId: '深蓝S7' });

    expect(mockCarService.searchCars).toHaveBeenCalledWith({ q: '深蓝S7', limit: 10 });
    expect(result).toMatchObject({
      id: 'car-deepal-s7',
      brand: '深蓝',
      model: 'S7',
    });
  });

  it('matches query with spaces between brand and model', async () => {
    const car = {
      id: 'car-deepal-s7',
      brand: '深蓝',
      model: 'S7',
      variant: '基础版',
      type: 'SUV',
      fuelType: 'PHEV',
      msrp: 140000,
      baseSpecs: { seats: 5 },
    };

    mockCarService.getCarById.mockResolvedValue(null);
    mockCarService.searchCars.mockResolvedValue([car]);
    mockCarService.getCarPrice.mockResolvedValue(null);
    mockCarService.getCarReviews.mockResolvedValue([]);

    const { runCarDetail } = await import('../src/tools/car-detail.tool');
    const result = await runCarDetail({ query: '深蓝 S7' });

    expect(result).toMatchObject({
      id: 'car-deepal-s7',
      brand: '深蓝',
      model: 'S7',
    });
  });
});
