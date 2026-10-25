import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DesignViewModal from '@/components/designs/DesignViewModal';
import { overlayBackChannel } from '@/hooks/useOverlayBackClose';

const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { resolve: () => resolve(), promise, requested: vi.fn() };
});
vi.mock('react-redux', () => ({ useSelector: () => true }));
vi.mock('@/components/designs/DesignViewModalContent', async () => {
  loading.requested();
  await loading.promise;
  return { default: ({ open }: { open: boolean }) => open ? <div>Ready viewer</div> : null };
});

it('consumes Back during a slow viewer download and never reopens a cancelled overlay', async () => {
  const onClose = vi.fn();
  const push = vi.spyOn(window.history, 'pushState');
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  const view = render(<DesignViewModal open={false} item={null} onClose={onClose} />);
  expect(loading.requested).not.toHaveBeenCalled();
  view.rerender(<DesignViewModal open item={null} onClose={onClose} />);
  await waitFor(() => expect(loading.requested).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(overlayBackChannel.consumesPop()).toBe(true);
  expect(push).toHaveBeenCalledOnce();

  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(onClose).toHaveBeenCalledOnce();
  view.rerender(<DesignViewModal open={false} item={null} onClose={onClose} />);
  await act(async () => { loading.resolve(); await loading.promise; });
  expect(screen.queryByText('Ready viewer')).not.toBeInTheDocument();
  expect(overlayBackChannel.consumesPop()).toBe(false);

  view.rerender(<DesignViewModal open item={null} onClose={onClose} />);
  expect(await screen.findByText('Ready viewer')).toBeInTheDocument();
  expect(push).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(back).toHaveBeenCalledOnce();
  expect(overlayBackChannel.consumesPop()).toBe(false);
  vi.restoreAllMocks();
});
