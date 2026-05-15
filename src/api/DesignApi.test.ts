import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  finalizeDesignUploads,
  initializeDesignUploads,
  resolveDesignId,
} from './DesignApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./idempotency', () => ({
  createIdempotencyKey: () => 'idem-design-test',
}));

const mockedApiClient = vi.mocked(apiClient);

describe('DesignApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes design uploads through the explicit designs endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: {
        data: {
          legacyCollectionId: 'legacy-1',
          uploads: [],
        },
      },
    });

    await expect(
      initializeDesignUploads({
        title: 'Evening design',
        files: [],
        tags: ['dress'],
        subCategoryId: 'sub-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        designId: 'legacy-1',
        legacyCollectionId: 'legacy-1',
        uploads: [],
      }),
    );
    expect(mockedApiClient.post).toHaveBeenCalledWith('/designs/initialize', {
      title: 'Evening design',
      files: [],
      tags: ['dress'],
      subCategoryId: 'sub-1',
    });
  });

  it('finalizes with designMetadata instead of collectionMetadata', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ data: { data: { id: 'design-1' } } });

    await finalizeDesignUploads('design-1', [], true, {
      action: 'publish',
      designMetadata: {
        title: 'Published design',
        subCategoryId: 'sub-1',
        fitPreference: 'REGULAR',
        targetAgeGroup: 'ADULT',
      },
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/designs/design-1/finalize',
      expect.objectContaining({
        shouldPublish: true,
        action: 'publish',
        designMetadata: expect.objectContaining({
          title: 'Published design',
          subCategoryId: 'sub-1',
        }),
      }),
      { headers: { 'Idempotency-Key': 'idem-design-test' } },
    );
    const [, payload] = mockedApiClient.post.mock.calls[0];
    expect(payload).not.toHaveProperty('collectionMetadata');
  });

  it('resolves design identifiers before legacy collection identifiers', () => {
    expect(
      resolveDesignId({
        designId: 'design-primary',
        id: 'id-secondary',
        legacyCollectionId: 'legacy-third',
        collectionId: 'collection-last',
      }),
    ).toBe('design-primary');
    expect(resolveDesignId({ legacyCollectionId: 'legacy-1' })).toBe('legacy-1');
    expect(resolveDesignId({ collectionId: 'collection-1' })).toBe('collection-1');
  });

  it('keeps CreateDesign on DesignApi/useDesignUpload instead of collection upload naming', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/catalog/CreateDesign.tsx'), 'utf8');

    expect(source).toContain('useDesignUpload');
    expect(source).toContain('DesignApi');
    expect(source).not.toMatch(/useCollectionUpload/);
    expect(source).toContain('designMetadata');
  });
});
