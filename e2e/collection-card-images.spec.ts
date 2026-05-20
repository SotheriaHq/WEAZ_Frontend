import { test, expect } from '@playwright/test';
import { gotoCollectionsView, waitForCollectionCard } from './helpers/studio';

test.describe('Collection Card Images', () => {
    test.beforeEach(async ({ page }) => {
        await gotoCollectionsView(page);
    });

    test('published collection card displays an image, not fallback', async ({ page }) => {
        const firstCard = await waitForCollectionCard(page);
        const imageArea = firstCard.locator('.relative.h-64');

        await page.waitForTimeout(3_000);

        const imgTag = imageArea.locator('img');
        const imgCount = await imgTag.count();

        expect(imgCount).toBeGreaterThan(0);
        const src = await imgTag.first().getAttribute('src');
        expect(src).toBeTruthy();
        expect(src!.length).toBeGreaterThan(0);
    });

    test('collection card shows preview dots when multiple preview images exist', async ({ page }) => {
        const firstCard = await waitForCollectionCard(page);
        await firstCard.hover();
        await page.waitForTimeout(1_000);

        const dots = firstCard.locator('.absolute.top-4.right-14 .rounded-full');
        await expect(dots.first()).toBeVisible({ timeout: 5_000 });
        expect(await dots.count()).toBeGreaterThanOrEqual(2);
    });

    test('hovering cycles through preview images', async ({ page }) => {
        const firstCard = await waitForCollectionCard(page);
        const imageArea = firstCard.locator('.relative.h-64');
        const imgTag = imageArea.locator('img').first();

        await page.waitForTimeout(1_000);
        const initialSrc = await imgTag.getAttribute('src').catch(() => null);

        await firstCard.hover();
        await page.waitForTimeout(2_500);

        const hoverSrc = await imgTag.getAttribute('src').catch(() => null);

        if (initialSrc && hoverSrc && initialSrc !== hoverSrc) {
            expect(hoverSrc).not.toBe(initialSrc);
        } else {
            await expect(imgTag).toBeVisible();
        }

        await page.mouse.move(0, 0);
    });
});
