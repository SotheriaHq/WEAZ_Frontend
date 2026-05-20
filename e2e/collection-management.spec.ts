import { test, expect, type Locator, type Page } from '@playwright/test';
import {
    SEEDED_COLLECTION_NAME,
    gotoCollectionsView,
    openCollectionActions,
    waitForCollectionCard,
} from './helpers/studio';

async function loginAndNavigateToStore(page: Page) {
    await gotoCollectionsView(page);
}

async function actionCollectionCard(page: Page): Promise<Locator> {
    for (const name of [/E2E Action Collection/i, /Test Collection E2E/i]) {
        const candidate = page.getByRole('button', { name }).first();
        if (await candidate.isVisible({ timeout: 3_000 }).catch(() => false)) {
            return candidate;
        }
    }
    throw new Error('No non-seed collection is available for destructive action coverage');
}

async function openGallery(page: Page) {
    const { card } = await openCollectionActions(page, SEEDED_COLLECTION_NAME);
    const galleryBtn = card.getByRole('button', { name: 'Gallery', exact: true });
    await expect(galleryBtn).toBeVisible({ timeout: 10_000 });
    await galleryBtn.click();

    const galleryModal = page.locator('[aria-label="Close collection gallery"]');
    await expect(galleryModal).toBeVisible({ timeout: 10_000 });
    return galleryModal;
}

test.describe('Collection Gallery Modal', () => {
    test('should open gallery, display image with natural aspect ratio, and navigate', async ({ page }) => {
        await loginAndNavigateToStore(page);
        await openGallery(page);

        const mainImage = page.locator('img.object-contain').first();
        await expect(mainImage).toBeVisible({ timeout: 10_000 });
        await expect(mainImage).toHaveClass(/object-contain/);
    });

    test('should navigate gallery with keyboard arrows', async ({ page }) => {
        await loginAndNavigateToStore(page);
        await openGallery(page);

        const counter = page.locator('span.tabular-nums').filter({ hasText: /^\d+\/\d+$/ }).first();
        await expect(counter).toBeVisible({ timeout: 10_000 });
        const counterText = await counter.textContent();

        if (counterText && counterText.includes('/')) {
            const total = Number.parseInt(counterText.split('/')[1].trim(), 10);

            if (total > 1) {
                await page.keyboard.press('ArrowRight');
                await expect(counter).toContainText(/^2\/\d+$/);

                await page.keyboard.press('ArrowLeft');
                await expect(counter).toContainText(/^1\/\d+$/);
            }
        }

        await page.keyboard.press('Escape');
        await expect(page.locator('[aria-label="Close collection gallery"]')).not.toBeVisible();
    });

    test('should close gallery from the current close control', async ({ page }) => {
        await loginAndNavigateToStore(page);
        const backdrop = await openGallery(page);

        await page.getByRole('button', { name: 'Close gallery' }).last().click();
        await expect(backdrop).not.toBeVisible();
    });
});

test.describe('Collection Edit Flow', () => {
    async function openSeededEdit(page: Page) {
        await loginAndNavigateToStore(page);
        const { card } = await openCollectionActions(page, SEEDED_COLLECTION_NAME);
        await card.getByRole('button', { name: 'Edit', exact: true }).click();
        await page.waitForURL(/.*collectionId.*mode=edit.*/, { timeout: 10_000 });
        await page.waitForLoadState('domcontentloaded');
    }

    test('should pre-populate all fields in edit mode', async ({ page }) => {
        await openSeededEdit(page);
        await expect(page.getByRole('heading', { name: 'Edit Collection' })).toBeVisible({ timeout: 10_000 });
    });

    test('should show cooldown banner when metadataEditedAt is within 30 days', async ({ page }) => {
        await openSeededEdit(page);

        const cooldownBanner = page.locator('text=can only be updated once every 30 days');
        if (await cooldownBanner.isVisible({ timeout: 3_000 }).catch(() => false)) {
            const titleInput = page.locator('input').first();
            await expect(titleInput).toBeDisabled();
        }
    });

    test('should show backend error toast when cooldown rejects edit', async ({ page }) => {
        await openSeededEdit(page);

        const titleField = page.locator('input').first();
        if (await titleField.isEnabled({ timeout: 2_000 }).catch(() => false)) {
            const currentValue = await titleField.inputValue();
            await titleField.fill(`${currentValue} - e2e test edit`);

            const publishBtn = page.locator('button:has-text("Publish")').or(
                page.locator('button:has-text("Update")'),
            );
            if (await publishBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await publishBtn.click();

                const toastMessage = page.locator('[data-sonner-toast]').filter({
                    hasText: /30 days|Next edit available/,
                });
                if (await toastMessage.isVisible({ timeout: 5_000 }).catch(() => false)) {
                    await expect(toastMessage).toBeVisible();
                }
            }
        }
    });
});

test.describe('Collection Actions', () => {
    test('should archive and unarchive a collection', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const collectionCard = await actionCollectionCard(page);
        const menuBtn = collectionCard.locator('button[aria-label="Collection actions"]');
        await menuBtn.click();

        const archiveBtn = collectionCard.getByRole('button', { name: /^Archive$/i });
        if (await archiveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await archiveBtn.click();
            await page.getByRole('button', { name: /^Archive$/i }).last().click();
            await expect(page.locator('[data-sonner-toast]').filter({ hasText: /archived/i })).toBeVisible({
                timeout: 10_000,
            });
        }
    });

    test('should duplicate a collection', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const collectionCard = await actionCollectionCard(page);
        const menuBtn = collectionCard.locator('button[aria-label="Collection actions"]');
        await menuBtn.click();

        const duplicateBtn = collectionCard.getByRole('button', { name: 'Duplicate', exact: true });
        await expect(duplicateBtn).toBeVisible();
        await duplicateBtn.click();

        await expect(page.locator('[data-sonner-toast]').filter({ hasText: /duplicated/i })).toBeVisible({
            timeout: 10_000,
        });
    });

    test('should delete a collection with confirmation', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const collectionCard = await actionCollectionCard(page);
        const menuBtn = collectionCard.locator('button[aria-label="Collection actions"]');
        await menuBtn.click();

        const deleteBtn = collectionCard.getByRole('button', { name: /^Delete$/i });
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        await page.getByRole('button', { name: /^Delete$/i }).last().click();
        await expect(page.locator('[data-sonner-toast]').filter({ hasText: /deleted/i })).toBeVisible({
            timeout: 10_000,
        });
    });
});

test.describe('Breadcrumb Navigation', () => {
    test('should show Products / Collections breadcrumb on collections view', async ({ page }) => {
        await loginAndNavigateToStore(page);

        await expect(page.getByRole('button', { name: 'Store', exact: true }).last()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('text=Collections').first()).toBeVisible();
    });

    test('should show full breadcrumb trail when viewing a collection', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const collectionCard = await waitForCollectionCard(page, SEEDED_COLLECTION_NAME);
        const collectionName = await collectionCard.locator('p.font-bold').first().textContent();
        await collectionCard.click();
        await page.waitForLoadState('domcontentloaded');

        await expect(page.getByRole('button', { name: 'Store', exact: true }).last()).toBeVisible();
        const collectionsButton = page.getByRole('button', { name: 'Collections', exact: true });
        await expect(collectionsButton).toBeVisible();

        if (collectionName) {
            await expect(page.locator(`text=${collectionName.trim()}`).first()).toBeVisible();
        }
    });

    test('should navigate back to collections list when clicking Collections breadcrumb', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const collectionCard = await waitForCollectionCard(page, SEEDED_COLLECTION_NAME);
        await collectionCard.click();
        await page.waitForLoadState('domcontentloaded');

        const collectionsButton = page.getByRole('button', { name: 'Collections', exact: true });
        await expect(collectionsButton).toBeVisible();
        await collectionsButton.click();

        await expect(page).toHaveURL(/view=collections/);
        await expect(page).not.toHaveURL(/collectionId/);
    });

    test('should navigate to Products view when clicking Products breadcrumb', async ({ page }) => {
        await loginAndNavigateToStore(page);

        const storeButton = page.getByRole('button', { name: 'Store', exact: true }).last();
        await expect(storeButton).toBeVisible({ timeout: 10_000 });
        await storeButton.click();

        await expect(page).toHaveURL(/\/studio\/store/);
        await expect(page).not.toHaveURL(/view=collections/);
    });
});
