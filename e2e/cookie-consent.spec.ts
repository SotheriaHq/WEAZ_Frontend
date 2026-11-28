import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('Cookie policy opens from the first-visit consent card', async ({ page }) => {
  await page.setViewportSize({ width: 756, height: 638 });
  await page.goto('/');

  const policyLink = page.getByRole('link', { name: 'Cookie policy' });
  await expect(policyLink).toBeVisible();
  const bounds = await policyLink.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

  await expect(page).toHaveURL(/\/cookies$/);
  await expect(page.getByRole('heading', { name: 'Cookie and Tracking Policy', level: 1 })).toBeVisible();
});
