export type DesignAudienceValue = 'MALE' | 'FEMALE' | 'EVERYBODY';
export type DesignAgeGroupValue = 'ADULT' | 'CHILD';

export type DesignCategoryLike = {
  id: string;
  slug?: string | null;
  name?: string | null;
  types?: DesignCategoryTypeLike[];
};

export type DesignCategoryTypeLike = {
  id: string;
  slug?: string | null;
  name?: string | null;
};

const normalizeToken = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const textFor = (value: { slug?: string | null; name?: string | null; id?: string | null }) =>
  [value.slug, value.name, value.id].map(normalizeToken).filter(Boolean).join(' ');

const containsAny = (haystack: string, needles: string[]) =>
  needles.some((needle) => haystack.includes(needle));

const WOMENSWEAR_CATEGORY_ONLY_TERMS = [
  'dresses-gowns',
  'dress',
  'gown',
  'skirts',
  'skirt',
];

const MENSWEAR_CATEGORY_ONLY_TERMS = [
  'senator-wear',
  'senator',
];

const WOMENSWEAR_TYPE_ONLY_TERMS = [
  'dress',
  'gown',
  'skirt',
  'blouse',
  'crop-top',
  'peplum',
  'bridesmaid',
  'bridal-gown',
  'reception-dress',
  'bridal-robe',
  'buba-and-wrapper',
  'iro-and-buba',
];

const MENSWEAR_TYPE_ONLY_TERMS = [
  'senator',
  'tuxedo',
  'waistcoat',
  'groom-traditional',
];

export function isDesignCategoryAllowedForAudience(
  category: DesignCategoryLike,
  audience: DesignAudienceValue,
  _ageGroup: DesignAgeGroupValue,
) {
  const text = textFor(category);
  if (audience === 'MALE') {
    return !containsAny(text, WOMENSWEAR_CATEGORY_ONLY_TERMS);
  }
  if (audience === 'FEMALE') {
    return !containsAny(text, MENSWEAR_CATEGORY_ONLY_TERMS);
  }
  return true;
}

export function isDesignCategoryTypeAllowedForAudience(
  categoryType: DesignCategoryTypeLike,
  audience: DesignAudienceValue,
  _ageGroup: DesignAgeGroupValue,
) {
  const text = textFor(categoryType);
  if (audience === 'MALE') {
    return !containsAny(text, WOMENSWEAR_TYPE_ONLY_TERMS);
  }
  if (audience === 'FEMALE') {
    return !containsAny(text, MENSWEAR_TYPE_ONLY_TERMS);
  }
  return true;
}

export function filterDesignCategoryTypesForAudience<T extends DesignCategoryTypeLike>(
  categoryTypes: T[],
  audience: DesignAudienceValue,
  ageGroup: DesignAgeGroupValue,
): T[] {
  return categoryTypes.filter((categoryType) =>
    isDesignCategoryTypeAllowedForAudience(categoryType, audience, ageGroup),
  );
}

export function filterDesignCategoriesForAudience<T extends DesignCategoryLike>(
  categories: T[],
  audience: DesignAudienceValue,
  ageGroup: DesignAgeGroupValue,
): T[] {
  return categories
    .filter((category) => isDesignCategoryAllowedForAudience(category, audience, ageGroup))
    .map((category) => {
      const types = Array.isArray(category.types)
        ? filterDesignCategoryTypesForAudience(category.types, audience, ageGroup)
        : [];
      return { ...category, types };
    })
    .filter((category) => !Array.isArray(category.types) || category.types.length > 0);
}
