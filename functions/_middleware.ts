import {
  fetchWithTimeout,
  isCrawlerRequest,
  resolveApiBaseUrl,
  shouldServeBotHtml,
} from './seo-shared';

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

  if (!isCrawlerRequest(userAgent) || !shouldServeBotHtml(url.pathname)) {
    return context.next();
  }

  try {
    const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
    const path = `${url.pathname}${url.search}`;
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
