import { test, expect } from '@playwright/test';
import { signInWithSeedUser } from '../helpers/auth';
import { clickBagIt, expectBagOpen, openSeedPath } from '../helpers/bagging';
import { baggingSeed, hasAuthSeed, requiresSeed, seedMissingReason } from '../helpers/test-data';

test.describe('bagging duplicate and checkout behavior', () => {
  test('duplicate IN_BAG opens existing bag instead of creating another line', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.duplicateInBagPath), seedMissingReason('IN_BAG duplicate source'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.duplicateInBagPath);
    await clickBagIt(page);

    await expect(page.getByText(/already in your bag|resume this custom request|your bag/i)).toBeVisible({ timeout: 15000 });
    await expectBagOpen(page);
  });

  test('PAID_ACTIVE duplicate blocks new custom line', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.duplicatePaidActivePath), seedMissingReason('PAID_ACTIVE duplicate source'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.duplicatePaidActivePath);
    await clickBagIt(page);

    await expect(page.getByText(/^You already have an active paid custom order/i)).toBeVisible({ timeout: 15000 });
  });

  test('mixed standard and custom checkout renders seeded lines', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.mixedCheckoutPath), seedMissingReason('mixed checkout bag'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.mixedCheckoutPath);

    await expect(page.getByRole('heading', { name: /order summary/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/E2E Bagging Mixed Checkout Standard Skirt/i)).toBeVisible();
    await expect(page.getByText(/E2E Bagging Mixed Checkout Custom Kimono/i)).toBeVisible();
    await expect(page.getByText(/custom requests/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
  });
});
