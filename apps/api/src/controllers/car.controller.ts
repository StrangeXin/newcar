import { Request, Response } from 'express';
import { carService, CarSearchParams, toYuanFromWan } from '../services/car.service';

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CarController {
  async searchCars(req: Request, res: Response) {
    try {
      const budgetMinWan = parseNumber(req.query.budget_min);
      const budgetMaxWan = parseNumber(req.query.budget_max);

      const params: CarSearchParams = {
        brand: typeof req.query.brand === 'string' ? req.query.brand : undefined,
        fuelType: typeof req.query.fuel_type === 'string' ? req.query.fuel_type : undefined,
        carType: typeof req.query.type === 'string' ? req.query.type : undefined,
        budgetMin: toYuanFromWan(budgetMinWan),
        budgetMax: toYuanFromWan(budgetMaxWan),
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        limit: parseNumber(req.query.limit),
        offset: parseNumber(req.query.offset),
      };

      const cars = await carService.searchCars(params);
      return res.json({ cars });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getCarById(req: Request, res: Response) {
    try {
      const car = await carService.getCarById(req.params.id);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      return res.json(car);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getCarPrice(req: Request, res: Response) {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      const snapshot = await carService.getCarPrice(req.params.id, region);
      if (!snapshot) {
        return res.status(404).json({ error: 'Price snapshot not found' });
      }
      return res.json(snapshot);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getCarReviews(req: Request, res: Response) {
    try {
      const limit = parseNumber(req.query.limit);
      const reviews = await carService.getCarReviews(req.params.id, limit);
      return res.json({ reviews });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getPolicies(req: Request, res: Response) {
    try {
      const region = typeof req.query.region === 'string' ? req.query.region : undefined;
      if (!region) {
        return res.status(400).json({ error: 'region is required' });
      }

      const carId = typeof req.query.car_id === 'string' ? req.query.car_id : undefined;
      const activeOnly = req.query.active_only !== 'false';

      const policies = await carService.getPolicies(region, carId, activeOnly);
      return res.json({ policies });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async createPriceSnapshot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { region, msrp, dealerDiscount, effectivePrice, source, policyIds } = req.body;
      if (!msrp || typeof msrp !== 'number' || msrp <= 0) {
        return res.status(400).json({ error: 'msrp is required' });
      }
      const car = await carService.getCarById(id);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      const normalizedEffectivePrice =
        typeof effectivePrice === 'number'
          ? effectivePrice
          : msrp - (typeof dealerDiscount === 'number' ? dealerDiscount : 0);

      const snapshot = await carService.createPriceSnapshot(id, {
        region,
        msrp,
        dealerDiscount,
        effectivePrice: normalizedEffectivePrice,
        source,
        policyIds,
      });
      return res.status(201).json(snapshot);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async createPolicy(req: Request, res: Response) {
    try {
      const { carId, region, policyType, subsidyAmount, eligibilityCriteria, validFrom, validUntil, sourceUrl } = req.body;
      if (!region || !policyType || typeof subsidyAmount !== 'number' || !validFrom || !validUntil) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (new Date(validFrom) >= new Date(validUntil)) {
        return res.status(400).json({ error: 'validFrom must be earlier than validUntil' });
      }

      const policy = await carService.createPolicy({
        carId,
        region,
        policyType,
        subsidyAmount,
        eligibilityCriteria,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        sourceUrl,
      });
      return res.status(201).json(policy);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export const carController = new CarController();
