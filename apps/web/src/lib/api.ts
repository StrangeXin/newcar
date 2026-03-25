import { getToken } from './auth';
import {
  mockJourney,
  mockCandidates,
  mockTimelineEvents,
  mockSnapshot,
  mockNotifications,
  mockCommunityJourneys,
} from './mock-data';

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function getMockResponse<T>(path: string, method: HttpMethod = 'GET'): T | null {
  if (!MOCK_MODE) return null;

  // POST routes
  if (method === 'POST') {
    if (path === '/auth/phone/send-otp') return { message: '验证码已发送', otp: '123456' } as T;
    if (path === '/auth/phone/login') return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' } as T;
    if (path.match(/\/community\/[^/]+\/fork/)) return { id: 'mock-journey-id' } as T;
    if (path === '/journeys') return mockJourney as T;
    if (path.match(/\/journeys\/[^/]+\/candidates\/[^/]+\/winner/)) return { success: true } as T;
    if (path.match(/\/journeys\/[^/]+\/publish$/)) return { ...mockCommunityJourneys[0], id: 'mock-published-1' } as T;
    if (path.match(/\/published-journeys\/[^/]+\/regenerate$/)) return mockCommunityJourneys[0] as T;
    return {} as T;
  }

  // PATCH routes
  if (method === 'PATCH') {
    if (path.match(/\/journeys\/[^/]+\/candidates\/[^/]+\/notes/)) return { success: true } as T;
    if (path.match(/\/journeys\/[^/]+\/candidates\/[^/]+/)) return { success: true } as T;
    if (path.match(/\/published-journeys\/[^/]+$/)) return mockCommunityJourneys[0] as T;
    return {} as T;
  }

  // DELETE routes
  if (method === 'DELETE') {
    return {} as T;
  }

  // GET routes
  if (path === '/journeys/active') return mockJourney as T;
  if (path.match(/\/journeys\/[^/]+\/timeline/)) return { events: mockTimelineEvents } as T;
  if (path.match(/\/journeys\/[^/]+\/publish\/preview/)) {
    return {
      story: {
        title: mockJourney.title,
        narrative: mockSnapshot.narrativeSummary,
        highlights: (mockSnapshot.keyInsights ?? []).map((i) => i.insight),
      },
      report: {
        title: mockJourney.title,
        candidates: mockCandidates.map((c) => ({
          name: c.car ? `${c.car.brand} ${c.car.model}` : c.carId,
          score: c.aiMatchScore,
          notes: c.userNotes,
        })),
        insights: (mockSnapshot.keyInsights ?? []),
      },
      template: {
        title: mockJourney.title,
        requirements: mockJourney.requirements,
        stages: ['DISCOVERY', 'COMPARISON', 'DECISION'],
      },
    } as T;
  }
  if (path.match(/\/journeys\/[^/]+\/candidates/)) return { candidates: mockCandidates } as T;
  if (path.match(/\/snapshots\/[^/]+\/snapshot/)) return mockSnapshot as T;
  if (path === '/notifications') return mockNotifications as T;
  if (path.startsWith('/community') && !path.match(/\/community\/[^?]/)) {
    return {
      items: mockCommunityJourneys,
      total: mockCommunityJourneys.length,
      limit: 20,
      offset: 0,
    } as T;
  }
  if (path.match(/\/community\/[^?/]+$/)) {
    const id = path.split('/').pop();
    const item = mockCommunityJourneys.find((j) => j.id === id);
    return (item || mockCommunityJourneys[0]) as T;
  }

  return null;
}

async function request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? getToken() : undefined;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) {
        errorMessage = errJson.error;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function get<T>(path: string): Promise<T> {
  const mock = getMockResponse<T>(path);
  if (mock !== null) return mock;
  return request<T>(path, 'GET');
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const mock = getMockResponse<T>(path, 'POST');
  if (mock !== null) return mock;
  return request<T>(path, 'POST', body);
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  const mock = getMockResponse<T>(path, 'PATCH');
  if (mock !== null) return mock;
  return request<T>(path, 'PATCH', body);
}

export async function del<T>(path: string): Promise<T> {
  const mock = getMockResponse<T>(path, 'DELETE');
  if (mock !== null) return mock;
  return request<T>(path, 'DELETE');
}

export function buildJourneyChatWsUrl(journeyId: string) {
  const token = typeof window !== 'undefined' ? getToken() : undefined;
  const url = new URL(`/ws/journeys/${journeyId}/chat`, BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}
