/// <reference lib="dom" />
import { test, expect } from "@playwright/test";

test("customer list wraps real records, paginates and searches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route("**/customers?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get("page") ?? 1);
    const search = params.get("search");
    const items = search
      ? []
      : [
          {
            id: "shopper-" + pageNumber,
            name:
              pageNumber === 1
                ? "Ada Ama Customer With A Long Name"
                : "Bisi Shopper",
            username: "customer-name-".repeat(10),
            orderCount: 3,
            lastOrderAt: "2026-10-21T00:00:00Z",
          },
        ];
    await route.fulfill({
      json: {
        data: {
          items,
          total: search ? 0 : 26,
          page: pageNumber,
          limit: 25,
          hasNextPage: !search && pageNumber === 1,
          settings: { effectiveMinimumOrders: 1 },
        },
      },
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-credentials": "true",
      },
    });
  });
  await page.goto("/e2e/fixtures/store-layout.html?screen=customers");
  await expect(
    page.getByText("Ada Ama Customer With A Long Name", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator("main")
      .evaluate(
        (node) =>
          node.ownerDocument.documentElement.scrollWidth <=
          node.ownerDocument.defaultView!.innerWidth + 1,
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Bisi Shopper", { exact: true })).toBeVisible();
  await page.getByRole("combobox").fill("No match");
  await expect(page.getByText("No shoppers match your search.")).toBeVisible();
});

for (const width of [320, 390, 820, 1440])
  for (const embedded of [false, true]) {
    test(`store wraps long copy and starts cards early at ${width}px embedded=${embedded}`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) =>
        process.stderr.write(
          "Failed: " +
            new URL(request.url()).pathname +
            " " +
            request.failure()?.errorText +
            "\n",
        ),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          process.stderr.write(message.text() + "\n");
      });
      await page.setViewportSize({ width, height: 900 });
      let statusResolved = false;
      let productsBeforeStatus = false;
      let productRequests = 0;
      let verificationResolved = false;
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          url.port === "3000" &&
          !/^\/(api|v1|store|brands)(\/|$)/.test(url.pathname)
        )
          return route.continue();
        let data: unknown = [];
        if (url.pathname.endsWith("/store/status")) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          statusResolved = true;
          data = {
            isStoreOpen: true,
            brandId: "00000000-0000-4000-8000-000000000002",
            profile: {
              name: "Nuel's Cotour",
              description:
                "Into the unknown Nuels Fashion hib and fix. ".repeat(8),
            },
          };
        } else if (url.pathname.endsWith("/customer-settings"))
          data = {
            canUpgrade: true,
            canConfigureCustomers: false,
            customerMinimumOrders: 3,
            effectiveMinimumOrders: 1,
          };
        else if (url.pathname.endsWith("/products")) {
          productRequests++;
          productsBeforeStatus ||= !statusResolved;
          data = {
            items: [
              {
                id: "00000000-0000-4000-8000-000000000003",
                name: "Everyday Adire",
                price: 12000,
                totalStock: 4,
                isActive: true,
                publicationStatus: "PUBLISHED",
                images: [],
              },
            ],
            total: 1,
          };
        } else if (url.pathname.includes("verification")) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          verificationResolved = true;
          data = {
            verificationStatus: "APPROVED",
            badgeState: { verificationBadgeVisible: true },
          };
        }
        await route.fulfill({
          json: { data, statusCode: 200 },
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:3000",
            "access-control-allow-credentials": "true",
          },
        });
      });
      await page.goto(
        "/e2e/fixtures/store-layout.html" + (embedded ? "?embedded=1" : ""),
      );
      await expect(
        page.getByRole("heading", { name: "Nuel's Cotour", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        page.getByText("Everyday Adire", { exact: true }),
      ).toBeVisible({ timeout: 10000 });
      await expect.poll(() => verificationResolved).toBe(true);
      expect(pageErrors).toEqual([]);
      const geometry = await page
        .getByRole("heading", { name: "Nuel's Cotour", exact: true })
        .evaluate((node) => ({
          width: node.getBoundingClientRect().width,
          documentWidth: node.ownerDocument.documentElement.scrollWidth,
          viewport: node.ownerDocument.defaultView?.innerWidth ?? 0,
        }));
      expect(geometry.width).toBeGreaterThan(width < 500 ? 200 : 400);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1);
      if (embedded) {
        const thinBorders = await page.locator("main").evaluate((root) =>
          Array.from(root.querySelectorAll("*"))
            .filter((node) => {
              const style =
                node.ownerDocument.defaultView!.getComputedStyle(node);
              return [
                "borderTopWidth",
                "borderRightWidth",
                "borderBottomWidth",
                "borderLeftWidth",
              ].some((key) => {
                const value = parseFloat(
                  style[key as keyof typeof style] as string,
                );
                return value > 0 && value < 2;
              });
            })
            .map((node) => node.className),
        );
        expect(thinBorders).toEqual([]);
      }
      expect(productsBeforeStatus).toBe(true);
      expect(productRequests).toBe(1);
      await expect(
        page.getByRole("button", { name: "Upgrade", exact: true }),
      ).toHaveCount(embedded ? 0 : 1);
      if (width === 390 && !embedded)
        await page.screenshot({
          path: "test-results/store-layout-390.png",
          fullPage: true,
        });
    });
  }

for (const paid of [false, true])
  test(`customer threshold paid=${paid}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let saved: number | undefined;
    await page.route("**/customer-settings", async (route) => {
      if (route.request().method() === "PATCH")
        saved = route.request().postDataJSON().minimumOrders;
      await route.fulfill({
        json: {
          data: {
            canUpgrade: true,
            canConfigureCustomers: paid,
            customerMinimumOrders: saved ?? 3,
            effectiveMinimumOrders: paid ? (saved ?? 3) : 1,
          },
        },
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:3000",
          "access-control-allow-credentials": "true",
        },
      });
    });
    await page.goto("/e2e/fixtures/store-layout.html?screen=customer-settings");
    const input = page.getByRole("spinbutton");
    await expect(input).toHaveValue("3");
    if (!paid) {
      await expect(input).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Save customer settings" }),
      ).toBeDisabled();
    } else {
      await input.fill("0");
      await expect(
        page.getByRole("button", { name: "Save customer settings" }),
      ).toBeDisabled();
      await input.fill("5");
      await page
        .getByRole("button", { name: "Save customer settings" })
        .click();
      await expect.poll(() => saved).toBe(5);
    }
  });


test('product taxonomy becomes usable before private collections and does not refetch on selections', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseCollections!: () => void;
  const collectionsGate = new Promise<void>((resolve) => { releaseCollections = resolve; });
  let collectionsStarted = false;
  let collectionsFinished = false;
  let categoryRequests = 0;
  let legacyTypeRequests = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '3000' && !/^\/(api|v1|store|brands|categories|collections|store-collections)(\/|$)/.test(url.pathname)) return route.continue();
    let data: unknown = [];
    if (url.pathname.endsWith('/categories')) {
      categoryRequests++;
      data = [{ id: 'tops', slug: 'tops', name: 'Tops', subCategories: [{ id: 't-shirt', slug: 't-shirt', name: 'T-shirt' }] }];
    } else if (url.pathname.includes('/store-collections/user/')) {
      collectionsStarted = true;
      await collectionsGate;
      collectionsFinished = true;
    } else if (url.pathname.endsWith('/collections/category-types')) legacyTypeRequests++;
    await route.fulfill({ json: { data, statusCode: 200 }, headers: { 'access-control-allow-origin': 'http://127.0.0.1:3000', 'access-control-allow-credentials': 'true' } });
  });
  try {
    await page.goto('/e2e/fixtures/store-layout.html?screen=product-creation&embedded=1');
    const category = page.getByRole('button', { name: 'What is it?' });
    await expect(category).toBeEnabled({ timeout: 30000 });
    await expect.poll(() => collectionsStarted).toBe(true);
    expect(collectionsFinished).toBe(false);
    await category.click();
    await page.getByText('Tops', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Garment type' })).toBeEnabled();
    expect(categoryRequests).toBe(1);
    expect(legacyTypeRequests).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    releaseCollections();
  }
});
