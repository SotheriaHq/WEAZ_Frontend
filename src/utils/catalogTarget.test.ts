import { describe, expect, it } from 'vitest';
import {
  buildCatalogTargetPayload,
  isCatalogTargetType,
  mapCatalogTargetForLegacyApi,
  normalizeCatalogTarget,
} from './catalogTarget';

describe('catalogTarget', () => {
  it('builds design targets with legacy collection compatibility', () => {
    expect(
      buildCatalogTargetPayload({
        targetType: 'DESIGN',
        designId: 'design-1',
        legacyCollectionId: 'collection-1',
      }),
    ).toEqual({
      targetType: 'DESIGN',
      targetId: 'design-1',
      designId: 'design-1',
      legacyCollectionId: 'collection-1',
      collectionId: 'collection-1',
    });
  });

  it('builds product targets', () => {
    expect(buildCatalogTargetPayload({ targetType: 'PRODUCT', productId: 'product-1' })).toEqual({
      targetType: 'PRODUCT',
      targetId: 'product-1',
      productId: 'product-1',
    });
  });

  it('builds collection targets', () => {
    expect(buildCatalogTargetPayload({ targetType: 'COLLECTION', collectionId: 'collection-1' })).toEqual({
      targetType: 'COLLECTION',
      targetId: 'collection-1',
      collectionId: 'collection-1',
    });
  });

  it('maps design targets to legacy saved/comment API payloads', () => {
    expect(
      mapCatalogTargetForLegacyApi({
        targetType: 'DESIGN',
        designId: 'design-1',
        legacyCollectionId: 'collection-1',
      }),
    ).toEqual({
      targetType: 'COLLECTION',
      targetId: 'collection-1',
      legacyCollectionId: 'collection-1',
    });
  });

  it('does not guess targetId-only payloads', () => {
    expect(normalizeCatalogTarget({ targetId: 'ambiguous-1' })).toBeNull();
    expect(() => buildCatalogTargetPayload({ targetId: 'ambiguous-1' })).toThrow(
      /DESIGN, PRODUCT, or COLLECTION/,
    );
  });

  it('guards catalog target types', () => {
    expect(isCatalogTargetType('DESIGN')).toBe(true);
    expect(isCatalogTargetType('COLLECTION_MEDIA')).toBe(false);
  });
});
