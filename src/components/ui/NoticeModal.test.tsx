import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticeModalHost, dismissNotice, showNotice } from './NoticeModal';

afterEach(() => {
  act(() => dismissNotice());
});

describe('NoticeModal', () => {
  /*
    The regression this guards: the action rendered as a ghost link beside a
    solid "Got it" that held focus, so the loudest control — and the one Enter
    pressed — was the way out. People dismissed the notice without doing the
    one thing it existed to get them to do.
  */
  it('makes the action the primary button and gives it focus', async () => {
    render(<NoticeModalHost />);
    act(() =>
      showNotice({
        tone: 'action',
        title: 'Verify your bank account',
        message: 'WIEZ cannot send your payout yet.',
        action: { label: 'Verify bank account', onSelect: vi.fn() },
      }),
    );

    const primary = await screen.findByRole('button', { name: /verify bank account/i });
    await waitFor(() => expect(primary).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument();
  });

  it('runs the action and closes', async () => {
    const onSelect = vi.fn();
    render(<NoticeModalHost />);
    act(() =>
      showNotice({
        message: 'Your payout account is not active yet.',
        action: { label: 'Open payout settings', onSelect },
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: /open payout settings/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('"Not now" closes without running the action', async () => {
    const onSelect = vi.fn();
    render(<NoticeModalHost />);
    act(() =>
      showNotice({
        message: 'Your payout account is not active yet.',
        action: { label: 'Open payout settings', onSelect },
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('keeps a single "Got it" as the primary when there is nothing to do', async () => {
    render(<NoticeModalHost />);
    act(() => showNotice({ tone: 'blocked', message: 'This product cannot be bagged.' }));

    const primary = await screen.findByRole('button', { name: 'Got it' });
    await waitFor(() => expect(primary).toHaveFocus());
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows the detail line and the subject glyph when given', async () => {
    render(<NoticeModalHost />);
    act(() =>
      showNotice({
        tone: 'action',
        emoji: '🏦',
        message: 'Verify your bank account.',
        detail: 'Your balance stays where it is. Nothing is lost.',
        action: { label: 'Verify bank account', onSelect: vi.fn() },
      }),
    );

    expect(await screen.findByText(/nothing is lost/i)).toBeInTheDocument();
    expect(screen.getByText('🏦')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<NoticeModalHost />);
    act(() => showNotice('Heads up about something.'));

    await screen.findByRole('alertdialog');
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('keeps Tab inside the dialog', async () => {
    render(<NoticeModalHost />);
    act(() =>
      showNotice({
        message: 'Your payout account is not active yet.',
        action: { label: 'Open payout settings', onSelect: vi.fn() },
      }),
    );

    const primary = await screen.findByRole('button', { name: /open payout settings/i });
    const secondary = screen.getByRole('button', { name: 'Not now' });
    await waitFor(() => expect(primary).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(secondary).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(primary).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(secondary).toHaveFocus();
  });
});
