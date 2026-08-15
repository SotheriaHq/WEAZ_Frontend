import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';

declare global {
  interface Window {
    /**
     * Client-side navigation entry point for the native Studio shell.
     *
     * `threadly-mobile/app/(tabs)/studio/webview.tsx` → `navigateStudioInPlace`
     * injects a script that prefers this function and falls back to
     * `window.location.assign(...)`. The function had never existed on this
     * side, so the fallback WAS the behaviour: every Studio dock tap
     * (Dashboard ↔ Store ↔ Orders ↔ Reviews ↔ Messages) tore down the document
     * and re-ran the whole boot — HTML, JS bundle, React mount, Redux hydrate,
     * every query refetched from zero — which is why a section switch replayed
     * the full loading sequence instead of the warm session the native shell
     * carefully avoids re-handing-off for.
     */
    __WIEZ_STUDIO_NAV__?: (path: string) => void;
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
export function useStudioNativeNavBridge(): void {
  const navigate = useNavigate();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';

  useEffect(() => {
    if (!isEmbeddedMobile) return;

    const handler = (path: string) => {
      if (typeof path !== 'string' || !path.startsWith('/')) return;
      const target = withEmbeddedSurface(path);
      // `replace` deliberately: the dock is a tab bar, not a trail. Pushing
      // would make the native Back button walk backwards through every section
      // the brand had visited before it left Studio.
      navigate(target, { replace: true });
    };

    window.__WIEZ_STUDIO_NAV__ = handler;

    return () => {
      if (window.__WIEZ_STUDIO_NAV__ === handler) {
        delete window.__WIEZ_STUDIO_NAV__;
      }
    };
  }, [isEmbeddedMobile, navigate]);
}

export default useStudioNativeNavBridge;
