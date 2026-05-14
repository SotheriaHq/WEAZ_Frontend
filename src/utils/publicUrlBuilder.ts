import { env } from '@/config/env';

const normalizeBaseUrl = (value?: string): string => {
  if (value && value.trim().length > 0) {
    return value.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:5173';
};

export type PublicUrlTarget =
  | {
      entityType: 'profile';
      id?: string | null;
      username?: string | null;
    }
  | {
      entityType: 'storefront';
      ownerId?: string | null;
      slug?: string | null;
      username?: string | null;
    }
  | {
      entityType: 'design';
      id: string;
      legacyCollectionId?: string | null;
    }
  | {
      entityType: 'product';
      id?: string | null;
      slug?: string | null;
    }
  | {
      entityType: 'collection';
      id: string;
    }
  | {
      entityType: 'order';
      orderId: string;
    };

export const getAppBaseUrl = (): string => normalizeBaseUrl(env.appUrl);

const toAbsoluteUrl = (path: string): string => {
  return new URL(path, `${getAppBaseUrl()}/`).toString();
};

export const buildProfileUrl = (profile: {
  id?: string | null;
  username?: string | null;
}): string => {
  const username = profile.username?.trim();
  if (username) {
    return toAbsoluteUrl(`/u/${encodeURIComponent(username)}`);
  }

  return toAbsoluteUrl(`/profile/${encodeURIComponent(profile.id?.trim() || '')}`);
};

export const buildStorefrontUrl = (store: {
  ownerId?: string | null;
  slug?: string | null;
  username?: string | null;
}): string => {
  const slug = store.slug?.trim() || store.username?.trim();
  if (slug) {
    return toAbsoluteUrl(`/brand/${encodeURIComponent(slug)}`);
  }

  const ownerId = store.ownerId?.trim();
  if (ownerId) {
    return toAbsoluteUrl(`/profile/${encodeURIComponent(ownerId)}`);
  }

  return toAbsoluteUrl('/profile');
};

export const buildProductUrl = (product: {
  id?: string | null;
  slug?: string | null;
}): string => {
  const slug = product.slug?.trim();
  if (slug) {
    return toAbsoluteUrl(`/p/${encodeURIComponent(slug)}`);
  }

  return toAbsoluteUrl(`/products/${encodeURIComponent(product.id?.trim() || '')}`);
};

export const buildDesignUrl = (design: {
  id?: string | null;
  legacyCollectionId?: string | null;
}): string => {
  const designId = design.id?.trim() || design.legacyCollectionId?.trim() || '';
  const params = new URLSearchParams();
  const legacyCollectionId = design.legacyCollectionId?.trim();
  if (legacyCollectionId && legacyCollectionId !== designId) {
    params.set('legacyCollectionId', legacyCollectionId);
  }

  const query = params.toString();
  return toAbsoluteUrl(`/designs/${encodeURIComponent(designId)}${query ? `?${query}` : ''}`);
};

export const buildCollectionUrl = (collectionId: string): string => {
  return toAbsoluteUrl(`/collections/${encodeURIComponent(collectionId)}`);
};

export const buildOrderUrl = (orderId: string): string => {
  return toAbsoluteUrl(`/orders/${encodeURIComponent(orderId)}`);
};

export const buildPublicUrl = (target: PublicUrlTarget): string => {
  switch (target.entityType) {
    case 'profile':
      return buildProfileUrl(target);
    case 'storefront':
      return buildStorefrontUrl(target);
    case 'design':
      return buildDesignUrl(target);
    case 'product':
      return buildProductUrl(target);
    case 'collection':
      return buildCollectionUrl(target.id);
    case 'order':
      return buildOrderUrl(target.orderId);
    default:
      return toAbsoluteUrl('/');
  }
};
