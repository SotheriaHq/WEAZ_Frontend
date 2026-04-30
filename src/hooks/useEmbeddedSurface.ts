import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export type EmbeddedSurface = 'mobile-app' | null;

export function getEmbeddedSurface(search: string): EmbeddedSurface {
  const params = new URLSearchParams(search);
  return params.get('surface') === 'mobile-app' ? 'mobile-app' : null;
}

export function useEmbeddedSurface(): EmbeddedSurface {
  const location = useLocation();
  return useMemo(() => getEmbeddedSurface(location.search), [location.search]);
}

export function isEmbeddedMobileSurface(search: string): boolean {
  return getEmbeddedSurface(search) === 'mobile-app';
}
