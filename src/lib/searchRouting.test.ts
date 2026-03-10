import { describe, expect, it } from 'vitest';
import { buildSearchHref, resolveSearchIntent } from './searchRouting';

describe('searchRouting', () => {
  it('routes @-prefixed queries to brand search', () => {
    expect(resolveSearchIntent('@nike')).toEqual({ query: '@nike', type: 'brand' });
    expect(buildSearchHref('@nike')).toBe('/search?q=%40nike&type=brand');
  });

  it('routes slash-prefixed queries to tag search', () => {
    expect(resolveSearchIntent('/summer')).toEqual({ query: '/summer', type: 'tag' });
    expect(buildSearchHref('/summer')).toBe('/search?q=%2Fsummer&type=tag');
  });

  it('keeps plain queries in the global all-search mode', () => {
    expect(resolveSearchIntent('linen shirt')).toEqual({ query: 'linen shirt', type: 'all' });
    expect(buildSearchHref('linen shirt')).toBe('/search?q=linen+shirt');
  });
});