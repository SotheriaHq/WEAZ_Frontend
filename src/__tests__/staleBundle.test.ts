import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Recovering from a half-replaced deploy without showing anyone an error.
 *
 * The reported symptom: "when we deploy and I refresh, the screen shows a 500
 * for a flash and then refreshes again to render data." A deploy replaces every
 * hashed chunk; a tab holding the old `index.html` asks for names that are gone,
 * React throws, and a boundary paints a 500 for a fault a reload cures.
 *
 * The detector was copied into three files and the copies had drifted —
 * `ErrorPage` knew `reading 'default'`, `main.tsx` did not, and
 * `RootErrorBoundary` had no copy at all. These tests pin the shared one.
 */

const isNewBuildAvailable = vi.fn(() => false);

vi.mock('@/utils/buildVersionGuard', () => ({
  isNewBuildAvailable: () => isNewBuildAvailable(),
}));

const load = async () => await import('@/utils/staleBundle');

beforeEach(() => {
  vi.resetModules();
  isNewBuildAvailable.mockReturnValue(false);
  sessionStorage.clear();
});

describe('recognising a stale bundle', () => {
  it('knows the ways a browser says the chunk is gone', async () => {
    const { isStaleBundleError } = await load();

    for (const message of [
      'Failed to fetch dynamically imported module: https://weaz.me/assets/x.js',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Loading chunk 42 failed.',
      'ChunkLoadError',
      // React.lazy resolving a chunk from the other half of a mixed deploy.
      "Cannot read properties of undefined (reading 'default')",
      // The SPA fallback served as HTML for a hashed .js URL.
      'Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".',
    ]) {
      expect(isStaleBundleError(new Error(message)), message).toBe(true);
    }
  });

  it('does not claim ordinary crashes', async () => {
    const { isStaleBundleError } = await load();

    // The one that started this: a real hook-order bug, which must reach the
    // error screen rather than be reloaded away.
    expect(isStaleBundleError(new Error('Minified React error #310'))).toBe(false);
    expect(isStaleBundleError(new Error('brand.name is not a function'))).toBe(false);
    expect(isStaleBundleError(null)).toBe(false);
    expect(isStaleBundleError(undefined)).toBe(false);
  });

  it('treats any error as stale once a newer build is known', async () => {
    const { shouldRecoverFromStaleBundle } = await load();
    const unrelated = new Error('brand.name is not a function');

    expect(shouldRecoverFromStaleBundle(unrelated)).toBe(false);

    /*
      Once the version guard has seen a newer buildId, the running code is
      superseded and the particular way it failed stops being worth guessing
      at. This arm is what catches a message nobody has met yet.
    */
    isNewBuildAvailable.mockReturnValue(true);
    expect(shouldRecoverFromStaleBundle(unrelated)).toBe(true);
  });

  it('never attempts recovery when navigator is offline', async () => {
    const { shouldRecoverFromStaleBundle, recoverFromStaleBundle } = await load();
    const chunkError = new Error('Failed to fetch dynamically imported module: https://weaz.me/assets/x.js');

    const originalOnLine = navigator.onLine;
    try {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      expect(shouldRecoverFromStaleBundle(chunkError)).toBe(false);
      expect(recoverFromStaleBundle('test-key')).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});

describe('page-wide chunk failure listeners', () => {
  const setOnline = (value: boolean) =>
    Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  const originalOnLine = navigator.onLine;
  const cleanups: Array<() => void> = [];

  // Listeners are page-wide, so capture them and hand them to each test directly.
  const install = async () => {
    const added: Record<string, EventListener> = {};
    const spy = vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: EventListener) => {
      added[type] = fn;
    }) as typeof window.addEventListener);
    cleanups.push(() => spy.mockRestore());
    const { installChunkFailureRecovery } = await load();
    const reload = vi.fn();
    installChunkFailureRecovery(reload);
    return { added, reload };
  };

  const preloadEvent = () => new Event('vite:preloadError', { cancelable: true });
  const rejection = (reason: unknown) => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', { value: reason });
    return event;
  };

  afterEach(() => {
    setOnline(originalOnLine);
    cleanups.splice(0).forEach((fn) => fn());
  });

  it('reloads onto the new deploy when a chunk fails online', async () => {
    setOnline(true);
    const { added, reload } = await install();
    const event = preloadEvent();
    added['vite:preloadError'](event);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the app on screen when a chunk fails offline', async () => {
    setOnline(false);
    const { added, reload } = await install();
    const event = preloadEvent();
    added['vite:preloadError'](event);
    expect(reload).not.toHaveBeenCalled();
    // Not prevented, so the import rejects into ErrorPage, which recovers on `online`.
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not reload for a stale-bundle rejection while offline', async () => {
    setOnline(false);
    const { added, reload } = await install();
    added.unhandledrejection(rejection(new Error('Failed to fetch dynamically imported module: x.js')));
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads for a stale-bundle rejection online and ignores other rejections', async () => {
    setOnline(true);
    const { added, reload } = await install();
    added.unhandledrejection(rejection(new Error('Network Error')));
    expect(reload).not.toHaveBeenCalled();
    added.unhandledrejection(rejection(new Error('Failed to fetch dynamically imported module: x.js')));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('recovering', () => {
  const replace = vi.fn();

  beforeEach(() => {
    replace.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://weaz.me/runway', replace, reload: vi.fn() },
    });
  });

  it('reloads onto a cache-busted URL', async () => {
    const { recoverFromStaleBundle } = await load();

    expect(recoverFromStaleBundle('test-key')).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
    // A plain reload can re-serve the same stale document on some mobile
    // browsers, which would loop forever.
    expect(replace.mock.calls[0][0]).toMatch(/[?&]_r=\d+/);
  });

  it('gives up after one attempt so a real bug stays visible', async () => {
    const { recoverFromStaleBundle } = await load();

    expect(recoverFromStaleBundle('test-key')).toBe(true);
    expect(recoverFromStaleBundle('test-key')).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('keeps the two boundaries on separate budgets', async () => {
    const { recoverFromStaleBundle, STALE_BUNDLE_SESSION_KEYS } = await load();

    expect(recoverFromStaleBundle(STALE_BUNDLE_SESSION_KEYS.router)).toBe(true);
    // The root boundary catches what fails outside the router, so it has not
    // spent its attempt yet.
    expect(recoverFromStaleBundle(STALE_BUNDLE_SESSION_KEYS.root)).toBe(true);
  });
});
