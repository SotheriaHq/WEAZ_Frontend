import { resolveApiBaseUrl } from './seo-shared';

export const onRequest: PagesFunction = async (context) => {
  const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
  const response = await fetch(`${apiBase}/public/seo/sitemap.xml`, {
    headers: { Accept: 'application/xml' },
  });
  const body = await response.text();

  return new Response(body, {
    status: response.ok ? 200 : response.status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
};