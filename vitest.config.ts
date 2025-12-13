import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    css: true,
    globals: true,
    // Start from Vitest defaults so node_modules and build outputs stay excluded.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
