import { test, expect } from '@playwright/test';
import { signInWithSeedUser } from '../helpers/auth';
import {
  clickBagIt,
  expectFittingsFlow,
  expectStaleFittingsPrompt,
  openSeedPath,
} from '../helpers/bagging';
import { baggingSeed, hasAuthSeed, requiresSeed, seedMissingReason } from '../helpers/test-data';

test.describe('custom bagging', () => {
  test('custom design from design modal uses source status and starts custom bag line', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.customDesignPath), seedMissingReason('custom design source bagging'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.customDesignPath);
    await clickBagIt(page);

    await expect(page.getByText(/custom order|custom request|fittings|measurements/i)).toBeVisible({ timeout: 15000 });
  });

  test('custom product from market or product view enters custom flow', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.customProductPath), seedMissingReason('custom product bagging'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.customProductPath);
    await page.getByRole('button', { name: /custom bag it|bag as custom request|bag it as custom/i }).click();

    await expect(page.getByText(/custom order|custom request|fittings|measurements/i)).toBeVisible({ timeout: 15000 });
  });

  test('missing fittings opens fitting flow for custom source', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.fittingProductPath), seedMissingReason('missing fittings custom source'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.fittingProductPath);
    await clickBagIt(page);
    await expectFittingsFlow(page);
  });

  test('stale fittings modal opens and both actions are available', async ({ page }) => {
    test.skip(!hasAuthSeed() || !requiresSeed(baggingSeed.staleFittingsPath), seedMissingReason('stale fittings custom source'));

    await signInWithSeedUser(page);
    await openSeedPath(page, baggingSeed.staleFittingsPath);
    await clickBagIt(page);
    await expectStaleFittingsPrompt(page);

    await expect(page.getByRole('button', { name: /continue with existing fittings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /update fittings/i })).toBeVisible();
  });
});
