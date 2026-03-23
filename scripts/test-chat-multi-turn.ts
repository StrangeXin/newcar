import WebSocket from 'ws';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const PHONE = process.env.TEST_PHONE || '13800138000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function wsUrl(path: string) {
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
        title: '多轮对话测试旅程',
        requirements: {
          budgetMax: 25,
          fuelTypePreference: ['PHEV'],
          useCases: ['family'],
        },
      }),
    });
  }
}

async function sendTurn(socket: WebSocket, content: string) {
  return new Promise<{
    events: Array<any>;
    fullContent?: string;
  }>((resolve, reject) => {
    const events: Array<any> = [];
    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(String(raw));
      events.push(event);

      if (event.type === 'error') {
        cleanup();
        reject(new Error(event.message || 'chat error'));
        return;
      }

      if (event.type === 'done') {
        cleanup();
        resolve({
          events,
          fullContent: event.fullContent,
        });
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    socket.on('message', onMessage);
    socket.on('error', onError);
    socket.send(JSON.stringify({ type: 'message', content }));
  });
}

async function main() {
  const otpRes = await request<{ otp: string }>('/auth/phone/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE }),
  });

  const loginRes = await request<{ accessToken: string }>('/auth/phone/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, otp: otpRes.otp }),
  });

  const journey = await ensureJourney(loginRes.accessToken);
  const socket = new WebSocket(wsUrl(`/ws/journeys/${journey.id}/chat?token=${loginRes.accessToken}`));

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });

  const firstTurn = await sendTurn(socket, '推荐一款适合家用的增程 SUV，并把理想 L6 加入候选。');
  const secondTurn = await sendTurn(socket, '深蓝S7 附近哪里可试驾？顺便给我它的详细参数。');
  socket.close();

  const secondTurnErrors = secondTurn.events.filter((event) => event.type === 'error');
  const hasCarDetail = secondTurn.events.some((event) => event.type === 'tool_start' && event.name === 'car_detail');

  if (secondTurnErrors.some((event) => String(event.message || '').includes('Car not found'))) {
    throw new Error('Second turn still returned Car not found');
  }

  if (!hasCarDetail) {
    throw new Error('Second turn did not trigger car_detail');
  }

  console.log(JSON.stringify({
    journeyId: journey.id,
    firstTurn: {
      fullContent: firstTurn.fullContent,
      eventTypes: firstTurn.events.map((event) => event.type),
    },
    secondTurn: {
      fullContent: secondTurn.fullContent,
      eventTypes: secondTurn.events.map((event) => event.type),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
