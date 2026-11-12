import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StoreGeneralSettings from '@/components/settings/tabs/StoreGeneralSettings';
import { queryKeys } from '@/query/queryKeys';

const state = vi.hoisted(() => ({ actorId: 'actor-a', brandId: 'brand-a' }));
const api = vi.hoisted(() => ({ general: vi.fn(), saveProfile: vi.fn(), savePolicies: vi.fn(), name: vi.fn(), open: vi.fn(), close: vi.fn(), prime: vi.fn() }));
vi.mock('react-redux', () => ({ useSelector: (select: (s: unknown) => unknown) => select({ user: { profile: { id: state.actorId, activeBrandId: state.brandId } } }) }));
vi.mock('@/api/StoreApi', () => ({ getStoreGeneralSettings: api.general, updateStoreProfile: api.saveProfile, updateStorePolicies: api.savePolicies, updateStoreName: api.name, openStore: api.open, closeStore: api.close }));
vi.mock('@/hooks/useStoreSetupStatus', () => ({ primeStoreSetupStatusCache: api.prime }));
const settings = () => ({ brandId: state.brandId, storeName: 'Ada Studio', slug: 'ada', tagline: 'Clothes for every day', tags: [], description: 'Tailored for you', contactEmail: 'brand@example.invalid', contactEmailPublic: false, isStoreOpen: true });
let client: QueryClient;
const ui = () => <QueryClientProvider client={client}><StoreGeneralSettings /></QueryClientProvider>;
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
  state.actorId = 'actor-a'; state.brandId = 'brand-a';
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 180_000, gcTime: 1_800_000, refetchOnMount: false } } });
  vi.clearAllMocks(); api.general.mockImplementation(async () => settings());
  api.saveProfile.mockResolvedValue({}); api.savePolicies.mockResolvedValue({});
});
afterEach(() => { cleanup(); client.clear(); });
describe('Studio profile cache', () => {
  it('paints a fresh revisit immediately without another request', async () => {
    render(ui()); await screen.findByDisplayValue('Ada Studio'); cleanup(); render(ui());
    expect(screen.getByDisplayValue('Ada Studio')).toBeTruthy(); expect(api.general).toHaveBeenCalledTimes(1);
  });
  it('paints stale saved data while quietly revalidating it', async () => {
    client.setQueryData(queryKeys.store.generalSettings(state.actorId, state.brandId), settings(), { updatedAt: Date.now() - 190_000 });
    api.general.mockImplementation(() => new Promise(() => {}));
    render(ui()); expect(screen.getByDisplayValue('Ada Studio')).toBeTruthy();
    await waitFor(() => expect(api.general).toHaveBeenCalledTimes(1));
    expect((screen.getByDisplayValue('Ada Studio') as HTMLInputElement).disabled).toBe(false);
  });
  it('refreshes pristine fields but preserves unsaved edits', async () => {
    render(ui()); await screen.findByDisplayValue('Ada Studio');
    api.general.mockResolvedValue({ ...settings(), tagline: 'New server tagline' });
    await act(async () => { await client.refetchQueries({ queryKey: ['store'] }); });
    fireEvent.change(await screen.findByDisplayValue('New server tagline'), { target: { value: 'My unsaved tagline' } });
    api.general.mockResolvedValue({ ...settings(), tagline: 'Another server tagline' });
    await act(async () => { await client.refetchQueries({ queryKey: ['store'] }); });
    expect(screen.getByDisplayValue('My unsaved tagline')).toBeTruthy();
  });
  it('clears the old form immediately when the account or workspace changes', async () => {
    const view = render(ui()); await screen.findByDisplayValue('Ada Studio');
    api.general.mockImplementation(() => new Promise(() => {})); state.brandId = 'brand-b'; view.rerender(ui());
    expect(screen.queryByDisplayValue('Ada Studio')).toBeNull();
    state.actorId = 'actor-b'; view.rerender(ui()); expect(screen.queryByDisplayValue('brand@example.invalid')).toBeNull();
  });
  it('shows a recoverable first-load error instead of editable empty defaults', async () => {
    api.general.mockRejectedValueOnce(new Error('offline')); render(ui()); await screen.findByRole('alert');
    expect(screen.queryByDisplayValue('Ada Studio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry settings' })); await screen.findByDisplayValue('Ada Studio');
  });
});
