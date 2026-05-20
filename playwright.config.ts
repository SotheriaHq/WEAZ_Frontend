import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

const e2eParallel = process.env.THREADLY_E2E_PARALLEL === 'true';
const authStatePath =
    process.env.THREADLY_E2E_AUTH_STATE ??
    resolve(process.cwd(), 'test-results', 'e2e-auth', 'brand.json');

export default defineConfig({
    testDir: '.',
    testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
    globalSetup: './e2e/global-setup.ts',
    fullyParallel: e2eParallel,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: e2eParallel ? undefined : 1,
    reporter: 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.VITE_E2E_BASE_URL ?? 'http://127.0.0.1:5173',
        trace: 'on-first-retry',
        headless: true,
        screenshot: 'only-on-failure',
        storageState: authStatePath,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
