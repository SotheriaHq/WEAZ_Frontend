import { describe, expect, it } from 'vitest';
import { routeForSavedItem } from './savedItemRoute';

describe('routeForSavedItem', () => {
  it('opens a clipped design in the content view, not the market listing', () => {
    /*
      This is the shape `/saved/me` returns for a design clipped from the
      Runway: the API stores designs as COLLECTION rows, so `targetType` says
      COLLECTION and only the collection's own `domain` distinguishes it from a
      store collection.

      It used to route to `/collections/:id`, which probed the API and then
      redirected to `/market?openDesign=` — a parameter `/market` never reads.
    */
    const route = routeForSavedItem({
      targetType: 'COLLECTION',
      targetId: 'collection-1',
      collectionId: 'collection-1',
      domain: 'DESIGN',
      isAvailableInStore: false,
    });

    expect(route).toBe('/designs/collection-1');
  });

  it('still opens a real store collection as a collection', () => {
    expect(
      routeForSavedItem({
        targetType: 'COLLECTION',
        targetId: 'collection-2',
        collectionId: 'collection-2',
        domain: 'STORE',
        isAvailableInStore: true,
      }),
    ).toBe('/collections/collection-2');

    // `isAvailableInStore` alone is enough — a DESIGN-domain collection that
    // has been opened for sale is still shopped as a collection.
    expect(
      routeForSavedItem({
        targetType: 'COLLECTION',
        targetId: 'collection-3',
        domain: 'DESIGN',
        isAvailableInStore: true,
      }),
    ).toBe('/collections/collection-3');
  });

  it('opens the exact frame a COLLECTION_MEDIA row was clipped from', () => {
    expect(
      routeForSavedItem({
        targetType: 'COLLECTION_MEDIA',
        targetId: 'media-1',
        collectionId: 'collection-4',
        mediaId: 'media-1',
      }),
    ).toBe('/designs/collection-4?openMedia=media-1');
  });

  it('routes products to the product view', () => {
    expect(
      routeForSavedItem({ targetType: 'PRODUCT', targetId: 'product-1' }),
    ).toBe('/products/product-1');
  });

  it('returns null when there is nothing to open', () => {
    expect(routeForSavedItem({ targetType: 'COLLECTION', targetId: '' })).toBeNull();
    expect(routeForSavedItem({ targetType: 'COLLECTION_MEDIA', targetId: 'media-2' })).toBeNull();
  });
});
