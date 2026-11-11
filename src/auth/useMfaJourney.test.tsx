import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMfaJourney } from './useMfaJourney';
import { SecurityMfaApi, type MfaSetup, type MfaStatus } from '../api/SecurityMfaApi';
import { createPasskey, passkeyAvailability } from './passkeys';
import type { RegistrationResponseJSON } from '@simplewebauthn/browser';

vi.mock('../api/SecurityMfaApi', () => ({
  SecurityMfaApi: { status: vi.fn(), requestEmail: vi.fn(), confirmEmail: vi.fn(), beginTotp: vi.fn(),
    confirmTotp: vi.fn(), revoke: vi.fn(), regenerate: vi.fn(), beginPasskey: vi.fn(), confirmPasskey: vi.fn() },
  mfaErrorMessage: () => 'Could not finish. Retry safely.',
}));
vi.mock('./passkeys', () => ({ createPasskey: vi.fn(), passkeyAvailability: vi.fn() }));
const status: MfaStatus = { factors: [], recoveryCodesRemaining: 0, readVerificationSeconds: 300,
  passkeys: { webConfigured: false, androidConfigured: false },
  setup: { hasPassword: true, emailVerified: true } };
const setup = { factorId: 'factor', secret: 'PRIVATE', uri: 'otpauth://totp/test', expiresInSeconds: 600 };
const deferred = <T,>() => { let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(SecurityMfaApi.status).mockResolvedValue(status);
  vi.mocked(passkeyAvailability).mockResolvedValue({ available: false, message: 'Use an authenticator.' }); });

describe('ephemeral MFA setup', () => {
  it('survives React strict lifecycle, reaches loading/error/retry and does not use an aborted result', async () => {
    const stale = deferred<MfaStatus>();
    vi.mocked(SecurityMfaApi.status).mockReturnValueOnce(stale.promise).mockResolvedValue(status);
    const { result } = renderHook(() => useMfaJourney({ kind: 'add' }, () => true),
      { reactStrictMode: true });
    await waitFor(() => expect(SecurityMfaApi.status).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.step).toBe('password'));
    await act(async () => stale.resolve({ ...status, setup: { hasPassword: false, emailVerified: false } }));
    expect(result.current.status?.setup.hasPassword).toBe(true);
  });
  it('runs email proof before first enrollment, clears password/seed after use and shows codes once', async () => {
    vi.mocked(SecurityMfaApi.requestEmail).mockResolvedValue({ challengeId: 'email', expiresInSeconds: 600 });
    vi.mocked(SecurityMfaApi.confirmEmail).mockResolvedValue({ enrollmentProof: 'email-proof' });
    vi.mocked(SecurityMfaApi.beginTotp).mockResolvedValue(setup);
    vi.mocked(SecurityMfaApi.confirmTotp).mockResolvedValue({ recoveryCodes: ['private-backup'] });
    const { result } = renderHook(() => useMfaJourney({ kind: 'add' }, () => true));
    await waitFor(() => expect(result.current.step).toBe('password'));
    act(() => result.current.setPassword('current-password'));
    await act(async () => result.current.submit());
    expect(result.current.step).toBe('email'); expect(SecurityMfaApi.beginTotp).not.toHaveBeenCalled();
    act(() => result.current.setCode('12345678'));
    await act(async () => result.current.submit());
    expect(SecurityMfaApi.beginTotp).toHaveBeenCalledWith('current-password', 'email-proof', undefined, expect.any(AbortSignal));
    expect(result.current.password).toBe(''); expect(result.current.setup?.secret).toBe('PRIVATE');
    act(() => result.current.setCode('123456'));
    await act(async () => result.current.submit());
    expect(result.current.step).toBe('codes'); expect(result.current.setup).toBeNull();
    expect(result.current.code).toBe(''); expect(result.current.saved).toBe(false);
  });
  it('does not mutate when the account changes while the user is entering a code', async () => {
    let current = true;
    const { result } = renderHook(() => useMfaJourney({ kind: 'add' }, () => current));
    await waitFor(() => expect(result.current.step).toBe('password'));
    act(() => result.current.setPassword('password')); current = false;
    await act(async () => result.current.submit());
    expect(SecurityMfaApi.requestEmail).not.toHaveBeenCalled();
  });
  it('prevents duplicate submissions and aborts a pending setup on unmount', async () => {
    const pending = deferred<MfaSetup>();
    vi.mocked(SecurityMfaApi.status).mockResolvedValue({ ...status, factors: [{ id: 'old', kind: 'TOTP', label: 'App', verifiedAt: '', createdAt: '' }] });
    vi.mocked(SecurityMfaApi.beginTotp).mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useMfaJourney({ kind: 'replace', factorId: 'old' }, () => true));
    await waitFor(() => expect(result.current.step).toBe('password'));
    act(() => result.current.setPassword('password'));
    let first!: Promise<void>;
    act(() => { first = result.current.submit(); });
    await act(async () => result.current.submit());
    expect(SecurityMfaApi.beginTotp).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(SecurityMfaApi.beginTotp).mock.calls[0][3]!;
    unmount(); expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve(setup); await first; });
  });
  it('shows a retryable loading failure without pretending setup succeeded', async () => {
    vi.mocked(SecurityMfaApi.status).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(status);
    const { result } = renderHook(() => useMfaJourney({ kind: 'add' }, () => true));
    await waitFor(() => expect(result.current.error).toBeTruthy()); expect(result.current.step).toBe('loading');
    await act(async () => result.current.reload()); expect(result.current.step).toBe('password');
  });
});

describe('passkey setup journey', () => {
  const registered = { id: 'credential' } as RegistrationResponseJSON;
  async function start() {
    vi.mocked(SecurityMfaApi.status).mockResolvedValue({ ...status, factors: [{ id: 'old', kind: 'TOTP', label: 'App', verifiedAt: '', createdAt: '' }],
      passkeys: { webConfigured: true, androidConfigured: true } });
    vi.mocked(passkeyAvailability).mockResolvedValue({ available: true, message: null });
    vi.mocked(SecurityMfaApi.beginPasskey).mockResolvedValue({ challengeId: 'registration', options: {} as never, expiresInSeconds: 300 });
    vi.mocked(createPasskey).mockResolvedValue(registered);
    vi.mocked(SecurityMfaApi.confirmPasskey).mockResolvedValue({ recoveryCodes: ['private-backup'] });
    let current = true;
    const view = renderHook(() => useMfaJourney({ kind: 'passkey' }, () => current));
    await waitFor(() => expect(view.result.current.passkeySupport.available).toBe(true));
    act(() => view.result.current.setPassword('current-password'));
    await act(async () => view.result.current.submit());
    return { ...view, cancel: () => { current = false; } };
  }
  it('prepares registration first and opens the system ceremony only on the next explicit action', async () => {
    const { result } = await start();
    expect(result.current.step).toBe('passkey'); expect(result.current.password).toBe('');
    expect(createPasskey).not.toHaveBeenCalled(); expect(SecurityMfaApi.confirmPasskey).not.toHaveBeenCalled();
    await act(async () => result.current.submit());
    expect(createPasskey).toHaveBeenCalledOnce(); expect(result.current.step).toBe('codes');
    expect(result.current.passkeyResponse).toBeNull();
  });
  it('retries an uncertain confirmation with the same credential instead of creating another device credential', async () => {
    const { result } = await start();
    vi.mocked(SecurityMfaApi.confirmPasskey).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ recoveryCodes: [] });
    await act(async () => result.current.submit());
    expect(result.current.step).toBe('passkey'); expect(result.current.passkeyResponse).toBe(registered);
    await act(async () => result.current.submit());
    expect(createPasskey).toHaveBeenCalledOnce(); expect(SecurityMfaApi.confirmPasskey).toHaveBeenCalledTimes(2);
    expect(result.current.step).toBe('complete');
  });
  it('discards a late device response after its owning setup closes', async () => {
    const view = await start(); const pending = deferred<RegistrationResponseJSON>();
    vi.mocked(createPasskey).mockReturnValue(pending.promise);
    let submitted!: Promise<void>; act(() => { submitted = view.result.current.submit(); });
    view.cancel();
    await act(async () => { pending.resolve(registered); await submitted; });
    expect(SecurityMfaApi.confirmPasskey).not.toHaveBeenCalled();
  });
  it('does not confirm after the registration deadline even if the device prompt finishes later', async () => {
    const view = await start(); const pending = deferred<RegistrationResponseJSON>();
    vi.mocked(createPasskey).mockReturnValue(pending.promise);
    let submitted!: Promise<void>; act(() => { submitted = view.result.current.submit(); });
    const clock = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 300001);
    try { await act(async () => { pending.resolve(registered); await submitted; }); }
    finally { clock.mockRestore(); }
    expect(SecurityMfaApi.confirmPasskey).not.toHaveBeenCalled();
  });
});
