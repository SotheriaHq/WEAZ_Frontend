import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueFacts, QueueOrderActions } from './CustomOrderQueue';
import { adminOrderQueueApi, customOrderQueueApi, type QueuePresenter } from '@/api/CustomOrderQueueApi';
import { registerQueuePayload } from '@/features/orders/queueClock';

vi.mock('@/hooks/useAdminPermissions', () => ({ useAdminPermissions: () => ({ hasPermission: () => true }) }));
vi.mock('@/query/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/api/CustomOrderQueueApi', () => ({ customOrderQueueApi: { refundQuote: vi.fn(), retain: vi.fn(), cancel: vi.fn(), resubmit: vi.fn() }, adminOrderQueueApi: { refundQuote: vi.fn(), action: vi.fn() } }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
vi.mock('@/hooks/useOverlayBackClose', () => ({ useOverlayBackClose: vi.fn() }));

const makeQueue = (overrides: Partial<QueuePresenter> = {}): QueuePresenter => {
  const now = Date.now();
  return registerQueuePayload({ lane: 'PENDING', orderRevision: 12, serverNow: new Date(now).toISOString(), queueExpiresAt: new Date(now + 24 * 3600000).toISOString(), retainOpensAt: new Date(now - 24 * 3600000).toISOString(), retainClosesAt: new Date(now + 12 * 3600000).toISOString(), canRetain: true, canCancel: true, canResubmit: false, adminPromotionHeld: false, position: 7, waitingCount: 20, ...overrides });
};
beforeEach(() => vi.resetAllMocks());
describe('waiting-order actions', () => {
  it('shows a persistent admin hold and deadline to the shopper', () => {
    render(<QueueFacts queue={makeQueue({ adminPromotionHeld: true })} />);
    expect(screen.getByText(/Admin promotion hold/)).toBeVisible();
    expect(screen.getByText(/Cancels in/)).toBeVisible();
    expect(screen.getByText(/Payment captured and held until Active/)).toBeVisible();
  });
  it('hides queue clocks for historical records and retain after it was used', () => {
    const { rerender } = render(<QueueFacts queue={makeQueue({ lane: null })} />);
    expect(screen.queryByText(/Cancels in/)).toBeNull();
    rerender(<MemoryRouter><QueueOrderActions orderId="a" queue={makeQueue({ canRetain: false })} audience="buyer" /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Retain position/ })).toBeNull();
  });
  it('requires a current server quote and reason before cancellation, then displays processing truthfully', async () => {
    vi.mocked(customOrderQueueApi.refundQuote).mockResolvedValue({ orderRevision: 12, currency: 'NGN', capturedAmount: 132500, vatWithheld: 7500, garmentFeeWithheld: 10000, jumpFeeWithheld: 2000, deliveryRefund: 5000, refundAmount: 113000 });
    vi.mocked(customOrderQueueApi.cancel).mockResolvedValue(makeQueue({ lane: 'TERMINAL', canCancel: false, canRetain: false, canResubmit: true, refundSummary: { status: 'PENDING', amount: 113000, currency: 'NGN' } }));
    const onChanged = vi.fn();
    render(<MemoryRouter><QueueOrderActions orderId="a" queue={makeQueue()} audience="buyer" onChanged={onChanged} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel waiting order' }));
    await screen.findByText('10% jump cancellation fee');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), { target: { value: 'Delivery plans changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(customOrderQueueApi.cancel).toHaveBeenCalledWith('a', 'Delivery plans changed', 12));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Processing does not mean money has reached your bank/)).toBeVisible();
  });
  it('does not let an older quote response apply to a different order', async () => {
    let resolveQuote!: (value: { currency: string; orderRevision: number; refundAmount: number }) => void;
    vi.mocked(customOrderQueueApi.refundQuote).mockReturnValue(new Promise((resolve) => { resolveQuote = resolve; }));
    const { rerender } = render(<MemoryRouter><QueueOrderActions orderId="a" queue={makeQueue()} audience="buyer" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel waiting order' }));
    rerender(<MemoryRouter><QueueOrderActions orderId="b" queue={makeQueue()} audience="buyer" /></MemoryRouter>);
    await act(async () => resolveQuote({ currency: 'NGN', orderRevision: 12, refundAmount: 1 }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(customOrderQueueApi.cancel).not.toHaveBeenCalled();
  });
  it('routes admin refund review through the admin quote endpoint', async () => {
    vi.mocked(adminOrderQueueApi.refundQuote).mockResolvedValue({ currency: 'NGN', orderRevision: 12, refundAmount: 1 });
    render(<MemoryRouter><QueueOrderActions orderId="a" queue={makeQueue()} audience="admin" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel waiting order' }));
    await waitFor(() => expect(adminOrderQueueApi.refundQuote).toHaveBeenCalledWith('a'));
    expect(customOrderQueueApi.refundQuote).not.toHaveBeenCalled();
  });
});
