import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { profile: Record<string, unknown> | null } = { profile: null };
const postStudioNativeEvent = vi.fn();

vi.mock('react-redux', () => ({
  useSelector: (selector: (root: { user: { profile: unknown } }) => unknown) =>
    selector({ user: { profile: state.profile } }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ loading: false }) }));
vi.mock('@/hooks/useEmbeddedSurface', () => ({ useEmbeddedSurface: () => 'mobile-app' }));
vi.mock('@/utils/studioNativeBridge', () => ({
  postStudioNativeEvent: (event: unknown) => postStudioNativeEvent(event),
}));

import RequireBrand from '../RequireBrand';

const renderGate = (access?: 'store' | 'brand') =>
  render(
    <MemoryRouter>
      <RequireBrand access={access}>
        <div>studio content</div>
      </RequireBrand>
    </MemoryRouter>,
  );

// Regression (16 Nov 2026): a brand that had just signed up (no store yet) was
// refused by the Studio shell with AUTH_REQUIRED, which the app showed as
// "Studio session expired" — so a new brand could never reach store setup.
describe('RequireBrand', () => {
  beforeEach(() => {
    postStudioNativeEvent.mockClear();
  });

  it('lets a brand with no store into Studio (access="brand")', () => {
    state.profile = { id: 'u1', type: 'BRAND', storeId: null, brandMemberships: [] };
    renderGate('brand');
    expect(screen.getByText('studio content')).toBeInTheDocument();
    expect(postStudioNativeEvent).not.toHaveBeenCalled();
  });

  it('still refuses a shopper account in Studio', () => {
    state.profile = { id: 'u2', type: 'REGULAR', storeId: null, brandMemberships: [] };
    renderGate('brand');
    expect(screen.queryByText('studio content')).toBeNull();
    expect(postStudioNativeEvent).toHaveBeenCalledWith({ type: 'AUTH_REQUIRED', reason: 'brand_required' });
  });

  it('keeps the store requirement by default', () => {
    state.profile = { id: 'u3', type: 'BRAND', storeId: null, brandMemberships: [] };
    renderGate();
    expect(screen.queryByText('studio content')).toBeNull();
  });

  it('lets a brand with a store through by default', () => {
    state.profile = { id: 'u4', type: 'BRAND', storeId: 'b4', brandMemberships: [] };
    renderGate();
    expect(screen.getByText('studio content')).toBeInTheDocument();
  });
});
