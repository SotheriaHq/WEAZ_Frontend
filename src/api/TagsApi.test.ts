import { beforeEach, describe, expect, it, vi } from 'vitest';
import TagsApi from './TagsApi';
import { apiClient } from './httpClient';

vi.mock('./httpClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('TagsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to seeded tags when trending tags fail to load', async () => {
    mockedApiClient.get
      .mockRejectedValueOnce(new Error('trending unavailable'))
      .mockResolvedValueOnce({
        data: {
          data: [
            { name: 'ankara-fashion', usageCount: 0 },
            { name: 'aso-ebi', usageCount: 0 },
          ],
        },
      });

    await expect(TagsApi.getSuggestions(10)).resolves.toEqual(['ankara-fashion', 'aso-ebi']);

    expect(mockedApiClient.get).toHaveBeenNthCalledWith(1, '/tags/trending', {
      params: { window: '7d', limit: 10 },
    });
    expect(mockedApiClient.get).toHaveBeenNthCalledWith(2, '/tags', {
      params: { limit: 10 },
    });
  });

  it('falls back to seeded tags when trending tags are empty after a reset', async () => {
    mockedApiClient.get
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({
        data: {
          data: [{ name: 'bridal', usageCount: 0 }],
        },
      });

    await expect(TagsApi.getSuggestions(5)).resolves.toEqual(['bridal']);

    expect(mockedApiClient.get).toHaveBeenNthCalledWith(2, '/tags', {
      params: { limit: 5 },
    });
  });
});
