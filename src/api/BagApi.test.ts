import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BagApi } from './BagApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('BagApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps combined bag count from the backend response envelope', async () => {
    mockedApiClient.get.mockResolvedValueOnce({
      data: {
        statusCode: 200,
        data: {
          standardQuantity: 2,
          customLineCount: 1,
          combinedCount: 3,
        },
      },
    });

    await expect(BagApi.getBagCount()).resolves.toEqual({
      standardQuantity: 2,
      customLineCount: 1,
      combinedCount: 3,
    });
    expect(mockedApiClient.get).toHaveBeenCalledWith('/bag/count');
  });

  it('wraps product and source status endpoints with bag-named methods', async () => {
    const status = {
      productId: 'product_1',
      canBag: true,
      bagMode: 'STANDARD',
      standard: { available: true, alreadyBagged: false },
      custom: { available: false, alreadyBagged: false },
      ui: { defaultAction: 'ADD_STANDARD' },
    };
    mockedApiClient.get
      .mockResolvedValueOnce({ data: { data: status } })
      .mockResolvedValueOnce({ data: { data: { ...status, sourceType: 'DESIGN' } } });

    await expect(BagApi.getProductBagStatus('product_1')).resolves.toEqual(status);
    await expect(BagApi.getSourceBagStatus('DESIGN', 'design_1')).resolves.toEqual({
      ...status,
      sourceType: 'DESIGN',
    });

    expect(mockedApiClient.get).toHaveBeenNthCalledWith(1, '/store/products/product_1/bag-status');
    expect(mockedApiClient.get).toHaveBeenNthCalledWith(2, '/bag/sources/DESIGN/design_1/status');
  });

  it('keeps standard and custom bag compatibility endpoints behind bag method names', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ data: { data: { items: [], itemCount: 0, subtotal: 0 } } });
    mockedApiClient.delete.mockResolvedValueOnce({ data: { data: { removed: true } } });

    await BagApi.addStandardToBag({ productId: 'product_1', quantity: 1 });
    await expect(BagApi.removeCustomBagLine('session_1')).resolves.toEqual({ removed: true });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/store/cart', {
      productId: 'product_1',
      quantity: 1,
    });
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/custom-orders/checkout-sessions/session_1');
  });

  it('uses collection bagging endpoints instead of standard cart endpoints for collection mutations', async () => {
    const status = {
      sourceType: 'COLLECTION',
      sourceId: 'collection_1',
      collection: { id: 'collection_1', title: 'Drop', productCount: 1 },
      summary: { canBagAll: true, canBagSelected: true },
      products: [],
      ui: { defaultAction: 'BAG_ALL', disabledReason: null },
      featureFlags: { collectionReviewsEnabled: false },
    };
    const mutation = {
      collectionId: 'collection_1',
      added: [{ productId: 'product_1', bagItemId: 'cart_1', quantity: 1 }],
      skipped: [],
      blocked: [],
      summary: { addedCount: 1, skippedCount: 0, blockedCount: 0, combinedBagCount: 1 },
    };
    mockedApiClient.get.mockResolvedValueOnce({ data: { data: status } });
    mockedApiClient.post
      .mockResolvedValueOnce({ data: { data: mutation } })
      .mockResolvedValueOnce({ data: { data: mutation } });

    await expect(BagApi.getCollectionBagStatus('collection_1')).resolves.toEqual(status);
    await expect(BagApi.bagCollectionAll('collection_1')).resolves.toEqual(mutation);
    await expect(
      BagApi.bagCollectionSelected('collection_1', {
        productIds: ['product_1'],
        selections: { product_1: { selectedSize: 'M', selectedColor: 'Black', quantity: 1 } },
      }),
    ).resolves.toEqual(mutation);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/bag/sources/COLLECTION/collection_1/status');
    expect(mockedApiClient.post).toHaveBeenNthCalledWith(1, '/bag/collections/collection_1/bag-all', {});
    expect(mockedApiClient.post).toHaveBeenNthCalledWith(2, '/bag/collections/collection_1/bag-selected', {
      productIds: ['product_1'],
      selections: { product_1: { selectedSize: 'M', selectedColor: 'Black', quantity: 1 } },
    });
  });
});
