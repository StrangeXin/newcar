import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { chatWsController } from './controllers/chat-ws.controller';
import { runDailySnapshotJob } from './jobs/daily-snapshot.job';
import { scheduler } from './lib/scheduler';
import { authService } from './services/auth.service';
import { journeyService } from './services/journey.service';

const app = createApp();
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });

scheduler.add('daily-snapshot', '0 8 * * *', runDailySnapshotJob);
scheduler.start();

server.on('upgrade', async (req: any, socket: any, head: any) => {
  const pathname = new URL(req.url || '', 'http://localhost').pathname;
  const match = pathname.match(/^\/ws\/journeys\/([^/]+)\/chat$/);

  if (!match) {
    socket.destroy();
    return;
  }

  const journeyId = match[1];
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    if (payload.type !== 'access') {
      socket.destroy();
      return;
    }

    const journey = await journeyService.getJourneyDetail(journeyId);
    if (!journey || journey.userId !== payload.userId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: any) => {
      chatWsController.handleConnection(ws, req, journeyId, {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });
    });
  } catch {
    socket.destroy();
  }
});

server.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
