import { configureStore } from '@reduxjs/toolkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userReducer from '@/features/userSlice';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { primeStoreSetupStatusCache, useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import RequireStoreSetup from '@/components/store/RequireStoreSetup';

const bridge = vi.hoisted(() => ({ surface: null as null | 'mobile-app', post: vi.fn() }));
const getStatus = vi.fn();
vi.mock('@/api/StoreApi', () => ({ getStoreStatus: (...args: unknown[]) => getStatus(...args) }));
vi.mock('@/hooks/useEmbeddedSurface', () => ({ useEmbeddedSurface: () => bridge.surface }));
vi.mock('@/utils/studioNativeBridge', () => ({ postStudioNativeEvent: (...args: unknown[]) => bridge.post(...args) }));
const profile = (id = 'actor-a') => ({ id, type: 'BRAND', role: 'User', activeBrandId: id + '-brand',
  brandMemberships: [{ brandId: id + '-brand', role: 'OWNER', status: 'ACTIVE', isOwner: true }], isEmailVerified: true, brandDescription: 'A sufficiently detailed profile',
  brandTags: ['fashion'], brandCountry: 'Nigeria' });
const makeStore = (id?: string) => configureStore({ reducer: { user: userReducer },
  preloadedState: { user: { profile: profile(id) as never, isAuthenticated: true } } });
const status = (complete = true) => ({ brandId: 'actor-a-brand', isSetupComplete: complete, isProfileComplete: true, isEmailVerified: true, isStoreOpen: false });
function Readout() { return <span data-testid="status">{String(useStoreSetupStatus())}</span>; }
function mount(id?: string, gate = false) {
  return render(<Provider store={makeStore(id)}><QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/studio']}>{gate ? <RequireStoreSetup><span>Protected Studio</span></RequireStoreSetup> : <Readout />}</MemoryRouter>
  </QueryClientProvider></Provider>);
}
beforeEach(() => { bridge.surface = null; bridge.post.mockReset(); queryClient.clear(); queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 60_000, refetchOnMount: false } }); getStatus.mockReset(); });
afterEach(() => { cleanup(); queryClient.clear(); });

describe('shared actor-scoped Studio setup cache', () => {
  it('does not render protected content before the first check', async () => {
    let finish!: (value: unknown) => void;
    getStatus.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount(undefined, true);
    expect(screen.queryByText('Protected Studio')).toBeNull();
    await act(async () => { finish(status()); });
    await waitFor(() => expect(screen.getByText('Protected Studio')).toBeTruthy());
  });
  it('notifies the embedded shell after commit only once for the same block', async () => {
    bridge.surface = 'mobile-app';
    const incomplete = { ...status(false), isProfileComplete: false };
    getStatus.mockResolvedValue(incomplete); mount(undefined, true);
    await screen.findByText('Finish your brand profile');
    expect(bridge.post).toHaveBeenCalledOnce();
    await act(async () => { queryClient.setQueryData(queryKeys.store.status('actor-a', 'actor-a-brand'), { ...incomplete }); });
    expect(bridge.post).toHaveBeenCalledOnce();
  });
  it('paints a warm revisit immediately without a second request', async () => {
    getStatus.mockResolvedValue(status());
    mount(); await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('true'));
    cleanup(); mount();
    expect(screen.getByTestId('status').textContent).toBe('true');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
  it('does not let an error approve an unknown store', async () => {
    getStatus.mockRejectedValue(new Error('offline')); mount(undefined, true);
    await screen.findByRole('alert'); expect(screen.queryByText('Protected Studio')).toBeNull();
  });
  it('never carries account A approval into account B', async () => {
    getStatus.mockResolvedValueOnce(status()).mockImplementationOnce(() => new Promise(() => {}));
    mount('actor-a'); await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('true'));
    cleanup(); mount('actor-b'); expect(screen.getByTestId('status').textContent).toBe('null');
  });
  it('primes only the publishing actor and accepts later authoritative changes', async () => {
    for (const id of ['actor-a', 'actor-b']) queryClient.setQueryData(queryKeys.store.status(id, id + '-brand'), status(false));
    queryClient.setQueryData(queryKeys.store.status('actor-a', 'other-brand'), status(false));
    primeStoreSetupStatusCache(true, 'actor-a', 'actor-a-brand');
    expect(queryClient.getQueryData<{ isSetupComplete: boolean }>(queryKeys.store.status('actor-a', 'other-brand'))?.isSetupComplete).toBe(false);
    expect(queryClient.getQueryData<{ isSetupComplete: boolean }>(queryKeys.store.status('actor-a', 'actor-a-brand'))?.isSetupComplete).toBe(true);
    expect(queryClient.getQueryData<{ isSetupComplete: boolean }>(queryKeys.store.status('actor-b', 'actor-b-brand'))?.isSetupComplete).toBe(false);
    queryClient.setQueryData(queryKeys.store.status('actor-a', 'actor-a-brand'), status(false));
    mount(); expect(screen.getByTestId('status').textContent).toBe('false');
  });
  it('rejects a different brand from the status endpoint', async () => {
    getStatus.mockResolvedValue({ ...status(true), brandId: 'other-brand' }); mount(undefined, true);
    await screen.findByRole('alert'); expect(screen.queryByText('Protected Studio')).toBeNull();
  });
  it('does not use a foreign cached status stored under this workspace', () => {
    queryClient.setQueryData(queryKeys.store.status('actor-a', 'actor-a-brand'), { ...status(true), brandId: 'other-brand' });
    getStatus.mockImplementation(() => new Promise(() => {})); mount(undefined, true);
    expect(screen.queryByText('Protected Studio')).toBeNull();
  });
  it('retains known completeness during a failed refresh and while store is paused', async () => {
    queryClient.setQueryData(queryKeys.store.status('actor-a', 'actor-a-brand'), status());
    getStatus.mockRejectedValue(new Error('offline')); mount();
    await act(async () => { await queryClient.refetchQueries({ queryKey: queryKeys.store.status() }); });
    expect(screen.getByTestId('status').textContent).toBe('true');
  });
});
