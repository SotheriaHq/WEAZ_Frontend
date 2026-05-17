import { expect, type Page } from '@playwright/test';
import { baggingSeed } from './test-data';

type StorageState = Awaited<ReturnType<Page['context']>> extends infer Context
  ? Context extends { storageState: () => Promise<infer State> }
    ? State
    : never
  : never;

let cachedSeedStorageState: StorageState | null = null;

export async function signInWithSeedUser(page: Page) {
  if (cachedSeedStorageState) {
    await page.context().addCookies(cachedSeedStorageState.cookies);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /profile menu/i })).toBeVisible({ timeout: 15000 });
    return;
  }

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
