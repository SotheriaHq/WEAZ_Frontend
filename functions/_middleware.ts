import {
  isCrawlerRequest,
  resolveApiBaseUrl,
  shouldServeBotHtml,
} from './seo-shared';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const userAgent = context.request.headers.get('user-agent') ?? '';

  if (!isCrawlerRequest(userAgent) || !shouldServeBotHtml(url.pathname)) {
    return context.next();
  }

  const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
  const path = `${url.pathname}${url.search}`;
  const response = await fetch(
    `${apiBase}/public/seo/bot-html?path=${encodeURIComponent(path)}`,
    { headers: { Accept: 'text/html' } },
  );
  const html = await response.text();

  return new Response(html, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};