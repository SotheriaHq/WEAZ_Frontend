import { expect, type Page } from '@playwright/test';
import { baggingSeed } from './test-data';

export async function signInWithSeedUser(page: Page) {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill(baggingSeed.buyerEmail);
  await page.getByLabel(/password/i).fill(baggingSeed.buyerPassword);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await expect(page.getByText(/sign in|log in/i)).toHaveCount(0, { timeout: 15000 });
}

export async function ensureLoggedOut(page: Page) {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}
