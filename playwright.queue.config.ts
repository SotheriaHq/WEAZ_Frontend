import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/queue',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174/tests/e2e/queue/fixture.html', reuseExistingServer: true, timeout: 60000 },
});
