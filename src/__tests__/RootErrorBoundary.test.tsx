import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const captureClientException = vi.fn();
vi.mock('../observability/sentry', () => ({
  captureClientException: (...args: unknown[]) => captureClientException(...args),
}));
vi.mock('@/utils/buildVersionGuard', () => ({ isNewBuildAvailable: () => false }));

import RootErrorBoundary from '@/components/RootErrorBoundary';

const Throws = ({ error }: { error: Error }) => {
  throw error;
};

const chunkError = () => new Error('Failed to fetch dynamically imported module: https://weaz.me/assets/ErrorPage.js');
const originalOnLine = navigator.onLine;
const originalLocation = window.location;
const reload = vi.fn();
const replace = vi.fn();

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    reload.mockClear();
    replace.mockClear();
    captureClientException.mockClear();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://weaz.me/runway', reload, replace },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setOnline(originalOnLine);
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it('tells an offline user they are offline, with no technical detail', () => {
    setOnline(false);
    render(<RootErrorBoundary><Throws error={chunkError()} /></RootErrorBoundary>);

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByText('WIEZ could not start')).toBeNull();
    expect(screen.queryByText(/dynamically imported module/)).toBeNull();
    expect(captureClientException).not.toHaveBeenCalled();
  });

  it('recovers by itself when the connection returns', () => {
    setOnline(false);
    render(<RootErrorBoundary><Throws error={chunkError()} /></RootErrorBoundary>);
    expect(reload).not.toHaveBeenCalled();

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reports a real startup failure while offline', () => {
    setOnline(false);
    render(<RootErrorBoundary><Throws error={new Error('Store failed to hydrate')} /></RootErrorBoundary>);

    expect(screen.getByText('WIEZ could not start')).toBeTruthy();
    expect(captureClientException).toHaveBeenCalledTimes(1);
  });

  it('keeps stale-deploy recovery when online', () => {
    setOnline(true);
    render(<RootErrorBoundary><Throws error={chunkError()} /></RootErrorBoundary>);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("You're offline")).toBeNull();
  });
});
