import { test, expect } from '@playwright/test';
import { loginAsBrand } from './helpers/auth';

test.describe('Collection Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text());
      }
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
  });

  test('should complete current store collection draft creation flow', async ({ page }) => {
    await loginAsBrand(page);

    await page.goto('/studio/store/collections/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Create Collection' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('From Existing Products')).toBeVisible();
    await expect(page.getByText('Create New Products')).toBeVisible();

    const titleInput = page.locator('input[placeholder="e.g. Holiday Drop"]');
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('Test Collection E2E');

    await page
      .locator('textarea[placeholder="Short description"]')
      .fill('This is a test collection created by the E2E test suite.');

    const tagInput = page.locator('input[placeholder="Add hashtag..."]');
    await tagInput.fill('e2e-playwright');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: /Draft saved/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/studio\/store.*view=collections/);
  });

  test('should navigate back from creation page', async ({ page }) => {
    await loginAsBrand(page);

    await page.goto('/studio/store/collections/new');
    await expect(page.getByRole('heading', { name: 'Create Collection' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/studio\/store.*view=collections/);
  });

  test('should switch build modes and show metadata fields', async ({ page }) => {
    await loginAsBrand(page);

    await page.goto('/studio/store/collections/new');
    await expect(page.getByRole('heading', { name: 'Create Collection' })).toBeVisible({ timeout: 10_000 });

    await page.getByText('Create New Products').click();
    await expect(page.getByRole('button', { name: 'Create a Product' })).toBeVisible();

    await page.getByText('From Existing Products').click();
    await expect(page.locator('input[placeholder="Search products..."]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Holiday Drop"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Short description"]')).toBeVisible();
  });
});
