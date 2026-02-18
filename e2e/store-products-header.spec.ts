import { test, expect } from '@playwright/test';

test.describe('Store Products Panel - Header Redesign', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err));

        // Login first
        await page.goto('/login');
        try {
            await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 10000 });
        } catch {
            // If login page doesn't load with label, try direct input
        }
        await page.fill('input[type="email"]', 'brand@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*(profile|dashboard|studio).*/, { timeout: 15000 });

        // Navigate to Studio Store
        await page.goto('/studio/store');
        await page.waitForLoadState('networkidle');
    });

    test('expandable emoji search: expands on click, collapses on blur', async ({ page }) => {
        // 1. Verify the 🔎 emoji button is visible (collapsed state)
        const searchToggle = page.locator('button[aria-label="Open search"]');
        await expect(searchToggle).toBeVisible({ timeout: 10000 });

        // 2. Click to expand the search field
        await searchToggle.click();

        // 3. Verify search input appears
        const searchInput = page.locator('input[placeholder="Search products..."]');
        await expect(searchInput).toBeVisible({ timeout: 3000 });

        // 4. Type in search and verify it persists (should NOT collapse)
        await searchInput.fill('test query');
        await page.click('h2:has-text("Your Products")'); // Click away
        await expect(searchInput).toBeVisible(); // Should stay open because search has text

        // 5. Clear search text, then click away — should collapse
        await searchInput.fill('');
        await page.click('h2:has-text("Your Products")');
        await expect(searchToggle).toBeVisible({ timeout: 3000 }); // Emoji button should return
    });

    test('quick actions: slide out inline from same row on toggle', async ({ page }) => {
        // 1. Verify ⚡ toggle button exists
        const quickActionsToggle = page.locator('button[aria-label="Show quick actions"]');
        await expect(quickActionsToggle).toBeVisible({ timeout: 10000 });

        // 2. Click to expand quick actions
        await quickActionsToggle.click();

        // 3. Verify quick action buttons are now visible in the same row
        await expect(page.getByText('📦 Add Collection')).toBeVisible({ timeout: 3000 });
        await expect(page.getByText('🎨 Create Look')).toBeVisible();
        await expect(page.getByText('📥 Import')).toBeVisible();

        // 4. Click again to collapse
        const hideToggle = page.locator('button[aria-label="Hide quick actions"]');
        await hideToggle.click();

        // 5. Verify buttons are gone (hidden by max-width:0 transition)
        await expect(page.getByText('📦 Add Collection')).not.toBeVisible({ timeout: 3000 });
    });

    test('add product button is always visible', async ({ page }) => {
        // The "Add Product" button should always be visible regardless of toggle states
        const addProductBtn = page.getByText('➕ Add Product');
        await expect(addProductBtn).toBeVisible({ timeout: 10000 });

        // Toggle quick actions and verify Add Product is still visible
        const quickActionsToggle = page.locator('button[aria-label="Show quick actions"]');
        await quickActionsToggle.click();
        await expect(addProductBtn).toBeVisible();

        // Expand search and verify Add Product is still visible
        await page.locator('button[aria-label="Open search"]').click({ timeout: 3000 }).catch(() => {
            // Search may already be visible from a previous interaction
        });
        await expect(addProductBtn).toBeVisible();
    });

    test('draft collections toggle: slides out inline', async ({ page }) => {
        // This test only runs if there are draft collections
        const draftToggle = page.locator('button[aria-label="Show draft collections"]');

        // Check if the toggle exists (only present when drafts exist)
        const hasDrafts = await draftToggle.isVisible().catch(() => false);
        if (!hasDrafts) {
            test.skip();
            return;
        }

        // Click to expand
        await draftToggle.click();

        // Verify draft items appear inline
        const hideToggle = page.locator('button[aria-label="Hide draft collections"]');
        await expect(hideToggle).toBeVisible({ timeout: 3000 });

        // Click to collapse
        await hideToggle.click();
        await expect(draftToggle).toBeVisible({ timeout: 3000 });
    });
});
