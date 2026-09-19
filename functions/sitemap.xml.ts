import { fetchWithTimeout, resolveApiBaseUrl } from './seo-shared';

/**
 * Sitemap proxy. On upstream failure we return 503 + Retry-After rather
 * than an empty urlset: crawlers keep their previously fetched sitemap on
 * a 5xx, whereas a cached EMPTY sitemap would hint every URL disappeared.
 */
export const onRequest: PagesFunction = async (context) => {
  try {
    const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
    const response = await fetchWithTimeout(
      `${apiBase}/public/seo/sitemap.xml`,
      { headers: { Accept: 'application/xml' } },
      // Sitemap generation walks four tables; give it more headroom.
      10_000,
    );

    if (!response.ok) {
      throw new Error(`sitemap upstream returned ${response.status}`);
    }

    const body = await response.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch {
    return new Response('Sitemap temporarily unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '300',
      },
    });
  }
};
