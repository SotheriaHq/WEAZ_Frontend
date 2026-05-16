import { describe, expect, it } from 'vitest';
import { filterDesignCategoriesForAudience } from './designAudienceApplicability';

const categories = [
  {
    id: 'dresses',
    slug: 'dresses-gowns',
    name: 'Dresses & Gowns',
    types: [{ id: 'maxi', slug: 'maxi-dress', name: 'Maxi dress' }],
  },
  {
    id: 'tops',
    slug: 'tops-shirts',
    name: 'Tops & Shirts',
    types: [
      { id: 'tee', slug: 't-shirt', name: 'T-shirt' },
      { id: 'blouse', slug: 'blouse', name: 'Blouse' },
    ],
  },
  {
    id: 'senator',
    slug: 'senator-wear',
    name: 'Senator Wear',
    types: [{ id: 'two-piece-senator', slug: 'two-piece-senator', name: 'Two-piece senator' }],
  },
  {
    id: 'native',
    slug: 'native-sets',
    name: 'Native Sets',
    types: [{ id: 'traditional-set', slug: 'traditional-set', name: 'Traditional set' }],
  },
];

describe('design audience applicability', () => {
  it('removes obviously womenswear-only garment options for menswear', () => {
    const result = filterDesignCategoriesForAudience(categories, 'MALE', 'ADULT');

    expect(result.map((category) => category.slug)).not.toContain('dresses-gowns');
    expect(result.find((category) => category.slug === 'tops-shirts')?.types.map((type) => type.slug)).toEqual(['t-shirt']);
  });

  it('removes obviously menswear-only garment options for womenswear', () => {
    const result = filterDesignCategoriesForAudience(categories, 'FEMALE', 'ADULT');

    expect(result.map((category) => category.slug)).not.toContain('senator-wear');
    expect(result.map((category) => category.slug)).toContain('dresses-gowns');
  });

  it('keeps broad garment options for unisex/everybody', () => {
    const result = filterDesignCategoriesForAudience(categories, 'EVERYBODY', 'CHILD');

    expect(result.map((category) => category.slug)).toEqual([
      'dresses-gowns',
      'tops-shirts',
      'senator-wear',
      'native-sets',
    ]);
  });
});
