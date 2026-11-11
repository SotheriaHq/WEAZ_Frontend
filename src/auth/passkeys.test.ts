import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserSupportsWebAuthn, startRegistration, WebAuthnAbortService } from '@simplewebauthn/browser';
import { createPasskey, passkeyAvailability } from './passkeys';

vi.mock('@simplewebauthn/browser', () => ({ browserSupportsWebAuthn: vi.fn(), startRegistration: vi.fn(),
  startAuthentication: vi.fn(), WebAuthnAbortService: { cancelCeremony: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());
describe('web passkey boundary', () => {
  it('requires both server configuration and browser support', async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    expect((await passkeyAvailability({ webConfigured: false, androidConfigured: true })).available).toBe(false);
    expect((await passkeyAvailability({ webConfigured: true, androidConfigured: false })).available).toBe(true);
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    expect((await passkeyAvailability({ webConfigured: true, androidConfigured: false })).available).toBe(false);
  });
  it('never opens a ceremony already cancelled by its owner', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createPasskey({} as never, controller.signal)).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(startRegistration).not.toHaveBeenCalled();
  });
  it('cancels only its own active prompt, discards late results and permits a fresh prompt afterwards', async () => {
    let resolve!: (value: never) => void;
    vi.mocked(startRegistration).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    const controller = new AbortController(); const first = createPasskey({} as never, controller.signal);
    await expect(createPasskey({} as never)).rejects.toThrow('current passkey prompt');
    controller.abort(); expect(WebAuthnAbortService.cancelCeremony).toHaveBeenCalledOnce();
    resolve({ id: 'late' } as never);
    await expect(first).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    vi.mocked(startRegistration).mockResolvedValueOnce({ id: 'fresh' } as never);
    expect(await createPasskey({} as never)).toEqual({ id: 'fresh' });
  });
  it('returns actionable cancellation text without leaking raw provider errors', async () => {
    vi.mocked(startRegistration).mockRejectedValueOnce({ name: 'NotAllowedError', message: 'PRIVATE' });
    await expect(createPasskey({} as never)).rejects.toThrow('cancelled or timed out');
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('PRIVATE'));
    await expect(createPasskey({} as never)).rejects.toThrow('could not be completed');
  });
});
