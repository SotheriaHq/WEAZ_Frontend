import { resolveApiBaseUrl } from './seo-shared';

export const onRequest: PagesFunction = async (context) => {
  const apiBase = resolveApiBaseUrl(context.env as Record<string, string>);
  const response = await fetch(`${apiBase}/public/seo/robots.txt`, {
    headers: { Accept: 'text/plain' },
  });
  const body = await response.text();

  return new Response(body, {
    status: response.ok ? 200 : response.status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};