import { test, expect } from '@playwright/test';
import { signInWithSeedUser } from '../helpers/auth';
import { clickBagIt, expectBagOpen, expectFittingsFlow, openSeedPath } from '../helpers/bagging';
import { baggingSeed, hasAuthSeed, requiresSeed, seedMissingReason } from '../helpers/test-data';

test.describe('standard bagging', () => {
  test('standard product without fittings can be bagged', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.standardProductPath), seedMissingReason('standard product bagging'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.standardProductPath);
    await clickBagIt(page);
    await expectBagOpen(page);
  });

  test('product requiring size or color opens selector and blocks incomplete add', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.variantProductPath), seedMissingReason('size/color selector'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.variantProductPath);
    await clickBagIt(page);

    await expect(page.getByRole('dialog', { name: /select options/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /add to bag/i })).toBeDisabled();
  });

  test('product requiring fittings opens fitting flow', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.fittingProductPath), seedMissingReason('required fittings product'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.fittingProductPath);
    await clickBagIt(page);
    await expectFittingsFlow(page);
  });
});
