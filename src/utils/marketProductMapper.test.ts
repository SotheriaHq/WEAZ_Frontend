import { describe, expect, it } from 'vitest';
import { normalizeMarketProduct } from './marketProductMapper';

describe('normalizeMarketProduct', () => {
  it('maps explicit product rows from the fresh market endpoint', () => {
    const product = normalizeMarketProduct({
      id: 'product-1',
      entityType: 'PRODUCT',
      name: 'Ready-to-Wear Ankara Gown',
      price: 65000,
      totalStock: 8,
      brand: { id: 'brand-1', name: 'Threadly Atelier', currency: 'NGN' },
      images: ['https://threadly.local/uploads/seed/design/domain-sample-1.jpg'],
      media: [{ id: 'media-1', url: 'https://threadly.local/uploads/seed/design/domain-sample-1.jpg', type: 'image', isPrimary: true }],
      sizes: ['S', 'M'],
    });

    expect(product?.entityType).toBe('PRODUCT');
    expect(product?.id).toBe('product-1');
    expect(product?.name).toBe('Ready-to-Wear Ankara Gown');
    expect(product?.brand.name).toBe('Threadly Atelier');
    expect(product?.sizeAvailability).toEqual([
      { size: 'S', inStock: true, quantity: 8 },
      { size: 'M', inStock: true, quantity: 8 },
    ]);
  });

  it('falls back from title to name-compatible product card data', () => {
    const product = normalizeMarketProduct({
      id: 'product-2',
      title: 'Titled Product',
      price: 100,
      brandId: 'brand-2',
    });

    expect(product?.name).toBe('Titled Product');
    expect(product?.entityType).toBe('PRODUCT');
  });
});
