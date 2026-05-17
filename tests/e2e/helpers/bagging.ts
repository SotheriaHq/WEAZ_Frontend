import { expect, type Locator, type Page } from '@playwright/test';

export const bagItButton = (page: Page): Locator =>
  page.getByRole('button', { name: /bag it|bag this item|custom bag it|bag as custom request/i }).first();

export const myBagSurface = (page: Page): Locator =>
  page.getByRole('dialog', { name: /bag|shopping bag/i }).or(page.getByText(/your bag|my bag/i)).first();

export async function openSeedPath(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('body')).toBeVisible();
}

export async function clickBagIt(page: Page) {
  const button = bagItButton(page);
  await expect(button).toBeVisible({ timeout: 15000 });
  await button.click();
}

export async function expectBagOpen(page: Page) {
  await expect(myBagSurface(page)).toBeVisible({ timeout: 15000 });
}

export async function expectAuthPrompt(page: Page) {
  await expect(page.getByText(/sign in to continue bagging|sign in to view your bag/i)).toBeVisible({
    timeout: 15000,
  });
}

export async function expectFittingsFlow(page: Page) {
  await expect(page.getByRole('dialog', { name: /complete fittings/i })).toBeVisible({ timeout: 15000 });
}

export async function expectStaleFittingsPrompt(page: Page) {
  await expect(page.getByRole('dialog', { name: /review fittings before bagging/i })).toBeVisible({
    timeout: 15000,
  });
}
