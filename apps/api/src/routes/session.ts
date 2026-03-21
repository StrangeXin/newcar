import { Router } from 'express';
import { sessionService } from '../services/session.service';

const router = Router();

router.get('/session', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string | undefined;

  if (!sessionId) {
    return res.status(400).json({ error: 'No session id' });
  }

  const session = await sessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({
    sessionId,
    isGuest: !session.userId,
    createdAt: session.createdAt,
    boundAt: session.boundAt || null,
  });
});

router.post('/session', async (_req, res) => {
  const { sessionId } = await sessionService.createGuestSession();
  return res.json({ sessionId });
});

export default router;
