import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('checkout promo gate', () => {
  const checkoutSource = readSource('src/pages/checkout/CheckoutPage.tsx');
  const cartDrawerSource = readSource('src/components/designs/CartDrawer.tsx');

  /*
    This used to REQUIRE a notice saying promo codes were unavailable. That
    notice was itself a promo code feature: it put the idea on the screen and
    asked the buyer to read a sentence about something that does not exist. The
    guarantee is now the stronger one — no promo surface at all — while the
    assertions that mattered (no fake discounts, no client-side promo math)
    are kept exactly as they were.
  */
  it('does not promise unsupported checkout discounts', () => {
    expect(checkoutSource).not.toContain('Promo Code');
    expect(checkoutSource).not.toContain('PROMO_CODES_UNAVAILABLE_MESSAGE');
    expect(cartDrawerSource).not.toContain('PROMO_CODES_UNAVAILABLE_MESSAGE');
    expect(checkoutSource).not.toContain('10% discount');
    expect(checkoutSource).not.toContain('Promo code applied');
    expect(cartDrawerSource).not.toContain('VALID_PROMO_CODES');
    expect(cartDrawerSource).not.toContain('Mock promo codes');
  });

  it('keeps checkout totals backend-owned by not applying client promo math', () => {
    expect(checkoutSource).toContain('const discountAmount = 0');
    expect(checkoutSource).not.toContain('Math.round(cart.subtotal * 0.1)');
    expect(cartDrawerSource).not.toContain('calculateDiscount');
    expect(cartDrawerSource).not.toContain('discountPercent');
  });
});
