const STORAGE_KEY = 'threadly:search:recent';
const MAX_ITEMS = 10;
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface StoredRecentSearch {
  query: string;
  storedAt: number;
}

function normalize(query: string) {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const normalized = Array.isArray(parsed)
      ? parsed
          .map((item): StoredRecentSearch | null => {
            if (typeof item === 'string') {
              return { query: item, storedAt: now };
            }
            if (
              item &&
              typeof item === 'object' &&
              typeof item.query === 'string' &&
              typeof item.storedAt === 'number'
            ) {
              return item as StoredRecentSearch;
            }
            return null;
          })
          .filter((item): item is StoredRecentSearch => Boolean(item))
          .filter((item) => now - item.storedAt <= TTL_MS)
          .slice(0, MAX_ITEMS)
      : [];

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized.map((item) => item.query);
  } catch {
    return [];
  }
}

export function storeRecentSearch(query: string) {
  const normalized = normalize(query);
  if (!normalized || typeof window === 'undefined') {
    return;
  }

  const current = getRecentSearches().filter((item) => normalize(item) !== normalized);
  const next: StoredRecentSearch[] = [
    { query: normalized, storedAt: Date.now() },
    ...current.map((item) => ({ query: item, storedAt: Date.now() })),
  ].slice(0, MAX_ITEMS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}