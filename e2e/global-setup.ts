import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { performBrandLogin } from './helpers/auth';

export default async function globalSetup(config: FullConfig) {
    const projectBaseURL = config.projects[0]?.use?.baseURL;
    const baseURL =
        typeof projectBaseURL === 'string'
            ? projectBaseURL
            : process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
    const authStatePath =
        process.env.THREADLY_E2E_AUTH_STATE ??
        resolve(process.cwd(), 'test-results', 'e2e-auth', 'brand.json');

    mkdirSync(dirname(authStatePath), { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await performBrandLogin(page);
    await page.evaluate(() => {
        const storage = (globalThis as unknown as {
            localStorage: { setItem: (key: string, value: string) => void };
        }).localStorage;

        storage.setItem('threadly_tour_product_create', '1');
    });
    await context.storageState({ path: authStatePath });
    await browser.close();
}
