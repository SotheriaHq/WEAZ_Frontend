import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
// Build helper is plain JavaScript so the same implementation runs in Node CI.
// @ts-expect-error build helper has no declaration file
import { collectMarketFonts, collectRouteAssets, renderRoutePreloads } from '../../scripts/generate-route-preloads.mjs';

describe('initial-route asset preloading', () => {
  const manifest = {
    runway: { file: 'assets/Runway-abc.js', imports: ['shared'], dynamicImports: ['viewer'] },
    market: { file: 'assets/Market-def.js', imports: ['shared'] },
    shared: { file: 'assets/core-xyz.js', css: ['assets/core-xyz.css'], imports: ['runway'] },
    viewer: { file: 'assets/private-viewer.js' },
  };

  it('walks static dependencies once and excludes unopened dynamic imports', () => {
    expect(collectRouteAssets(manifest, 'runway')).toEqual([
      '/assets/Runway-abc.js', '/assets/core-xyz.js', '/assets/core-xyz.css',
    ]);
    expect(() => collectRouteAssets(manifest, 'missing')).toThrow('Missing initial-route');
    expect(() => collectRouteAssets({ bad: { file: '../private.js' } }, 'bad')).toThrow('Unexpected initial-route');
  });

  it('selects the current route, deduplicates links and treats CSS as style hints', () => {
    const script = renderRoutePreloads({ '/': ['/assets/Runway-abc.js'], '/market': ['/assets/Market-def.js', '/assets/core-xyz.css', '/fonts/wiez-web/playfair-display-latin-123456abcdef.woff2'] });
    const links: Array<{ rel?: string; href?: string; as?: string; type?: string; crossOrigin?: string }> = [];
    const context = {
      window: { location: { pathname: '/market/' } },
      document: {
        querySelector: (selector: string) => links.find(link => selector === `link[href="${link.href}"]`),
        createElement: () => ({}),
        head: { appendChild: (link: typeof links[number]) => links.push(link) },
      },
    };
    vm.runInNewContext(script, context);
    vm.runInNewContext(script, context);
    expect(links).toEqual([
      { href: '/assets/Market-def.js', rel: 'modulepreload', crossOrigin: '' },
      { href: '/assets/core-xyz.css', rel: 'preload', as: 'style', crossOrigin: '' },
      { href: '/fonts/wiez-web/playfair-display-latin-123456abcdef.woff2', rel: 'preload', as: 'font', type: 'font/woff2', crossOrigin: '' },
    ]);
    context.window.location.pathname = '/settings';
    vm.runInNewContext(script, context);
    expect(links).toHaveLength(3);
  });

  it('selects the visible Market subsets from verified build filenames and rejects missing/unsafe records', () => {
    const files = [
      { name: 'playfair-display-latin-ext-111111111111.woff2' },
      { name: 'plus-jakarta-sans-latin-ext-abcdefabcdef.woff2' },
      { name: 'playfair-display-latin-123456abcdef.woff2' },
    ];
    expect(collectMarketFonts({ files })).toEqual([
      '/fonts/wiez-web/playfair-display-latin-123456abcdef.woff2',
      '/fonts/wiez-web/plus-jakarta-sans-latin-ext-abcdefabcdef.woff2',
    ]);
    expect(() => collectMarketFonts({ files: [] })).toThrow('Missing visible Market font');
    expect(() => collectMarketFonts({ files: [{ name: '../playfair-display-latin-123456abcdef.woff2' }] })).toThrow('Missing visible Market font');
  });
});
