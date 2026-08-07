import { configureStore } from '@reduxjs/toolkit';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userReducer from '@/features/userSlice';
import type { AuthUserDto } from '@/types/auth';
import {
  invalidateStoreSetupStatusCache,
  useStoreSetupStatus,
} from '@/hooks/useStoreSetupStatus';

const useStoreStatusQuery = vi.fn();

vi.mock('@/query/queries', () => ({
  useStoreStatusQuery: (...args: unknown[]) => useStoreStatusQuery(...args),
}));

function Readout() {
  const value = useStoreSetupStatus();
  return <div data-testid="value">{String(value)}</div>;
}

/**
 * `hasActiveBrandMembership` accepts an ACTIVE membership OR `type === 'BRAND'`
 * WITH a storeId. Miss both and `useStoreSetupStatus` short-circuits on
 * `!isBrand` and returns true, so every assertion here would pass for the wrong
 * reason — which is exactly what happened on the first run of this file.
 */
const makeProfile = (type: 'BRAND' | 'REGULAR'): AuthUserDto =>
  ({
    id: type === 'BRAND' ? 'user-1' : 'user-2',
    username: type === 'BRAND' ? 'brand_demo' : 'shopper',
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'User',
    type,
    storeId: type === 'BRAND' ? 'brand-1' : null,
    brandFullName: type === 'BRAND' ? 'Ada Atelier' : null,
    brandMemberships: [],
    themePreference: 'system',
    isActive: 'Active',
    createdAt: new Date().toISOString(),
  }) as unknown as AuthUserDto;

const makeStore = (type: 'BRAND' | 'REGULAR' = 'BRAND') =>
  configureStore({
    reducer: { user: userReducer },
    preloadedState: {
      user: { profile: makeProfile(type), isAuthenticated: true },
    },
  });

const renderHookValue = () => {
  // Explicit teardown: one test renders twice to model a request that succeeds
  // and then fails, and two live readouts make `getByTestId` ambiguous.
  cleanup();
  render(
    <Provider store={makeStore('BRAND')}>
      <Readout />
    </Provider>,
  );
  return screen.getByTestId('value').textContent;
};

describe('useStoreSetupStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateStoreSetupStatusCache();
  });

  it('reports completeness from the server when the query resolves', () => {
    useStoreStatusQuery.mockReturnValue({
      data: { isSetupComplete: true },
      error: null,
    });
    expect(renderHookValue()).toBe('true');
  });

  it('does not lock the studio when the status request fails', () => {
    // `StudioSidebar` disables every nav item whose `requiresSetup` is true
    // whenever this hook is `false` — which is all of them except Store. This
    // used to return `false` on error, so one timed-out or 401'd
    // `/store/status` call left a fully published brand with a dead sidebar:
    // pages reachable by URL, nothing clickable. `RequireStoreSetup` renders
    // children when ITS fetch fails, so returning false here also put the
    // sidebar and the route guard in direct disagreement.
    useStoreStatusQuery.mockReturnValue({
      data: undefined,
      error: new Error('Network Error'),
    });
    expect(renderHookValue()).not.toBe('false');
  });

  it('keeps a known-incomplete verdict when a later request fails', () => {
    // Falling back to permissive must not erase a verdict we actually have —
    // an incomplete brand should stay flagged across a transient failure.
    useStoreStatusQuery.mockReturnValue({
      data: { isSetupComplete: false },
      error: null,
    });
    expect(renderHookValue()).toBe('false');

    useStoreStatusQuery.mockReturnValue({
      data: undefined,
      error: new Error('Network Error'),
    });
    expect(renderHookValue()).toBe('false');
  });

  it('returns true for non-brand users without querying', () => {
    useStoreStatusQuery.mockReturnValue({ data: undefined, error: null });
    cleanup();
    render(
      <Provider store={makeStore('REGULAR')}>
        <Readout />
      </Provider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('true');
  });
});
