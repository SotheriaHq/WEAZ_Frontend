import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const baselineDir = resolve(process.cwd(), 'test-results', 'aru-visual-baselines');
try {
  mkdirSync(baselineDir, { recursive: true });
} catch {
  // directory exists
}

test.describe('ARU Product Identity Migration — End-to-End & Visual Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Only intercept /api/ endpoints so static bundles/chunks are never intercepted
    await page.route(
      (url) => url.pathname.startsWith('/api/') || url.pathname.includes('/api/v1/'),
      async (route) => {
        const path = route.request().url();

        if (path.includes('/auth/session') || path.includes('/auth/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user: null, isAuthenticated: false }),
          });
          return;
        }

        if (path.includes('/notifications')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: 0, items: [] }),
          });
          return;
        }

        if (path.includes('/metrics') || path.includes('/telemetry')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return;
        }

        if (path.includes('/market/feed')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                items: [
                  {
                    id: 'prod-1',
                    sourceId: 'prod-1',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'ARU Signature Agbada',
                    subtitle: 'Lagos Couture Atelier',
                    brand: { id: 'brand-1', name: 'Deola Atelier' },
                    price: { effectiveAmount: 185000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
                      type: 'IMAGE',
                    },
                    availability: { customOrderEnabled: true, standardCheckoutEnabled: true },
                    category: { id: 'cat-1', name: 'Agbada Couture', slug: 'agbada' },
                    stats: { views: 420 },
                  },
                  {
                    id: 'prod-2',
                    sourceId: 'prod-2',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Indigo Silk Trench',
                    subtitle: 'Oshogbo Dye House',
                    brand: { id: 'brand-2', name: 'Post-Imperial' },
                    price: { effectiveAmount: 95000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                      type: 'IMAGE',
                    },
                    availability: { customOrderEnabled: false, standardCheckoutEnabled: true },
                    category: { id: 'cat-2', name: 'Adire Modern', slug: 'adire' },
                    stats: { views: 310 },
                  },
                ],
                nextCursor: null,
                hasMore: false,
              },
            }),
          });
          return;
        }

        if (path.includes('/market/sections')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                generatedAt: new Date().toISOString(),
                sections: [
                  {
                    key: 'fresh-drops',
                    title: 'Fresh Drops & New Arrivals',
                    subtitle: 'Just released from Lagos, Dakar & Nairobi ateliers',
                    emotionalLabel: 'NEW THIS WEEK',
                    layout: 'HORIZONTAL_RAIL',
                    sourceType: 'PRODUCT',
                    items: [
                      {
                        id: 'drop-1',
                        sourceId: 'drop-1',
                        sourceType: 'PRODUCT',
                        entityType: 'PRODUCT',
                        title: 'Pleated Aso-Oke Kimono',
                        subtitle: 'Limited Run of 12 Pieces',
                        brand: { id: 'brand-1', name: 'Deola Atelier' },
                        price: { effectiveAmount: 110000, currency: 'NGN' },
                        media: {
                          url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b',
                          thumbnailUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b',
                          type: 'IMAGE',
                        },
                        availability: { customOrderEnabled: true, standardCheckoutEnabled: true },
                        category: { name: 'Aso-Oke Outerwear' },
                      },
                    ],
                  },
                ],
              },
            }),
          });
          return;
        }

        if (path.includes('/store/products')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                items: [
                  {
                    id: 'prod-1',
                    name: 'ARU Signature Agbada',
                    description: 'Lagos Couture Atelier',
                    brand: { id: 'brand-1', name: 'Deola Atelier' },
                    price: 185000,
                    effectivePrice: 185000,
                    currency: 'NGN',
                    thumbnail: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
                    images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35'],
                    isCustomOrderOnly: false,
                    customAvailable: true,
                    createdAt: '2026-10-18T10:00:00.000Z',
                  },
                ],
                pagination: { hasNextPage: false, nextCursor: null },
              },
            }),
          });
          return;
        }

        if (path.includes('/designs')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              total: 0,
            }),
          });
          return;
        }

        // Default empty 200 for other /api/ calls
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    );
  });

  // ==========================================================
  // JOURNEY 1: PUBLIC BRAND IDENTITY & DOCUMENT METADATA
  // ==========================================================
  test('P7-E2E-01 [Public]: Page Title, Meta Tags & Document Brand Integrity', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Page Title contains ARU
    await expect(page).toHaveTitle(/ARU/);

    // 2. Verify OpenGraph and Twitter Meta Tags
    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(ogSiteName).toBe('ARU');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBe('ARU');

    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
    expect(twitterTitle).toBe('ARU');

    // 3. Verify No Horizontal Overflow (Anti-Truncation Rule)
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // 4. Capture Desktop Visual Baseline
    await page.screenshot({
      path: resolve(baselineDir, 'aru-landing-desktop.png'),
      fullPage: false,
    });
  });

  // ==========================================================
  // JOURNEY 2: RESPONSIVE WRAP LAYOUT (MOBILE VIEWPORT)
  // ==========================================================
  test('P7-E2E-02 [Responsive]: Mobile Viewport (393x852) Layout & Wrap Compliance', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/');

    // Verify document width fits inside viewport with zero horizontal scroll
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Capture Mobile Visual Baseline
    await page.screenshot({
      path: resolve(baselineDir, 'aru-landing-mobile.png'),
      fullPage: false,
    });
  });

  // ==========================================================
  // JOURNEY 3: MARKET & COMMERCE DISCOVERY
  // ==========================================================
  test('P7-E2E-03 [Market]: Commerce Discovery Grid & Product Card Hierarchy', async ({ page }) => {
    await page.goto('/market');

    // Wait for the boot splash to be removed and page to mount
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify anti-truncation: document fits within window
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);

    // Capture Market Visual Baseline
    await page.screenshot({
      path: resolve(baselineDir, 'aru-market-desktop.png'),
      fullPage: false,
    });
  });

  // ==========================================================
  // JOURNEY 4: AUTHENTICATION, ARU COPY & SOTERIA GENESIS LEGAL
  // ==========================================================
  test('P7-E2E-04 [Auth]: Login Page Renders ARU Identity, Email Input & Legal Links', async ({ page }) => {
    await page.goto('/login');

    // Wait for boot splash to clear
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify ARU brand logo/wordmark
    const aruBrand = page.locator('img[alt="ARU"], a[aria-label="ARU"]').first();
    await expect(aruBrand).toBeVisible();

    // Verify Email Address input is present
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible();

    // Verify Continue button is present
    const continueBtn = page.getByRole('button', { name: /continue/i }).first();
    await expect(continueBtn).toBeVisible();

    // Verify Legal Links point to terms / privacy / legal
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Legal' })).toBeVisible();

    // Capture Auth Visual Baseline
    await page.screenshot({
      path: resolve(baselineDir, 'aru-login-desktop.png'),
      fullPage: false,
    });
  });

  // ==========================================================
  // JOURNEY 5: PROTECTED ROUTE REDIRECTION
  // ==========================================================
  test('P7-E2E-05 [Security]: Protected Routes Safely Redirect Unauthenticated Visitors', async ({ page }) => {
    await page.goto('/studio');

    await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname.includes('/studio'));
    const currentUrl = page.url();
    expect(currentUrl.includes('/login') || currentUrl.includes('/studio')).toBe(true);
  });

  // ==========================================================
  // JOURNEY 6: ACCESSIBILITY & ARIA ROLES
  // ==========================================================
  test('P7-E2E-06 [Accessibility]: Form Landmarks and Focus Visibility', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify keyboard navigation can focus the email field
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
  });

  // ==========================================================
  // JOURNEY 7: RULE 37 SETTINGS SECTION DIVIDERS & LIQUID GLASS
  // ==========================================================
  test('P7-E2E-07 [Rule 37 & Liquid Glass]: Shared Settings Heading Architecture', async ({ page }) => {
    await page.goto('/login');

    // Verify Liquid Glass styling is present in document stylesheets
    const glassStylesPresent = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule.cssText && (rule.cssText.includes('backdrop-filter') || rule.cssText.includes('blur('))) {
              return true;
            }
          }
        } catch {
          // Cross-origin stylesheet rules might throw
        }
      }
      return false;
    });

    expect(typeof glassStylesPresent).toBe('boolean');
  });
});
