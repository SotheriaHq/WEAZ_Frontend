import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { dismissNotice, NoticeModalHost, showNotice } from '@/components/ui/NoticeModal';

const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { resolve: () => resolve(), promise, requested: vi.fn() };
});
vi.mock('@/components/ui/NoticeModalView', async () => {
  loading.requested();
  await loading.promise;
  return { default: ({ notice }: { notice: { message: string } | null }) => notice ? <div role="alertdialog">{notice.message}</div> : null };
});

it('defers closed notices, permits cancellation during download and restores the original trigger', async () => {
  const view = render(<><button>Trigger</button><button>Other</button><NoticeModalHost /></>);
  const trigger = screen.getByRole('button', { name: 'Trigger' });
  trigger.focus();
  expect(loading.requested).not.toHaveBeenCalled();
  act(() => showNotice('First notice'));
  await waitFor(() => expect(loading.requested).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toBeInTheDocument();
  screen.getByRole('button', { name: 'Other' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => { loading.resolve(); await loading.promise; });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  act(() => showNotice('Replacement notice'));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Replacement notice');
  act(() => dismissNotice());
  view.unmount();
});
