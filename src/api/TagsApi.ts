import { apiClient } from '@/api/httpClient';

export interface TagSuggestion {
  name: string;
  usageCount: number;
}

export interface TagDetail {
  name: string;
  displayName: string;
  usageCount: number;
  isBanned: boolean;
  aliasOf: { name: string; displayName: string } | null;
  entityCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface TagFeedResponse {
  tag: string;
  items: Array<{
    id: string;
    entityType: 'COLLECTION' | 'PRODUCT' | 'BRAND' | 'USER_BRAND';
    taggedAt: string;
    data: Record<string, unknown>;
  }>;
  nextCursor: string | null;
}

const extractSuggestions = (payload: any): TagSuggestion[] => {
  const items: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data?.items)
    ? payload.data.items
    : Array.isArray(payload?.data)
    ? payload.data
    : [];

  return items
    .map((item) => {
      const name =
        typeof item?.name === 'string'
          ? item.name.trim()
          : typeof item?.tag === 'string'
          ? item.tag.trim()
          : '';
      const usageCount = Number(item?.usageCount ?? item?.count ?? 0);
      return { name, usageCount: Number.isFinite(usageCount) ? usageCount : 0 };
    })
    .filter((item) => item.name.length > 0);
};

export const TagsApi = {
  async getSuggestions(limit = 50): Promise<string[]> {
    // Brands must see the FULL approved tag catalog (all seeded/platform tags),
    // not just recently-used tags. `/tags` (getPopularTags) returns every APPROVED
    // tag plus the viewer's own pending tags; `/tags/trending` only returns tags
    // with recent usage, which is why a freshly-seeded catalog showed almost none.
    try {
      const catalog = await this.getPopular(limit);
      if (catalog.length > 0) return catalog.map((item) => item.name);
    } catch {
      // fall back to trending (which itself falls back to /tags) below
    }
    const trending = await this.getTrending('7d', limit).catch(() => []);
    return trending.map((item) => item.name);
  },

  async search(query: string, limit = 10): Promise<TagSuggestion[]> {
    const res = await apiClient.get('/tags/search', {
      params: { q: query, limit },
    });
    return extractSuggestions(res?.data);
  },

  async getTrending(window: '1h' | '24h' | '7d' = '24h', limit = 20): Promise<TagSuggestion[]> {
    try {
      const res = await apiClient.get('/tags/trending', {
        params: { window, limit },
      });
      const parsed = extractSuggestions(res?.data);
      if (parsed.length > 0) return parsed;
    } catch {
      // Fresh local resets can have no trending usage yet; fall back to seeded/popular tags.
    }

    const fallback = await apiClient.get('/tags', { params: { limit } });
    return extractSuggestions(fallback?.data);
  },

  async getPopular(limit = 50): Promise<TagSuggestion[]> {
    const res = await apiClient.get('/tags', { params: { limit } });
    return extractSuggestions(res?.data);
  },

  async getDetails(tagName: string): Promise<TagDetail> {
    const res = await apiClient.get(`/tags/${encodeURIComponent(tagName)}`);
    return res.data as TagDetail;
  },

  async getFeed(tagName: string, cursor?: string, limit = 20): Promise<TagFeedResponse> {
    const res = await apiClient.get(`/tags/${encodeURIComponent(tagName)}/posts`, {
      params: { cursor, limit },
    });
    return res.data as TagFeedResponse;
  },

  async addTag(_tag: string): Promise<void> {
    return;
  },
};

export default TagsApi;
