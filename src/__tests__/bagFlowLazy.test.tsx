import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { BagFlowProvider, useBagFlow } from '@/features/bagging/BagFlowProvider';
import { overlayBackChannel } from '@/hooks/useOverlayBackClose';

const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { resolve: () => resolve(), promise, auth: vi.fn(), selector: vi.fn(), fittings: vi.fn(), stale: vi.fn(), composer: vi.fn() };
});
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn(), useSelector: (select: (s: unknown) => unknown) => select({ user: { isAuthenticated: false, profile: null } }) }));
vi.mock('@/components/auth/AuthRequiredPrompt', async () => {
  loading.auth(); await loading.promise;
  return { default: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>Auth prompt ready</div> : null };
});
vi.mock('@/components/bagging/ProductBagSelectorModal', () => { loading.selector(); return { default: () => null }; });
vi.mock('@/components/bagging/BagFittingsModal', () => { loading.fittings(); return { default: () => null }; });
vi.mock('@/components/bagging/StaleFittingConfirmationModal', () => { loading.stale(); return { default: () => null }; });
vi.mock('@/components/bagging/BagComposerOverlay', () => { loading.composer(); return { default: () => null }; });

function Trigger() {
  const flow = useBagFlow();
  return <button onClick={() => flow?.openAuthPrompt({ id: 'product', name: 'Dress' }, 'ADD_STANDARD')}>Bag</button>;
}

it('loads only the requested bag flow and consumes Back before its download completes', async () => {
  const push = vi.spyOn(history, 'pushState');
  const back = vi.spyOn(history, 'back').mockImplementation(() => {});
  const view = render(<MemoryRouter><BagFlowProvider><Trigger /></BagFlowProvider></MemoryRouter>);
  for (const fn of [loading.auth, loading.selector, loading.fittings, loading.stale, loading.composer]) expect(fn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Bag' }));
  await waitFor(() => expect(loading.auth).toHaveBeenCalledOnce());
  expect(push).toHaveBeenCalledOnce();
  expect(overlayBackChannel.consumesPop()).toBe(true);
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => { loading.resolve(); await loading.promise; });
  expect(screen.queryByText('Auth prompt ready')).not.toBeInTheDocument();
  expect(overlayBackChannel.consumesPop()).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Bag' }));
  expect(await screen.findByText('Auth prompt ready')).toBeInTheDocument();
  for (const fn of [loading.selector, loading.fittings, loading.stale, loading.composer]) expect(fn).not.toHaveBeenCalled();
  view.unmount();
  expect(back).toHaveBeenCalledOnce();
  expect(overlayBackChannel.consumesPop()).toBe(false);
  vi.restoreAllMocks();
});
