import { describe, expect, it } from 'vitest';
import type { MarketSectionItem } from '@/api/MarketApi';
import { getSectionItemClipType } from '@/utils/marketSectionMapper';

const itemOf = (entityType: MarketSectionItem['entityType']) =>
  ({ id: 'a', entityType }) as MarketSectionItem;

describe('getSectionItemClipType', () => {
  it.each(['PRODUCT', 'DESIGN', 'COLLECTION'] as const)('lets %s be clipped', (entityType) => {
    expect(getSectionItemClipType(itemOf(entityType))).toBe(entityType);
  });

  // Asking the API about these answered 500 for every signed-in Market visit.
  it.each(['BRAND', 'CATEGORY'] as const)('never treats %s as clippable', (entityType) => {
    expect(getSectionItemClipType(itemOf(entityType))).toBeNull();
  });
});
