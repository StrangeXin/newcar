import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { errorHandler } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import { carRoutes, policyRoutes } from './routes/cars';
import journeyRoutes from './routes/journey';
import notificationRoutes from './routes/notifications';
import sessionRoutes from './routes/session';
import snapshotRoutes from './routes/snapshot';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(rateLimitMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/auth', authRoutes);
  app.use('/cars', carRoutes);
  app.use('/policies', policyRoutes);
  app.use('/', sessionRoutes);
  app.use('/journeys', journeyRoutes);
  app.use('/snapshots', snapshotRoutes);
  app.use('/notifications', notificationRoutes);

  app.use(errorHandler);

  return app;
}
