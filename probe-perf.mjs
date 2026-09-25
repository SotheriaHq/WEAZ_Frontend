import { chromium } from '@playwright/test';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const t0 = Date.now();
  const apiCalls = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('api.weaz.me')) return;
    const req = res.request();
    const timing = req.timing();
    apiCalls.push({
      path: url.replace('https://api.weaz.me', '').slice(0, 90),
      startedAt: Math.round(timing.startTime > 0 ? Date.now() - t0 - (timing.responseEnd - timing.startTime) : Date.now() - t0),
      status: res.status(),
    });
  });

  await page.goto('https://weaz.me/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const tDom = Date.now() - t0;

  // Wait for first real content image (product/design card) to be visible.
  let tFirstImage = null;
  try {
    await page.waitForSelector('img[src*="amazonaws"], img[src*="X-Amz"], img[src*="cloudfront"]', { timeout: 30000, state: 'visible' });
    tFirstImage = Date.now() - t0;
  } catch { /* none appeared */ }

  await page.waitForTimeout(12000);
  const tEnd = Date.now() - t0;

  const skeletons = await page.locator('[class*="animate-pulse"]').count();
  const images = await page.locator('img').count();

  console.log(`domcontentloaded: ${tDom}ms`);
  console.log(`first content image visible: ${tFirstImage ?? 'NEVER'}ms`);
  console.log(`at ${tEnd}ms: ${skeletons} skeleton nodes still pulsing, ${images} imgs`);
  console.log(`total api.weaz.me requests: ${apiCalls.length}`);

  const byPath = new Map();
  for (const c of apiCalls) {
    const key = c.path.split('?')[0].replace(/[0-9a-f-]{20,}/g, ':id');
    byPath.set(key, (byPath.get(key) || 0) + 1);
  }
  console.log('--- request counts by endpoint ---');
  [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`${String(v).padStart(3)}  ${k}`));

  console.log('--- first 25 requests (ms offset from nav) ---');
  apiCalls.slice(0, 25).forEach((c) => console.log(`${String(c.startedAt).padStart(6)}ms  ${c.status}  ${c.path.split('?')[0]}`));

  await browser.close();
};

run().catch((err) => { console.error('probe failed:', err); process.exit(1); });
