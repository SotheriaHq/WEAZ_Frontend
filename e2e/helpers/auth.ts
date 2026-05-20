import { expect, type Page } from '@playwright/test';

export const E2E_BRAND_EMAIL = process.env.E2E_BRAND_EMAIL ?? 'brand@example.com';
export const E2E_BRAND_PASSWORD = process.env.E2E_BRAND_PASSWORD ?? 'password123';

export async function performBrandLogin(page: Page) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(E2E_BRAND_EMAIL);

    const continueButton = page.getByRole('button', { name: /^Continue$/i });
    if (await continueButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await continueButton.click();
    } else {
        await page.locator('button[type="submit"]').click();
    }

    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
    await passwordInput.fill(E2E_BRAND_PASSWORD);

    const signInButton = page.getByRole('button', { name: /^Sign In$/i });
    if (await signInButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await signInButton.click();
    } else {
        await page.locator('button[type="submit"]').click();
    }

    await page.waitForURL(/.*(profile|dashboard|studio).*/, { timeout: 15_000 });
}

export async function loginAsBrand(page: Page) {
    await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/login')) {
        await expect(page.getByRole('heading', { name: /Studio|Vogue Vendor/i }).first()).toBeVisible({
            timeout: 15_000,
        });
        return;
    }

    await performBrandLogin(page);
}
