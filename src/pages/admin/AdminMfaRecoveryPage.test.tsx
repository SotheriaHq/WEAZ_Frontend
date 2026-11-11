import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMfaRecoveryPage from './AdminMfaRecoveryPage';
import { SecurityMfaApi, type AdminMfaRecoveryRequest } from '@/api/SecurityMfaApi';

vi.mock('react-redux', () => ({ useSelector: (read: (value: unknown) => unknown) => read({ user: { profile: { id: 'reviewer' } } }) }));
vi.mock('@/api/SecurityMfaApi', () => ({ SecurityMfaApi: { adminRecoveryQueue: vi.fn(), reviewRecovery: vi.fn() },
  mfaErrorMessage: () => 'Review changed. Refresh the request.' }));
const entry = (): AdminMfaRecoveryRequest => ({ id: 'case-reference', userId: 'owner', status: 'PENDING_REVIEW', revision: 3,
  reason: 'Lost all methods', publicMessage: null, expiresAt: '2026-11-09T00:00:00Z', createdAt: '2026-11-02T00:00:00Z',
  user: { id: 'owner', username: 'Existing account', status: 'ACTIVE', role: 'User' }, reviews: [] });
beforeEach(() => vi.resetAllMocks());

describe('independent reviewer screens', () => {
  it('shows the empty queue without exposing a decision form', async () => {
    vi.mocked(SecurityMfaApi.adminRecoveryQueue).mockResolvedValue({ items: [], nextCursor: null });
    render(<AdminMfaRecoveryPage />);
    expect(await screen.findByText('No open recovery requests.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve this review' })).not.toBeInTheDocument();
  });
  it('does not offer self-review or a second approval by the same administrator', async () => {
    vi.mocked(SecurityMfaApi.adminRecoveryQueue).mockResolvedValue({ items: [
      { ...entry(), id: 'own-case', userId: 'reviewer' },
      { ...entry(), reviews: [{ id: 'vote', revision: 3, reviewerId: 'reviewer', decision: 'APPROVE', evidenceReference: 'restricted case' }] },
    ], nextCursor: null });
    render(<AdminMfaRecoveryPage />);
    expect(await screen.findByText('You cannot review your own recovery request.')).toBeInTheDocument();
    expect(screen.getByText(/You already reviewed this revision/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve this review' })).not.toBeInTheDocument();
  });
  it('requires independent verification attestation and submits the exact case revision once', async () => {
    vi.mocked(SecurityMfaApi.adminRecoveryQueue).mockResolvedValue({ items: [entry()], nextCursor: null });
    vi.mocked(SecurityMfaApi.reviewRecovery).mockResolvedValue({ status: 'PENDING_REVIEW', approvals: 1 });
    render(<AdminMfaRecoveryPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve this review' }));
    fireEvent.change(screen.getByLabelText('Private evidence reference'), { target: { value: 'restricted-case-reference' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity and submit this decision' }));
    expect(SecurityMfaApi.reviewRecovery).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('independent ownership verification');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity and submit this decision' }));
    await waitFor(() => expect(SecurityMfaApi.reviewRecovery).toHaveBeenCalledWith('case-reference', {
      revision: 3, decision: 'APPROVE', identityVerified: true, evidenceReference: 'restricted-case-reference',
    }, expect.any(AbortSignal)));
    expect(SecurityMfaApi.reviewRecovery).toHaveBeenCalledOnce();
  });
});
