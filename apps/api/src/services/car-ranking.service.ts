export interface UserPreferences {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  stylePreference?: string;
}

const USE_CASE_TYPE_MAP: Record<string, string[]> = {
  family: ['SUV', 'MPV'],
  commute: ['SEDAN', 'HATCHBACK'],
  'long-trip': ['SUV', 'SEDAN'],
  offroad: ['SUV'],
};

export function rankByRelevance<
  T extends { msrp?: number | null; type: string; fuelType: string },
>(cars: T[], prefs: UserPreferences): T[] {
  if (!prefs || Object.keys(prefs).length === 0) {
    return cars;
  }

  const scored = cars.map((car) => ({
    car,
    score: calcScore(car, prefs),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.car);
}

function calcScore(
  car: { msrp?: number | null; type: string; fuelType: string },
  prefs: UserPreferences,
): number {
  let score = 0;
  score += scoreBudget(car.msrp, prefs.budgetMin, prefs.budgetMax);
  score += scoreUseCase(car.type, prefs.useCases);
  score += scoreFuelType(car.fuelType, prefs.fuelTypePreference);
  score += scoreStyle(car.type, prefs.stylePreference);
  return score;
}

function scoreBudget(
  msrp: number | null | undefined,
  min?: number,
  max?: number,
): number {
  if (min === undefined && max === undefined) return 30;
  if (msrp == null) return 15;

  const midBudget = ((min || 0) + (max || min || 0)) / 2 || msrp;
  const range = (max || midBudget) - (min || 0) || midBudget;
  const deviation = Math.abs(msrp - midBudget) / range;

  if (min !== undefined && max !== undefined && msrp >= min && msrp <= max) return 30;
  if (deviation <= 0.1) return 20;
  if (deviation <= 0.3) return 10;
  return 0;
}

function scoreUseCase(type: string, useCases?: string[]): number {
  if (!useCases || useCases.length === 0) return 25;

  for (const useCase of useCases) {
    const preferred = USE_CASE_TYPE_MAP[useCase];
    if (preferred) {
      if (preferred[0] === type) return 25;
      if (preferred.includes(type)) return 20;
    }
  }
  return 10;
}

function scoreFuelType(fuelType: string, preferences?: string[]): number {
  if (!preferences || preferences.length === 0) return 25;
  if (preferences.includes(fuelType)) return 25;

  const similar: Record<string, string[]> = {
    BEV: ['PHEV'],
    PHEV: ['BEV', 'HEV'],
    HEV: ['PHEV'],
    ICE: [],
  };
  if (similar[preferences[0]]?.includes(fuelType)) return 15;
  return 5;
}

function scoreStyle(type: string, stylePreference?: string): number {
  if (!stylePreference) return 20;
  return type === stylePreference ? 20 : 0;
}
