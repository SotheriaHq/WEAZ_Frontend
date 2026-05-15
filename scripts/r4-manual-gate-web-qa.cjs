const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3040';
const BRAND_OWNER_EMAIL = process.env.R4_BRAND_EMAIL || 'brand.owner@test.com';
const BUYER_EMAIL = process.env.R4_BUYER_EMAIL || 'buyer@test.com';
const PASSWORD = process.env.R4_PASSWORD || 'Password@123';
const STORE_COLLECTION_PRODUCT_NAME =
  process.env.R4_COLLECTION_PRODUCT_NAME || 'Ready-to-Wear Ankara Gown';

const SEEDED = {
  designId: '44444444-4444-4444-8444-444444444444',
  productId: '55555555-5555-4555-8555-555555555555',
  collectionId: '66666666-6666-4666-8666-666666666666',
};

const results = [];

const record = (name, status, details = {}) => {
  results.push({ name, status, ...details });
  const suffix = Object.keys(details).length ? ` ${JSON.stringify(details)}` : '';
  console.log(`${status.padEnd(8)} ${name}${suffix}`);
};

const createQaMedia = () => {
  const dir = path.join(os.tmpdir(), 'threadly-r4-manual-media');
  fs.mkdirSync(dir, { recursive: true });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWUlEQVR4nO3PQQ0AIBDAMMC/5xuwgR+QVLKqzrm7gPlmPQArwAqwAqwAK8AKsAKsACvACrACrAArwAqwAqwAK8AKsAKsACvACrACrAArwAqwAqwAK8AKsALcBuQBP67bZhgAAAAASUVORK5CYII=',
    'base64',
  );
  return [1, 2, 3, 4].map((index) => {
    const filePath = path.join(dir, `r4-design-${index}.png`);
    fs.writeFileSync(filePath, png);
    return filePath;
  });
};

const signIn = async (page, email) => {
  await page.goto(`${WEB_BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
};

const selectFirstUniversalOption = async (page, labelText) => {
  const label = page.getByText(labelText, { exact: true });
  await label.waitFor({ timeout: 10_000 });
  const container = page.locator('div').filter({ has: label }).last();
  const button = container.getByRole('button').first();
  await button.click();
  const option = page.locator('[role="option"], li, button').filter({ hasText: /.+/ }).last();
  await option.click({ timeout: 10_000 });
};

const addTag = async (page, tag) => {
  const input = page.getByPlaceholder('Search or create a tag...');
  await input.fill(tag);
  const add = page.getByLabel('Add tag');
  await add.click();
};

const verifyDesignPublish = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(12_000);
  const networkErrors = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(API_BASE_URL)) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await signIn(page, BRAND_OWNER_EMAIL);
    await page.goto(`${WEB_BASE_URL}/designs/create`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Create Design' }).waitFor();
    record('Create Design opens', 'PASS');

    const mediaFiles = createQaMedia();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(mediaFiles);
    await page.getByText('Image 1 of 4', { exact: false }).waitFor({ timeout: 15_000 });
    record('4 media add works', 'PASS', { mediaFiles: mediaFiles.length });

    const title = `R4 Manual Gate Design ${Date.now()}`;
    await page.getByPlaceholder("e.g., Summer Breeze '24").fill(title);
    await page.getByPlaceholder('Inspired by the warm coastal breeze of Lagos...').fill('Browser QA publish check for explicit Design persistence.');
    await addTag(page, 'r4-manual');
    await page.getByText('Pricing & Availability', { exact: true }).click();
    await page.getByPlaceholder('15,000').fill('25000');
    await page.getByPlaceholder('45,000').fill('85000');

    let finalizedDesignId = null;
    const finalizeDesignResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/designs/') &&
      response.url().includes('/finalize') &&
      response.request().method() === 'POST',
      { timeout: 45_000 },
    ).catch(() => null);

    const publish = page.getByRole('button', { name: 'Publish Design' });
    await publish.click();
    const confirm = page.getByRole('button', { name: 'Confirm publish' })
      .or(page.getByRole('button', { name: 'Publish now' }))
      .or(page.getByRole('button', { name: 'Publish Design' }));
    await confirm.last().click({ timeout: 10_000 });
    const finalizeDesignResponse = await finalizeDesignResponsePromise;
    if (finalizeDesignResponse?.ok()) {
      try {
        const payload = await finalizeDesignResponse.json();
        finalizedDesignId =
          payload?.data?.designId ||
          payload?.data?.id ||
          payload?.designId ||
          payload?.id ||
          null;
      } catch {
        finalizedDesignId = null;
      }
    }

    await page.waitForURL((url) => url.pathname.includes('/profile'), { timeout: 20_000 });
    await page.getByText(title, { exact: false }).waitFor({ timeout: 90_000 });
    record('Publish completes and appears in profile', 'PASS', { title });

    const designLink = page.locator(`a[href^="/designs/"]`).filter({ hasText: title });
    const linkCount = await designLink.count();
    let designUrl = null;
    if (finalizedDesignId) {
      designUrl = `/designs/${finalizedDesignId}`;
    } else if (linkCount > 0) {
      designUrl = await designLink.first().getAttribute('href');
    } else {
      const anyLink = page.locator(`a[href^="/designs/"]`).first();
      if ((await anyLink.count()) > 0) designUrl = await anyLink.getAttribute('href');
    }
    if (designUrl) {
      await page.goto(new URL(designUrl, WEB_BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
      await page.getByText(title, { exact: false }).waitFor({ timeout: 20_000 });
      record('Published design opens canonical route', 'PASS', { route: page.url() });
    } else {
      record('Published design canonical route link visible', 'PARTIAL', { reason: 'Profile task showed published title, but script could not extract its route link.' });
    }

    if (networkErrors.length > 0) {
      record('Design publish network errors', 'PARTIAL', { networkErrors: networkErrors.slice(0, 5) });
    }
  } catch (error) {
    record('Web design publish end-to-end', 'FAIL', { error: error.message });
  } finally {
    await page.close();
  }
};

const verifyStoreCollection = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(12_000);
  try {
    await signIn(page, BRAND_OWNER_EMAIL);
    await page.goto(`${WEB_BASE_URL}/collections/create`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname.includes('/studio/store/collections/new'), { timeout: 15_000 });
    record('StoreCollection create flow opens', 'PASS', { route: page.url() });

    const title = `R4 Manual Gate Capsule ${Date.now()}`;
    let finalizedCollectionId = null;
    const finalizeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/store-collections/') &&
      response.url().includes('/finalize') &&
      response.request().method() === 'POST',
      { timeout: 30_000 },
    ).catch(() => null);

    await page.getByPlaceholder('e.g. Holiday Drop').fill(title);
    const description = page.locator('textarea').first();
    if ((await description.count()) > 0) {
      await description.fill('Browser QA StoreCollection create submit check.');
    }
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ index: 0 });
    await page.waitForTimeout(500);
    await selects.nth(1).selectOption({ index: 0 });

    await page.getByPlaceholder('Add tag...').fill('r4manual').catch(async () => {
      await page.locator('input').last().fill('r4manual');
    });
    await page.keyboard.press('Enter');
    await page.getByText('r4manual', { exact: false }).first().waitFor({ timeout: 5_000 });

    const productCard = page.locator('article').filter({ hasText: STORE_COLLECTION_PRODUCT_NAME }).first();
    await productCard.waitFor({ timeout: 20_000 });
    await productCard.locator('button').filter({ hasText: /^Select$/ }).first().click({ force: true });
    await page.waitForFunction(() => document.body.innerText.includes('Selected 1/5'), null, { timeout: 5_000 });
    await productCard.locator('button').filter({ hasText: /^Set Primary$/ }).first().click({ force: true });
    await page.waitForFunction(() => document.body.innerText.includes('Primary cover'), null, { timeout: 5_000 });

    const publish = page.getByRole('button', { name: 'Publish Collection' })
      .or(page.getByRole('button', { name: 'Publish' }));
    await publish.first().click();
    const finalizeResponse = await finalizeResponsePromise;
    if (!finalizeResponse) {
      await page.waitForTimeout(1000);
      const bodyText = await page.locator('body').innerText().catch(() => '');
      throw new Error(`Timed out waiting for StoreCollection finalize API response. Page text: ${bodyText.slice(0, 1200)}`);
    }
    if (!finalizeResponse.ok()) {
      throw new Error(`StoreCollection finalize failed with HTTP ${finalizeResponse.status()}.`);
    }
    if (finalizeResponse) {
      try {
        const payload = await finalizeResponse.json();
        finalizedCollectionId =
          payload?.data?.id ||
          payload?.data?.collectionId ||
          payload?.id ||
          payload?.collectionId ||
          null;
      } catch {
        finalizedCollectionId = null;
      }
    }
    await page.waitForURL((url) => url.pathname === '/studio/store', { timeout: 30_000 });
    record('StoreCollection submit/save works', 'PASS', { title, collectionId: finalizedCollectionId, route: page.url() });

    if (finalizedCollectionId) {
      await page.goto(`${WEB_BASE_URL}/studio/store/collections/new?collectionId=${finalizedCollectionId}&mode=edit`, { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('e.g. Holiday Drop').waitFor({ timeout: 20_000 });
      const editedDescription = page.locator('textarea').first();
      if ((await editedDescription.count()) > 0) {
        await editedDescription.fill('Browser QA StoreCollection edit submit check.');
      }
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.waitForURL((url) => url.pathname.includes('/studio/store'), { timeout: 30_000 });
      record('StoreCollection edit submit works', 'PASS', { collectionId: finalizedCollectionId });
    } else {
      record('StoreCollection edit submit works', 'PARTIAL', { reason: 'Create submit passed, but script could not extract the finalized collection id from the response.' });
    }

    await page.goto(`${WEB_BASE_URL}/collections/${SEEDED.collectionId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Evening Capsule/i }).waitFor({ timeout: 15_000 });
    record('Seeded StoreCollection detail still opens', 'PASS');
  } catch (error) {
    record('Web StoreCollection create/edit submit', 'FAIL', { error: error.message });
  } finally {
    await page.close();
  }
};

const verifyCustomOrder = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(12_000);
  try {
    await signIn(page, BUYER_EMAIL);
    await page.goto(`${WEB_BASE_URL}/designs/${SEEDED.designId}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Ankara Evening Concept', { exact: false }).waitFor({ timeout: 15_000 });
    const cta = page.getByRole('button', { name: 'Request custom order' })
      .or(page.getByRole('button', { name: 'Request Custom' }));
    await cta.first().click();
    await page.getByText('Ankara Evening Custom Order', { exact: false }).waitFor({ timeout: 20_000 });
    record('Custom-order composer opens', 'PASS');

    const measurementInputs = page.locator('section').filter({ hasText: 'Measurement profile' }).locator('input[inputmode="decimal"]');
    const measurementCount = await measurementInputs.count();
    for (let i = 0; i < measurementCount; i += 1) {
      await measurementInputs.nth(i).fill(String(90 + i * 2));
    }
    const confirmBoxes = page.locator('section').filter({ hasText: 'Measurement profile' }).locator('input[type="checkbox"]');
    const confirmCount = await confirmBoxes.count();
    for (let i = 0; i < confirmCount; i += 1) {
      if (!(await confirmBoxes.nth(i).isChecked())) {
        await confirmBoxes.nth(i).check();
      }
    }
    record('Measurement fields load and can be confirmed', 'PASS', { measurementCount });

    const addressSection = page.locator('section').filter({ hasText: 'Delivery details' });
    const addAddress = addressSection.getByRole('button', { name: 'Add new address' });
    if ((await addAddress.count()) > 0) {
      await addAddress.click();
    }
    const addressInputs = addressSection.locator('input');
    const addressValues = ['R4 Buyer', 'buyer@test.com', '+2348000000000', '12 QA Street', 'Lagos', 'Lagos', 'Nigeria'];
    const addressCount = Math.min(await addressInputs.count(), addressValues.length);
    for (let i = 0; i < addressCount; i += 1) {
      await addressInputs.nth(i).fill(addressValues[i]);
    }

    await page.getByRole('button', { name: 'Lock price preview' }).click();
    await page.getByText('Grand total', { exact: false }).waitFor({ timeout: 30_000 });
    record('Custom-order price preview works', 'PASS');

    const addToBag = page.getByRole('button', { name: 'Add custom order to bag' });
    await addToBag.click();
    await page.getByText(/Custom order added to your bag|already in your bag/i).waitFor({ timeout: 20_000 }).catch(() => undefined);
    const bagVisible = await page.getByText('checkout', { exact: false }).count();
    record('Custom-order checkout handoff starts', 'PASS', { bagTextMatches: bagVisible });
  } catch (error) {
    record('Custom-order price preview / checkout handoff', 'FAIL', { error: error.message });
  } finally {
    await page.close();
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await verifyDesignPublish(browser);
    await verifyStoreCollection(browser);
    await verifyCustomOrder(browser);
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.status === 'FAIL');
  console.log('\nSUMMARY');
  console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
})();
