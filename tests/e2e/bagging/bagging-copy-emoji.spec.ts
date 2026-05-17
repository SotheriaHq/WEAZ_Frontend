import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLoggedOut } from '../helpers/auth';
import { clickBagIt, expectAuthPrompt, openSeedPath } from '../helpers/bagging';
import { baggingSeed, requiresSeed, seedMissingReason } from '../helpers/test-data';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '../../..');

const sourceFile = (relativePath: string) => path.join(repoRoot, relativePath);

test.describe('bagging copy and emoji contract', () => {
  test('Bag It and My Bag emoji constants back touched buyer flows', async () => {
    const constants = await readFile(sourceFile('src/constants/bagging.ts'), 'utf8');
    expect(constants).toContain('BAG_IT_EMOJI');
    expect(constants).toContain('MY_BAG_EMOJI');
    expect(constants).toContain('0x1f6cd');
    expect(constants).toContain('0x1f9fa');

    const touchedBuyerFiles = [
      'src/components/auth/AuthRequiredPrompt.tsx',
      'src/components/bagging/BagFittingsModal.tsx',
      'src/components/bagging/BagPulseIcon.tsx',
      'src/components/catalog/InlineProductDetail.tsx',
      'src/components/designs/CartDrawer.tsx',
      'src/components/designs/DesignCard.tsx',
      'src/components/designs/DesignViewModal.tsx',
      'src/components/designs/ProductDetailModal.tsx',
      'src/components/designs/StoreProductCard.tsx',
      'src/components/designs/WishlistDrawer.tsx',
      'src/components/Navbar.tsx',
      'src/pages/catalog/ProductDetailsPage.tsx',
      'src/pages/checkout/CheckoutPage.tsx',
    ];

    const contents = await Promise.all(
      touchedBuyerFiles.map(async (file) => ({
        file,
        text: await readFile(sourceFile(file), 'utf8'),
      })),
    );

    for (const { file, text } of contents) {
      expect(text, `${file} should not render Add to Cart copy`).not.toMatch(/Add to Cart/);
      expect(text, `${file} should not render cart emoji in bag flows`).not.toContain('🛒');
      expect(text, `${file} should not keep Request Custom CTA copy`).not.toContain('Request Custom');
    }
  });

  test('logged-out Bag It prompts auth when seed path is configured', async ({ page }) => {
    test.skip(!requiresSeed(baggingSeed.loggedOutBagPath), seedMissingReason('logged-out Bag It auth prompt'));

    await ensureLoggedOut(page);
    await openSeedPath(page, baggingSeed.loggedOutBagPath);
    await clickBagIt(page);
    await expectAuthPrompt(page);
  });
});
