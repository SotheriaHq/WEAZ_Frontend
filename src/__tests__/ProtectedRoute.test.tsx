import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuthenticated } from '@/components/ProtectedRoute';
import userReducer from '@/features/userSlice';
import type { AuthUserDto } from '@/types/auth';

const authState = vi.hoisted(() => ({ loading: false }));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

const baseUser: AuthUserDto = {
  id: 'user-1',
  username: 'threadly',
  email: 'threadly@example.com',
  firstName: 'Thread',
  lastName: 'Ly',
  role: 'User',
  type: 'REGULAR',
  themePreference: 'system',
  phoneNumber: null,
  address: null,
  brandFullName: null,
  brandDescription: null,
  brandCountry: null,
  brandState: null,
  brandCity: null,
  brandTags: [],
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
  isEmailVerified: true,
  storeId: null,
  isActive: 'ACTIVE',
  createdAt: '2026-05-15T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z',
};

const createStore = (user: AuthUserDto | null) =>
  configureStore({
    reducer: {
      user: userReducer,
    },
    preloadedState: {
      user: {
        profile: user,
        isAuthenticated: Boolean(user),
      },
    },
  });

const renderProtectedPage = (user: AuthUserDto | null = null) => {
  const store = createStore(user);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route
            path="/profile"
            element={
              <RequireAuthenticated>
                <div>Private profile content</div>
              </RequireAuthenticated>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
};

describe('RequireAuthenticated', () => {
  beforeEach(() => {
    authState.loading = false;
    localStorage.clear();
  });

  it('redirects signed-out users even while auth initializes', async () => {
    authState.loading = true;

    renderProtectedPage(null);

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });

    expect(screen.queryByText('Private profile content')).not.toBeInTheDocument();
  });

  it('redirects signed-out users to login after auth initialization', async () => {
    renderProtectedPage(null);

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });

    expect(screen.queryByText('Private profile content')).not.toBeInTheDocument();
  });

  it('renders protected content while an authenticated session revalidates', () => {
    authState.loading = true;

    renderProtectedPage(baseUser);

    expect(screen.getByText('Private profile content')).toBeInTheDocument();
    expect(screen.queryByText('Refreshing your session')).not.toBeInTheDocument();
  });

  it('renders protected content after auth finishes', () => {
    renderProtectedPage(baseUser);

    expect(screen.getByText('Private profile content')).toBeInTheDocument();
  });
});
