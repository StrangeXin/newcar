import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { publishedJourneyController } from '../controllers/published-journey.controller';

// Routes under /journeys/:id/publish*
export const journeyPublishRoutes = Router({ mergeParams: true });

journeyPublishRoutes.post('/:id/publish', authMiddleware, (req, res) =>
  publishedJourneyController.publish(req, res)
);

journeyPublishRoutes.get('/:id/publish/preview', authMiddleware, (req, res) =>
  publishedJourneyController.preview(req, res)
);

// Routes under /published-journeys
export const publishedJourneyRoutes = Router();

publishedJourneyRoutes.patch('/:id', authMiddleware, (req, res) =>
  publishedJourneyController.update(req, res)
);

publishedJourneyRoutes.delete('/:id', authMiddleware, (req, res) =>
  publishedJourneyController.unpublish(req, res)
);

publishedJourneyRoutes.get('/:id', (req, res) =>
  publishedJourneyController.getOne(req, res)
);
