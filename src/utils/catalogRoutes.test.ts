import { describe, expect, it } from 'vitest';
import {
  buildCatalogEntityRoute,
  buildCollectionRoute,
  buildDesignRoute,
  buildProductRoute,
} from './catalogRoutes';

describe('catalog route helpers', () => {
  it('uses designId for design routes', () => {
    expect(buildDesignRoute({ designId: 'design-1' })).toBe('/designs/design-1');
    expect(buildDesignRoute({ designId: 'design-1', mode: 'edit' })).toBe('/designs/design-1/edit');
  });

  it('keeps legacy collection-backed design ids as compatibility fallback', () => {
    expect(buildDesignRoute({ legacyCollectionId: 'legacy-collection-1' })).toBe('/designs/legacy-collection-1');
    expect(
      buildDesignRoute({
        designId: 'design-1',
        legacyCollectionId: 'legacy-collection-1',
      }),
    ).toBe('/designs/design-1?legacyCollectionId=legacy-collection-1');
  });

  it('uses productId and collectionId for product and collection routes', () => {
    expect(buildProductRoute({ productId: 'product-1' })).toBe('/products/product-1');
    expect(buildProductRoute({ mode: 'create' })).toBe('/products/create');
    expect(buildCollectionRoute({ collectionId: 'collection-1' })).toBe('/collections/collection-1');
    expect(buildCollectionRoute({ collectionId: 'collection-1', mode: 'edit' })).toBe('/collections/collection-1/edit');
  });

  it('routes catalog entities through the matching domain helper', () => {
    expect(buildCatalogEntityRoute({ entityType: 'DESIGN', id: 'd1' })).toBe('/designs/d1');
    expect(buildCatalogEntityRoute({ entityType: 'PRODUCT', id: 'p1' })).toBe('/products/p1');
    expect(buildCatalogEntityRoute({ entityType: 'COLLECTION', id: 'c1' })).toBe('/collections/c1');
  });
});
