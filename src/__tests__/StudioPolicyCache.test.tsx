import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreWizardData } from '@/types/storeWizard';
import StorePoliciesSettings from '@/components/settings/tabs/StorePoliciesSettings';
import { queryKeys } from '@/query/queryKeys';

const state = vi.hoisted(() => ({ actorId: 'actor-a', brandId: 'actor-a-brand' }));
const api = vi.hoisted(() => ({ policies: vi.fn(), general: vi.fn(), savePolicies: vi.fn(), saveProfile: vi.fn() }));
vi.mock('react-redux', () => ({ useSelector: (select: (s: unknown) => unknown) => select({ user: { profile: { id: state.actorId, activeBrandId: state.brandId } } }) }));
vi.mock('@/api/StoreApi', () => ({ getStorePolicies: api.policies, getStoreGeneralSettings: api.general, updateStorePolicies: api.savePolicies, updateStoreProfile: api.saveProfile }));
vi.mock('@/components/store/wizard/StorePoliciesStep', () => ({ default: ({ data, onChange, onContinue }: { data: StoreWizardData; onChange: (update: Partial<StoreWizardData>) => void; onContinue: () => void }) => <div>
  <input aria-label="Contact email" value={data.contactEmail} onChange={(e) => onChange({ contactEmail: e.target.value })} />
  <button onClick={onContinue}>Save policies</button>
</div> }));

let client: QueryClient;
function mount() {
  return render(<QueryClientProvider client={client}><StorePoliciesSettings /></QueryClientProvider>);
}
beforeEach(() => {
  state.actorId = 'actor-a'; state.brandId = 'actor-a-brand';
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 180_000, gcTime: 1_800_000 } } });
  vi.clearAllMocks();
  api.policies.mockResolvedValue({ brandId: 'actor-a-brand', returnsAccepted: true });
  api.general.mockResolvedValue({ brandId: 'actor-a-brand', contactEmail: 'brand@example.invalid' });
  api.savePolicies.mockResolvedValue({}); api.saveProfile.mockResolvedValue({});
});
afterEach(() => { cleanup(); client.clear(); });

describe('Studio policy cache and draft protection', () => {
  it('does not invalidate until both writes settle after a partial failure', async () => {
    let finishPolicyWrite!: () => void;
    api.savePolicies.mockImplementation(() => new Promise<void>((resolve) => { finishPolicyWrite = resolve; }));
    api.saveProfile.mockRejectedValue(new Error('profile failed first'));
    mount(); await screen.findByDisplayValue('brand@example.invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Save policies' }));
    await act(async () => { await Promise.resolve(); });
    expect(api.policies).toHaveBeenCalledTimes(1);
    await act(async () => { finishPolicyWrite(); });
    await waitFor(() => expect(api.policies).toHaveBeenCalledTimes(2));
  });

  it('renders the cached policies immediately on a revisit without duplicate requests', async () => {
    mount(); await screen.findByDisplayValue('brand@example.invalid');
    cleanup(); mount();
    expect(screen.getByDisplayValue('brand@example.invalid')).toBeTruthy();
    expect(api.policies).toHaveBeenCalledTimes(1);
    expect(api.general).toHaveBeenCalledTimes(1);
  });
  it('shares the same general-settings cache as Store profile', async () => {
    client.setQueryData(queryKeys.store.generalSettings('actor-a', 'actor-a-brand'), { brandId: 'actor-a-brand', contactEmail: 'cached@example.invalid' });
    mount(); await screen.findByDisplayValue('cached@example.invalid');
    expect(api.general).not.toHaveBeenCalled();
  });
  it('does not replace unsaved edits when either resource refreshes', async () => {
    mount(); const input = await screen.findByLabelText('Contact email');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('brand@example.invalid'));
    fireEvent.change(input, { target: { value: 'draft@example.invalid' } });
    api.general.mockResolvedValue({ brandId: 'actor-a-brand', contactEmail: 'new-server@example.invalid' });
    await act(async () => { await client.refetchQueries({ queryKey: ['store'] }); });
    expect(screen.getByDisplayValue('draft@example.invalid')).toBeTruthy();
  });
  it('blocks the editable defaults after an initial error and supports retry', async () => {
    api.policies.mockRejectedValueOnce(new Error('offline'));
    mount(); await screen.findByRole('alert');
    expect(screen.queryByLabelText('Contact email')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry policies' }));
    await screen.findByDisplayValue('brand@example.invalid');
  });
  it('does not display account A data during account B first load', async () => {
    mount(); await screen.findByDisplayValue('brand@example.invalid'); cleanup();
    state.actorId = 'actor-b'; state.brandId = 'actor-b-brand'; api.general.mockImplementation(() => new Promise(() => {}));
    mount(); expect(screen.queryByDisplayValue('brand@example.invalid')).toBeNull();
    expect(screen.queryByLabelText('Contact email')).toBeNull();
  });
  it('revalidates both resources after a partial save failure', async () => {
    api.saveProfile.mockRejectedValue(new Error('profile write unavailable'));
    mount(); await screen.findByDisplayValue('brand@example.invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Save policies' }));
    await waitFor(() => expect(api.policies).toHaveBeenCalledTimes(2));
    expect(api.general).toHaveBeenCalledTimes(2);
  });
});
