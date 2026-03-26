import http, { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { createApp } from './app';
import { config } from './config';
import { chatWsController } from './controllers/chat-ws.controller';
import { runDailySnapshotJob } from './jobs/daily-snapshot.job';
import { scheduler } from './lib/scheduler';

const app = createApp();
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });

scheduler.add('daily-snapshot', '0 8 * * *', runDailySnapshotJob);
scheduler.start();

server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  const pathname = new URL(req.url || '', 'http://localhost').pathname;
  const match = pathname.match(/^\/ws\/journeys\/([^/]+)\/chat$/);

  if (!match) {
    socket.destroy();
    return;
  }

  const journeyId = match[1];

  wss.handleUpgrade(req, socket, head, (ws: unknown) => {
    chatWsController.handleConnection(ws as Parameters<typeof chatWsController.handleConnection>[0], req, journeyId);
  });
});

server.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
