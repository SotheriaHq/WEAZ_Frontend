import { apiClient } from './httpClient';

export type SeoRobotsDirective = 'index,follow' | 'noindex,nofollow';

export interface SeoPageMeta {
  canonicalUrl: string;
  title: string;
  description: string;
  robots: SeoRobotsDirective;
  og: {
    title: string;
    description: string;
    image?: string;
    type: string;
    url: string;
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    image?: string;
  };
  jsonLd?: Record<string, unknown>;
  httpStatus: 200 | 404;
}

const extract = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const SeoApi = {
  async resolvePageMeta(path: string): Promise<SeoPageMeta> {
    const response = await apiClient.get('/public/seo/resolve', {
      params: { path },
    });
    return extract<SeoPageMeta>(response.data);
  },
};