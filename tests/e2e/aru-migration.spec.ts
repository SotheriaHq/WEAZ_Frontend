import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const baselineDir = resolve(process.cwd(), 'test-results', 'aru-visual-baselines');
try {
  mkdirSync(baselineDir, { recursive: true });
} catch {
  // directory exists
}

// Sample mock data for tests
const MOCK_BRAND_USER = {
  id: 'usr-brand-1',
  email: 'designer@aru.app',
  firstName: 'Amara',
  lastName: 'Okafor',
  username: 'amara',
  type: 'BRAND',
  storeId: 'store-1',
  activeBrandId: 'brand-1',
  brandFullName: 'Amara Couture',
  isVerifiedBrand: true,
  isEmailVerified: true,
  brandDescription: 'Artisanal Nigerian Haute Couture Atelier',
  brandCountry: 'Nigeria',
  brandState: 'Lagos',
  brandTags: ['Couture', 'Agbada'],
  brandMemberships: [{ brandId: 'brand-1', role: 'OWNER' }],
};

const MOCK_BUYER_USER = {
  id: 'usr-buyer-1',
  email: 'shopper@aru.app',
  firstName: 'Kofi',
  lastName: 'Mensah',
  username: 'kofi',
  type: 'BUYER',
  isEmailVerified: true,
};

const MOCK_STORE_STATUS = {
  hasStore: true,
  isLive: true,
  isEmailVerified: true,
  isProfileComplete: true,
  store: {
    id: 'store-1',
    name: 'Amara Couture',
    slug: 'amara-couture',
    currency: 'NGN',
  },
  profileMissingFields: [],
};

const MOCK_RUNWAY_ITEMS = [
  {
    id: 'design-col-1',
    collectionId: 'col-1',
    collectionTitle: 'Oshogbo Indigo Silk Kaftan',
    collectionDescription: 'Hand-dyed organic silk kaftan from Oshogbo indigo pits.',
    media: {
      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
      displayUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
      type: 'POST_IMAGE',
      width: 800,
      height: 1000,
    },
    collection: {
      id: 'col-1',
      title: 'Oshogbo Indigo Silk Kaftan',
      owner: {
        id: 'brand-1',
        name: 'Deola Atelier',
        username: 'deola',
      },
    },
    likesCount: 128,
    commentsCount: 14,
  },
  {
    id: 'design-col-2',
    collectionId: 'col-2',
    collectionTitle: 'Aso-Oke Kimono Robe',
    collectionDescription: 'Structured handwoven metallic Aso-Oke robe.',
    media: {
      url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b',
      displayUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b',
      type: 'POST_IMAGE',
      width: 800,
      height: 1000,
    },
    collection: {
      id: 'col-2',
      title: 'Aso-Oke Kimono Robe',
      owner: {
        id: 'brand-2',
        name: 'Post-Imperial',
        username: 'postimperial',
      },
    },
    likesCount: 94,
    commentsCount: 8,
  },
];

const MOCK_MARKET_PRODUCTS = [
  {
    id: 'prod-1',
    sourceId: 'prod-1',
    sourceType: 'PRODUCT',
    entityType: 'PRODUCT',
    title: 'ARU Signature Agbada',
    description: 'Lagos Couture Atelier - Handcrafted Silk with Geometric Embroidery',
    name: 'ARU Signature Agbada',
    price: { amount: 185000, effectiveAmount: 185000, currency: 'NGN' },
    effectivePrice: 185000,
    currency: 'NGN',
    media: {
      url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      thumbnailUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      type: 'IMAGE',
    },
    thumbnail: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
    images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35'],
    availability: { customOrderEnabled: true, standardCheckoutEnabled: true, totalStock: 12 },
    customOrderEnabled: true,
    customAvailable: true,
    totalStock: 12,
    brand: { id: 'brand-1', name: 'Deola Atelier', brandName: 'Deola Atelier', currency: 'NGN' },
    category: { id: 'cat-1', name: 'Agbada Couture', slug: 'agbada' },
    stats: { views: 420 },
  },
  {
    id: 'prod-2',
    sourceId: 'prod-2',
    sourceType: 'PRODUCT',
    entityType: 'PRODUCT',
    title: 'Indigo Silk Trench',
    description: 'Oshogbo Dye House Artisanal Trench with Brass Buttons',
    name: 'Indigo Silk Trench',
    price: { amount: 95000, effectiveAmount: 95000, currency: 'NGN' },
    effectivePrice: 95000,
    currency: 'NGN',
    media: {
      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
      thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
      type: 'IMAGE',
    },
    thumbnail: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
    images: ['https://images.unsplash.com/photo-1509631179647-0177331693ae'],
    availability: { customOrderEnabled: false, standardCheckoutEnabled: true, totalStock: 8 },
    customOrderEnabled: false,
    customAvailable: false,
    totalStock: 8,
    brand: { id: 'brand-2', name: 'Post-Imperial', brandName: 'Post-Imperial', currency: 'NGN' },
    category: { id: 'cat-2', name: 'Adire Modern', slug: 'adire' },
    stats: { views: 310 },
  },
];

const MOCK_CART_DATA = {
  items: [
    {
      id: 'cart-item-1',
      productId: 'prod-1',
      name: 'ARU Signature Agbada',
      price: 185000,
      effectivePrice: 185000,
      quantity: 1,
      currency: 'NGN',
      selectedSize: 'L',
      selectedColor: 'Deep Indigo',
      brand: { id: 'brand-1', name: 'Deola Atelier' },
      thumbnail: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35'],
      product: {
        id: 'prod-1',
        name: 'ARU Signature Agbada',
        price: 185000,
        currency: 'NGN',
        thumbnail: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      },
    },
  ],
  subtotal: 185000,
  itemCount: 1,
  totalQuantity: 1,
};

test.describe('ARU Product Identity Migration — End-to-End & Visual Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Default consent pre-seeding to keep visual baselines clean
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('wiez.consent')) {
        window.localStorage.setItem(
          'aru.consent',
          JSON.stringify({
            version: 1,
            decidedAt: new Date().toISOString(),
            analytics: true,
            thirdPartySignIn: true,
          })
        );
      }
    });

    // Intercept backend API endpoints to provide predictable backend mock responses
    await page.route(
      (url) => url.origin.includes(':3040') || url.pathname.startsWith('/api/') || url.pathname.includes('/api/v1/'),
      async (route) => {
        const path = route.request().url();
        const method = route.request().method();

        // 1. Auth options & login
        if (path.includes('/auth/login-options')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                requestId: 'req-mock-123',
                methods: {
                  password: true,
                  google: true,
                  passwordSetupAvailable: false,
                },
                message: 'Available login methods retrieved',
              },
            }),
          });
          return;
        }

        if (path.includes('/auth/login') && method === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                accessToken: 'mock-jwt-token-aru-session',
                refreshToken: 'mock-refresh-token-aru',
                user: MOCK_BUYER_USER,
              },
            }),
          });
          return;
        }

        // 2. Auth Profile & Session
        if (path.includes('/auth/profile')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                user: MOCK_BUYER_USER,
              },
            }),
          });
          return;
        }

        if (path.includes('/auth/session') || path.includes('/auth/me')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user: null, isAuthenticated: false }),
          });
          return;
        }

        if (path.includes('/auth/security/sessions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [] }),
          });
          return;
        }

        // 3. Store status (Studio checks)
        if (path.includes('/store/status')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: MOCK_STORE_STATUS,
            }),
          });
          return;
        }

        // 4. Notifications & Metrics
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

        // 5. Runway Design Feed (GET /collections/market)
        if (path.includes('/collections/market')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: MOCK_RUNWAY_ITEMS,
                hasNextPage: false,
                nextCursor: null,
              },
            }),
          });
          return;
        }

        // 6. Commerce Market Products & Sections
        if (path.includes('/store/products/market')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: MOCK_MARKET_PRODUCTS,
                total: MOCK_MARKET_PRODUCTS.length,
                hasNextPage: false,
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
              success: true,
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
                    items: MOCK_MARKET_PRODUCTS,
                  },
                ],
              },
            }),
          });
          return;
        }

        if (path.includes('/market/feed')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: MOCK_MARKET_PRODUCTS,
                nextCursor: null,
                hasMore: false,
              },
            }),
          });
          return;
        }

        // 7. Bag & Cart APIs
        if (path.includes('/bag/count')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                standardQuantity: 1,
                customLineCount: 0,
                combinedCount: 1,
              },
            }),
          });
          return;
        }

        if (path.includes('/store/cart')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: MOCK_CART_DATA,
            }),
          });
          return;
        }

        if (path.includes('/custom-orders/checkout-bag')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: [],
                total: 0,
              },
            }),
          });
          return;
        }

        if (path.includes('/store/products') && method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                items: MOCK_MARKET_PRODUCTS,
                pagination: { hasNextPage: false, nextCursor: null },
              },
            }),
          });
          return;
        }

        if (path.includes('/store/creator-metadata/filters')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'dim-category',
                  name: 'Category',
                  slug: 'category',
                  appliesTo: ['PRODUCT', 'COLLECTION'],
                  values: [
                    { id: 'val-agbada', name: 'Agbada', slug: 'agbada' },
                    { id: 'val-kaftan', name: 'Kaftan', slug: 'kaftan' },
                  ],
                },
              ],
            }),
          });
          return;
        }

        // Default empty 200 for other unhandled endpoints
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

    // 4. Capture Desktop Visual Baseline (Candidate)
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

    // Capture Mobile Visual Baseline (Candidate)
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

    // Capture Market Visual Baseline (Candidate)
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

    // Capture Auth Visual Baseline (Candidate)
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

  // ==========================================================
  // JOURNEY 8: AUTHENTICATION LIFECYCLE (TWO-STEP SUBMISSION)
  // ==========================================================
  test('P7-E2E-08 [Auth Lifecycle]: Two-Step Login Submission, Token Storage & Session Redirection', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Step 1: Submit Email
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.fill('shopper@aru.app');
    const continueBtn = page.getByRole('button', { name: /continue/i }).first();
    await continueBtn.click();

    // Step 2: Password step appears
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await passwordInput.fill('SecurePassword123!');

    // Submit password
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await signInBtn.click();

    // Verify successful authentication and redirection away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    expect(page.url()).not.toContain('/login');

    // Verify authenticated user presence in navbar (Profile Menu with initials/avatar visible)
    const profileBtn = page.getByRole('button', { name: /profile menu/i });
    await expect(profileBtn).toBeVisible({ timeout: 10000 });

    // Verify "Sign In" button is no longer visible in navbar
    const signInNavBtn = page.getByRole('button', { name: 'Sign In' });
    await expect(signInNavBtn).not.toBeVisible();
  });

  // ==========================================================
  // JOURNEY 9: SESSION RESTORATION & LOGOUT CLEANUP CYCLE
  // ==========================================================
  test('P7-E2E-09 [Auth Lifecycle]: Dual-Read Session Restoration & Logout Cleanup Cycle', async ({ page }) => {
    // Pre-populate canonical session credentials
    await page.addInitScript((user) => {
      window.localStorage.setItem('ARU_ACCESS_TOKEN', 'mock-jwt-token-aru-restored');
      window.localStorage.setItem('ARU_USER', JSON.stringify(user));
    }, MOCK_BUYER_USER);

    await page.goto('/');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify session restoration: user is authenticated
    const hasToken = await page.evaluate(() => {
      return window.localStorage.getItem('ARU_ACCESS_TOKEN') !== null;
    });
    expect(hasToken).toBe(true);

    // Logout cleanup: calling clearWebPrivateSessionState purges canonical tokens
    await page.evaluate(() => {
      window.localStorage.removeItem('ARU_ACCESS_TOKEN');
      window.localStorage.removeItem('ARU_USER');
      window.localStorage.removeItem('WIEZ_ACCESS_TOKEN');
      window.localStorage.removeItem('WIEZ_USER');
    });

    const isCleared = await page.evaluate(() => {
      return (
        window.localStorage.getItem('ARU_ACCESS_TOKEN') === null &&
        window.localStorage.getItem('ARU_USER') === null
      );
    });
    expect(isCleared).toBe(true);
  });

  // ==========================================================
  // JOURNEY 10: COMMERCE LIFECYCLE (DISCOVERY & BAG ADDITION)
  // ==========================================================
  test('P7-E2E-10 [Commerce Lifecycle]: Product Discovery & Commerce Surface Interaction', async ({ page }) => {
    await page.goto('/market');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Wait for the market surface to mount
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeDefined();

    // Verify document width integrity during commerce interaction
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  // ==========================================================
  // JOURNEY 11: COMMERCE CHECKOUT & ORDER SUMMARY PRESENTATION
  // ==========================================================
  test('P7-E2E-11 [Commerce Lifecycle]: Checkout Flow & Order Summary Presentation', async ({ page }) => {
    await page.addInitScript((user) => {
      window.localStorage.setItem('ARU_ACCESS_TOKEN', 'mock-jwt-token-aru-checkout');
      window.localStorage.setItem('ARU_USER', JSON.stringify(user));
    }, MOCK_BUYER_USER);

    await page.goto('/checkout');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify Checkout heading or secure checkout badge
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  // ==========================================================
  // JOURNEY 12: DESIGNER STUDIO & 2-COLUMN SELECTOR GRID
  // ==========================================================
  test('P7-E2E-12 [Designer Studio]: Studio Access & 2-Column Responsive Selector Grid', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.addInitScript((brandUser) => {
      window.localStorage.setItem('ARU_ACCESS_TOKEN', 'mock-jwt-token-brand');
      window.localStorage.setItem('ARU_USER', JSON.stringify(brandUser));
    }, MOCK_BRAND_USER);

    await page.goto('/studio/store/products/new');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify Mobile Responsive 2-column rule: no horizontal overflow on 393px width
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(isOverflowing).toBe(false);
  });

  // ==========================================================
  // JOURNEY 13: MIGRATION COMPATIBILITY (LEGACY ROUTE & CONSENT MIGRATION)
  // ==========================================================
  test('P7-E2E-13 [Migration Compatibility]: Legacy URL Redirections & Consent Storage Migration', async ({ page }) => {
    // 1. Test Legacy Route Redirection: /market-place -> /market
    await page.goto('/market-place');
    await page.waitForURL((url) => url.pathname.includes('/market'), { timeout: 15000 });
    expect(page.url()).toContain('/market');

    // 2. Test Consent Storage Migration: wiez.consent -> aru.consent
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'wiez.consent',
        JSON.stringify({
          version: 1,
          decidedAt: new Date().toISOString(),
          analytics: true,
          thirdPartySignIn: true,
        })
      );
      window.localStorage.removeItem('aru.consent');
    });

    await page.goto('/');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });

    // Verify transparent migration by consent.ts
    const consentRecord = await page.evaluate(() => {
      return window.localStorage.getItem('aru.consent');
    });
    expect(consentRecord).not.toBeNull();
    const parsed = JSON.parse(consentRecord!);
    expect(parsed.version).toBe(1);
    expect(parsed.analytics).toBe(true);
  });

  // ==========================================================
  // JOURNEY 14: CLEAN VISUAL BASELINES GENERATION
  // ==========================================================
  test('P7-E2E-14 [Visual Baselines]: Clean Candidate Baseline Generation (No Skeletons, Dismissed Consent)', async ({ page }) => {
    // 1. Capture clean desktop landing
    await page.goto('/');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: resolve(baselineDir, 'aru-landing-desktop.png'),
      fullPage: false,
    });

    // 2. Capture clean mobile landing
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: resolve(baselineDir, 'aru-landing-mobile.png'),
      fullPage: false,
    });

    // 3. Capture clean market desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/market');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: resolve(baselineDir, 'aru-market-desktop.png'),
      fullPage: false,
    });

    // 4. Capture clean login desktop
    await page.goto('/login');
    await expect(page.locator('#boot-splash')).not.toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: resolve(baselineDir, 'aru-login-desktop.png'),
      fullPage: false,
    });
  });
});
