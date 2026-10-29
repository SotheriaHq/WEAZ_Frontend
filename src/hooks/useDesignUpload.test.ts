import { describe, expect, it, vi } from 'vitest';
import { buildDesignUploadMetadata, resolvePresignedUploadMethod } from './useDesignUpload';

vi.mock('../api/httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api/idempotency', () => ({
  createIdempotencyKey: () => 'idem-design-test',
}));

describe('useDesignUpload contract helpers', () => {
  it('builds design metadata with subCategoryId and categoryTypeId compatibility', () => {
    const metadata = buildDesignUploadMetadata({
      items: [],
      title: '  Ankara gown  ',
      description: '  Custom look  ',
      minPrice: 30000,
      maxPrice: 45000,
      tags: ['ankara', 'gown'],
      shouldPublish: true,
      options: {
        visibility: 'PUBLIC',
        categoryId: 'cat-1',
        subCategoryId: 'sub-1',
        type: 'FEMALE',
        customOrderEnabled: true,
        customMeasurementKeys: ['BUST', 'WAIST'],
        fitPreference: 'REGULAR',
        targetAgeGroup: 'ADULT',
      },
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        title: 'Ankara gown',
        description: 'Custom look',
        categoryId: 'cat-1',
        subCategoryId: 'sub-1',
        categoryTypeId: 'sub-1',
        customOrderEnabled: true,
        customMeasurementKeys: ['BUST', 'WAIST'],
        fitPreference: 'REGULAR',
        targetAgeGroup: 'ADULT',
        minPrice: 30000,
        maxPrice: 45000,
      }),
    );
  });
});

describe('R2 PUT upload contract', () => {
  it('accepts the explicit current upload method', () => expect(resolvePresignedUploadMethod({ method: 'PUT' })).toBe('PUT'));
  it.each([undefined, 'POST', 'GET'])('refuses an absent or retired method %s', method => {
    expect(() => resolvePresignedUploadMethod({ method })).toThrow('Upload configuration is invalid');
  });
});
