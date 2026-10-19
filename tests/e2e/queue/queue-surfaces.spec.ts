import { expect, test } from '@playwright/test';

const surfaces = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile-browser', width: 360, height: 800 },
  { name: 'studio-webview', width: 393, height: 720 },
];

for (const surface of surfaces) {
  test(`${surface.name}: waiting cards, refund confirmation and back dismissal`, async ({ page }, testInfo) => {
    await page.setViewportSize(surface);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/tests/e2e/queue/fixture.html?view=shopper');
    await expect(page.getByText(/Admin promotion hold/)).toBeVisible();
    await expect(page.getByText(/Cancels in/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel waiting order' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('10% jump cancellation fee')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
    await page.goBack();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(/Admin promotion hold/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
  for (const view of ['admin', 'brand', 'billing', 'finance', 'detail']) {
    test(`${surface.name}: ${view} workspace wraps without horizontal overflow`, async ({ page }, testInfo) => {
      await page.setViewportSize(surface);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/tests/e2e/queue/fixture.html?view=${view}${surface.name === 'studio-webview' ? '&surface=mobile-app' : ''}`);
      if (view === 'admin') {
        await expect(page.getByRole('heading', { name: /Thread/, exact: false }).first()).toBeVisible();
        await page.getByRole('tab', { name: /Capacity campaigns/ }).click();
        await expect(page.getByText('New capacity campaign')).toBeVisible();
        await page.getByRole('tab', { name: /Runway notices/ }).click();
        await expect(page.getByText('Create a Runway notice')).toBeVisible();
      } else if (view === 'billing') {
        await expect(page.getByRole('heading', { name: /Billing & subscriptions/ })).toBeVisible();
        await page.getByRole('button', { name: 'Preview change' }).first().click();
        await expect(page.getByRole('checkbox')).not.toBeChecked();
        await expect(page.getByRole('button', { name: 'Confirm and continue' })).toBeDisabled();
      } else if (view === 'finance') await expect(page.getByText(/Custom-order refunds needing reconciliation/)).toBeVisible();
      else if (view === 'brand') await expect(page.getByRole('heading', { name: 'Custom orders', exact: true })).toBeVisible();
      else await expect(page.getByText(/Admin promotion hold/)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`queue-${surface.name}-${view}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

for (const state of ['loading', 'empty', 'error', 'permission']) {
  test(`billing ${state} state remains actionable`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/tests/e2e/queue/fixture.html?view=billing&state=${state}`);
    if (state === 'loading') await expect(page.getByText(/Loading subscription/)).toBeVisible();
    if (state === 'empty') await expect(page.getByText('No paid subscription. Select a tier to open custom-order intake.')).toBeVisible();
    if (state === 'error') { await expect(page.getByText('Unable to load subscription.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled(); }
    if (state === 'permission') { await expect(page.getByText('Only the brand owner can access billing, subscription history and saved payment methods.')).toBeVisible(); }
    await page.screenshot({ path: testInfo.outputPath(`queue-state-${state}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const surface of surfaces) {
  test(`${surface.name}: dark billing remains readable and keyboard accessible`, async ({ page }, testInfo) => {
    await page.setViewportSize(surface);
    await page.goto('/tests/e2e/queue/fixture.html?view=billing&theme=dark');
    await page.getByRole('button', { name: 'Preview change' }).first().focus();
    await expect(page.getByRole('button', { name: 'Preview change' }).first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Confirm and continue' })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`queue-dark-${surface.name}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('confirmed cancellation survives a failed background refresh', async ({ page }, testInfo) => {
  await page.goto('/tests/e2e/queue/fixture.html?view=shopper&state=refresh-error');
  await page.getByRole('button', { name: 'Cancel waiting order' }).click();
  await page.getByRole('textbox').fill('No longer required');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Resubmit with current quote' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { fixtureCalls: Array<{action: string}> }).fixtureCalls.filter(call => call.action === 'cancel').length)).toBe(1);
});

test('settings billing links, card selection, history and Studio return are connected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/e2e/queue/fixture.html?view=settings-billing');
  await expect(page.getByRole('heading', { name: 'Billing & subscriptions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Studio' })).toHaveAttribute('href', '/studio?tab=store');
  await page.getByRole('button', { name: 'Payment methods', exact: true }).click();
  await expect(page.getByText('Business card ···· 4081')).toBeVisible();
  await page.getByRole('radio', { name: /Business card/ }).check();
  await expect(page.getByRole('button', { name: 'Use selected card for renewal' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Use selected card for renewal' }).click();
  await page.waitForFunction(() => (window as any).fixtureCalls.some((call: any) => call.action === 'renewal-card'));
  await page.getByRole('button', { name: 'Edit nickname' }).click();
  await page.getByRole('textbox', { name: 'Card nickname' }).fill('Studio purchases');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.waitForFunction(() => (window as any).fixtureCalls.some((call: any) => call.action === 'rename-card'));
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Receipt reference: wzsub-fixture-receipt')).toBeVisible();
  await page.getByRole('tab', { name: 'Subscription history' }).click();
  await expect(page.getByText('₦10,000.00 / month').last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('subscription notice closes and Upgrade reaches Settings billing', async ({ page }) => {
  await page.goto('/tests/e2e/queue/fixture.html?view=notice');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Upgrade', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Billing & subscriptions' })).toBeVisible();
});


test('legacy Studio billing callbacks retain their reference in Settings', async ({ page }) => {
  await page.goto('/tests/e2e/queue/fixture.html?view=legacy-billing');
  await expect(page.getByRole('heading', { name: 'Billing & subscriptions' })).toBeVisible();
  await page.waitForFunction(() => (window as any).fixtureCalls.some((call: any) => call.action === 'subscription-verify' && call.payload === 'legacy-payment-reference'));
  await expect(page.getByText('Studio fixture')).not.toBeVisible();
});
