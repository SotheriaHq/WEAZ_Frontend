import { useEffect } from 'react';

// Module-level LRU of decode work so several galleries never refetch the same
// asset. It is deliberately capped: URLs can contain short-lived signatures,
// so an unbounded session cache would otherwise retain every past feed image.
const MAX_PRIMED_IMAGES = 120;
const primed = new Map<string, Promise<void>>();

const retainPrimedImage = (url: string, work: Promise<void>) => {
  primed.delete(url);
  primed.set(url, work);
  while (primed.size > MAX_PRIMED_IMAGES) {
    const oldest = primed.keys().next().value;
    if (!oldest) break;
    primed.delete(oldest);
  }
};

/**
 * Prime the browser image cache (and decode) for a single already-resolved
 * display URL. Safe no-op for empty values, storage keys, or blobs we can't
 * fetch ahead of time.
 */
export const preloadImageUrl = (url?: string | null): Promise<void> => {
  if (!url || typeof window === 'undefined') return Promise.resolve();
  if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) return Promise.resolve();
  const existing = primed.get(url);
  if (existing) return existing;

  const work = new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // A fetch cache hit alone is insufficient: progressive images can still
      // visibly assemble during a swipe. Wait for decode before considering the
      // asset ready, while preserving Safari's onload-only fallback.
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => undefined).finally(settle);
        return;
      }
      settle();
    };
    img.onerror = settle;
    img.src = url;
  });

  retainPrimedImage(url, work);
  return work;
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
