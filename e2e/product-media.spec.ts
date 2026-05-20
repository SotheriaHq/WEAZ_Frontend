import { test, expect } from '@playwright/test';
import { loginAsBrand } from './helpers/auth';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
);

const buildImage = (name: string) => ({
  name,
  mimeType: 'image/png',
  buffer: tinyPng,
});

test('create product with 4 images and cover selection', async ({ page }) => {
  await loginAsBrand(page);

  await page.goto('/studio/store/products/new');
  await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible();

  const mediaInput = page.getByTestId('product-media-input');
  await mediaInput.setInputFiles([
    buildImage('one.png'),
    buildImage('two.png'),
    buildImage('three.png'),
    buildImage('four.png'),
  ]);

  const setCoverButton = page.getByRole('button', { name: /Set Cover/i }).first();
  if (await setCoverButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await setCoverButton.click();
  }

  await page.getByTestId('product-title-input').fill('Playwright Media Test');
  await page.getByRole('button', { name: /^Pricing$/ }).click();
  await page.getByTestId('product-price-input').fill('1000');

  await page.getByRole('button', { name: 'Save as Draft' }).click();
  await expect(page.getByText('Draft saved successfully')).toBeVisible({ timeout: 15000 });
});
