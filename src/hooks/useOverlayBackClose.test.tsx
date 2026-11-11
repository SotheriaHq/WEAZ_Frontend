import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overlayBackChannel, useOverlayBackClose } from './useOverlayBackClose';
const flush = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  vi.restoreAllMocks(); window.history.replaceState({}, '', '/settings');
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
});
afterEach(async () => { cleanup(); await flush(); vi.restoreAllMocks(); });
describe('overlay-owned browser history', () => {
  it('Back closes only the child and preserves its parent', async () => {
    const parentClose = vi.fn(), childClose = vi.fn();
    const parent = renderHook(() => useOverlayBackClose(true, parentClose));
    const parentState = window.history.state;
    const child = renderHook(() => useOverlayBackClose(true, childClose));
    act(() => { window.history.replaceState(parentState, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: parentState })); });
    expect(childClose).toHaveBeenCalledOnce(); expect(parentClose).not.toHaveBeenCalled();
    child.unmount(); expect(overlayBackChannel.consumesPop()).toBe(true);
    parent.unmount(); await flush(); expect(window.history.back).toHaveBeenCalledOnce();
    expect(overlayBackChannel.consumesPop()).toBe(false);
  });
  it('pops two retired nested entries in one ordered operation', async () => {
    const parent = renderHook(() => useOverlayBackClose(true, vi.fn()));
    const child = renderHook(() => useOverlayBackClose(true, vi.fn()));
    parent.unmount(); child.unmount(); await flush();
    expect(window.history.go).toHaveBeenCalledExactlyOnceWith(-2); expect(window.history.back).not.toHaveBeenCalled();
  });
  it('never undoes a newer route, including a new state at the same URL', async () => {
    const overlay = renderHook(() => useOverlayBackClose(true, vi.fn()));
    window.history.pushState({ unrelated: true }, '', '/settings');
    overlay.unmount(); await flush();
    expect(window.history.go).not.toHaveBeenCalled(); expect(window.history.back).not.toHaveBeenCalled();
  });
  it('reuses a retiring entry during Strict Mode without an extra Back step', async () => {
    const push = vi.spyOn(window.history, 'pushState'); const replace = vi.spyOn(window.history, 'replaceState');
    const overlay = renderHook(() => useOverlayBackClose(true, vi.fn()), { wrapper: StrictMode });
    await flush(); expect(push).toHaveBeenCalledOnce(); expect(replace).not.toHaveBeenCalled();
    expect(window.history.back).not.toHaveBeenCalled();
    overlay.unmount(); await flush(); expect(window.history.back).toHaveBeenCalledOnce();
    expect(overlayBackChannel.consumesPop()).toBe(false);
  });
  it('reclaims both nested entries during Strict Mode effect replay', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const parentClose = vi.fn(), childClose = vi.fn();
    const overlay = renderHook(() => {
      useOverlayBackClose(true, parentClose); useOverlayBackClose(true, childClose);
    }, { wrapper: StrictMode });
    await flush(); expect(push).toHaveBeenCalledTimes(2);
    const parentState = push.mock.calls[0][0];
    act(() => { window.history.replaceState(parentState, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: parentState })); });
    expect(parentClose).not.toHaveBeenCalled(); expect(childClose).toHaveBeenCalledOnce();
    act(() => { window.history.replaceState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); });
    expect(parentClose).toHaveBeenCalledOnce();
    overlay.unmount(); await flush(); expect(window.history.back).not.toHaveBeenCalled();
    expect(overlayBackChannel.consumesPop()).toBe(false);
  });
  it('retains a closed ancestor until its still-open child closes', async () => {
    const parent = renderHook(() => useOverlayBackClose(true, vi.fn()));
    const child = renderHook(() => useOverlayBackClose(true, vi.fn()));
    parent.unmount(); await flush(); expect(window.history.back).not.toHaveBeenCalled();
    child.unmount(); await flush(); expect(window.history.go).toHaveBeenCalledExactlyOnceWith(-2);
    expect(overlayBackChannel.consumesPop()).toBe(false);
  });
  it('skips a retired ancestor when Back closes its child', async () => {
    const parent = renderHook(() => useOverlayBackClose(true, vi.fn()));
    const parentState = window.history.state, close = vi.fn();
    const child = renderHook(() => useOverlayBackClose(true, close));
    parent.unmount(); await flush();
    act(() => { window.history.replaceState(parentState, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: parentState })); });
    await flush(); expect(close).toHaveBeenCalledOnce(); expect(window.history.back).toHaveBeenCalledOnce();
    child.unmount(); await flush(); expect(window.history.back).toHaveBeenCalledOnce();
  });
  it('uses the latest close callback without adding history entries', () => {
    const first = vi.fn(), second = vi.fn(); const push = vi.spyOn(window.history, 'pushState');
    const overlay = renderHook(({ close }) => useOverlayBackClose(true, close), { initialProps: { close: first } });
    overlay.rerender({ close: second });
    act(() => { window.history.replaceState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); });
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledOnce(); expect(push).toHaveBeenCalledOnce();
  });
});
