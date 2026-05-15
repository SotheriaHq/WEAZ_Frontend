import { describe, expect, it } from 'vitest';
import { normalizeProductDto } from './ProductApi';

describe('normalizeProductDto', () => {
  it('uses backend product name as title when title is absent', () => {
    const product = normalizeProductDto({
      id: 'product-1',
      name: 'Ready-to-Wear Ankara Gown',
      price: 65000,
      currency: 'NGN',
      status: 'ACTIVE',
    } as any);

    expect(product?.title).toBe('Ready-to-Wear Ankara Gown');
    expect(product?.name).toBe('Ready-to-Wear Ankara Gown');
  });
});
