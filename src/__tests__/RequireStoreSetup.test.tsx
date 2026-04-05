import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequireStoreSetup from '@/components/store/RequireStoreSetup';
import userReducer from '@/features/userSlice';

const getStoreStatus = vi.fn();

vi.mock('@/api/StoreApi', () => ({
  getStoreStatus: (...args: unknown[]) => getStoreStatus(...args),
}));

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
            role: 'User',
            type: 'BRAND',
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
});