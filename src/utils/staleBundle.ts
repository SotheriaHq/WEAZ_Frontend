import { isNewBuildAvailable } from '@/utils/buildVersionGuard';

/**
 * Recognising — and silently recovering from — a half-replaced deploy.
 *
 * ## What goes wrong
 *
 * A deploy replaces every hashed chunk. A tab that already has `index.html`
 * keeps asking for the chunk names IT was built with, and those are gone. The
 * next lazy route import fails, React throws during render, and an error
 * boundary paints a 500 — for a fault that is nobody's bug and that a reload
 * cures completely.
 *
 * ## Why this file exists
 *
 * The message list below was copied into `main.tsx` and `ErrorPage.tsx`, and
 * the two copies had already drifted apart — `ErrorPage` knew about
 * `reading 'default'` and `main.tsx` did not. `RootErrorBoundary`, which
 * catches everything that fails OUTSIDE the router, had no copy at all: it
 * rendered "WIEZ could not start" and offered a button, for an error that
 * resolves itself.
 *
 * Three places have to agree about this or the screen the user gets depends on
 * which boundary happened to catch the error. So: one list, one reload.
 */

/**
 * The strings browsers use for "that module isn't there any more".
 *
 * Every engine words it differently, and a stale deploy can also serve the SPA
 * fallback HTML for a `.js` URL, which surfaces as a MIME-type complaint
 * rather than a 404. `reading 'default'` is React.lazy resolving a chunk from
 * the other half of a mixed-version deploy.
 */
const STALE_BUNDLE_MESSAGES = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Loading chunk',
  'ChunkLoadError',
  "reading 'default'",
  // SPA fallback HTML served for a hashed .js URL (deploy race / poisoned cache).
  'Failed to load module script',
  'MIME type of "text/html"',
  "MIME type of 'text/html'",
  'Expected a JavaScript-or-Wasm module script',
] as const;

const messageOf = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || '';
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message?: unknown }).message ?? '');
  }
  return String(value ?? '');
};

/** True when the message is one a half-replaced deploy produces. */
export const isStaleBundleError = (value: unknown): boolean => {
  const message = messageOf(value);
  if (!message) return false;
  return STALE_BUNDLE_MESSAGES.some((needle) => message.includes(needle));
};

/**
 * True when this error should be treated as a stale deploy.
 *
 * Either the message names one, OR the version guard has already seen a newer
 * `buildId` than the one this bundle was stamped with. That second arm matters:
 * once we KNOW the running code is superseded, the specific way it failed is
 * not worth guessing at, and a reload is the right answer for any of them.
 * It is also the only arm that catches a message we have not met yet.
 */
export const shouldRecoverFromStaleBundle = (value: unknown): boolean =>
  isStaleBundleError(value) || isNewBuildAvailable();

/**
 * Reload onto the current deploy, at most once per session per key.
 *
 * Cache-busted rather than a plain `reload()`: some mobile browsers re-serve
 * the same stale document, which would loop. The session key is what stops a
 * genuinely broken build from reloading forever — the second failure falls
 * through to whatever error UI the caller renders, so a real bug is still
 * visible rather than hidden behind a refresh cycle.
 */
export const recoverFromStaleBundle = (sessionKey: string): boolean => {
  try {
    if (sessionStorage.getItem(sessionKey) === '1') return false;
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Private mode or blocked storage: without a way to remember, reloading
    // risks a loop. Show the error instead.
    return false;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
};

/** Cleared on a clean boot, so a future deploy gets its one recovery again. */
export const STALE_BUNDLE_SESSION_KEYS = {
  router: 'wiez:error-page-auto-recovered',
  root: 'wiez:root-boundary-auto-recovered',
} as const;
