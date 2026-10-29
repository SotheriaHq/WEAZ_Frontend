import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerSettings from '@/components/settings/tabs/CustomerSettings';
import { brandCustomersApi } from '@/api/BrandCustomersApi';
import { toast } from 'sonner';

const state = vi.hoisted(() => ({
  actorId: 'owner', brandId: 'brand', canManage: true,
  canConfigure: true, canUpgrade: true, minimum: 3,
}));
vi.mock('@/hooks/useBrandCommerceAccess', () => ({
  useBrandCommerceAccess: () => ({
    actorId: state.actorId, brandId: state.brandId, canManage: state.canManage,
    isLoading: false, isError: false, refetch: vi.fn(),
    data: { customerMinimumOrders: state.minimum,
      canConfigureCustomers: state.canConfigure, canUpgrade: state.canUpgrade },
  }),
}));
vi.mock('@/api/BrandCustomersApi', () => ({ brandCustomersApi: { update: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let client: QueryClient;
const view = () => <MemoryRouter><QueryClientProvider client={client}><CustomerSettings /></QueryClientProvider></MemoryRouter>;
const input = () => screen.getByRole('spinbutton') as HTMLInputElement;

beforeEach(() => {
  Object.assign(state, { actorId: 'owner', brandId: 'brand', canManage: true,
    canConfigure: true, canUpgrade: true, minimum: 3 });
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

describe('Customer threshold drafts and saves', () => {
  it('refreshes untouched values but preserves edits during background refresh', () => {
    const result = render(view());
    state.minimum = 4;
    result.rerender(view());
    expect(input().value).toBe('4');
    fireEvent.change(input(), { target: { value: '7' } });
    state.minimum = 5;
    result.rerender(view());
    expect(input().value).toBe('7');
  });

  it('does not carry an unsaved threshold to a different account or brand', () => {
    const result = render(view());
    fireEvent.change(input(), { target: { value: '9' } });
    state.actorId = 'another-owner';
    state.minimum = 2;
    result.rerender(view());
    expect(input().value).toBe('2');
    fireEvent.change(input(), { target: { value: '8' } });
    state.brandId = 'another-brand';
    state.minimum = 6;
    result.rerender(view());
    expect(input().value).toBe('6');
  });

  it('uses the saved response and refreshes only this account and brand', async () => {
    const saved = { customerMinimumOrders: 7, canConfigureCustomers: true };
    vi.mocked(brandCustomersApi.update).mockResolvedValue(saved as never);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(view());
    fireEvent.change(input(), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer settings' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(brandCustomersApi.update).toHaveBeenCalledWith('brand', 7);
    expect(client.getQueryData(['brand-commerce-access', 'owner', 'brand'])).toEqual(saved);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['brand-commerce-access', 'owner', 'brand'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['brand-customers', 'owner', 'brand'] });
  });

  it('ignores a late save after the active account changes', async () => {
    let finish!: (value: never) => void;
    vi.mocked(brandCustomersApi.update).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = render(view());
    fireEvent.change(input(), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer settings' }));
    state.actorId = 'another-owner'; state.minimum = 2;
    result.rerender(view());
    await act(async () => { finish({ customerMinimumOrders: 7 } as never); });
    expect(input().value).toBe('2');
    expect(toast.success).not.toHaveBeenCalled();
    expect(client.getQueryData(['brand-commerce-access', 'owner', 'brand'])).toBeUndefined();
  });

  it('preserves the entered threshold after a failed save', async () => {
    vi.mocked(brandCustomersApi.update).mockRejectedValue(new Error('offline'));
    render(view());
    fireEvent.change(input(), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer settings' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(input().value).toBe('7');
  });

  it('does not accept an old response after switching away and back to the same account', async () => {
    let finish!: (value: never) => void;
    vi.mocked(brandCustomersApi.update).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = render(view());
    fireEvent.change(input(), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer settings' }));
    state.actorId = 'another-owner';
    result.rerender(view());
    state.actorId = 'owner'; state.minimum = 4;
    result.rerender(view());
    await act(async () => { finish({ customerMinimumOrders: 7 } as never); });
    expect(input().value).toBe('4');
    expect(toast.success).not.toHaveBeenCalled();
    expect(client.getQueryData(['brand-commerce-access', 'owner', 'brand'])).toBeUndefined();
  });

  it('keeps free controls disabled and only offers a valid upgrade', () => {
    state.canConfigure = false; state.canUpgrade = false;
    const result = render(view());
    expect(input().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save customer settings' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull();
    state.canUpgrade = true;
    result.rerender(view());
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeTruthy();
  });
});
