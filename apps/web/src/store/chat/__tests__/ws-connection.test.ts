import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  waitForOpen,
  setReconnectTimer,
  setManualDisconnectRequested,
  setReconnectSyncPending,
  incrementConnectionToken,
  reconnectTimer,
  manualDisconnectRequested,
  reconnectSyncPending,
  connectionToken,
} from '../ws-connection';

/* ── waitForOpen ─────────────────────────────────────────────────── */

describe('waitForOpen', () => {
  it('resolves immediately when socket is already OPEN', async () => {
    const socket = {
      readyState: WebSocket.OPEN,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;

    await expect(waitForOpen(socket)).resolves.toBeUndefined();
    // addEventListener should not be called — resolved synchronously
    expect(socket.addEventListener).not.toHaveBeenCalled();
  });

  it('resolves when open event fires on a CONNECTING socket', async () => {
    let openHandler: EventListener | undefined;

    const socket = {
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'open') openHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;

    const promise = waitForOpen(socket);

    // Simulate the socket opening
    expect(openHandler).toBeDefined();
    openHandler!(new Event('open'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects when error event fires before open', async () => {
    let errorHandler: EventListener | undefined;

    const socket = {
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'error') errorHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;

    const promise = waitForOpen(socket);

    expect(errorHandler).toBeDefined();
    errorHandler!(new Event('error'));

    await expect(promise).rejects.toThrow('WebSocket connection failed');
  });

  it('removes event listeners after open resolves', async () => {
    let openHandler: EventListener | undefined;

    const socket = {
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'open') openHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;

    const promise = waitForOpen(socket);
    openHandler!(new Event('open'));
    await promise;

    expect(socket.removeEventListener).toHaveBeenCalledWith('open', expect.any(Function));
    expect(socket.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('removes event listeners after error rejects', async () => {
    let errorHandler: EventListener | undefined;

    const socket = {
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'error') errorHandler = handler;
      }),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;

    const promise = waitForOpen(socket).catch(() => {});
    errorHandler!(new Event('error'));
    await promise;

    expect(socket.removeEventListener).toHaveBeenCalledWith('open', expect.any(Function));
    expect(socket.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

/* ── Reconnect state management ──────────────────────────────────── */

describe('setReconnectTimer', () => {
  it('updates the exported reconnectTimer variable', async () => {
    setReconnectTimer(42);
    // Re-import to get current module state
    const mod = await import('../ws-connection');
    expect(mod.reconnectTimer).toBe(42);
  });

  it('sets reconnectTimer to undefined', async () => {
    setReconnectTimer(undefined);
    const mod = await import('../ws-connection');
    expect(mod.reconnectTimer).toBeUndefined();
  });
});

describe('setManualDisconnectRequested', () => {
  it('sets manualDisconnectRequested to true', async () => {
    setManualDisconnectRequested(true);
    const mod = await import('../ws-connection');
    expect(mod.manualDisconnectRequested).toBe(true);
  });

  it('sets manualDisconnectRequested to false', async () => {
    setManualDisconnectRequested(false);
    const mod = await import('../ws-connection');
    expect(mod.manualDisconnectRequested).toBe(false);
  });
});

describe('setReconnectSyncPending', () => {
  it('sets reconnectSyncPending to true', async () => {
    setReconnectSyncPending(true);
    const mod = await import('../ws-connection');
    expect(mod.reconnectSyncPending).toBe(true);
  });

  it('sets reconnectSyncPending to false', async () => {
    setReconnectSyncPending(false);
    const mod = await import('../ws-connection');
    expect(mod.reconnectSyncPending).toBe(false);
  });
});

describe('incrementConnectionToken', () => {
  it('increments and returns the connection token', async () => {
    const mod = await import('../ws-connection');
    const before = mod.connectionToken;
    const returned = incrementConnectionToken();
    expect(returned).toBe(before + 1);
    expect(mod.connectionToken).toBe(before + 1);
  });

  it('increments monotonically on successive calls', async () => {
    const first = incrementConnectionToken();
    const second = incrementConnectionToken();
    const third = incrementConnectionToken();
    expect(second).toBe(first + 1);
    expect(third).toBe(second + 1);
  });
});
