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

const STALE_CHUNK_RELOAD_KEY = 'vite:preloadError:reloadedAt';

const isStaleChunkLoadError = (value: unknown): boolean => {
  const message =
    typeof value === 'string'
      ? value
      : value instanceof Error
        ? value.message
        : value && typeof value === 'object' && 'message' in value
          ? String((value as { message?: unknown }).message ?? '')
          : String(value ?? '');

  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError')
  );
};

const reloadForStaleChunks = (): boolean => {
  const last = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last <= 10_000) {
    return false;
  }
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
};

// Self-heal stale lazy-loaded chunks after a deploy. When a new build ships,
// old chunk filenames (content-hashed) disappear, so a browser holding a stale
// index.html fails the dynamic import with "Failed to fetch dynamically imported
// module". Vite emits `vite:preloadError` in that case — reload once to pull the
// fresh index.html (which points at the current hashes). The time-boxed guard
// prevents a reload loop if the asset is genuinely unreachable (e.g. offline).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadForStaleChunks();
});

window.addEventListener('error', (event) => {
  if (isStaleChunkLoadError(event.message) || isStaleChunkLoadError(event.error)) {
    reloadForStaleChunks();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isStaleChunkLoadError(event.reason)) {
    event.preventDefault();
    reloadForStaleChunks();
  }
});

const BootSplashCleanup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    document.getElementById('boot-splash')?.remove();
  }, []);
  return <>{children}</>;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
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
  </React.StrictMode>
);
