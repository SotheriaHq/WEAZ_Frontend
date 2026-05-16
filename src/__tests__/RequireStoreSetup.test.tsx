import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequireStoreSetup from '@/components/store/RequireStoreSetup';
import userReducer from '@/features/userSlice';

const getStoreStatus = vi.fn();

vi.mock('@/api/StoreApi', () => ({
  getStoreStatus: (...args: unknown[]) => getStoreStatus(...args),
}));

function LocationReadout() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('RequireStoreSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoreStatus.mockResolvedValue({
      brandId: 'brand-1',
      isStoreOpen: false,
      isEmailVerified: true,
      isProfileComplete: false,
      isSetupComplete: false,
      missingFields: [],
      profile: {
        name: 'Ada Atelier',
        description: 'A brand description long enough for profile completion.',
        tags: ['fashion'],
      },
    });
  });

  it('redirects brands to profile setup before allowing store setup access', async () => {
    const store = configureStore({
      reducer: {
        user: userReducer,
      },
      preloadedState: {
        user: {
          profile: {
            id: 'user-1',
            username: 'brand_demo',
            email: 'brand@example.com',
            firstName: 'Demo',
            lastName: 'Brand',
            role: 'User' as const,
            type: 'BRAND' as const,
            themePreference: 'system' as const,
            isActive: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEmailVerified: true,
            brandTags: ['fashion'],
            phoneNumber: null,
            address: null,
            brandFullName: 'Ada Atelier',
            brandDescription: 'A brand description long enough for profile completion.',
            brandCountry: 'Nigeria',
            brandState: null,
            brandCity: null,
            brandBusinessType: null,
            storeId: null,
            activeBrandId: 'brand-1',
            brandMemberships: [
              {
                brandId: 'brand-1',
                brandName: 'Ada Atelier',
                role: 'OWNER' as const,
                status: 'ACTIVE' as const,
                isOwner: true,
              },
            ],
            socialInstagram: null,
            socialFacebook: null,
            socialTwitter: null,
            socialWebsite: null,
            cacNumber: null,
            tin: null,
            ceoNin: null,
            ceoFirstName: null,
            ceoLastName: null,
            companyLocation: null,
            profileImage: null,
            profileImageId: null,
            profileImageFile: null,
            bannerImage: null,
            bannerImageId: null,
            bannerImageFile: null,
          },
          isAuthenticated: true,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/studio/store/setup']}>
          <Routes>
            <Route
              path="/studio/store/setup"
              element={
                <RequireStoreSetup>
                  <div>Store setup content</div>
                </RequireStoreSetup>
              }
            />
            <Route path="/profile" element={<div>Profile setup</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Profile setup')).toBeInTheDocument();
    });

    expect(screen.queryByText('Store setup content')).not.toBeInTheDocument();
  });

  it('sends unverified store setup attempts back to profile without a studio next path', async () => {
    getStoreStatus.mockResolvedValue({
      brandId: 'brand-2',
      isStoreOpen: false,
      isEmailVerified: false,
      isProfileComplete: true,
      isSetupComplete: false,
      missingFields: [],
      profile: {
        name: 'Ada Atelier',
        description: 'A brand description long enough for profile completion.',
        tags: ['womenswear'],
      },
    });

    const store = configureStore({
      reducer: {
        user: userReducer,
      },
      preloadedState: {
        user: {
          profile: {
            id: 'user-2',
            username: 'brand_demo',
            email: 'brand@example.com',
            firstName: 'Demo',
            lastName: 'Brand',
            role: 'User' as const,
            type: 'BRAND' as const,
            themePreference: 'system' as const,
            isActive: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEmailVerified: false,
            brandTags: ['womenswear'],
            phoneNumber: null,
            address: null,
            brandFullName: 'Ada Atelier',
            brandDescription: 'A brand description long enough for profile completion.',
            brandCountry: 'Nigeria',
            brandState: null,
            brandCity: null,
            brandBusinessType: null,
            storeId: null,
            activeBrandId: 'brand-2',
            brandMemberships: [
              {
                brandId: 'brand-2',
                brandName: 'Ada Atelier',
                role: 'OWNER' as const,
                status: 'ACTIVE' as const,
                isOwner: true,
              },
            ],
            socialInstagram: null,
            socialFacebook: null,
            socialTwitter: null,
            socialWebsite: null,
            cacNumber: null,
            tin: null,
            ceoNin: null,
            ceoFirstName: null,
            ceoLastName: null,
            companyLocation: null,
            profileImage: null,
            profileImageId: null,
            profileImageFile: null,
            bannerImage: null,
            bannerImageId: null,
            bannerImageFile: null,
          },
          isAuthenticated: true,
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/studio/store']}>
          <Routes>
            <Route
              path="/studio/store"
              element={
                <RequireStoreSetup>
                  <div>Store console</div>
                </RequireStoreSetup>
              }
            />
            <Route path="/profile" element={<LocationReadout />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/profile?verifyEmailPrompt=store-setup');
    });

    expect(screen.getByTestId('location')).not.toHaveTextContent('next=');
    expect(screen.queryByText('Store console')).not.toBeInTheDocument();
  });
});
