import { Candidate, TimelineEvent } from '@/types/api';
import { get } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { dispatchJourneySideEffect } from '@/lib/journey-workspace-events';
import {
  CandidateResponse,
  TimelineResponse,
  mapTimelineEventTypeToSideEffect,
} from './message-store';

/* ── WebSocket helpers ───────────────────────────────────────────── */

export function waitForOpen(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('WebSocket connection failed'));
    };
    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
    };

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
  });
}

/* ── Reconnect state ─────────────────────────────────────────────── */

export let reconnectTimer: number | undefined;
export let manualDisconnectRequested = false;
export let reconnectSyncPending = false;
export let connectionToken = 0;

export function setReconnectTimer(value: number | undefined) {
  reconnectTimer = value;
}

export function setManualDisconnectRequested(value: boolean) {
  manualDisconnectRequested = value;
}

export function setReconnectSyncPending(value: boolean) {
  reconnectSyncPending = value;
}

export function incrementConnectionToken() {
  connectionToken += 1;
  return connectionToken;
}

/* ── Auth helpers ─────────────────────────────────────────────────── */

export function sendAuth(socket: WebSocket) {
  const token = getToken();
  if (token) {
    socket.send(JSON.stringify({ type: 'auth', token }));
    return true;
  }
  return false;
}

/* ── Reconnect workspace sync ────────────────────────────────────── */

export async function refreshWorkspaceAfterReconnect(journeyId: string) {
  try {
    const [candidateResponse, timelineResponse] = await Promise.all([
      get<CandidateResponse>(`/journeys/${journeyId}/candidates`),
      get<TimelineResponse>(`/journeys/${journeyId}/timeline?limit=100`),
    ]);

    const replayEvents = Array.isArray(timelineResponse.events) ? [...timelineResponse.events].reverse() : [];
    let hasCandidateAddedEvent = false;

    for (const timelineEvent of replayEvents) {
      if (timelineEvent.type === 'CANDIDATE_ADDED') {
        hasCandidateAddedEvent = true;
      }

      dispatchJourneySideEffect({
        event: 'timeline_event',
        journeyId,
        data: timelineEvent,
      });

      const mappedEvent = mapTimelineEventTypeToSideEffect(timelineEvent.type);
      if (mappedEvent !== 'timeline_event') {
        dispatchJourneySideEffect({
          event: mappedEvent,
          journeyId,
          data: {
            ...timelineEvent.metadata,
            timelineEvent,
          },
        });
      }
    }

    if ((candidateResponse.candidates || []).length > 0 && !hasCandidateAddedEvent) {
      dispatchJourneySideEffect({
        event: 'candidate_added',
        journeyId,
        data: {
          reconnected: true,
          candidates: candidateResponse.candidates,
          candidatesCount: candidateResponse.candidates.length,
        },
      });
    }

    dispatchJourneySideEffect({
      event: 'journey_updated',
      journeyId,
      data: {
        reconnected: true,
        candidatesCount: candidateResponse.candidates?.length ?? 0,
        timelineCount: timelineResponse.events?.length ?? 0,
      },
    });
  } catch {
    // Best-effort compensation only.
  }
}
