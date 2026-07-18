import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { sentryVitePlugin } from "@sentry/vite-plugin";

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

// Stamped into the bundle AND emitted as /version.json so live clients can
// detect a newer deploy (stale-session self-heal). One id per build.
const BUILD_ID = String(Date.now());

const versionManifestPlugin = () => ({
  name: 'wiez-version-manifest',
  writeBundle(options: { dir?: string }) {
    const outDir = options.dir ?? path.resolve(process.cwd(), 'dist');
    fs.writeFileSync(
      path.join(outDir, 'version.json'),
      JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }),
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_DEV_PORT ?? DEFAULT_DEV_PORT) || DEFAULT_DEV_PORT;

  const isProd = mode === 'production';

  return {
    define: {
      __WIEZ_BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    plugins: [
      react(),
      versionManifestPlugin(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,

        release: {
            name: process.env.SENTRY_RELEASE,
        },
    }),
    ],
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
      target: ['es2020', 'safari14'],
      cssTarget: 'safari14',
      // Mobile browsers were stalling on a blank screen while preloading every
      // lazy admin/route chunk referenced from App.tsx. Only warm core vendors.
      modulePreload: {
        resolveDependencies(_filename, deps, { hostType }) {
          if (hostType !== 'html') {
            return deps;
          }
          return deps.filter((dep) =>
            /\/assets\/(react-vendor|router-vendor|redux-vendor)-/.test(dep),
          );
        },
      },
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
              // Only ALWAYS-LOADED vendors may be forced into named chunks.
              // A forced chunk claims its unassigned dependency subtree, so a
              // lazy-only vendor (recharts, emoji-picker, ...) that shares a
              // transitive dep with entry code (react-is, lodash, tslib)
              // drags its whole chunk into the entry's static import graph —
              // charts-vendor (88 kB gz of recharts+d3) was downloading on
              // every anonymous landing this way. Unforced vendors colocate
              // with the lazy route that actually uses them.
            }
            // Do NOT force pages/admin/* into named chunks here. manualChunks
            // claims the assigned module PLUS its unassigned dependency
            // subtree, so shared primitives (UniversalSelect, Dropdown, Modal,
            // toast, react-query, ...) were captured INTO admin-* chunks and
            // the entry had to statically import ten admin chunks plus
            // charts-vendor on every anonymous landing (GTmetrix 2026-07-18:
            // ~427 kB unused JS, 66-request critical chain). App.tsx's
            // React.lazy() imports already give each admin page its own chunk;
            // shared code belongs in the entry graph. If admin code ever shows
            // up in the entry again, the cause is a STATIC import of an admin
            // page somewhere — fix that import, not the chunking.
            return undefined;
          },
        },
      },
    },
  };
});
