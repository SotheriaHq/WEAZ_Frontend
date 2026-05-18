import { test, expect } from '@playwright/test';
import { signInWithSeedUser } from '../helpers/auth';
import { openSeedPath } from '../helpers/bagging';
import { baggingSeed, hasAuthSeed, requiresSeed, seedMissingReason } from '../helpers/test-data';

test.describe('collection bagging', () => {
  test('eligible collection bags selected products through collection endpoints', async ({ page }) => {
    test.skip(
      !hasAuthSeed() || !requiresSeed(baggingSeed.collectionAllEligiblePath),
      seedMissingReason('all-eligible collection bagging'),
    );

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.collectionAllEligiblePath);

    await page.getByRole('button', { name: /add all to bag/i }).click();
    await expect(page.getByRole('dialog', { name: /add collection to bag/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /add \d+ items to bag/i }).click();
    await expect(page.getByText(/added \d+ items? to your bag/i)).toBeVisible({ timeout: 15000 });
  });

  test('mixed collection surfaces backend blockers before mutation', async ({ page }) => {
    test.skip(
      !hasAuthSeed() || !requiresSeed(baggingSeed.collectionMixedPath),
      seedMissingReason('mixed collection blockers'),
    );

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.collectionMixedPath);

    await page.getByRole('button', { name: /add all to bag/i }).click();
    await expect(page.getByRole('dialog', { name: /add collection to bag/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /unavailable/i })).toBeVisible();
    await expect(page.getByText(/out of stock|measurements required|already in your bag/i).first()).toBeVisible();
  });
});
