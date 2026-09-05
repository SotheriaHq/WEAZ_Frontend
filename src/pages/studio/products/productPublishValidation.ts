/**
 * Client-side mirror of the backend's product publish contract.
 *
 * `StoreService.assertPublishReady` (plus `assertProductStructuredFiltersForPublish`)
 * is the authority on what a publishable product needs. The wizard used to
 * check only two of those thirteen rules — title and a cover image — so the
 * remaining eleven were discovered by the server, mid-submit, as a toast: a
 * brand answering an admin's change request got "Product description is
 * required" AFTER pressing Submit on step 3, with nothing marking the field
 * back on step 1. (SIT, 2026-08-09: two consecutive `HTTP 400 - PATCH
 * /products/943b12ff…` with exactly that message.)
 *
 * Keeping the rules here — as data, not scattered `&&` chains — lets the wizard
 * disable Continue/Submit, point at the offending field, and name what's
 * missing, all from one source. This does NOT replace the server checks; it
 * makes hitting them the exception rather than the normal way to learn what a
 * product needs.
 *
 * When `assertPublishReady` changes, change this too — `MIN_PRODUCT_MEDIA`,
 * `MAX_PRODUCT_MEDIA` and `MIN_PRODUCT_VARIANTS` intentionally repeat the
 * backend's private fields so a drift shows up as a failing test rather than a
 * mid-submit 400.
 */

export const MIN_PRODUCT_MEDIA = 4;
export const MAX_PRODUCT_MEDIA = 6;
export const MIN_PRODUCT_VARIANTS = 5;

const VALID_AUDIENCES = new Set(['MALE', 'FEMALE', 'EVERYBODY']);

export type ProductPublishField =
  | 'media'
  | 'cover'
  | 'title'
  | 'taxonomyCategoryId'
  | 'categoryTypeId'
  | 'gender'
  | 'styleDetails'
  | 'tags'
  | 'description'
  | 'price'
  | 'variants'
  | 'stock';

/** Which wizard step owns each field, so a failure can be pointed at. */
export const PRODUCT_PUBLISH_FIELD_STEP: Record<ProductPublishField, 1 | 2> = {
  media: 1,
  cover: 1,
  title: 1,
  taxonomyCategoryId: 1,
  categoryTypeId: 1,
  gender: 1,
  styleDetails: 1,
  tags: 1,
  description: 1,
  price: 2,
  variants: 2,
  stock: 2,
};

/**
 * Short names for the "still needed" summary. The full sentence lives in the
 * inline error next to the field; this is what fits on a chip.
 */
export const PRODUCT_PUBLISH_FIELD_LABEL: Record<ProductPublishField, string> = {
  media: 'Product images',
  cover: 'Cover image',
  title: 'Product title',
  taxonomyCategoryId: 'What is it?',
  categoryTypeId: 'Garment type',
  gender: 'Who is it for?',
  styleDetails: 'Style details',
  tags: 'Hashtags',
  description: 'Description',
  price: 'Price',
  variants: 'Size variants',
  stock: 'Inventory',
};

/**
 * DOM ids the wizard anchors to when the reader taps a missing-field chip.
 * Kept next to the field list so adding a rule forces a decision about where
 * it points.
 */
export const PRODUCT_PUBLISH_FIELD_ANCHOR: Record<ProductPublishField, string> = {
  media: 'product-media-section',
  cover: 'product-media-section',
  title: 'product-title-field',
  taxonomyCategoryId: 'product-category-section',
  categoryTypeId: 'product-category-section',
  gender: 'product-category-section',
  styleDetails: 'product-style-details-field',
  tags: 'product-hashtags-field',
  description: 'product-description-field',
  price: 'product-pricing-section',
  variants: 'product-variants-section',
  stock: 'product-inventory-section',
};

export interface ProductPublishInput {
  title: string;
  description: string;
  taxonomyCategoryId: string;
  categoryTypeId: string;
  gender: string;
  tags: string[];
  price: number;
  /** Lowest variant price, used when the base price is left at 0. */
  minVariantPrice?: number;
  variantCount: number;
  hasDuplicateVariants?: boolean;
  mediaCount: number;
  hasCover: boolean;
  /** Required view slots (front/left/right/back) not yet filled. */
  missingMediaSlots?: string[];
  styleDetailCount: number;
  trackInventory: boolean;
  stock: number;
  customOrderEnabled: boolean;
}

export type ProductPublishErrors = Partial<Record<ProductPublishField, string>>;

export function validateProductForPublish(
  input: ProductPublishInput,
): ProductPublishErrors {
  const errors: ProductPublishErrors = {};

  if (!input.title.trim()) {
    errors.title = 'Give this product a title.';
  }

  if (!input.description.trim()) {
    errors.description =
      'Describe the product — buyers see this on the product page.';
  }

  if (!input.taxonomyCategoryId.trim()) {
    errors.taxonomyCategoryId = 'Choose what this item is.';
  }

  if (!input.categoryTypeId.trim()) {
    errors.categoryTypeId = 'Choose a garment type.';
  }

  if (!VALID_AUDIENCES.has(String(input.gender ?? '').toUpperCase())) {
    errors.gender = 'Choose who this item is for.';
  }

  if (input.styleDetailCount <= 0) {
    errors.styleDetails = 'Add at least one style detail.';
  }

  if (input.tags.filter((tag) => tag.trim().length > 0).length === 0) {
    errors.tags = 'Add at least one hashtag.';
  }

  if (input.mediaCount < MIN_PRODUCT_MEDIA) {
    errors.media = `Upload at least ${MIN_PRODUCT_MEDIA} images: front, left, right, and back.`;
  } else if (input.mediaCount > MAX_PRODUCT_MEDIA) {
    errors.media = `You can upload up to ${MAX_PRODUCT_MEDIA} images.`;
  } else if (input.missingMediaSlots?.length) {
    errors.media = `Add ${input.missingMediaSlots.join(', ')} before submitting.`;
  }

  if (!input.hasCover && input.mediaCount > 0) {
    errors.cover = 'Pick one image as the cover.';
  }

  // The server accepts a base price OR variant-level pricing, so the wizard
  // must too — gating on `price > 0` alone would block a perfectly valid
  // product that prices every size individually.
  const effectivePrice = input.price > 0 ? input.price : (input.minVariantPrice ?? 0);
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    errors.price = 'Set a price above 0.';
  }

  if (input.hasDuplicateVariants) {
    errors.variants = 'Two variants share the same size and colour — remove one.';
  } else if (input.variantCount < MIN_PRODUCT_VARIANTS) {
    const remaining = MIN_PRODUCT_VARIANTS - input.variantCount;
    errors.variants = `Add ${remaining} more size ${
      remaining === 1 ? 'variant' : 'variants'
    } (${MIN_PRODUCT_VARIANTS} minimum).`;
  }

  if (input.trackInventory) {
    if (!Number.isFinite(input.stock) || input.stock < 0) {
      errors.stock = 'Stock must be 0 or greater.';
    } else if (input.stock <= 0 && !input.customOrderEnabled) {
      errors.stock =
        'Add stock, or turn on custom orders so buyers can still order this.';
    }
  }

  return errors;
}

/** Field keys for one wizard step, in the order they appear on screen. */
export function fieldsForStep(
  errors: ProductPublishErrors,
  step: 1 | 2,
): ProductPublishField[] {
  return (Object.keys(PRODUCT_PUBLISH_FIELD_STEP) as ProductPublishField[]).filter(
    (field) => PRODUCT_PUBLISH_FIELD_STEP[field] === step && Boolean(errors[field]),
  );
}

/** Earliest step still holding a blocker, or null when ready to submit. */
export function firstIncompleteStep(errors: ProductPublishErrors): 1 | 2 | null {
  if (fieldsForStep(errors, 1).length > 0) return 1;
  if (fieldsForStep(errors, 2).length > 0) return 2;
  return null;
}
