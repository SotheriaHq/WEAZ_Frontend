import { test, expect } from '@playwright/test';

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
  await page.goto('/login');
  await page.fill('input[type="email"]', 'brand@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*(profile|dashboard).*/, { timeout: 15000 });

  await page.goto('/studio/store/products/new');
  await expect(page.getByText('Create Product')).toBeVisible();

  const mediaInput = page.getByTestId('product-media-input');
  await mediaInput.setInputFiles([
    buildImage('one.png'),
    buildImage('two.png'),
    buildImage('three.png'),
    buildImage('four.png'),
  ]);

  await page.getByLabel('Set as cover').first().click();

  await page.getByTestId('product-title-input').fill('Playwright Media Test');
  await page.getByTestId('product-price-input').fill('1000');

  await page.getByRole('button', { name: 'Create Product' }).click();
  await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 15000 });
});
