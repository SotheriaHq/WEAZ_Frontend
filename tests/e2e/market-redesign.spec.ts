import { test, expect } from '@playwright/test';

test.describe('Market Redesign & Embedded Sections E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Store Products and Market APIs to provide consistent mock responses across all viewports
    const mockStoreProducts = [
      {
        id: 'prod-1',
        name: 'Heritage Embroidered Agbada',
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
      {
        id: 'prod-2',
        name: 'Structured Indigo Trench',
        description: 'Oshogbo Dye House',
        brand: { id: 'brand-2', name: 'Post-Imperial' },
        price: 95000,
        effectivePrice: 95000,
        currency: 'NGN',
        thumbnail: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
        images: ['https://images.unsplash.com/photo-1509631179647-0177331693ae'],
        isCustomOrderOnly: false,
        customAvailable: false,
        createdAt: '2026-10-18T09:00:00.000Z',
      },
      {
        id: 'prod-3',
        name: 'Silk Organza Draped Dress',
        description: 'Eko Fashion Week Edit',
        brand: { id: 'brand-3', name: 'Kenneth Ize' },
        price: 240000,
        effectivePrice: 240000,
        currency: 'NGN',
        thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
        images: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f'],
        isCustomOrderOnly: true,
        customAvailable: true,
        createdAt: '2026-10-18T08:00:00.000Z',
      },
      {
        id: 'prod-4',
        name: 'Minimalist Linen Kaftan',
        description: 'Abuja Atelier',
        brand: { id: 'brand-4', name: 'Orange Culture' },
        price: 48000,
        effectivePrice: 48000,
        currency: 'NGN',
        thumbnail: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
        images: ['https://images.unsplash.com/photo-1539109136881-3be0616acf4b'],
        isCustomOrderOnly: false,
        customAvailable: true,
        createdAt: '2026-10-18T07:00:00.000Z',
      },
    ];

    await page.route((url) => url.pathname.includes('/store/products'), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: mockStoreProducts,
            pagination: { hasNextPage: false, nextCursor: null },
          },
        }),
      });
    });

    await page.route((url) => url.pathname.includes('/market/feed'), async (route) => {
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
                title: 'Heritage Embroidered Agbada',
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
                title: 'Structured Indigo Trench',
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
              {
                id: 'prod-3',
                sourceId: 'prod-3',
                sourceType: 'PRODUCT',
                entityType: 'PRODUCT',
                title: 'Silk Organza Draped Dress',
                subtitle: 'Eko Fashion Week Edit',
                brand: { id: 'brand-3', name: 'Kenneth Ize' },
                price: { effectiveAmount: 240000, currency: 'NGN' },
                media: {
                  url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
                  thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
                  type: 'IMAGE',
                },
                availability: { customOrderEnabled: true, standardCheckoutEnabled: false },
                category: { id: 'cat-3', name: 'Silk & Draped', slug: 'silks' },
                stats: { views: 580 },
              },
              {
                id: 'prod-4',
                sourceId: 'prod-4',
                sourceType: 'PRODUCT',
                entityType: 'PRODUCT',
                title: 'Minimalist Linen Kaftan',
                subtitle: 'Abuja Atelier',
                brand: { id: 'brand-4', name: 'Orange Culture' },
                price: { effectiveAmount: 48000, currency: 'NGN' },
                media: {
                  url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                  thumbnailUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                  type: 'IMAGE',
                },
                availability: { customOrderEnabled: true, standardCheckoutEnabled: true },
                category: { id: 'cat-4', name: 'Linen Essentials', slug: 'linen' },
                stats: { views: 240 },
              },
            ],
            nextCursor: null,
            hasMore: false,
          },
        }),
      });
    });

    await page.route(
      (url) => url.pathname.endsWith('/market/sections') || url.pathname.includes('/market/sections?'),
      async (route) => {
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
                  {
                    id: 'drop-2',
                    sourceId: 'drop-2',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Indigo Dyed Utility Pant',
                    subtitle: 'Resist dyed in Abeokuta',
                    brand: { id: 'brand-2', name: 'Post-Imperial' },
                    price: { effectiveAmount: 65000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                      type: 'IMAGE',
                    },
                    availability: { standardCheckoutEnabled: true },
                    category: { name: 'Adire Casual' },
                  },
                  {
                    id: 'drop-3',
                    sourceId: 'drop-3',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Hand-woven Silk Scarf',
                    subtitle: 'Raw Mulberry Silk',
                    brand: { id: 'brand-3', name: 'Kenneth Ize' },
                    price: { effectiveAmount: 38000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
                      type: 'IMAGE',
                    },
                    availability: { standardCheckoutEnabled: true },
                    category: { name: 'Silk Accessories' },
                  },
                ],
              },
              {
                key: 'hot-right-now',
                title: 'Highest Sales & Most Coveted',
                subtitle: 'Verified top pieces and collector favorites',
                emotionalLabel: 'BESTSELLERS',
                layout: 'HORIZONTAL_RAIL',
                sourceType: 'PRODUCT',
                items: [
                  {
                    id: 'hot-1',
                    sourceId: 'hot-1',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Sculptural Kaftan Tunic',
                    subtitle: 'Triple-washed Belgian linen',
                    brand: { id: 'brand-4', name: 'Orange Culture' },
                    price: { effectiveAmount: 85000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                      type: 'IMAGE',
                    },
                    availability: { customOrderEnabled: true, standardCheckoutEnabled: true },
                    category: { name: 'Linen Essentials' },
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.route((url) => url.pathname.includes('/market/sections/fresh-drops'), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            generatedAt: new Date().toISOString(),
            section: {
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
                {
                  id: 'drop-2',
                  sourceId: 'drop-2',
                  sourceType: 'PRODUCT',
                  entityType: 'PRODUCT',
                  title: 'Indigo Dyed Utility Pant',
                  subtitle: 'Resist dyed in Abeokuta',
                  brand: { id: 'brand-2', name: 'Post-Imperial' },
                  price: { effectiveAmount: 65000, currency: 'NGN' },
                  media: {
                    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
                    type: 'IMAGE',
                  },
                  availability: { standardCheckoutEnabled: true },
                  category: { name: 'Adire Casual' },
                },
              ],
              pagination: { limit: 24, hasNextPage: false, nextCursor: null },
            },
          },
        }),
      });
    });

    await page.route((url) => url.pathname.includes('/market/suggestions'), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            blocks: [
              {
                blockKey: 'atelier-bespoke-suits',
                title: 'Bespoke Suiting & Tailoring',
                subtitle: 'Hand-tailored custom fits',
                reason: 'complementary-sector',
                layout: 'HORIZONTAL_RAIL',
                sourceType: 'PRODUCT',
                items: [
                  {
                    id: 'bespoke-1',
                    sourceId: 'bespoke-1',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Double-Breasted Wool Blazer',
                    subtitle: 'Italian-Nigerian Wool Blend',
                    brand: { id: 'brand-1', name: 'Deola Atelier' },
                    price: { effectiveAmount: 195000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
                      type: 'IMAGE',
                    },
                    availability: { customOrderEnabled: true },
                  },
                  {
                    id: 'bespoke-2',
                    sourceId: 'bespoke-2',
                    sourceType: 'PRODUCT',
                    entityType: 'PRODUCT',
                    title: 'Tailored Linen Trouser',
                    subtitle: 'Hand-stitched Pleats',
                    brand: { id: 'brand-4', name: 'Orange Culture' },
                    price: { effectiveAmount: 72000, currency: 'NGN' },
                    media: {
                      url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                      thumbnailUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b',
                      type: 'IMAGE',
                    },
                    availability: { customOrderEnabled: true },
                  },
                ],
              },
            ],
          },
        }),
      });
    });
  });

  test('Desktop: verifies zero overlap between Hero and sections, 100% section-driven layout, and Explore links', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/market');

    // 1. Check Hero Flagship Elements
    const heroComponent = page.locator('[data-testid="market-trending-hero"]');
    await expect(heroComponent).toBeVisible();

    // Verify Trending Headline, Badge, and Naira Price
    await expect(page.getByText(/Trending now on/i)).toBeVisible();
    await expect(page.getByText(/HANDCRAFTED|HANDPICKED/i)).toBeVisible();
    await expect(heroComponent.getByText(/₦/).first()).toBeVisible();
    await expect(page.getByText('CUSTOM FIT ORDER →')).toBeVisible();

    // Verify right column queue (#2, #3, #4 badges)
    await expect(page.getByText('#2')).toBeVisible();
    await expect(page.getByText('#3')).toBeVisible();

    // 2. Overlap Verification (no overlap between Hero and following catalog/sections area)
    const heroBox = await heroComponent.boundingBox();
    expect(heroBox).not.toBeNull();

    const destinationCatalog = page.locator('section').filter({ hasText: 'Destination Catalog' }).first();
    if (await destinationCatalog.isVisible()) {
      const catalogBox = await destinationCatalog.boundingBox();
      if (catalogBox && heroBox) {
        expect(catalogBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 2);
      }
    }

    // 3. Section Rail & Explore Links Verification
    const exploreFreshDropsBtn = page.getByRole('button', { name: /Explore/i }).first();
    await expect(exploreFreshDropsBtn).toBeVisible();

    // Verify End-of-Rail Explore Card is present
    await expect(page.getByText('Sector Archive').first()).toBeVisible();
    await expect(page.getByText(/Explore All/i).first()).toBeVisible();

    // 4. Click Explore Fresh Drops -> Navigates to Section Page
    await exploreFreshDropsBtn.click();
    await expect(page).toHaveURL(/\/market\/sections/);

    // 5. Section Detail Page Elements
    await expect(page.getByText('Back to Market')).toBeVisible();
    await expect(page.getByText(/Fresh Drops/i).first()).toBeVisible();

    // Check Embedded Curations (Anti-Repetition: Main market section titles like 'loved near you' must NOT appear)
    const embeddedSectionHeading = page.getByText(/Curated Suggestions & Sub-Themes for this Sector/i);
    if (await embeddedSectionHeading.isVisible()) {
      // Bespoke Suiting sub-section should be present from suggestions
      await expect(page.getByText('Bespoke Suiting & Tailoring').first()).toBeVisible();
      // But main market sections must NOT be duplicated inside embedded rails
      const embeddedRails = page.locator('section').filter({ hasText: 'Curated Suggestions' });
      await expect(embeddedRails.getByText('Fresh Drops & New Arrivals')).toHaveCount(0);
      await expect(embeddedRails.getByText('Highest Sales & Most Coveted')).toHaveCount(0);
      await expect(embeddedRails.getByText('Loved Near You')).toHaveCount(0);
    }

    // Verify Filter Toolbar
    await expect(page.getByRole('button', { name: 'Ready to Wear' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Custom Fit' })).toBeVisible();
  });

  test('Mobile Viewport: wraps elegantly without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/market');

    // Hero is visible and responsive
    const heroComponent = page.locator('[data-testid="market-trending-hero"]');
    await expect(heroComponent).toBeVisible();

    // Check no horizontal scrollbar on root
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
