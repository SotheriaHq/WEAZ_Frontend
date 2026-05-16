const V1_EXCLUDED_CATEGORY_SLUGS = new Set([
  'accessories',
  'accessory',
  'footwear',
  'shoes',
  'shoe',
  'bags',
  'bag',
  'jewelry',
  'jewellery',
  'watches',
  'watch',
  'cosmetics',
  'beauty',
  'perfume',
  'perfumes',
]);

const normalizeTaxonomyToken = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function isV1ExcludedCategoryOption(option: {
  slug?: string | null;
  name?: string | null;
  id?: string | null;
}) {
  const slug = normalizeTaxonomyToken(option.slug);
  const name = normalizeTaxonomyToken(option.name);
  const id = normalizeTaxonomyToken(option.id);

  return (
    V1_EXCLUDED_CATEGORY_SLUGS.has(slug) ||
    V1_EXCLUDED_CATEGORY_SLUGS.has(name) ||
    V1_EXCLUDED_CATEGORY_SLUGS.has(id)
  );
}

export function filterV1GarmentCategories<T extends { slug?: string | null; name?: string | null; id?: string | null }>(
  categories: T[],
): T[] {
  return categories.filter((category) => !isV1ExcludedCategoryOption(category));
}
