import { test, expect } from '@playwright/test';

test('dashboard flow', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err));
    page.on('requestfailed', req => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));

    console.log('Navigating to login...');
    await page.goto('/login');
    console.log('Current URL:', page.url());

    // Wait for form
    console.log('Waiting for email input...');
    try {
        await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 10000 });
    } catch (e) {
        const bodyText = await page.evaluate(
            () => (globalThis as any).document?.body?.innerText ?? ''
        );
        console.log('Email input not found. Body text:', bodyText);
        if (bodyText.includes('Oops!')) {
            console.log('Error Page detected!');
        }
        throw e;
    }

    console.log('Filling credentials...');
    await page.fill('input[type="email"]', 'brand@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect (likely to /profile)
    console.log('Waiting for redirect...');
    await page.waitForURL(/.*(profile|dashboard).*/, { timeout: 15000 });
    console.log('Redirected to:', page.url());

    // 2. Navigate to Dashboard explicitly
    console.log('Navigating to dashboard...');
    await page.goto('/dashboard/overview');

    // 3. Verify Dashboard Overview
    console.log('Verifying overview...');
    await expect(page.getByText('Total Sales')).toBeVisible();
    await expect(page.getByText('Recent Orders')).toBeVisible();

    // 4. Navigate to Orders
    console.log('Navigating to orders...');
    await page.click('a[href="/dashboard/orders"]');
    await expect(page.getByText('Orders')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 5. Navigate to Analytics
    console.log('Navigating to analytics...');
    await page.click('a[href="/dashboard/analytics"]');
    await expect(page.getByText('Revenue Over Time')).toBeVisible();

    // 6. Navigate to Finance
    console.log('Navigating to finance...');
    await page.click('a[href="/dashboard/finance"]');
    await expect(page.getByText('Available Balance')).toBeVisible();
});
