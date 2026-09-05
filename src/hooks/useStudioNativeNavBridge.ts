import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';

declare global {
  interface Window {
    /**
     * Client-side navigation entry point for the native Studio shell.
     *
     * `threadly-mobile/app/(tabs)/studio/webview.tsx` injects
     * `__WIEZ_STUDIO_NAV_GO__`, which calls this when it is present and
     * otherwise queues the path on `__WIEZ_STUDIO_NAV_PENDING__`. A missing
     * handler used to fall through to `location.assign` — a full document
     * reload on every dock tap.
     */
    __WIEZ_STUDIO_NAV__?: (path: string) => void;
    __WIEZ_STUDIO_NAV_GO__?: (path: string) => void;
    __WIEZ_STUDIO_NAV_PENDING__?: string | null;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

/**
 * Keeps `surface=mobile-app` on the URL across a bridged navigation.
 *
 * `useEmbeddedSurface` falls back to sessionStorage, so a bare path still
 * resolves as embedded — but the explicit marker is what survives a manual
 * reload inside the WebView, and it costs nothing to carry.
 */
function withEmbeddedSurface(path: string): string {
  const [pathWithSearch, hash = ''] = path.split('#');
  const [pathname, search = ''] = pathWithSearch.split('?');
  const params = new URLSearchParams(search);
  params.set('surface', 'mobile-app');
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * Mount ONCE, at the router root — not per shell.
 *
 * A Studio-scoped mount would deregister the moment the web app walked onto a
 * non-Studio route, and the very next dock tap would silently take the
 * full-reload fallback again. Registering at the root makes the bridge a
 * property of "this document is inside the native shell", which is what it
 * actually is.
 */
function isNativeStudioWebView(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);
}

export function useStudioNativeNavBridge(): void {
  const navigate = useNavigate();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';

  useEffect(() => {
    // Register whenever this document is inside the native WebView, not only
    // when `surface=mobile-app` is currently on the URL. StudioHome used to
    // `setSearchParams({ tab })` and wipe `surface`, which unregistered the
    // bridge; the next dock tap then `location.assign`'d and reloaded the
    // whole bundle. SessionStorage still marks the surface as embedded, but
    // the native injector cannot wait on that.
    if (!isEmbeddedMobile && !isNativeStudioWebView()) return;

    const handler = (path: string) => {
      if (typeof path !== 'string' || !path.startsWith('/')) return;
      const target = withEmbeddedSurface(path);
      // `replace` deliberately: the dock is a tab bar, not a trail. Pushing
      // would make the native Back button walk backwards through every section
      // the brand had visited before it left Studio.
      navigate(target, { replace: true });
    };

    window.__WIEZ_STUDIO_NAV__ = handler;
    const pending = window.__WIEZ_STUDIO_NAV_PENDING__;
    if (typeof pending === 'string' && pending.startsWith('/')) {
      window.__WIEZ_STUDIO_NAV_PENDING__ = null;
      handler(pending);
    }

    return () => {
      if (window.__WIEZ_STUDIO_NAV__ === handler) {
        delete window.__WIEZ_STUDIO_NAV__;
      }
    };
  }, [isEmbeddedMobile, navigate]);
}

export default useStudioNativeNavBridge;
