import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productApi, normalizeProductDto } from './ProductApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('./idempotency', () => ({
  createIdempotencyKey: () => 'test-idempotency-key',
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('productApi payload mapping', () => {
  it('sends gender while preserving category alias fields', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { id: 'product-1', title: 'Agbada', price: 1000, currency: 'NGN', status: 'ACTIVE' } },
    });

    await productApi.createProduct({
      title: 'Agbada',
      categoryId: 'category-1',
      categoryTypeId: 'subcategory-1',
      gender: 'MALE',
      tags: ['agbada'],
      filterValueIds: ['filter-1'],
      price: 1000,
      status: 'ACTIVE',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/products',
      expect.objectContaining({
        name: 'Agbada',
        categoryId: 'category-1',
        categoryTypeId: 'subcategory-1',
        subCategoryId: 'subcategory-1',
        gender: 'MALE',
        tags: ['agbada'],
        filterValueIds: ['filter-1'],
      }),
      expect.any(Object),
    );
  });
});
