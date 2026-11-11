import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaSetupModal, MfaVerificationDialog } from './MfaSettingsPanel';
import { SecurityMfaApi, type MfaStatus } from '@/api/SecurityMfaApi';
import { createPasskey, passkeyAvailability } from '@/auth/passkeys';
import { securityChallenges, SecurityVerificationError } from '@/auth/securityChallenge';
import { requestPhoneSessionVerification } from '@/auth/parentSessionBridge';
vi.mock('@/api/httpClient', () => ({ apiClient: {}, getStoredAccessToken: () => null }));
vi.mock('@/api/SecurityMfaApi', async original => ({ ...await original<typeof import('@/api/SecurityMfaApi')>(),
  SecurityMfaApi: { status: vi.fn(), beginPasskey: vi.fn(), confirmPasskey: vi.fn() } }));
vi.mock('@/auth/passkeys', () => ({ createPasskey: vi.fn(), passkeyAvailability: vi.fn() }));
vi.mock('@/auth/parentSessionBridge', () => ({ requestPhoneSessionVerification: vi.fn() }));
const status: MfaStatus = { factors: [{ id: 'old', kind: 'TOTP', label: 'My app', verifiedAt: '', createdAt: '' }],
  recoveryCodesRemaining: 2, readVerificationSeconds: 300, setup: { hasPassword: true, emailVerified: true },
  passkeys: { webConfigured: true, androidConfigured: true } };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(SecurityMfaApi.status).mockResolvedValue(status);
  vi.mocked(passkeyAvailability).mockResolvedValue({ available: true, message: null });
  vi.mocked(SecurityMfaApi.beginPasskey).mockResolvedValue({ challengeId: 'setup', options: {} as never, expiresInSeconds: 300 });
  vi.mocked(createPasskey).mockResolvedValue({ id: 'credential' } as never);
  vi.mocked(SecurityMfaApi.confirmPasskey).mockResolvedValue({ recoveryCodes: ['PRIVATE-BACKUP'] });
});
function open() {
  const onClose = vi.fn(), onDone = vi.fn();
  render(<MemoryRouter><MfaSetupModal mode={{ kind: 'passkey' }} isCurrent={() => true} onClose={onClose} onDone={onDone} /></MemoryRouter>);
  return { onClose, onDone };
}
async function prepare() {
  await screen.findByLabelText('Passkey name');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue securely' })).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'current-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue securely' }));
  await screen.findByRole('button', { name: 'Create passkey' });
}
describe('passkey setup screens', () => {
  it('explains unsupported environments and leaves other methods unchanged', async () => {
    vi.mocked(passkeyAvailability).mockResolvedValue({ available: false, message: 'Use an authenticator app on this device.' });
    open(); await screen.findByText('Use an authenticator app on this device.');
    expect(screen.getByRole('button', { name: 'Continue securely' })).toBeDisabled();
    expect(SecurityMfaApi.beginPasskey).not.toHaveBeenCalled();
  });
  it('shows an explicit system-prompt action and supports retry after user cancellation', async () => {
    open(); await prepare(); expect(createPasskey).not.toHaveBeenCalled();
    vi.mocked(createPasskey).mockRejectedValueOnce(new SecurityVerificationError('The passkey prompt was cancelled. Choose another method or try again.'));
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await screen.findByText('The passkey prompt was cancelled. Choose another method or try again.');
    expect(screen.getByRole('button', { name: 'Create passkey' })).not.toBeDisabled();
    expect(SecurityMfaApi.confirmPasskey).not.toHaveBeenCalled();
  });
  it('keeps confirmation retry separate from creation and warns before losing unsaved recovery codes', async () => {
    const { onClose, onDone } = open(); await prepare();
    vi.mocked(SecurityMfaApi.confirmPasskey).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ recoveryCodes: ['PRIVATE-BACKUP'] });
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry passkey confirmation' }));
    await screen.findByText('PRIVATE-BACKUP');
    expect(createPasskey).toHaveBeenCalledOnce(); expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(await screen.findByRole('button', { name: 'Keep codes open' })).toBeVisible(); expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep codes open' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });
});

describe('phone-first Studio verification screen', () => {
  const show = async () => {
    render(<MemoryRouter><MfaVerificationDialog /></MemoryRouter>);
    let result!: ReturnType<typeof securityChallenges.request>;
    await act(async () => {
      result = securityChallenges.request({ code: 'PARENT_SESSION_VERIFICATION_REQUIRED', sensitivity: 'SENSITIVE_READ',
        parentSessionId: '11111111-1111-4111-8111-111111111111', deadline: performance.now() + 300_000,
        review: { title: 'Verify the phone' } }, 'child', () => 'child');
      void result.catch(() => undefined);
    });
    return { result };
  };
  it('offers phone verification, explains failure and retries without loading child MFA methods', async () => {
    vi.mocked(requestPhoneSessionVerification).mockRejectedValueOnce(new Error('Phone verification timed out. Retry when ready.')).mockResolvedValueOnce();
    const { result } = await show();
    await waitFor(() => expect(screen.getByText(/Verifying this Studio session cannot unlock your phone/)).toBeVisible());
    expect(SecurityMfaApi.status).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify on this phone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('timed out');
    fireEvent.click(screen.getByRole('button', { name: 'Verify on this phone' }));
    await expect(result).resolves.toEqual({ actionProof: null });
  });
  it('cancels a pending host request when the dialog is closed', async () => {
    let signal!: AbortSignal;
    vi.mocked(requestPhoneSessionVerification).mockImplementation((_parent, value) => {
      signal = value; return new Promise(() => undefined);
    });
    const { result } = await show();
    const cancelled = expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    fireEvent.click(screen.getByRole('button', { name: 'Verify on this phone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel verification' }));
    await cancelled; await waitFor(() => expect(signal.aborted).toBe(true));
  });
});
