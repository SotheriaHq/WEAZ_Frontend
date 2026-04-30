import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export type EmbeddedSurface = 'mobile-app' | null;
const EMBEDDED_SURFACE_SESSION_KEY = 'threadly.studio.embeddedSurface';

export function getEmbeddedSurface(search: string): EmbeddedSurface {
  const params = new URLSearchParams(search);
  return params.get('surface') === 'mobile-app' ? 'mobile-app' : null;
}

function readSessionEmbeddedSurface(): EmbeddedSurface {
  try {
    return window.sessionStorage.getItem(EMBEDDED_SURFACE_SESSION_KEY) === 'mobile-app'
      ? 'mobile-app'
      : null;
  } catch {
    return null;
  }
}

function writeSessionEmbeddedSurface(surface: EmbeddedSurface): void {
  try {
    if (surface) {
      window.sessionStorage.setItem(EMBEDDED_SURFACE_SESSION_KEY, surface);
    } else {
      window.sessionStorage.removeItem(EMBEDDED_SURFACE_SESSION_KEY);
    }
  } catch {
    // Storage can be unavailable in private or restricted WebViews.
  }
}

export function getEmbeddedSurfaceForLocation(_pathname: string, search: string): EmbeddedSurface {
  const explicitSurface = getEmbeddedSurface(search);
  if (explicitSurface) {
    return explicitSurface;
  }

  return readSessionEmbeddedSurface();
}

export function useEmbeddedSurface(): EmbeddedSurface {
  const location = useLocation();
  const explicitSurface = useMemo(() => getEmbeddedSurface(location.search), [location.search]);

  useEffect(() => {
    if (explicitSurface) {
      writeSessionEmbeddedSurface(explicitSurface);
    }
  }, [explicitSurface]);

  return useMemo(
    () => getEmbeddedSurfaceForLocation(location.pathname, location.search),
    [location.pathname, location.search],
  );
}

export function isEmbeddedMobileSurface(search: string): boolean {
  return getEmbeddedSurface(search) === 'mobile-app';
}
