import WebSocket from 'ws';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const PHONE = process.env.TEST_PHONE || '13800138000';
const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS || 45000);
const IDLE_TIMEOUT_MS = Number(process.env.TURN_IDLE_TIMEOUT_MS || 15000);

type WsEvent = {
  type: string;
  name?: string;
  event?: string;
  message?: string;
  fullContent?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function toWsUrl(path: string) {
  const url = new URL(path, API_BASE);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

async function ensureJourney(token: string) {
  try {
    return await request<any>('/journeys/active', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return request<any>('/journeys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '严格回归测试旅程',
        requirements: {
          budgetMax: 25,
          fuelTypePreference: ['PHEV'],
          useCases: ['family'],
        },
      }),
    });
  }
}

async function login() {
  const otpRes = await request<{ otp: string }>('/auth/phone/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE }),
  });

  return request<{ accessToken: string }>('/auth/phone/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, otp: otpRes.otp }),
  });
}

async function waitForOpen(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
}

function summarizeEvents(events: WsEvent[]) {
  return events.map((event) => (event.name ? `${event.type}:${event.name}` : event.type)).join(', ');
}

async function sendTurn(socket: WebSocket, label: string, content: string) {
  return new Promise<{ events: WsEvent[]; fullContent: string }>((resolve, reject) => {
    const events: WsEvent[] = [];
    let startedAt = Date.now();
    let lastActivityAt = Date.now();
    let timeoutId: NodeJS.Timeout | null = setInterval(() => {
      const now = Date.now();
      const totalElapsed = now - startedAt;
      const idleElapsed = now - lastActivityAt;

      if (totalElapsed < TURN_TIMEOUT_MS && idleElapsed < IDLE_TIMEOUT_MS) {
        return;
      }

      cleanup();
      reject(
        new Error(
          `${label} timed out after total=${totalElapsed}ms idle=${idleElapsed}ms. events=[${summarizeEvents(events)}] fullContent="${events
            .map((event) => event.fullContent || '')
            .join('')
            .slice(0, 240)}"`
        )
      );
    }, 500);

    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(String(raw)) as WsEvent;
      events.push(event);
      lastActivityAt = Date.now();

      if (event.type === 'error') {
        cleanup();
        reject(new Error(event.message || 'chat error'));
        return;
      }

      if (event.type === 'done') {
        cleanup();
        resolve({
          events,
          fullContent: event.fullContent || '',
        });
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(new Error(`${label} socket error: ${error.message}`));
    };

    const cleanup = () => {
      if (timeoutId) {
        clearInterval(timeoutId);
        timeoutId = null;
      }
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.on('error', onError);
    socket.send(JSON.stringify({ type: 'message', content }));
  });
}

function assertEventOrder(events: WsEvent[], toolName: string) {
  const startIndex = events.findIndex((event) => event.type === 'tool_start' && event.name === toolName);
  const doneIndex = events.findIndex((event) => event.type === 'tool_done' && event.name === toolName);

  if (startIndex === -1) {
    throw new Error(`Missing tool_start for ${toolName}`);
  }
  if (doneIndex === -1) {
    throw new Error(`Missing tool_done for ${toolName}`);
  }
  if (doneIndex < startIndex) {
    throw new Error(`tool_done came before tool_start for ${toolName}`);
  }
}

async function main() {
  const { accessToken } = await login();
  const journey = await ensureJourney(accessToken);

  const socket = new WebSocket(toWsUrl(`/ws/journeys/${journey.id}/chat?token=${accessToken}`));
  await waitForOpen(socket);

  const turn1 = await sendTurn(socket, 'turn1', '推荐一款适合家用的增程 SUV，并把理想 L6 加入候选。');
  const turn2 = await sendTurn(socket, 'turn2', '请再把理想L6加入候选一次，确认不会报错。');
  const turn3 = await sendTurn(socket, 'turn3', '深蓝S7 附近哪里可试驾？顺便给我它的详细参数。');
  const turn4 = await sendTurn(socket, 'turn4', '那深蓝 S7 和理想 L6 我下一步该怎么比？');
  socket.close();

  assertEventOrder(turn3.events, 'car_detail');

  if (turn2.events.some((event) => event.type === 'error')) {
    throw new Error('Turn 2 should not error when candidate is already added');
  }

  if (/Car not found/i.test(turn3.fullContent)) {
    throw new Error('Turn 3 still contains Car not found');
  }

  if (!/深蓝.?S7/.test(turn3.fullContent)) {
    throw new Error('Turn 3 did not mention 深蓝S7 details');
  }

  if (!/候选|无需重复|已在候选|对比/.test(turn2.fullContent)) {
    throw new Error('Turn 2 did not acknowledge duplicate candidate handling');
  }

  if (!/对比|下一步|理想\s*L6|深蓝\s*S7/.test(turn4.fullContent)) {
    throw new Error('Turn 4 did not continue multi-turn comparison context');
  }

  console.log(
    JSON.stringify(
      {
        journeyId: journey.id,
        apiBase: API_BASE,
        turn1: { fullContent: turn1.fullContent, eventTypes: turn1.events.map((event) => event.type) },
        turn2: { fullContent: turn2.fullContent, eventTypes: turn2.events.map((event) => event.type) },
        turn3: { fullContent: turn3.fullContent, eventTypes: turn3.events.map((event) => event.type) },
        turn4: { fullContent: turn4.fullContent, eventTypes: turn4.events.map((event) => event.type) },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
