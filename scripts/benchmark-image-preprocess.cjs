const { chromium } = require('@playwright/test');
function metrics(reference, result, width, height, channels) {
  let total = 0;
  let windows = 0;
  let squaredError = 0;
  let maximumError = 0;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      for (let c = 0; c < Math.min(channels, 3); c++) {
        let a = 0, b = 0, aa = 0, bb = 0, ab = 0, count = 0;
        for (let dy = 0; dy < 8 && y + dy < height; dy++) {
          for (let dx = 0; dx < 8 && x + dx < width; dx++) {
            const index = ((y + dy) * width + x + dx) * channels + c;
            const av = reference[index], bv = result[index];
            a += av; b += bv; aa += av * av; bb += bv * bv; ab += av * bv; count++;
            const error = Math.abs(av - bv);
            squaredError += error * error;
            maximumError = Math.max(maximumError, error);
          }
        }
        a /= count; b /= count;
        const va = Math.max(0, aa / count - a * a);
        const vb = Math.max(0, bb / count - b * b);
        const covariance = ab / count - a * b;
        total += ((2 * a * b + c1) * (2 * covariance + c2)) /
          ((a * a + b * b + c1) * (va + vb + c2));
        windows++;
      }
    }
  }
  const mse = squaredError / (width * height * Math.min(channels, 3));
  return { rgbSsim8x8: total / windows, psnrDb: mse ? 10 * Math.log10(255 ** 2 / mse) : null, maximumRgbError: maximumError };
}

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

async function main() {
  const label = process.argv[2] || 'candidate';
  if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid evidence label');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const baselineRef = 'b466a5847fd8f6cb98fbe22f1a1248b774e96e30';
    if (label === 'baseline') {
      const source = execFileSync('git', ['show', `${baselineRef}:src/utils/imagePreprocess.ts`], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
      const body = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
      await page.route('**/src/utils/imagePreprocess.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body }));
    }
    await page.goto('http://127.0.0.1:3000/e2e/fixtures/image-quality.html');
    const result = await page.evaluate(async (metricSource) => {
      const { preprocessImageFile } = await import('/src/utils/imagePreprocess.ts');
      const compare = (0, eval)(`(${metricSource})`);
      const canvas = document.createElement('canvas');
      canvas.width = 2400; canvas.height = 3200;
      const ctx = canvas.getContext('2d');
      const tile = document.createElement('canvas'); tile.width = 32; tile.height = 32;
      const paint = tile.getContext('2d');
      const colours = ['#b01c3f', '#e6a91e', '#165494', '#19885d'];
      for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) {
        paint.fillStyle = colours[(x / 2 + y / 2) % 4]; paint.fillRect(x, y, 2, 2);
      }
      ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, canvas.width, canvas.height);
      const shadow = ctx.createLinearGradient(0, 0, canvas.width, 0);
      shadow.addColorStop(0, 'rgba(0,0,0,.5)'); shadow.addColorStop(.5, 'rgba(0,0,0,0)');
      shadow.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = shadow; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([png], 'woven-stress.png', { type: 'image/png' });
      const original = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const started = performance.now();
      const processed = await preprocessImageFile(file, 'detail', { maxSizeBytes: 8 * 1024 * 1024, targetReductionRatio: .9, quality: .99 });
      const preprocessMs = performance.now() - started;
      const decoded = await createImageBitmap(processed.file);
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      const output = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const result = { fixture: '2400x3200 synthetic chromatic weave with folds', inputBytes: file.size,
        outputBytes: processed.file.size, outputWidth: decoded.width, outputHeight: decoded.height,
        skipped: processed.skipped, reason: processed.reason, preprocessMs,
        ...compare(original, output, canvas.width, canvas.height, 4),
      };
      decoded.close(); canvas.width = 0; canvas.height = 0;
      return result;
    }, metrics.toString());
    const output = path.resolve(__dirname, `../docs/performance/image-browser-${label}-2026-10-21.json`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), browser: browser.version(),
      baselineRef, limitations: 'One synthetic stress image and one processing sample; compare full reconstructed input resolution, not a human perceptual-quality percentage.', result }, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
