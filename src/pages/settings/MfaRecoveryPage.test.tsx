import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MfaRecoveryPage from './MfaRecoveryPage';
import { SecurityMfaApi, type MfaRecoveryRequest } from '@/api/SecurityMfaApi';

vi.mock('react-redux', () => ({ useSelector: (read: (value: unknown) => unknown) => read({ user: { profile: { id: '11111111-1111-4111-8111-111111111111' } } }) }));
vi.mock('@/api/httpClient', () => ({ apiClient: {}, getStoredAccessToken: () => `e30.${btoa(JSON.stringify({
  sub: '11111111-1111-4111-8111-111111111111', sid: '22222222-2222-4222-8222-222222222222', authVersion: 1, role: 'BRAND',
})).replace(/=/g, '')}.sig` }));
vi.mock('@/api/SecurityMfaApi', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/SecurityMfaApi')>(),
  SecurityMfaApi: { recoveryStatus: vi.fn(), requestRecovery: vi.fn(), updateRecovery: vi.fn(), status: vi.fn() },
}));
const request = (status: MfaRecoveryRequest['status']): MfaRecoveryRequest => ({ id: 'recovery-reference', status,
  revision: 1, reason: 'Lost device', message: null, approvals: status === 'APPROVED' ? 2 : 0, requiredApprovals: 2,
  createdAt: '2026-11-02T00:00:00Z', expiresAt: '2026-11-09T00:00:00Z',
  approvedUntil: status === 'APPROVED' ? '2026-11-03T00:00:00Z' : null, completedAt: null });
const open = () => render(<MemoryRouter><MfaRecoveryPage /></MemoryRouter>);
beforeEach(() => vi.resetAllMocks());

describe('account-holder recovery screens', () => {
  it.each(['PENDING_REVIEW', 'NEEDS_INFORMATION'] as const)('can continue an existing %s test exception with password confirmation', async status => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: { ...request(status), requiredApprovals: 0 } });
    vi.mocked(SecurityMfaApi.requestRecovery).mockResolvedValue({ request: { ...request('APPROVED'), requiredApprovals: 0, approvals: 0 } });
    open();
    const button = await screen.findByRole('button', { name: 'Continue recovery' });
    expect(screen.queryByText(/No automatic approval/)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(SecurityMfaApi.requestRecovery).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'local-only-password' } });
    fireEvent.click(button);
    await waitFor(() => expect(SecurityMfaApi.requestRecovery).toHaveBeenCalledWith('local-only-password', 'Lost device', expect.any(AbortSignal)));
    expect(await screen.findByRole('button', { name: 'Set up replacement authenticator' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue recovery' })).not.toBeInTheDocument();
  });
  it('explains a server-confirmed test SuperAdmin exception without claiming independent reviews occurred', async () => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: { ...request('APPROVED'), requiredApprovals: 0, approvals: 0 } });
    open();
    expect(await screen.findByText(/Independent review is waived/)).toHaveTextContent('password, email code and verified replacement');
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up replacement authenticator' })).toBeInTheDocument();
  });
  it.each(['PENDING_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED'] as const)(
    'renders the real %s state without unlocking an unapproved replacement', async status => {
      vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: request(status) });
      open(); await screen.findByText(/Reference:/);
      expect(screen.queryByRole('button', { name: 'Set up replacement authenticator' }) !== null).toBe(status === 'APPROVED');
      expect(screen.queryByRole('button', { name: 'Cancel recovery request' }) !== null).toBe(['PENDING_REVIEW', 'NEEDS_INFORMATION', 'APPROVED'].includes(status));
      expect(SecurityMfaApi.requestRecovery).not.toHaveBeenCalled();
    });
  it('does not offer replacement when a reviewer’s approval became invalid', async () => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: { ...request('APPROVED'), reviewChanged: true } });
    open(); expect(await screen.findByRole('alert')).toHaveTextContent('approval is no longer valid');
    expect(screen.queryByRole('button', { name: 'Set up replacement authenticator' })).not.toBeInTheDocument();
  });
  it('submits additional information to the existing case and clears the password', async () => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: { ...request('NEEDS_INFORMATION'), message: 'Provide your support reference.' } });
    vi.mocked(SecurityMfaApi.updateRecovery).mockResolvedValue({ request: { ...request('PENDING_REVIEW'), revision: 2 } });
    open(); await screen.findByText('Provide your support reference.');
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'local-only-password' } });
    fireEvent.change(screen.getByLabelText('Recovery information'), { target: { value: 'Case reference 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send information for a new review' }));
    await waitFor(() => expect(SecurityMfaApi.updateRecovery).toHaveBeenCalledWith('recovery-reference', 'local-only-password', 'Case reference 123', expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
    expect(SecurityMfaApi.requestRecovery).not.toHaveBeenCalled();
  });
  it('offers retry after an offline status request and never fabricates a submitted request', async () => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ request: null });
    open(); expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
    expect(screen.queryByRole('button', { name: 'Request support review' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh recovery status' }));
    expect(await screen.findByRole('button', { name: 'Request support review' })).toBeInTheDocument();
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });
  it('does not submit recovery without a password and non-secret explanation', async () => {
    vi.mocked(SecurityMfaApi.recoveryStatus).mockResolvedValue({ request: null }); open();
    fireEvent.click(await screen.findByRole('button', { name: 'Request support review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('current password');
    expect(SecurityMfaApi.requestRecovery).not.toHaveBeenCalled();
  });
});
