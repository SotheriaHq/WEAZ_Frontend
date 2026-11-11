import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPhoneSessionVerification } from './parentSessionBridge';

const parentSessionId = '11111111-1111-4111-8111-111111111111';
const postMessage = vi.fn();
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); window.ReactNativeWebView = { postMessage }; });
afterEach(() => { delete window.ReactNativeWebView; vi.useRealTimers(); });
describe('phone verification bridge', () => {
  const reply = (detail: unknown) => window.dispatchEvent(new CustomEvent('wiez:phone-session-verification', { detail }));
  it('sends only correlation and session identifiers and ignores unrelated acknowledgements', async () => {
    const request = requestPhoneSessionVerification(parentSessionId, new AbortController().signal);
    const sent = JSON.parse(postMessage.mock.calls[0][0]);
    expect(sent).toEqual({ type: 'VERIFY_PHONE_SESSION', requestId: expect.any(String), parentSessionId });
    reply({ ...sent, requestId: 'wrong', verified: true }); expect(vi.getTimerCount()).toBe(1);
    reply({ ...sent, parentSessionId: 'wrong', verified: true }); expect(vi.getTimerCount()).toBe(1);
    reply({ ...sent, verified: true }); await request; expect(vi.getTimerCount()).toBe(0);
  });
  it('stops on abort and cannot accept a late completion', async () => {
    const controller = new AbortController(), request = requestPhoneSessionVerification(parentSessionId, controller.signal);
    const failure = expect(request).rejects.toThrow('cancelled'); controller.abort(); await failure;
    reply({ ...JSON.parse(postMessage.mock.calls[0][0]), verified: true }); expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds the wait and offers retry after timeout or a failed phone verification', async () => {
    const request = requestPhoneSessionVerification(parentSessionId, new AbortController().signal);
    const failure = expect(request).rejects.toThrow('timed out'); await vi.advanceTimersByTimeAsync(300_000); await failure;
    const retry = requestPhoneSessionVerification(parentSessionId, new AbortController().signal);
    const rejected = expect(retry).rejects.toThrow('did not finish');
    reply({ ...JSON.parse(postMessage.mock.calls.at(-1)![0]), verified: false }); await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('explains how to recover in a standalone browser instead of waiting for a missing host', async () => {
    delete window.ReactNativeWebView;
    await expect(requestPhoneSessionVerification(parentSessionId, new AbortController().signal)).rejects.toThrow('flagged phone');
    expect(postMessage).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});
