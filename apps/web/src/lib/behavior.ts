'use client';

import { getToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const SESSION_KEY = 'newcar_session_id';

type BehaviorType = 'PAGE_VIEW' | 'CAR_VIEW' | 'COMPARISON_OPEN' | 'PRICE_CHECK';

function getSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

export async function trackEvent(
  journeyId: string,
  type: BehaviorType,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined' || journeyId === 'mock-journey') {
    return;
  }

  try {
    const sessionId = getSessionId();
    const token = getToken();
    await fetch(`${BASE_URL}/journeys/${journeyId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type,
        targetType,
        targetId,
        metadata,
      }),
    });
  } catch {
    // swallow errors for UX safety
  }
}
