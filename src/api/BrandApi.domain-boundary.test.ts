import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandApi } from './BrandApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('BrandApi domain boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates collection drafts through store collection endpoints, not design endpoints', async () => {
    mockedApiClient.post
      .mockResolvedValueOnce({ data: { data: { sessionId: 'collection-1' } } })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'collection-1',
            title: 'Capsule',
            visibility: 'PRIVATE',
            isAvailableInStore: true,
          },
        },
      });

    await expect(
      brandApi.createCollection({
        name: 'Capsule',
        description: 'Drop grouping',
        isPublic: false,
        categoryId: 'cat-1',
        subCategoryId: 'sub-1',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'collection-1' }));

    expect(mockedApiClient.post).toHaveBeenNthCalledWith(
      1,
      '/store-collections/initialize',
      expect.objectContaining({
        mode: 'existing',
        title: 'Capsule',
        visibility: 'PRIVATE',
        categoryId: 'cat-1',
        subCategoryId: 'sub-1',
        categoryTypeId: 'sub-1',
        isAvailableInStore: true,
      }),
    );
    expect(mockedApiClient.post).toHaveBeenNthCalledWith(
      2,
      '/store-collections/collection-1/finalize',
      expect.objectContaining({
        action: 'draft',
        collectionMetadata: expect.objectContaining({
          title: 'Capsule',
          visibility: 'PRIVATE',
          isAvailableInStore: true,
        }),
      }),
    );

    const calledPaths = mockedApiClient.post.mock.calls.map(([path]) => path);
    expect(calledPaths).not.toContain('/designs/initialize');
    expect(calledPaths).not.toContain('/collections');
  });
});
