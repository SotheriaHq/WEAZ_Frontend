import { expect, type Locator, type Page } from '@playwright/test';
import { loginAsBrand } from './auth';

export const SEEDED_COLLECTION_NAME = 'E2E Studio Capsule';

export async function gotoStudioStore(page: Page, path = '/studio/store') {
    await loginAsBrand(page);
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /Vogue Vendor|Your Catalog|Collections Management/i }).first()).toBeVisible({
        timeout: 20_000,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const draftReminderLater = page.getByRole('button', { name: 'Later' });
        if (await draftReminderLater.isVisible({ timeout: 1_500 }).catch(() => false)) {
            await draftReminderLater.click({ force: true });
            await expect(draftReminderLater).not.toBeVisible({ timeout: 3_000 });
            break;
        }
        await page.waitForTimeout(500);
    }
}

export async function gotoCollectionsView(page: Page) {
    await gotoStudioStore(page, '/studio/store?view=collections');
    await expect(page.getByRole('heading', { name: 'Collections Management' })).toBeVisible({
        timeout: 20_000,
    });
}

export function collectionCard(page: Page, name = SEEDED_COLLECTION_NAME): Locator {
    return page.getByRole('button', { name: new RegExp(name, 'i') }).first();
}

export async function waitForCollectionCard(page: Page, name = SEEDED_COLLECTION_NAME): Promise<Locator> {
    const card = collectionCard(page, name);
    await expect(card).toBeVisible({ timeout: 20_000 });
    return card;
}

export async function openCollectionActions(page: Page, name = SEEDED_COLLECTION_NAME) {
    const card = await waitForCollectionCard(page, name);
    const menuButton = card.getByRole('button', { name: 'Collection actions' });
    await expect(menuButton).toBeVisible({ timeout: 10_000 });
    await menuButton.click();
    return { card, menuButton };
}
