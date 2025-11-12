import marketApi from '@/api/MarketApi';
import { apiClient } from '@/api/httpClient';

/** Lightweight tags API that derives suggestions from the market feed.
 * In the future, replace with a proper backend endpoint (e.g., GET /tags, POST /tags).
 */
export const TagsApi = {
  async getSuggestions(limit = 50): Promise<string[]> {
    // Try backend endpoint first; fallback to market scrape
    try {
      const res = await apiClient.get(`/tags`, { params: { limit } });
      const payload = res?.data as any;
      const items: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];
      const names = items
        .map((t) => (typeof t?.name === 'string' ? t.name.trim() : ''))
        .filter(Boolean);
      if (names.length) return Array.from(new Set(names));
    } catch (e) {
      // ignore, fallback below
    }
    try {
  const feed = await marketApi.getFeed({ limit, counts: 'combined' });
      const set = new Set<string>();
      for (const item of feed.items ?? []) {
        for (const tag of item.tags ?? []) {
          if (typeof tag === 'string' && tag.trim().length > 0) {
            set.add(tag.trim());
          }
        }
      }
      return Array.from(set).slice(0, 200);
    } catch {
      return [];
    }
  },
  /** Stub: wire to backend when available. */
  async addTag(_tag: string): Promise<void> {
    return;
  },
};

export default TagsApi;

