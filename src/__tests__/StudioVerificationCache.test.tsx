import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerificationWizardPage from '@/pages/studio/store/VerificationWizardPage';
import { useVerificationWizardResource, verificationWizardKey } from '@/hooks/useVerificationWizardResource';
import { shouldDehydrateWiezQuery } from '@/query/queryPersistor';
import { PRIVATE_QUERY_ROOTS, queryKeys } from '@/query/queryKeys';

const state = vi.hoisted(() => ({ actorId: 'actor-a', brandId: 'brand-a', phoneNumber: '' }));
const dispatch = vi.hoisted(() => vi.fn());
const api = vi.hoisted(() => ({ status: vi.fn(), draft: vi.fn(), letter: vi.fn(), signed: vi.fn(), save: vi.fn() }));
vi.mock('react-redux', () => ({ useSelector: (select: (s: unknown) => unknown) => select({ user: { profile: { id: state.actorId, activeBrandId: state.brandId, brandCountry: 'Nigeria', phoneNumber: state.phoneNumber } } }), useDispatch: () => dispatch }));
vi.mock('@/api/BrandApi', () => ({ brandApi: { getVerificationStatus: api.status, getVerificationDraft: api.draft, getVerificationLetter: api.letter, getSignedS3KeyUrl: api.signed, saveVerificationDraft: api.save } }));
let client: QueryClient;
const status = () => ({ brandId: state.brandId, verificationStatus: 'NOT_SUBMITTED', canSubmit: true, cooldownRemainingDays: 0, rejectionReasons: [], infoRequestedItems: [], badgeState: { isVerifiedBrand: false, verificationBadgeVisible: false, verifiedExplanationUrl: null } });
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
  state.actorId = 'actor-a'; state.brandId = 'brand-a'; state.phoneNumber = ''; vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 180_000, gcTime: 1_800_000, refetchOnMount: false } } });
  api.status.mockImplementation(async () => status());
  api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerLegalFirstName: 'Ada', ownerNin: 'private-evidence-value' } });
  api.letter.mockResolvedValue({ version: 1, title: 'Letter', body: 'Declaration', brandName: 'Ada Studio', ownerName: 'Ada' });
  api.save.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); client.clear(); });
describe('Studio verification cache', () => {
  it('keeps a warm saved draft phone instead of an older profile value', async () => {
    state.phoneNumber = '+2348011111111';
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerPhoneNumber: '+2348022222222' } });
    const hook = renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true)); cleanup();
    render(<VerificationWizardPage />, { wrapper: Wrapper });
    await waitFor(() => expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value.replace(/\D/g, '')).toMatch(/8022222222$/));
  });

  it('cancels every request and removes private evidence when its query is cancelled', async () => {
    let finishDraft!: (value: unknown) => void;
    api.draft.mockImplementation(() => new Promise((resolve) => { finishDraft = resolve; }));
    renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(api.draft).toHaveBeenCalledTimes(1));
    const signal = api.draft.mock.calls[0][1].signal as AbortSignal;
    const key = verificationWizardKey(state.actorId, state.brandId);
    await act(async () => { await client.cancelQueries({ queryKey: key }); client.removeQueries({ queryKey: key }); });
    expect(signal.aborted).toBe(true);
    await act(async () => { finishDraft({ draftData: { ownerNin: 'late-private-value' } }); });
    expect(client.getQueryData(key)).toBeUndefined();
  });
  it('never dispatches the previous account after a delayed draft save', async () => {
    let finishSave!: (value: unknown) => void;
    api.save.mockImplementation(() => new Promise((resolve) => { finishSave = resolve; }));
    render(<VerificationWizardPage />, { wrapper: Wrapper }); await screen.findByDisplayValue('Ada');
    fireEvent.change(screen.getByDisplayValue('Ada'), { target: { value: 'Edited before save' } });
    fireEvent.change(document.querySelector('input[type="tel"]')!, { target: { value: '8031234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save.mock.calls[0][1].ownerPhoneNumber).toBe('+2348031234567');
    cleanup(); state.actorId = 'actor-b'; dispatch.mockClear();
    await act(async () => { finishSave({ ok: true }); });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses the fresh saved draft phone before an older profile phone', async () => {
    state.phoneNumber = '+2348011111111';
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerPhoneNumber: '+2348022222222' } });
    render(<VerificationWizardPage />, { wrapper: Wrapper });
    await waitFor(() => expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value.replace(/\D/g, '')).toMatch(/8022222222$/));
  });
  it('does not show the old document preview after a pristine file change', async () => {
    api.signed.mockImplementation(async (key: string) => 'https://media.example.invalid/' + key + '.jpg');
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerPhotoKey: 'old-file', currentStep: 4 } });
    render(<VerificationWizardPage />, { wrapper: Wrapper });
    await waitFor(() => expect(document.querySelector('img[src="https://media.example.invalid/old-file.jpg"]')).toBeTruthy());
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerPhotoKey: 'new-file', currentStep: 4 } });
    await act(async () => { await client.refetchQueries({ queryKey: ['verification'] }); });
    await waitFor(() => expect(document.querySelector('img[src="https://media.example.invalid/new-file.jpg"]')).toBeTruthy());
    expect(document.querySelector('img[src="https://media.example.invalid/old-file.jpg"]')).toBeNull();
  });

  it.each([null, { ownerLegalFirstName: 'Ada' }])('clears deleted evidence on a pristine refresh: %s', async (draftData) => {
    render(<VerificationWizardPage />, { wrapper: Wrapper }); await screen.findByDisplayValue('private-evidence-value');
    api.draft.mockResolvedValue({ source: 'EMPTY', draftData });
    await act(async () => { await client.refetchQueries({ queryKey: ['verification'] }); });
    await waitFor(() => expect(screen.queryByDisplayValue('private-evidence-value')).toBeNull());
  });

  it('updates a pristine stale draft when revalidation returns', async () => {
    const first = renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true)); cleanup();
    const key = verificationWizardKey(state.actorId, state.brandId);
    client.setQueryData(key, client.getQueryData(key), { updatedAt: Date.now() - 190_000 });
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerLegalFirstName: 'Newer saved draft' } });
    render(<VerificationWizardPage />, { wrapper: Wrapper });
    expect(screen.getByDisplayValue('Ada')).toBeTruthy();
    await screen.findByDisplayValue('Newer saved draft');
  });

  it('paints the cached wizard on re-entry without duplicating three fresh requests', async () => {
    render(<VerificationWizardPage />, { wrapper: Wrapper }); await screen.findByDisplayValue('Ada');
    cleanup(); render(<VerificationWizardPage />, { wrapper: Wrapper });
    expect(screen.getByDisplayValue('Ada')).toBeTruthy();
    expect(api.status).toHaveBeenCalledTimes(1); expect(api.draft).toHaveBeenCalledTimes(1); expect(api.letter).toHaveBeenCalledTimes(1);
  });
  it('keeps unsaved wizard input when background reads finish', async () => {
    render(<VerificationWizardPage />, { wrapper: Wrapper }); const firstName = await screen.findByDisplayValue('Ada');
    fireEvent.change(firstName, { target: { value: 'Ada edited' } });
    api.draft.mockResolvedValue({ source: 'DRAFT', draftData: { ownerLegalFirstName: 'Other server value' } });
    await act(async () => { await client.refetchQueries({ queryKey: ['verification'] }); });
    expect(screen.getByDisplayValue('Ada edited')).toBeTruthy();
  });
  it('blocks an initial failure and recovers with Retry', async () => {
    api.draft.mockRejectedValueOnce(new Error('offline')); render(<VerificationWizardPage />, { wrapper: Wrapper });
    await screen.findByRole('alert'); expect(screen.queryByDisplayValue('Ada')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' })); await screen.findByDisplayValue('Ada');
  });
  it('does not retain the old form across an account/workspace change', async () => {
    const view = render(<VerificationWizardPage />, { wrapper: Wrapper }); await screen.findByDisplayValue('Ada');
    api.draft.mockImplementation(() => new Promise(() => {})); state.brandId = 'brand-b';
    view.rerender(<VerificationWizardPage />); expect(screen.queryByDisplayValue('Ada')).toBeNull();
    state.actorId = 'actor-b'; view.rerender(<VerificationWizardPage />); expect(screen.queryByDisplayValue('private-evidence-value')).toBeNull();
  });
  it('deduplicates concurrent observers and passes abort signals to every request', async () => {
    const first = renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(api.draft).toHaveBeenCalledTimes(1);
    expect(api.status).toHaveBeenCalledWith('actor-a', { force: true, signal: expect.any(AbortSignal) });
    expect(api.draft).toHaveBeenCalledWith('actor-a', { signal: expect.any(AbortSignal) });
    expect(api.letter).toHaveBeenCalledWith('actor-a', { signal: expect.any(AbortSignal) });
  });
  it('rejects a response from another workspace', async () => {
    api.status.mockResolvedValue({ ...status(), brandId: 'foreign-brand' });
    const hook = renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.isError).toBe(true)); expect(hook.result.current.data).toBeUndefined();
  });
  it('never serializes verification documents or store contact settings to disk', async () => {
    const hook = renderHook(() => useVerificationWizardResource(state.actorId, state.brandId), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    client.setQueryData(queryKeys.store.generalSettings(state.actorId, state.brandId), { contactEmail: 'private@example.invalid' });
    client.setQueryData(queryKeys.store.policies(state.actorId, state.brandId), { shippingRegions: ['NG'] });
    const snapshot = dehydrate(client, { shouldDehydrateQuery: shouldDehydrateWiezQuery });
    expect(snapshot.queries).toEqual([]);
    expect(PRIVATE_QUERY_ROOTS.has(verificationWizardKey(state.actorId, state.brandId)[0])).toBe(true);
    expect(PRIVATE_QUERY_ROOTS.has('store')).toBe(true);
  });
});
