import { test, expect } from '@playwright/test';
import { loginAsBrand } from './helpers/auth';

test('dashboard flow', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err));
    page.on('requestfailed', req => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));

    console.log('Navigating to login...');
    await loginAsBrand(page);

    // Wait for redirect (likely to /profile)
    console.log('Waiting for redirect...');
    console.log('Redirected to:', page.url());

    // 2. Navigate to the current Studio dashboard explicitly.
    console.log('Navigating to Studio dashboard...');
    await page.goto('/studio');

    // 3. Verify Dashboard Overview
    console.log('Verifying overview...');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Recent Activity')).toBeVisible();

    // 4. Navigate to Orders
    console.log('Navigating to orders...');
    await page.goto('/studio?tab=orders');
    await expect(page.getByText('Standard Orders')).toBeVisible();
    await expect(page.getByText('Custom Orders')).toBeVisible();

    // 5. Navigate to Analytics
    console.log('Navigating to analytics...');
    await page.goto('/studio?tab=analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByText('Revenue Over Time')).toBeVisible();

    // 6. Navigate to Finance
    console.log('Navigating to finance...');
    await page.goto('/studio?tab=finance');
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
    await expect(page.getByText('Available balance')).toBeVisible();
});
