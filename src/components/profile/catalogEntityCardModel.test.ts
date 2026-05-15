import { describe, expect, it } from 'vitest';
import {
  getCatalogEntityCardCopy,
  resolveCatalogEntityCardBranch,
} from './catalogEntityCardModel';

describe('catalogEntityCardModel', () => {
  it('resolves explicit entity card branches', () => {
    expect(resolveCatalogEntityCardBranch({ entityType: 'DESIGN' })).toBe('design');
    expect(resolveCatalogEntityCardBranch({ entityType: 'PRODUCT' })).toBe('product');
    expect(resolveCatalogEntityCardBranch({ entityType: 'COLLECTION' })).toBe('collection');
  });

  it('keeps ambiguous legacy rows on the compatible legacy branch', () => {
    expect(resolveCatalogEntityCardBranch({ id: 'legacy', title: 'Untyped' })).toBe('legacy');
  });

  it('keeps design, product, and collection primary actions separate', () => {
    expect(getCatalogEntityCardCopy('design').primaryActionKind).toBe('view-design');
    expect(getCatalogEntityCardCopy('product').primaryActionKind).toBe('view-product');
    expect(getCatalogEntityCardCopy('collection').primaryActionKind).toBe('view-collection');
  });

  it('does not give design or collection branches product-only copy', () => {
    expect(getCatalogEntityCardCopy('design').viewLabel.toLowerCase()).not.toContain('cart');
    expect(getCatalogEntityCardCopy('design').viewLabel.toLowerCase()).not.toContain('bag');
    expect(getCatalogEntityCardCopy('collection').viewLabel.toLowerCase()).not.toContain('cart');
    expect(getCatalogEntityCardCopy('collection').viewLabel.toLowerCase()).not.toContain('bag');
  });
});
