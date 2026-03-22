import { Router } from 'express';
import { carController } from '../controllers/car.controller';
import { authMiddleware } from '../middleware/auth';

const carRoutes = Router();
const policyRoutes = Router();

carRoutes.get('/', (req, res) => carController.searchCars(req, res));
carRoutes.get('/:id', (req, res) => carController.getCarById(req, res));
carRoutes.get('/:id/price', (req, res) => carController.getCarPrice(req, res));
carRoutes.get('/:id/reviews', (req, res) => carController.getCarReviews(req, res));

// Task 4 write APIs (auth only for now)
carRoutes.post('/:id/price', authMiddleware, (req, res) => carController.createPriceSnapshot(req, res));
policyRoutes.post('/', authMiddleware, (req, res) => carController.createPolicy(req, res));

policyRoutes.get('/', (req, res) => carController.getPolicies(req, res));

export { carRoutes, policyRoutes };
