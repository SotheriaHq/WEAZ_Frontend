import { expect, type BrowserContext, type Page } from '@playwright/test';
import { baggingSeed } from './test-data';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

let cachedSeedStorageState: StorageState | null = null;

async function restoreSeedUser(page: Page) {
  if (!cachedSeedStorageState) return false;

  await page.context().addCookies(cachedSeedStorageState.cookies);
  await page.goto('/');
  const origin = new URL(page.url()).origin;
  const originState = cachedSeedStorageState.origins.find((entry) => entry.origin === origin);
  if (originState?.localStorage?.length) {
    await page.evaluate((entries) => {
      entries.forEach((entry) => window.localStorage.setItem(entry.name, entry.value));
    }, originState.localStorage);
    await page.reload({ waitUntil: 'domcontentloaded' });
    return true;
  }

  try {
    await expect(page.getByRole('button', { name: /profile menu/i })).toBeVisible({ timeout: 5000 });
    return true;
  } catch {
    cachedSeedStorageState = null;
    return false;
  }
}

export async function signInWithSeedUser(page: Page) {
  if (await restoreSeedUser(page)) return;

  await page.goto('/login');

  await page.locator('input[type="email"]').fill(baggingSeed.buyerEmail);
  await page.getByRole('button', { name: /continue/i }).click();

  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible({ timeout: 15000 });
  await passwordInput.fill(baggingSeed.buyerPassword);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  cachedSeedStorageState = await page.context().storageState();
}

export async function ensureLoggedOut(page: Page) {
  cachedSeedStorageState = null;
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}
