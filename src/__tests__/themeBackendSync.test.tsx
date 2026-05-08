import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeBackendSync } from '@/components/theme/ThemeBackendSync';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import userReducer from '@/features/userSlice';
import { useSyncedThemePreference } from '@/hooks/useSyncedThemePreference';
import type { AuthUserDto } from '@/types/auth';
import type { ThemePreference } from '@/types/theme';

const authState = vi.hoisted(() => ({ loading: false }));
const patchMock = vi.hoisted(() => vi.fn());

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    patch: patchMock,
  },
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
  createdAt: '2026-05-05T00:00:00.000Z',
  updatedAt: '2026-05-05T00:00:00.000Z',
};

const createStore = (user: AuthUserDto | null = null) =>
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

const PreferenceProbe = () => {
  const { themePreference, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="themePreference">{themePreference}</span>
      <span data-testid="resolvedTheme">{resolvedTheme}</span>
    </div>
  );
};

const SyncedPreferenceButton = ({ value }: { value: ThemePreference }) => {
  const { themePreference, resolvedTheme, setThemePreference } = useSyncedThemePreference();
  return (
    <button type="button" onClick={() => void setThemePreference(value)}>
      {themePreference}:{resolvedTheme}
    </button>
  );
};

const ThemeButton = ({ value }: { value: ThemePreference }) => {
  const { setThemePreference } = useTheme();
  return (
    <button type="button" onClick={() => setThemePreference(value)}>
      set {value}
    </button>
  );
};

describe('web theme backend sync', () => {
  beforeEach(() => {
    authState.loading = false;
    patchMock.mockReset();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    document.documentElement.style.colorScheme = '';
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute('content', '#ffffff');
    setSystemDark(false);
  });

  it('keeps the pre-render boot script on the same storage key and root contract', () => {
    const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(indexHtml).toContain("var storageKey = 'vite-ui-theme'");
    expect(indexHtml).toContain("root.dataset.theme = className");
    expect(indexHtml).toContain('root.dataset.themePreference = theme');
    expect(indexHtml).toContain('root.style.colorScheme = className');
    expect(indexHtml).toContain('meta[name="theme-color"]');
  });

  it('disables component transitions during runtime theme flips', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(css).toContain('html.theme-transitioning *::after');
    expect(css).toMatch(/html\.theme-transitioning[\s\S]*transition:\s*none !important;/);
    expect(css).not.toContain('background-color 0.2s cubic-bezier');
  });

  it('boots from localStorage before backend hydration', () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <ThemeProvider>
        <PreferenceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('themePreference')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#0a0a0a',
    );
  });

  it('normalizes invalid localStorage to system and synchronizes root state', () => {
    localStorage.setItem('vite-ui-theme', 'time');

    render(
      <ThemeProvider>
        <PreferenceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('themePreference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('resolves system to dark when matchMedia prefers dark', () => {
    setSystemDark(true);
    localStorage.setItem('vite-ui-theme', 'system');

    render(
      <ThemeProvider>
        <PreferenceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('themePreference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('resolves system to light when matchMedia prefers light', () => {
    setSystemDark(false);
    localStorage.setItem('vite-ui-theme', 'system');

    render(
      <ThemeProvider>
        <PreferenceProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('themePreference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('updates runtime root theme state atomically', () => {
    localStorage.setItem('vite-ui-theme', 'light');

    render(
      <ThemeProvider>
        <ThemeButton value="dark" />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#0a0a0a',
    );
  });

  it('does not treat explicit preloaded dark as the system scheme', () => {
    setSystemDark(false);
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.themePreference = 'dark';
    document.documentElement.classList.add('dark');

    render(
      <ThemeProvider>
        <PreferenceProbe />
        <ThemeButton value="system" />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('themePreference')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('dark');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('themePreference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolvedTheme')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('applies backend preference after auth hydration', async () => {
    localStorage.setItem('vite-ui-theme', 'light');
    const store = createStore({ ...baseUser, themePreference: 'dark' });

    render(
      <Provider store={store}>
        <ThemeProvider>
          <ThemeBackendSync />
          <PreferenceProbe />
        </ThemeProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('themePreference')).toHaveTextContent('dark');
      expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    });
  });

  it('normalizes invalid backend preference to system', async () => {
    localStorage.setItem('vite-ui-theme', 'dark');
    const store = createStore({
      ...baseUser,
      themePreference: 'time' as ThemePreference,
    });

    render(
      <Provider store={store}>
        <ThemeProvider>
          <ThemeBackendSync />
          <PreferenceProbe />
        </ThemeProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('themePreference')).toHaveTextContent('system');
      expect(localStorage.getItem('vite-ui-theme')).toBe('system');
    });
  });

  it.each(['light', 'dark', 'system'] as const)(
    'updates local UI immediately and patches only themePreference for %s',
    async (nextPreference) => {
      const store = createStore({ ...baseUser, themePreference: 'system' });
      patchMock.mockResolvedValue({ data: { themePreference: nextPreference } });

      render(
        <Provider store={store}>
          <ThemeProvider>
            <SyncedPreferenceButton value={nextPreference} />
          </ThemeProvider>
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button')).toHaveTextContent(nextPreference);
      expect(localStorage.getItem('vite-ui-theme')).toBe(nextPreference);

      await waitFor(() => {
        expect(patchMock).toHaveBeenCalledWith('/users/me/preferences', {
          themePreference: nextPreference,
        });
      });

      expect(patchMock.mock.calls[0][1]).not.toHaveProperty('resolvedTheme');
      expect(store.getState().user.profile?.themePreference).toBe(nextPreference);
    },
  );
});
