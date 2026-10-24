import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RunwayCommentsSheet } from '@/components/runway/RunwayCommentsSheet';
import { overlayBackChannel } from '@/hooks/useOverlayBackClose';

const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { resolve: () => resolve(), promise, requested: vi.fn() };
});
vi.mock('@/components/comments/CommentThread', async () => {
  loading.requested(); await loading.promise;
  return { default: () => <div>Comments ready</div> };
});
vi.mock('@/components/loaders/MuseLoader', () => ({ MuseLoader: () => <div role="status">Loading comments</div> }));

it('keeps the sheet responsive and dismissible while loading comments on first use', async () => {
  const close = vi.fn();
  const back = vi.spyOn(history, 'back').mockImplementation(() => {});
  const view = render(<RunwayCommentsSheet open={false} collectionId="design" onClose={close} />);
  expect(loading.requested).not.toHaveBeenCalled();
  view.rerender(<RunwayCommentsSheet open collectionId="design" onClose={close} />);
  await waitFor(() => expect(loading.requested).toHaveBeenCalledOnce());
  expect(screen.getByRole('dialog', { name: 'Comments' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Loading comments');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(close).toHaveBeenCalledTimes(2);
  expect(overlayBackChannel.consumesPop()).toBe(false);
  view.rerender(<RunwayCommentsSheet open={false} collectionId="design" onClose={close} />);
  await act(async () => { loading.resolve(); await loading.promise; });
  expect(screen.queryByText('Comments ready')).not.toBeInTheDocument();
  view.rerender(<RunwayCommentsSheet open collectionId="design" onClose={close} />);
  expect(await screen.findByText('Comments ready')).toBeInTheDocument();
  view.unmount();
  expect(back).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
