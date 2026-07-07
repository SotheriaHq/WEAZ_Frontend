import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SeoApi } from '@/api/SeoApi';
import {
  APP_NAME,
  PRODUCT_DESCRIPTION,
  PUBLIC_WEB_URL,
} from '@/config/productIdentity';
import { trackPageView } from '@/observability/analytics';
import { isSeoNoindexClientPath } from '@/utils/seoPaths';

const DEFAULT_TITLE = APP_NAME;
const DEFAULT_DESCRIPTION = PRODUCT_DESCRIPTION;
const DEFAULT_IMAGE = '/brand/wiez-logo-mark.svg';

const upsertMeta = (
  attribute: 'name' | 'property',
  key: string,
  content?: string,
) => {
  if (!content) return;
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertLink = (rel: string, href?: string) => {
  if (!href) return;
  let element = document.head.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const upsertJsonLd = (payload?: Record<string, unknown>) => {
  const id = 'wiez-seo-jsonld';
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  if (!payload) return;
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(payload);
  document.head.appendChild(script);
};

const resolveOrigin = () =>
  PUBLIC_WEB_URL.startsWith('http')
    ? PUBLIC_WEB_URL.replace(/\/+$/, '')
    : window.location.origin;

const applyFallbackMeta = (
  pathname: string,
  robots: 'index,follow' | 'noindex,nofollow' = 'index,follow',
) => {
  const origin = resolveOrigin();
  const canonical = `${origin}${pathname === '/' ? '' : pathname}`;

  document.title = DEFAULT_TITLE;
  upsertMeta('name', 'description', DEFAULT_DESCRIPTION);
  upsertMeta('name', 'robots', robots);
  upsertLink('canonical', canonical);
  upsertMeta('property', 'og:site_name', DEFAULT_TITLE);
  upsertMeta('property', 'og:locale', 'en_US');
  upsertMeta('property', 'og:title', DEFAULT_TITLE);
  upsertMeta('property', 'og:description', DEFAULT_DESCRIPTION);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', `${origin}${DEFAULT_IMAGE}`);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', DEFAULT_TITLE);
  upsertMeta('name', 'twitter:description', DEFAULT_DESCRIPTION);
  upsertMeta('name', 'twitter:image', `${origin}${DEFAULT_IMAGE}`);
  upsertJsonLd(undefined);
};

const applyResolvedMeta = (meta: Awaited<ReturnType<typeof SeoApi.resolvePageMeta>>) => {
  document.title = meta.title;
  upsertMeta('name', 'description', meta.description);
  upsertMeta('name', 'robots', meta.robots);
  upsertLink('canonical', meta.canonicalUrl);
  upsertMeta('property', 'og:site_name', APP_NAME);
  upsertMeta('property', 'og:locale', 'en_US');
  upsertMeta('property', 'og:title', meta.og.title);
  upsertMeta('property', 'og:description', meta.og.description);
  upsertMeta('property', 'og:type', meta.og.type);
  upsertMeta('property', 'og:url', meta.og.url);
  upsertMeta('property', 'og:image', meta.og.image);
  upsertMeta('name', 'twitter:card', meta.twitter.card);
  upsertMeta('name', 'twitter:title', meta.twitter.title);
  upsertMeta('name', 'twitter:description', meta.twitter.description);
  upsertMeta('name', 'twitter:image', meta.twitter.image);

  for (const tag of meta.extraMeta ?? []) {
    upsertMeta(tag.attribute, tag.key, tag.content);
  }

  upsertJsonLd(meta.jsonLd);
};

const SeoHead: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    let active = true;

    if (isSeoNoindexClientPath(location.pathname)) {
      applyFallbackMeta(location.pathname, 'noindex,nofollow');
      trackPageView(path);
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const meta = await SeoApi.resolvePageMeta(path);
        if (!active) return;
        applyResolvedMeta(meta);
      } catch {
        if (!active) return;
        const robots = isSeoNoindexClientPath(location.pathname)
          ? 'noindex,nofollow'
          : 'index,follow';
        applyFallbackMeta(location.pathname, robots);
      } finally {
        if (active) {
          trackPageView(path);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [location.pathname, location.search]);

  return null;
};

export default SeoHead;