import React from 'react';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import RootErrorBoundary from '@/components/RootErrorBoundary';
import { store } from '@/store';

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: React.PropsWithChildren) => children,
  useAuth: () => ({ loading: false, user: null }),
}));
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ syncThemePreferenceFromBackend: vi.fn() }),
}));
vi.mock('@/hooks/useVerificationStateSync', () => ({ useVerificationStateSync: vi.fn() }));
vi.mock('@/hooks/useNotifications', () => ({ useNotificationsBootstrap: vi.fn() }));
vi.mock('@/context/BrandPatchContext', () => ({
  BrandPatchProvider: ({ children }: React.PropsWithChildren) => children,
}));
vi.mock('@/features/bagging/BagFlowProvider', () => ({
  BagFlowProvider: ({ children }: React.PropsWithChildren) => children,
}));
vi.mock('@/components/Layout', () => ({ Layout: () => null }));
vi.mock('@/components/seo/SeoHead', () => ({ default: () => null }));
vi.mock('@/components/privacy/CookieConsent', () => ({ default: () => null }));
vi.mock('@/components/profile/GenderPrompt', () => ({ GenderPrompt: () => null }));
vi.mock('@/pages/placeholders/NotFound', () => ({ default: () => <h1>Application started</h1> }));
vi.mock('@/observability/sentry', () => ({ captureClientException: vi.fn() }));

let App: React.ComponentType;
beforeAll(async () => {
  history.replaceState(null, '', '/__startup-test?surface=mobile-app');
  App = (await import('@/App')).default;
}, 30_000);

it('boots the actual app with route-dependent theme sync inside its router', async () => {
  render(<Provider store={store}><App /></Provider>);
  expect(await screen.findByRole('heading', { name: 'Application started' })).toBeInTheDocument();
  expect(document.documentElement.dataset.embeddedSurface).toBe('mobile-app');
});

it('reports a terminal startup failure to the native loader without exposing error details', () => {
  const postMessage = vi.fn();
  window.ReactNativeWebView = { postMessage };
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const Throws = () => { throw new Error('Sensitive startup details'); };
  try {
    render(<RootErrorBoundary><Throws /></RootErrorBoundary>);
    expect(screen.getByText('WIEZ could not start')).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'BOOT_FAILED' }));
    expect(postMessage.mock.calls.flat().join(' ')).not.toContain('Sensitive startup details');
  } finally {
    delete window.ReactNativeWebView;
    consoleError.mockRestore();
  }
});
