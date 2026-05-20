import { test, expect } from '@playwright/test';
import { gotoStudioStore } from './helpers/studio';

test.describe('Store Products Panel - Header Redesign', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err));

        await gotoStudioStore(page);
    });

    test('expandable search: expands on click, collapses on blur', async ({ page }) => {
        const searchToggle = page.locator('button[aria-label="Open search"]').nth(1);
        await expect(searchToggle).toBeVisible({ timeout: 10_000 });

        await searchToggle.click();

        const searchInput = page.locator('input[placeholder="Search products..."]');
        await expect(searchInput).toBeVisible({ timeout: 3_000 });

        await searchInput.fill('test query');
        await expect(searchInput).toHaveValue('test query');
        await page.click('h2:has-text("Your Catalog")');
        await expect(searchInput).toBeVisible();

        await searchInput.fill('');
        await page.click('h2:has-text("Your Catalog")');
        await expect(searchToggle).toBeVisible({ timeout: 3_000 });
    });

    test('quick actions: slide out inline from same row on toggle', async ({ page }) => {
        const quickActionsToggle = page.locator('button[aria-label="Show quick actions"]');
        await expect(quickActionsToggle).toBeVisible({ timeout: 10_000 });

        await quickActionsToggle.click();

        await expect(page.getByText(/Add Collection/)).toBeVisible({ timeout: 3_000 });
        await expect(page.getByText(/Create Look/)).toBeVisible();
        await expect(page.getByText(/Import/)).toBeVisible();

        const hideToggle = page.locator('button[aria-label="Hide quick actions"]');
        await hideToggle.click();

        await expect(page.locator('button[aria-label="Show quick actions"]')).toBeVisible({ timeout: 3_000 });
    });

    test('add product button is always visible', async ({ page }) => {
        const addProductBtn = page.getByRole('button', { name: 'Add Product' });
        await expect(addProductBtn).toBeVisible({ timeout: 10_000 });

        const quickActionsToggle = page.locator('button[aria-label="Show quick actions"]');
        await quickActionsToggle.click();
        await expect(addProductBtn).toBeVisible();

        await page.locator('button[aria-label="Open search"]').nth(1).click({ timeout: 3_000 }).catch(() => {
            // Search may already be visible from a previous interaction.
        });
        await expect(addProductBtn).toBeVisible();
    });

    test('draft collections toggle: slides out inline', async ({ page }) => {
        const draftToggle = page.locator('button[aria-label="Show draft collections"]');

        const hasDrafts = await draftToggle.isVisible().catch(() => false);
        if (!hasDrafts) {
            test.skip();
            return;
        }

        await draftToggle.click();

        const hideToggle = page.locator('button[aria-label="Hide draft collections"]');
        await expect(hideToggle).toBeVisible({ timeout: 3_000 });

        await hideToggle.click();
        await expect(draftToggle).toBeVisible({ timeout: 3_000 });
    });
});
