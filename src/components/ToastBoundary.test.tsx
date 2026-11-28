import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../observability/sentry', () => ({ captureClientException: capture }));

import { ToastBoundary } from './ToastBoundary';

/**
 * WIEZ-P01B-0001: a toast that threw while rendering reached the root error
 * boundary and replaced every screen. It must now stay inside the toaster.
 */
describe('ToastBoundary', () => {
  let failing = true;
  const Toasts = () => {
    if (failing) throw new Error('Objects are not valid as a React child');
    return <p>toast area</p>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failing = true;
    capture.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the rest of the app on screen when a toast throws, and reports it', () => {
    render(
      <main>
        <p>bag page</p>
        <ToastBoundary>
          <Toasts />
        </ToastBoundary>
      </main>,
    );
    expect(screen.getByText('bag page')).toBeTruthy();
    expect(screen.queryByText('toast area')).toBeNull();
    expect(capture).toHaveBeenCalledWith(expect.any(Error), { boundary: 'toast' });
  });

  it('brings the toaster back so later toasts still appear', () => {
    render(
      <ToastBoundary>
        <Toasts />
      </ToastBoundary>,
    );
    failing = false;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('toast area')).toBeTruthy();
  });
});
