import React from 'react';
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

// Self-heal stale lazy-loaded chunks after a deploy. When a new build ships,
// old chunk filenames (content-hashed) disappear, so a browser holding a stale
// index.html fails the dynamic import with "Failed to fetch dynamically imported
// module". Vite emits `vite:preloadError` in that case — reload once to pull the
// fresh index.html (which points at the current hashes). The time-boxed guard
// prevents a reload loop if the asset is genuinely unreachable (e.g. offline).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const KEY = 'vite:preloadError:reloadedAt';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>
);
