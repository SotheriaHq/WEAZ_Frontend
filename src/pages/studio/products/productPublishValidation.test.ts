import { describe, expect, it } from 'vitest';
import {
  MIN_PRODUCT_MEDIA,
  MIN_PRODUCT_VARIANTS,
  PRODUCT_PUBLISH_FIELD_ANCHOR,
  PRODUCT_PUBLISH_FIELD_LABEL,
  PRODUCT_PUBLISH_FIELD_STEP,
  fieldsForStep,
  firstIncompleteStep,
  validateProductForPublish,
  type ProductPublishInput,
} from './productPublishValidation';

const publishable = (
  overrides: Partial<ProductPublishInput> = {},
): ProductPublishInput => ({
  title: 'Ankara Bomber',
  description: 'A cropped bomber in hand-dyed ankara.',
  taxonomyCategoryId: 'cat-1',
  categoryTypeId: 'type-1',
  gender: 'EVERYBODY',
  tags: ['ankara'],
  price: 45000,
  minVariantPrice: 0,
  variantCount: MIN_PRODUCT_VARIANTS,
  hasDuplicateVariants: false,
  mediaCount: MIN_PRODUCT_MEDIA,
  hasCover: true,
  missingMediaSlots: [],
  styleDetailCount: 2,
  trackInventory: true,
  stock: 10,
  customOrderEnabled: false,
  ...overrides,
});

describe('validateProductForPublish', () => {
  it('passes a complete product', () => {
    expect(validateProductForPublish(publishable())).toEqual({});
    expect(firstIncompleteStep(validateProductForPublish(publishable()))).toBeNull();
  });

  it('catches the description gap that produced the SIT 400', () => {
    const errors = validateProductForPublish(publishable({ description: '   ' }));
    expect(errors.description).toBeTruthy();
    expect(firstIncompleteStep(errors)).toBe(1);
  });

  it.each([
    ['title', { title: '' }],
    ['taxonomyCategoryId', { taxonomyCategoryId: '' }],
    ['categoryTypeId', { categoryTypeId: '' }],
    ['styleDetails', { styleDetailCount: 0 }],
    ['tags', { tags: [] }],
  ])('flags a missing %s', (field, override) => {
    const errors = validateProductForPublish(publishable(override));
    expect(errors[field as keyof typeof errors]).toBeTruthy();
  });

  it('rejects an audience the server would reject', () => {
    expect(validateProductForPublish(publishable({ gender: 'UNISEX' })).gender).toBeTruthy();
    expect(validateProductForPublish(publishable({ gender: '' })).gender).toBeTruthy();
    for (const audience of ['MALE', 'FEMALE', 'EVERYBODY', 'everybody']) {
      expect(validateProductForPublish(publishable({ gender: audience })).gender).toBeUndefined();
    }
  });

  it('treats whitespace-only tags as no tags', () => {
    expect(validateProductForPublish(publishable({ tags: ['  ', ''] })).tags).toBeTruthy();
  });

  it('accepts variant-level pricing when the base price is 0', () => {
    const errors = validateProductForPublish(
      publishable({ price: 0, minVariantPrice: 12000 }),
    );
    expect(errors.price).toBeUndefined();
  });

  it('rejects a product with no price anywhere', () => {
    expect(
      validateProductForPublish(publishable({ price: 0, minVariantPrice: 0 })).price,
    ).toBeTruthy();
  });

  describe('media', () => {
    it('requires the minimum count', () => {
      const errors = validateProductForPublish(publishable({ mediaCount: 3 }));
      expect(errors.media).toContain(String(MIN_PRODUCT_MEDIA));
    });

    it('rejects more than the maximum', () => {
      expect(validateProductForPublish(publishable({ mediaCount: 7 })).media).toBeTruthy();
    });

    it('names the missing view slots once the count is satisfied', () => {
      const errors = validateProductForPublish(
        publishable({ missingMediaSlots: ['Back'] }),
      );
      expect(errors.media).toContain('Back');
    });

    it('asks for a cover only when there are images to choose from', () => {
      expect(validateProductForPublish(publishable({ hasCover: false })).cover).toBeTruthy();
      expect(
        validateProductForPublish(publishable({ hasCover: false, mediaCount: 0 })).cover,
      ).toBeUndefined();
    });
  });

  describe('variants', () => {
    it('counts down to the minimum', () => {
      const errors = validateProductForPublish(publishable({ variantCount: 4 }));
      expect(errors.variants).toContain('Add 1 more size variant');
    });

    it('reports duplicates ahead of the shortfall', () => {
      const errors = validateProductForPublish(
        publishable({ variantCount: 1, hasDuplicateVariants: true }),
      );
      expect(errors.variants).toContain('same size');
    });
  });

  describe('inventory', () => {
    it('blocks zero stock without custom orders', () => {
      expect(validateProductForPublish(publishable({ stock: 0 })).stock).toBeTruthy();
    });

    it('allows zero stock when custom orders are on', () => {
      expect(
        validateProductForPublish(publishable({ stock: 0, customOrderEnabled: true })).stock,
      ).toBeUndefined();
    });

    it('ignores stock entirely when inventory is untracked', () => {
      expect(
        validateProductForPublish(publishable({ trackInventory: false, stock: 0 })).stock,
      ).toBeUndefined();
    });

    it('rejects negative stock', () => {
      expect(validateProductForPublish(publishable({ stock: -1 })).stock).toBeTruthy();
    });
  });
});

describe('step routing', () => {
  it('splits blockers across the two editable steps', () => {
    const errors = validateProductForPublish(
      publishable({ description: '', variantCount: 0 }),
    );
    expect(fieldsForStep(errors, 1)).toContain('description');
    expect(fieldsForStep(errors, 2)).toContain('variants');
    expect(firstIncompleteStep(errors)).toBe(1);
  });

  it('points at step 2 when only operations are incomplete', () => {
    expect(firstIncompleteStep(validateProductForPublish(publishable({ stock: 0 })))).toBe(2);
  });

  it('gives every field a step, a label and an anchor', () => {
    const fields = Object.keys(PRODUCT_PUBLISH_FIELD_STEP) as Array<
      keyof typeof PRODUCT_PUBLISH_FIELD_STEP
    >;
    for (const field of fields) {
      expect(PRODUCT_PUBLISH_FIELD_LABEL[field]).toBeTruthy();
      expect(PRODUCT_PUBLISH_FIELD_ANCHOR[field]).toBeTruthy();
    }
    // A missing entry would silently drop a blocker from the "still needed"
    // bar while still disabling the button — the worst of both.
    const everythingMissing = validateProductForPublish({
      title: '',
      description: '',
      taxonomyCategoryId: '',
      categoryTypeId: '',
      gender: '',
      tags: [],
      price: 0,
      variantCount: 0,
      mediaCount: 0,
      hasCover: false,
      styleDetailCount: 0,
      trackInventory: true,
      stock: 0,
      customOrderEnabled: false,
    });
    for (const field of Object.keys(everythingMissing)) {
      expect(fields).toContain(field);
    }
  });
});
