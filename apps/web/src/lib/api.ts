import { getToken } from './auth';
import {
  mockJourney,
  mockCandidates,
  mockSnapshot,
  mockNotifications,
  mockCommunityJourneys,
} from './mock-data';

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const MOCK_MODE = true; // Set to false to use real API

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function getMockResponse<T>(path: string): T | null {
  if (!MOCK_MODE) return null;

  if (path === '/journeys/active') return mockJourney as T;
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
  if (MOCK_MODE) return undefined as T;
  return request<T>(path, 'POST', body);
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  if (MOCK_MODE) return undefined as T;
  return request<T>(path, 'PATCH', body);
}

export async function del<T>(path: string): Promise<T> {
  if (MOCK_MODE) return undefined as T;
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
