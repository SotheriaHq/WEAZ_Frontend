import { describe, expect, it } from 'vitest';
import { resolveCatalogEntityType } from './catalogEntity';

describe('resolveCatalogEntityType', () => {
  it('keeps explicit entity types', () => {
    expect(resolveCatalogEntityType({ entityType: 'DESIGN' })).toBe('DESIGN');
    expect(resolveCatalogEntityType({ entityType: 'PRODUCT' })).toBe('PRODUCT');
    expect(resolveCatalogEntityType({ entityType: 'COLLECTION' })).toBe('COLLECTION');
  });

  it('maps legacy design feed records', () => {
    expect(resolveCatalogEntityType({ sourceType: 'COLLECTION_MEDIA' })).toBe('DESIGN');
    expect(resolveCatalogEntityType({ domain: 'DESIGN', medias: [] })).toBe('DESIGN');
  });

  it('maps product and collection signals', () => {
    expect(resolveCatalogEntityType({ price: 20, totalStock: 3 })).toBe('PRODUCT');
    expect(resolveCatalogEntityType({ domain: 'STORE', products: [] })).toBe('COLLECTION');
  });

  it('uses fallback only for ambiguous records', () => {
    expect(resolveCatalogEntityType({ id: 'legacy' })).toBeNull();
    expect(resolveCatalogEntityType({ id: 'legacy' }, 'DESIGN')).toBe('DESIGN');
  });
});
