import type { SearchEntityType } from '@/types/search';

export function resolveSearchIntent(query: string): {
  query: string;
  type?: SearchEntityType | 'all';
} {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: '' };
  }

  if (trimmed.startsWith('@')) {
    return { query: trimmed, type: 'brand' };
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return { query: trimmed, type: 'tag' };
  }

  return { query: trimmed, type: 'all' };
}

export function buildSearchHref(query: string): string {
  const intent = resolveSearchIntent(query);
  if (!intent.query) {
    return '/search';
  }

  const params = new URLSearchParams();
  params.set('q', intent.query);
  if (intent.type && intent.type !== 'all') {
    params.set('type', intent.type);
  }
  return `/search?${params.toString()}`;
}