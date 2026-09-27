import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import './index.css';
import App from './App';
import { RealtimeProvider } from './realtime';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { UploadLimitsProvider } from './context/UploadLimitsContext';
import { Provider } from 'react-redux';
import { store } from './store';
import { QueryProvider } from './query/QueryProvider';
import RootErrorBoundary, { removeBootSplash } from './components/RootErrorBoundary';
import { initClientDiagnostics } from './utils/clientDiagnostics';
import { initBuildVersionGuard } from './utils/buildVersionGuard';
import { STALE_BUNDLE_SESSION_KEYS, isStaleBundleError } from './utils/staleBundle';
import { initSentry } from './observability/sentry';

initSentry();

const STALE_CHUNK_RELOAD_KEY = 'vite:preloadError:reloadedAt';

initClientDiagnostics();
initBuildVersionGuard();

/**
 * Time-based rather than once-per-session, because these fire for LOADS, not
 * renders: a page can legitimately try several chunks while a deploy lands,
 * and each should get its reload attempt once the previous one has had time
 * to commit. The boundaries use the once-per-session keys instead, since a
 * render that fails twice is a real bug worth showing.
 */
const reloadForStaleChunks = (): boolean => {
  const last = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last <= 10_000) {
    return false;
  }
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  // Cache-busted navigation (same technique as boot-splash.js): a plain
  // reload can re-serve a stale cached document on some mobile browsers.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
};

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadForStaleChunks();
});

window.addEventListener('unhandledrejection', (event) => {
  if (isStaleBundleError(event.reason)) {
    event.preventDefault();
    reloadForStaleChunks();
  }
});

const BootSplashCleanup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    removeBootSplash();
    /*
      Booted cleanly — re-arm the stale-bundle auto-recovery for a future
      deploy. Both boundaries, because either can be the one that catches it:
      the router's for a lazy route, the root's for anything that fails
      before or outside the router.
    */
    for (const key of Object.values(STALE_BUNDLE_SESSION_KEYS)) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }, []);
  return <>{children}</>;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BootSplashCleanup>
        <Provider store={store}>
          <QueryProvider>
            <RealtimeProvider>
              <ThemeProvider>
                <LanguageProvider>
                  <UploadLimitsProvider>
                    <App />
                  </UploadLimitsProvider>
                </LanguageProvider>
              </ThemeProvider>
            </RealtimeProvider>
          </QueryProvider>
        </Provider>
      </BootSplashCleanup>
    </RootErrorBoundary>
  </React.StrictMode>,
);
