import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/httpClient';
import { updateDesign } from '@/api/DesignApi';

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/api/idempotency', () => ({
  createIdempotencyKey: () => 'idem-design-update-test',
}));

const patchMock = vi.mocked(apiClient.patch);

describe('updateDesign payload sanitization', () => {
  beforeEach(() => {
    patchMock.mockClear();
    patchMock.mockResolvedValue({ data: { data: { id: 'design-1' } } });
  });

  it('strips empty-string fields the backend UUID/enum validators reject', async () => {
    await updateDesign('design-1', {
      title: 'Draft title',
      categoryId: '',
      subCategoryId: '',
      categoryTypeId: '',
      type: 'FEMALE',
    } as never);

    const [url, body] = patchMock.mock.calls[0];
    expect(url).toBe('/designs/design-1');
    expect(body).toEqual({ title: 'Draft title', type: 'FEMALE' });
    expect(body).not.toHaveProperty('categoryId');
  });

  it('keeps explicit nulls (clear-field semantics) and uses a long timeout', async () => {
    await updateDesign('design-1', {
      title: 'Draft',
      rtwSizeSystem: null,
    } as never);

    const [, body, config] = patchMock.mock.calls[0];
    expect(body).toEqual({ title: 'Draft', rtwSizeSystem: null });
    expect(config).toMatchObject({ timeout: 60_000 });
  });
});
