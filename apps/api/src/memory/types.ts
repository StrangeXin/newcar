export interface Signal {
  type: 'REQUIREMENT' | 'PREFERENCE' | 'BUDGET';
  value: string;
  confidence: number;
  updatedAt: string;
}

export interface UserPreference {
  preferredBrands?: string[];
  preferredFuelTypes?: string[];
  preferredCarTypes?: string[];
  updatedAt: string;
}