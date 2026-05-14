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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <RealtimeProvider>
        <ThemeProvider>
          <LanguageProvider>
            <UploadLimitsProvider>
              <App />
            </UploadLimitsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </RealtimeProvider>
    </Provider>
  </React.StrictMode>
);
