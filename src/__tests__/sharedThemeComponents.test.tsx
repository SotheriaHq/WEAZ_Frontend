import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import { Navbar } from '@/components/Navbar';
import { ThemeSelector } from '@/components/ThemeSelector';
import AdminThemeSwitcher from '@/components/admin/AdminThemeSwitcher';
import { ThemeProvider } from '@/context/ThemeContext';
import cartReducer from '@/features/cartSlice';
import notificationsReducer from '@/features/notificationsSlice';
import uiReducer from '@/features/uiSlice';
import userReducer from '@/features/userSlice';
import wishlistReducer from '@/features/wishlistSlice';
import type { AuthUserDto } from '@/types/auth';

const authState = vi.hoisted(() => ({ loading: false }));
const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    setLanguage: vi.fn(),
    translate: (key: string) => key,
  }),
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: apiMocks,
  dropStoredAccessToken: vi.fn(),
}));

vi.mock('@/components/search/SearchBarWithSuggestions', () => ({
  default: () => <div data-testid="search-suggestions" />,
}));

vi.mock('@/components/notifications/NotificationsDropdown', () => ({
  default: () => null,
}));

vi.mock('@/components/brand/BrandWordmark', () => ({
  default: ({ textClassName }: { textClassName?: string }) => (
    <span className={textClassName}>Threadly</span>
  ),
}));

vi.mock('@/hooks/useStoreSetupStatus', () => ({
  useStoreSetupStatus: () => false,
}));

const setSystemDark = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

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
  createdAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
};

const createStore = (user: AuthUserDto | null = baseUser) =>
  configureStore({
    reducer: {
      user: userReducer,
      ui: uiReducer,
      cart: cartReducer,
      wishlist: wishlistReducer,
      notifications: notificationsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
    preloadedState: {
      user: {
        profile: user,
        isAuthenticated: Boolean(user),
      },
    },
  });

const renderWithProviders = (element: React.ReactNode, user: AuthUserDto | null = baseUser) => {
  const store = createStore(user);

  render(
    <Provider store={store}>
      <MemoryRouter>
        <ThemeProvider>{element}</ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );

  return store;
};

describe('shared web theme components', () => {
  beforeEach(() => {
    authState.loading = false;
    apiMocks.get.mockResolvedValue({ data: { items: [], total: 0 } });
    apiMocks.post.mockResolvedValue({ data: {} });
    apiMocks.patch.mockImplementation((_url, payload) => ({
      data: { themePreference: payload.themePreference },
    }));
    apiMocks.delete.mockResolvedValue({ data: {} });
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    setSystemDark(false);
  });

  it('profile dropdown renders all three theme choices and keeps system as the saved preference', async () => {
    renderWithProviders(<Navbar />);

    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));

    expect(await screen.findByRole('button', { name: /use light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use dark theme/i })).toBeInTheDocument();
    const systemButton = screen.getByRole('button', { name: /use system theme/i });
    expect(systemButton).toBeInTheDocument();

    fireEvent.click(systemButton);

    expect(localStorage.getItem('vite-ui-theme')).toBe('system');
    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith('/users/me/preferences', {
        themePreference: 'system',
      });
    });
    expect(apiMocks.patch.mock.calls.at(-1)?.[1]).not.toHaveProperty('resolvedTheme');
  });

  it('theme selector sends only themePreference', async () => {
    renderWithProviders(<ThemeSelector />);

    fireEvent.click(screen.getByRole('button', { name: /system/i }));

    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith('/users/me/preferences', {
        themePreference: 'system',
      });
    });
    expect(apiMocks.patch.mock.calls.at(-1)?.[1]).not.toHaveProperty('resolvedTheme');
  });

  it('admin theme switcher keeps the light dark system contract', async () => {
    renderWithProviders(<AdminThemeSwitcher />);

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'System' }));

    await waitFor(() => {
      expect(localStorage.getItem('vite-ui-theme')).toBe('system');
    });
  });
});
