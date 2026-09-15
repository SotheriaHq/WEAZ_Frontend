import { fetchWithTimeout, resolveApiBaseUrl } from './seo-shared';

/**
 * robots.txt MUST stay available: search engines treat a persistently
 * erroring robots.txt (5xx) as "assume the whole site is disallowed",
 * which can deindex everything. If the backend is unreachable we serve a
 * conservative static fallback instead of an error.
 */
export const onRequest: PagesFunction = async (context) => {
  const requestOrigin = new URL(context.request.url).origin;
  // Fail-open for production indexing: allow public surfaces, block private
  // app shells. When the API is healthy it may instead return full Disallow
  // for SIT/UAT (SEO_INDEXING_ENABLED=false). Keep this list in sync with
  // bthreadly/src/seo/seo.config.ts SEO_DISALLOWED_PATH_PREFIXES.
  const fallbackBody = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /studio/',
    'Disallow: /admin/',
    'Disallow: /checkout/',
    'Disallow: /bag/',
    'Disallow: /orders/',
    'Disallow: /messages/',
    'Disallow: /dashboard/',
    'Disallow: /settings/',
    'Disallow: /notifications/',
    'Disallow: /diagnostics/',
    'Disallow: /account/',
    'Disallow: /custom-orders/',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /verify-email',
    '',
    `Sitemap: ${requestOrigin}/sitemap.xml`,
    '',
  ].join('\n');

  try {
    const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
    const response = await fetchWithTimeout(`${apiBase}/public/seo/robots.txt`, {
      headers: { Accept: 'text/plain' },
    });

    if (!response.ok) {
      throw new Error(`robots.txt upstream returned ${response.status}`);
    }

    const body = await response.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response(fallbackBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Short TTL: recover to the backend-driven file quickly.
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
};
