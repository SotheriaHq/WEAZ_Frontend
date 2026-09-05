import { useEffect } from 'react';

// Module-level set so an image is only ever primed once per session, even if
// several galleries reference the same URL.
const primed = new Set<string>();

/**
 * Prime the browser image cache (and decode) for a single already-resolved
 * display URL. Safe no-op for empty values, storage keys, or blobs we can't
 * fetch ahead of time.
 */
export const preloadImageUrl = (url?: string | null): void => {
  if (!url || typeof window === 'undefined') return;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) return;
  if (primed.has(url)) return;
  primed.add(url);
  const img = new Image();
  // Decode off the main thread; the goal is only to warm the cache.
  img.decoding = 'async';
  img.src = url;
};

/**
 * Preload a set of resolved image URLs. Used by galleries/lightboxes so that
 * flipping left/right (or tapping a thumbnail) swaps to an already-decoded
 * image instead of stalling on a fresh network fetch + decode — the root cause
 * of the "swipe is frozen / needs multiple taps" behavior.
 */
export const useImagePreload = (urls: Array<string | null | undefined>): void => {
  const key = urls.filter(Boolean).join('|');
  useEffect(() => {
    urls.forEach(preloadImageUrl);
    // `key` captures the meaningful identity of the url list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};

export default useImagePreload;
