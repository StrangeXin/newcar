import { getToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

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

export function get<T>(path: string): Promise<T> {
  return request<T>(path, 'GET');
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, 'POST', body);
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, 'PATCH', body);
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, 'DELETE');
}
