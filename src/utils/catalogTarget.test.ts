import { describe, expect, it } from 'vitest';
import {
  buildCatalogTargetPayload,
  isCatalogTargetType,
  mapCatalogTargetForLegacyApi,
  normalizeCatalogTarget,
  toSavedItemRequest,
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

  it('strips the mapper breadcrumb out of a /saved request body', () => {
    // The backend validates this body with `forbidNonWhitelisted: true`, so an
    // extra property is a 400 rather than a field the server ignores. Clipping
    // a design sent `legacyCollectionId` and got exactly that.
    const request = toSavedItemRequest(
      mapCatalogTargetForLegacyApi({
        targetType: 'DESIGN',
        designId: 'design-1',
        legacyCollectionId: 'collection-1',
      }),
    );

    expect(request).toEqual({ targetType: 'COLLECTION', targetId: 'collection-1' });
    expect(Object.keys(request).sort()).toEqual(['targetId', 'targetType']);
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
