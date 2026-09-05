import {
  fetchWithTimeout,
  isCrawlerRequest,
  resolveApiBaseUrl,
  shouldCanonicalRedirect,
  shouldServeBotHtml,
} from './seo-shared';

/**
 * Hashed Vite build outputs under /assets/* must NEVER SPA-fallback to
 * index.html. Cloudflare Pages' SPA mode returns 200 text/html for missing
 * paths; our `/assets/*` header then stamps that HTML with
 * `Cache-Control: public, max-age=31536000, immutable`, so the edge caches
 * poison at the JS URL. Browsers then fail boot with:
 *   Failed to load module script: … MIME type of "text/html"
 * Incidents: 2026-07-10, 2026-07-31. Convert HTML-for-asset into a real 404
 * with no-store so it cannot be cached as a successful module.
 */
const HASHED_ASSET_PATH =
  /^\/assets\/.+\.(?:js|mjs|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif)$/i;

const rejectSpaFallbackForAsset = async (
  context: EventContext<unknown, string, unknown>,
): Promise<Response> => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

/**
 * Bot rendering middleware.
 *
 * Crawler requests for public pages are answered with lightweight
 * server-rendered HTML from the backend SEO service. Everything else
 * (humans, static files, private paths) falls through to the SPA.
 *
 * FAIL-OPEN INVARIANT: if the SEO origin is down, slow, or errors, the
 * crawler must receive the normal SPA response — never a hard 5xx. A
 * transient API outage must not read as a site outage to search engines.
 */
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const userAgent = context.request.headers.get('user-agent') ?? '';
  const path = `${url.pathname}${url.search}`;

  // Asset guard runs first — even crawlers must not receive bot HTML for
  // hashed build files (shouldServeBotHtml already skips static extensions,
  // but SPA fallback still applies at the platform layer).
  if (HASHED_ASSET_PATH.test(url.pathname)) {
    return rejectSpaFallbackForAsset(context);
  }

  if (shouldCanonicalRedirect(url.pathname)) {
    try {
      const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
      const redirectResponse = await fetchWithTimeout(
        `${apiBase}/public/seo/canonical-redirect?path=${encodeURIComponent(path)}`,
        { redirect: 'manual' },
      );

      if (redirectResponse.status >= 300 && redirectResponse.status < 400) {
        const location = redirectResponse.headers.get('location');
        if (location) {
          return new Response(null, {
            status: 301,
            headers: {
              Location: location,
              'Cache-Control': 'public, max-age=300',
            },
          });
        }
      }
    } catch {
      // Fail-open to SPA routing.
    }
  }

  if (!isCrawlerRequest(userAgent) || !shouldServeBotHtml(url.pathname)) {
    return context.next();
  }

  try {
    const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
    const response = await fetchWithTimeout(
      `${apiBase}/public/seo/bot-html?path=${encodeURIComponent(path)}`,
      { headers: { Accept: 'text/html' } },
    );

    // Upstream 5xx → serve the SPA instead of propagating an outage.
    if (response.status >= 500) {
      return context.next();
    }

    const html = await response.text();

    // Cache only healthy responses; 404s get a short TTL so recovered
    // content (republished design, reopened store) resurfaces quickly.
    const cacheControl =
      response.status === 200
        ? 'public, max-age=300'
        : 'public, max-age=60';

    return new Response(html, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': cacheControl,
        // Bot HTML and human HTML share URLs — downstream caches must
        // never serve one audience's variant to the other.
        Vary: 'User-Agent',
      },
    });
  } catch {
    return context.next();
  }
};
