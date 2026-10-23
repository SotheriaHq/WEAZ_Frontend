import { isUsableMediaUrl, mediaUrlCacheExpiresAt } from './mediaUrlPolicy';
import { advanceMediaSessionEpoch, getMediaSessionEpoch } from './mediaUrlSession';

const CACHE_KEY = 'wiez_signed_url_cache';
const MAX_ENTRIES = 256;
const MAX_AGE_MS = 14 * 60 * 1000;
const pending = new Map<string, Promise<string | null>>();
type Entry = { url: string; expiresAt: number };

export const mediaSessionCacheKey = (key: string) => `${getMediaSessionEpoch()}:${key}`;

function read(): Record<string, Entry> {
  try { const value = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}

function write(entries: Record<string, Entry>) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(entries)); }
  catch { /* Storage is optional. */ }
}

export function getCachedMediaUrl(key: string): string | null {
  const entries = read();
  const scoped = mediaSessionCacheKey(key);
  const entry = entries[scoped];
  if (entry && entry.expiresAt > Date.now() && isUsableMediaUrl(entry.url)) return entry.url;
  if (entry) { delete entries[scoped]; write(entries); }
  return null;
}

export function invalidateCachedMediaUrl(key: string) {
  const entries = read();
  delete entries[mediaSessionCacheKey(key)];
  write(entries);
}

export function clearCachedMediaUrls() {
  advanceMediaSessionEpoch();
  pending.clear();
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* Storage is optional. */ }
}

export async function resolveCachedMediaUrl(key: string, fetcher: () => Promise<string | null>, force = false): Promise<string | null> {
  const epoch = getMediaSessionEpoch();
  const scoped = mediaSessionCacheKey(key);
  if (force) invalidateCachedMediaUrl(key);
  else { const cached = getCachedMediaUrl(key); if (cached) return cached; }
  const existing = pending.get(scoped);
  if (existing) return existing;
  const request = (async () => {
    try {
      const url = await fetcher();
      if (epoch !== getMediaSessionEpoch() || !url || !isUsableMediaUrl(url, Date.now(), 0)) return null;
      const entries = read();
      for (const entryKey of Object.keys(entries)) if (entries[entryKey]?.expiresAt <= Date.now()) delete entries[entryKey];
      entries[scoped] = { url, expiresAt: mediaUrlCacheExpiresAt(url, MAX_AGE_MS) };
      while (Object.keys(entries).length > MAX_ENTRIES) delete entries[Object.keys(entries)[0]];
      write(entries);
      return url;
    } catch { return null; }
  })();
  pending.set(scoped, request);
  try { return await request; }
  finally { if (pending.get(scoped) === request) pending.delete(scoped); }
}
