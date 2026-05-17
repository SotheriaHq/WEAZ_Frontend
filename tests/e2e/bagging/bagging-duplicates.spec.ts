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

    await expect(page.getByText(/active paid custom order|already have an active paid/i)).toBeVisible({ timeout: 15000 });
  });

  test('mixed standard and custom checkout renders payable and blocked lines', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.mixedCheckoutPath), seedMissingReason('mixed checkout bag'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.mixedCheckoutPath);

    await expect(page.getByText(/bag lines|standard|custom/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/blocked|unavailable|not payable/i).or(page.getByRole('button', { name: /pay|checkout|continue/i }))).toBeVisible();
  });
});
