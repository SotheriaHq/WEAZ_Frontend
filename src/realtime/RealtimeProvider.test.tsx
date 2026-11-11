import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider, useRealtime } from './RealtimeProvider';

const auth = vi.hoisted(() => ({ token: null as string | null, identity: null as string | null,
  observers: new Set<() => void>(), sockets: [] as unknown[], immediate: false }));
vi.mock('@/api/httpClient', () => ({ getStoredAccessToken: () => auth.token, getApiSecurityIdentity: () => auth.identity,
  subscribeAccessToken: (listener: () => void) => { auth.observers.add(listener); return () => auth.observers.delete(listener); },
  refreshAccessToken: vi.fn(async () => null),
}));
vi.mock('socket.io-client', () => ({ io: () => {
  const handlers = new Map<string, Set<(value?: unknown) => void>>();
  const socket = { auth: {} as Record<string, unknown>, connected: false, sent: [] as Array<{ name: string; value: unknown }>,
    on(name: string, callback: (value?: unknown) => void) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(callback); },
    off(name: string, callback?: (value?: unknown) => void) { if (callback) handlers.get(name)?.delete(callback); else handlers.delete(name); },
    emit(name: string, value: unknown) { this.sent.push({ name, value }); },
    connect() { if (auth.immediate) this.fire('connect'); },
    disconnect() { this.fire('disconnect', 'io client disconnect'); },
    removeAllListeners() { handlers.clear(); },
    fire(name: string, value?: unknown) { if (name === 'connect') this.connected = true; if (name === 'disconnect') this.connected = false;
      for (const callback of [...(handlers.get(name) ?? [])]) callback(value); },
  };
  auth.sockets.push(socket); return socket;
} }));
type FakeSocket = { auth: Record<string, unknown>; sent: Array<{ name: string; value: unknown }>; fire(name: string, value?: unknown): void };
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const design = '33333333-3333-4333-8333-333333333333';
function Observer({ comment, notice }: { comment: () => void; notice: () => void }) {
  const { onComment, onNotification } = useRealtime();
  useEffect(() => onComment(`DESIGN:${design}`, comment), [onComment, comment]);
  useEffect(() => onNotification(notice), [onNotification, notice]);
  return null;
}
function mount() {
  const store = configureStore({ reducer: { user: (state = { profile: { id: user } }, action: { type: string; payload?: string }) =>
    action.type === 'test/user' ? { profile: { id: action.payload! } } : state } });
  const comment = vi.fn(), notice = vi.fn();
  const view = render(<Provider store={store}><RealtimeProvider><Observer comment={comment} notice={notice} /></RealtimeProvider></Provider>);
  return { ...view, store, comment, notice,
    hide: () => view.rerender(<Provider store={store}><RealtimeProvider /></Provider>) };
}
function credential(token: string, identity = `${user}:first:1:User`) {
  auth.token = token; auth.identity = identity; for (const listener of [...auth.observers]) listener();
}
const socket = (index = 0) => auth.sockets[index] as FakeSocket;
const commentFrame = { targetType: 'DESIGN', targetId: design, commentId: 'fixture', ts: 1, version: 1 };
beforeEach(() => { auth.token = null; auth.identity = null; auth.observers.clear(); auth.sockets = []; auth.immediate = false; });
afterEach(() => cleanup());

describe('RealtimeProvider session lifecycle', () => {
  it('waits for restored credentials, then preserves subscriptions requested during bootstrap', async () => {
    const f = mount(); expect(auth.sockets).toHaveLength(0);
    act(() => credential('restored'));
    await waitFor(() => expect(auth.sockets).toHaveLength(1));
    expect(socket().auth.token).toBe('restored');
    act(() => socket().fire('connect'));
    expect(socket().sent).toContainEqual({ name: 'join', value: { room: `DESIGN:${design}` } });
    act(() => socket().fire('comment.created', commentFrame)); expect(f.comment).toHaveBeenCalledTimes(1);
    f.unmount(); expect(auth.observers.size).toBe(0);
  });
  it('normal JWT rotation reauthenticates without replacing the socket or losing comment subscribers', async () => {
    credential('first'); const f = mount(); await waitFor(() => expect(auth.sockets).toHaveLength(1));
    act(() => socket().fire('connect')); act(() => credential('rotated')); expect(auth.sockets).toHaveLength(1);
    expect(socket().auth.token).toBe('rotated'); act(() => socket().fire('connect'));
    act(() => socket().fire('comment.created', commentFrame)); expect(f.comment).toHaveBeenCalledTimes(1);
  });
  it('a new session for the same user retains handlers even if reconnect state updates are batched', async () => {
    credential('first'); auth.immediate = true; const f = mount(); await waitFor(() => expect(auth.sockets).toHaveLength(1));
    act(() => credential('new-session', `${user}:second:1:User`));
    await waitFor(() => expect(auth.sockets).toHaveLength(2));
    act(() => socket(0).fire('notification.created', { id: 'old' })); expect(f.notice).not.toHaveBeenCalled();
    act(() => { socket(1).fire('notification.created', { id: 'new' }); socket(1).fire('comment.created', commentFrame); });
    expect(f.notice).toHaveBeenCalledTimes(1); expect(f.comment).toHaveBeenCalledTimes(1);
  });
  it('a different account cannot reuse old sockets and new subscribers bind after account cleanup', async () => {
    credential('first'); const f = mount(); await waitFor(() => expect(auth.sockets).toHaveLength(1)); act(() => socket().fire('connect'));
    act(() => { credential('other', `${other}:third:1:User`); f.store.dispatch({ type: 'test/user', payload: other }); });
    await waitFor(() => expect(auth.sockets).toHaveLength(2));
    act(() => { socket(0).fire('comment.created', commentFrame); socket(1).fire('connect'); socket(1).fire('comment.created', commentFrame); });
    expect(socket(1).auth.token).toBe('other'); expect(f.comment).toHaveBeenCalledTimes(1);
  });
  it('closing the last consumer leaves its room and does not rejoin it on reconnect', async () => {
    credential('first'); const f = mount(); await waitFor(() => expect(auth.sockets).toHaveLength(1));
    act(() => socket().fire('connect')); f.hide();
    expect(socket().sent).toContainEqual({ name: 'leave', value: { room: `DESIGN:${design}` } });
    socket().sent = []; act(() => socket().fire('connect'));
    expect(socket().sent).not.toContainEqual({ name: 'join', value: { room: `DESIGN:${design}` } });
    act(() => socket().fire('comment.created', commentFrame)); expect(f.comment).not.toHaveBeenCalled();
  });
});
