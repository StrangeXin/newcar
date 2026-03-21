import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { errorHandler } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import journeyRoutes from './routes/journey';
import sessionRoutes from './routes/session';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(rateLimitMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/auth', authRoutes);
  app.use('/', sessionRoutes);
  app.use('/journeys', journeyRoutes);

  app.use(errorHandler);

  return app;
}
