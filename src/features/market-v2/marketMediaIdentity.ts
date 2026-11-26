import { isEquivalentSignedUrl } from '@/query/structuralSharing';
import { mediaSessionCacheKey } from '@/utils/mediaUrlCache';
import { getMediaUrlIdentity } from '@/utils/mediaUrlPolicy';

/**
 * One display URL per media variant (`fileId:variant`) for as long as that URL
 * stays usable.
 *
 * The server signs every card image afresh on each response, so the same
 * photo arrives with a different query string from the section request, the
 * catalogue request, the next page and every filter change. A different string
 * is a different browser-cache entry: the image re-downloads and the card
 * flashes. Keeping the first usable URL per variant makes every later
 * appearance of that photo a cache hit. The variant is the URL without its
 * credentials, so a CARD and a THUMB rendition of one file never swap places.
 *
 * A remembered URL is reused only while the shared signed-URL policy still
 * treats it as equivalent to the fresh one (same object, safely before expiry);
 * otherwise the fresh URL replaces it. Keys carry the media session, so one
 * account's capabilities are never handed to the next. The map is bounded,
 * oldest first.
 */
export const MARKET_MEDIA_IDENTITY_LIMIT = 400;

const remembered = new Map<string, string>();

export const marketMediaKey = (fileId: string | null | undefined, url: string): string =>
  `${fileId ?? 'source'}:${getMediaUrlIdentity(url)}`;

export function stableMarketMediaUrl(fileId: string | null | undefined, url: string, now = Date.now()): string {
  if (!url) return url;
  const key = mediaSessionCacheKey(marketMediaKey(fileId, url));
  const previous = remembered.get(key);
  const kept = previous && (previous === url || isEquivalentSignedUrl(previous, url, now)) ? previous : url;
  // Re-insert so frequently shown photos are evicted last.
  remembered.delete(key);
  remembered.set(key, kept);
  while (remembered.size > MARKET_MEDIA_IDENTITY_LIMIT) {
    const oldest = remembered.keys().next().value;
    if (oldest === undefined) break;
    remembered.delete(oldest);
  }
  return kept;
}

/** Test seam: forget every remembered URL. */
export function resetMarketMediaIdentity(): void {
  remembered.clear();
}

export const marketMediaIdentitySize = (): number => remembered.size;
