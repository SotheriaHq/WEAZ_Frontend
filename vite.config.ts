import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_DEV_PORT = 3000;

const resolveOptionalHttpsConfig = (env: Record<string, string>) => {
  const httpsEnabled =
    String(env.VITE_DEV_HTTPS ?? '')
      .trim()
      .toLowerCase() === 'true';

  if (!httpsEnabled) {
    return undefined;
  }

  const certPath = String(env.VITE_DEV_HTTPS_CERT_PATH ?? '').trim();
  const keyPath = String(env.VITE_DEV_HTTPS_KEY_PATH ?? '').trim();

  if (!certPath || !keyPath) {
    throw new Error(
      'VITE_DEV_HTTPS=true requires both VITE_DEV_HTTPS_CERT_PATH and VITE_DEV_HTTPS_KEY_PATH.',
    );
  }

  return {
    cert: fs.readFileSync(path.resolve(certPath)),
    key: fs.readFileSync(path.resolve(keyPath)),
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT ?? DEFAULT_DEV_PORT) || DEFAULT_DEV_PORT;

  const isProd = mode === 'production';

  return {
    plugins: [react()],
    esbuild: isProd
      ? {
          pure: [
            'console.log',
            'console.info',
            'console.debug',
            'console.trace',
            'console.assert',
            'console.count',
            'console.countReset',
            'console.time',
            'console.timeEnd',
            'console.timeLog',
            'console.group',
            'console.groupCollapsed',
            'console.groupEnd',
            'console.table',
            'console.dir',
          ],
        }
      : {},
    server: {
      host: env.VITE_DEV_HOST || '0.0.0.0',
      port,
      https: resolveOptionalHttpsConfig(env),
    },
    resolve: {
      alias: {
        '@': '/src',
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/')) {
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/scheduler/')
              ) {
                return 'react-vendor';
              }
              if (id.includes('/react-router')) {
                return 'router-vendor';
              }
              if (id.includes('/@reduxjs/') || id.includes('/react-redux/')) {
                return 'redux-vendor';
              }
              if (id.includes('/framer-motion/')) {
                return 'motion-vendor';
              }
              if (id.includes('/lucide-react/')) {
                return 'icons-vendor';
              }
              if (id.includes('/primereact/') || id.includes('/primeicons/')) {
                return 'prime-vendor';
              }
              if (id.includes('/recharts/')) {
                return 'charts-vendor';
              }
              if (
                id.includes('/qrcode.react/') ||
                id.includes('/react-qrcode-logo/') ||
                id.includes('/emoji-picker-react/') ||
                id.includes('/react-easy-crop/')
              ) {
                return 'feature-vendor';
              }
            }
            if (id.includes('/pages/admin/')) {
              const normalized = id.split(path.sep).join('/');
              const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
              return `admin-${fileName.replace(/\.[cm]?[jt]sx?$/, '')}`;
            }
            return undefined;
          },
        },
      },
    },
  };
});
