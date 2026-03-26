import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { publishedJourneyController } from '../controllers/published-journey.controller';
import { validateBody } from '../lib/validate';

const publishSchema = z.object({
  title: z.string(),
  publishedFormats: z.array(z.enum(['story', 'report', 'template'])).min(1),
  visibility: z.enum(['PUBLIC', 'UNLISTED']),
});

// Routes under /journeys/:id/publish*
export const journeyPublishRoutes = Router({ mergeParams: true });

journeyPublishRoutes.post('/:id/publish', authMiddleware, validateBody(publishSchema), (req, res) =>
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

publishedJourneyRoutes.post('/:id/regenerate', authMiddleware, (req, res) =>
  publishedJourneyController.regenerate(req, res)
);

publishedJourneyRoutes.delete('/:id', authMiddleware, (req, res) =>
  publishedJourneyController.unpublish(req, res)
);

publishedJourneyRoutes.get('/:id', (req, res) =>
  publishedJourneyController.getOne(req, res)
);
