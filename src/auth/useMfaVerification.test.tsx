import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMfaVerification } from './useMfaVerification';
import { SecurityMfaApi, type MfaStatus } from '../api/SecurityMfaApi';
import { authenticatePasskey, passkeyAvailability } from './passkeys';
import type { SecurityPrompt } from './securityChallenge';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
vi.mock('../api/SecurityMfaApi', () => ({ SecurityMfaApi: { status: vi.fn(), passkeyOptions: vi.fn(), verify: vi.fn() }, mfaErrorMessage: () => 'Could not finish. Retry safely.' }));
vi.mock('./passkeys', () => ({ authenticatePasskey: vi.fn(), passkeyAvailability: vi.fn() }));
const status: MfaStatus = { factors: [{ id: 'passkey', kind: 'PASSKEY', label: 'My phone', createdAt: '', verifiedAt: '' }],
  recoveryCodesRemaining: 0, readVerificationSeconds: 300, setup: { hasPassword: true, emailVerified: true },
  passkeys: { webConfigured: true, androidConfigured: true } };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(SecurityMfaApi.status).mockResolvedValue(status);
  vi.mocked(passkeyAvailability).mockResolvedValue({ available: true, message: null });
  vi.mocked(SecurityMfaApi.passkeyOptions).mockResolvedValue({ challenge: 'test' } as never);
  vi.mocked(authenticatePasskey).mockResolvedValue({ id: 'credential' } as AuthenticationResponseJSON);
  vi.mocked(SecurityMfaApi.verify).mockResolvedValue({ verified: true, actionProof: 'exact-proof' });
});
async function open() {
  let current = true;
  const complete = vi.fn();
  const prompt: SecurityPrompt = { identity: 'actor', isCurrent: () => current, complete, cancel: () => { current = false; },
    challenge: { code: 'STEP_UP_REQUIRED', sensitivity: 'CRITICAL_CHANGE', challengeId: 'challenge', deadline: performance.now() + 300000, review: { title: 'Exact action' } } };
  const view = renderHook(() => useMfaVerification(prompt));
  await waitFor(() => expect(view.result.current.passkeySupport.available).toBe(true));
  return { ...view, prompt, complete };
}
describe('passkey action verification', () => {
  it('requires explicit preparation followed by a new user press, and forwards only verified authority', async () => {
    const { result, complete } = await open();
    expect(result.current.method).toBe('passkey');
    await act(async () => result.current.preparePasskey());
    expect(authenticatePasskey).not.toHaveBeenCalled(); expect(SecurityMfaApi.verify).not.toHaveBeenCalled();
    await act(async () => result.current.submit());
    expect(SecurityMfaApi.verify).toHaveBeenCalledWith('challenge', { passkey: { id: 'credential' } }, expect.any(AbortSignal));
    expect(complete).toHaveBeenCalledWith({ actionProof: 'exact-proof' });
  });
  it('does not open or submit unprepared options', async () => {
    const { result } = await open(); await act(async () => result.current.submit());
    expect(authenticatePasskey).not.toHaveBeenCalled(); expect(SecurityMfaApi.verify).not.toHaveBeenCalled();
  });
  it('does not send a late system result after the exact prompt was cancelled', async () => {
    const { result, prompt, complete } = await open();
    await act(async () => result.current.preparePasskey());
    let resolve!: (value: AuthenticationResponseJSON) => void;
    vi.mocked(authenticatePasskey).mockReturnValue(new Promise(yes => { resolve = yes; }));
    let pending!: Promise<void>; act(() => { pending = result.current.submit(); }); prompt.cancel();
    await act(async () => { resolve({ id: 'late' } as AuthenticationResponseJSON); await pending; });
    expect(SecurityMfaApi.verify).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled();
  });
  it('keeps an alternate recovery method usable after a cancelled device ceremony', async () => {
    vi.mocked(SecurityMfaApi.status).mockResolvedValue({ ...status, recoveryCodesRemaining: 1 });
    const { result, complete } = await open(); await act(async () => result.current.preparePasskey());
    vi.mocked(authenticatePasskey).mockRejectedValueOnce(new Error('cancelled'));
    await act(async () => result.current.submit()); expect(complete).not.toHaveBeenCalled();
    act(() => { result.current.setMethod('recovery'); result.current.setCode('A'.repeat(32)); });
    await act(async () => result.current.submit());
    expect(SecurityMfaApi.verify).toHaveBeenCalledWith('challenge', { recoveryCode: 'A'.repeat(32) }, expect.any(AbortSignal));
    expect(complete).toHaveBeenCalledOnce();
  });
});
