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
