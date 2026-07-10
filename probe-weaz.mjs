import { chromium } from '@playwright/test';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleLines = [];
  const failures = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLines.push(`[${msg.type()}] ${msg.text().slice(0, 500)}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleLines.push(`[pageerror] ${String(err).slice(0, 800)}`);
  });
  page.on('requestfailed', (req) => {
    failures.push(`[reqfail] ${req.failure()?.errorText} ${req.url().slice(0, 200)}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failures.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
    }
    const url = res.url();
    if (url.includes('/assets/') && url.endsWith('.js')) {
      const type = res.headers()['content-type'] || '?';
      if (!type.includes('javascript')) {
        failures.push(`[MIME ${res.status()} ${type}] cf-cache=${res.headers()['cf-cache-status'] ?? '?'} age=${res.headers()['age'] ?? '?'} ${url.slice(-70)}`);
      }
    }
  });

  await page.goto('https://weaz.me/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(20000);

  const bodyText = (await page.textContent('body'))?.replace(/\s+/g, ' ').slice(0, 300);
  console.log('BODY:', bodyText);
  console.log('--- console errors ---');
  consoleLines.slice(0, 30).forEach((line) => console.log(line));
  console.log('--- network failures ---');
  failures.slice(0, 30).forEach((line) => console.log(line));
  await browser.close();
};

run().catch((err) => {
  console.error('probe failed:', err);
  process.exit(1);
});
