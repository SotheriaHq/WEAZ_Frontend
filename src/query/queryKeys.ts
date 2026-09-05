import { normalizeUuidV4List } from '@/utils/uuid';

export type CollectionScopeKey = 'design' | 'store' | 'all' | null | undefined;
export type CollectionVisibilityKey = 'public' | 'private' | 'all' | null | undefined;

const normalizeId = (value?: string | null) => String(value ?? '').trim();

const normalizeRecord = (value?: object | null) => {
  if (!value) return {};
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const entry = record[key];
      if (entry !== undefined && entry !== null && entry !== '') {
        acc[key] = entry;
      }
      return acc;
    }, {});
};

type WishlistParams = Record<string, unknown> | null | undefined;

const resolveWishlistArgs = (
  userIdOrParams?: string | null | WishlistParams,
  params?: WishlistParams,
) => {
  if (
    userIdOrParams &&
    typeof userIdOrParams === 'object' &&
    !Array.isArray(userIdOrParams)
  ) {
    return { userId: '', params: userIdOrParams };
  }

  return {
    userId: normalizeId(userIdOrParams as string | null | undefined),
    params,
  };
};

export const queryKeys = {
  auth: {
    profile: () => ['auth', 'profile'] as const,
  },
  user: {
    publicProfile: (userId?: string | null) => ['user', 'publicProfile', normalizeId(userId)] as const,
    meProfile: (userId?: string | null) => ['user', 'meProfile', normalizeId(userId)] as const,
  },
  brand: {
    profile: (brandId?: string | null) => ['brand', 'profile', normalizeId(brandId)] as const,
    collections: (
      ownerId?: string | null,
      filters?: {
        scope?: CollectionScopeKey;
        visibility?: CollectionVisibilityKey;
        includeDeleted?: boolean | null;
        onlyDeleted?: boolean | null;
      },
    ) =>
      [
        'brand',
        'collections',
        normalizeId(ownerId),
        normalizeRecord({
          scope: filters?.scope ?? 'design',
          visibility: filters?.visibility ?? null,
          includeDeleted: filters?.includeDeleted ?? null,
          onlyDeleted: filters?.onlyDeleted ?? null,
        }),
      ] as const,
    collectionDetail: (collectionId?: string | null, scope?: CollectionScopeKey) =>
      ['brand', 'collectionDetail', normalizeId(collectionId), scope ?? 'design'] as const,
    myDrafts: (ownerId?: string | null) =>
      ['brand', 'drafts', 'mine', normalizeId(ownerId)] as const,
    finance: (userId?: string | null) =>
      ['brand', 'finance', normalizeId(userId)] as const,
    reviewsDashboard: (params?: object | null) =>
      ['brand', 'reviewsDashboard', normalizeRecord(params)] as const,
  },
  brandPrivateAccess: {
    myStates: (brandId?: string | null, viewerId?: string | null) =>
      ['brandPrivateAccess', 'myStates', normalizeId(brandId), normalizeId(viewerId)] as const,
  },
  design: {
    detail: (designId?: string | null) => ['design', 'detail', normalizeId(designId)] as const,
  },
  designs: {
    user: (userId?: string | null, params?: Record<string, unknown> | null) =>
      ['designs', 'user', normalizeId(userId), normalizeRecord(params)] as const,
  },
  store: {
    status: () => ['store', 'status'] as const,
    cart: (userId?: string | null) => ['store', 'cart', normalizeId(userId)] as const,
    wishlistRoot: (userId?: string | null) => ['store', 'wishlist', normalizeId(userId)] as const,
    product: (productId?: string | null, params?: object | null) =>
      ['store', 'product', normalizeId(productId), normalizeRecord(params)] as const,
    wishlist: (userIdOrParams?: string | null | WishlistParams, params?: WishlistParams) => {
      const resolved = resolveWishlistArgs(userIdOrParams, params);
      return ['store', 'wishlist', resolved.userId, normalizeRecord(resolved.params)] as const;
    },
    bagCount: (userId?: string | null) => ['store', 'bagCount', normalizeId(userId)] as const,
  },
  config: {
    uploadLimits: () => ['config', 'uploadLimits'] as const,
  },
  media: {
    publicUrl: (fileId?: string | null) => ['media', 'publicUrl', normalizeId(fileId)] as const,
    signedUrl: (fileId?: string | null) => ['media', 'signedUrl', normalizeId(fileId)] as const,
  },
  saved: {
    status: (targetType?: string | null, targetId?: string | null) =>
      ['saved', 'status', normalizeId(targetType), normalizeId(targetId)] as const,
    batch: (targetType?: string | null, targetIds?: Array<string | null | undefined> | null) =>
      ['saved', 'batch', normalizeId(targetType), normalizeUuidV4List(targetIds)] as const,
  },
  threaded: {
    collection: (collectionId?: string | null) => ['threaded', 'collection', normalizeId(collectionId)] as const,
    collectionMedia: (mediaId?: string | null) => ['threaded', 'collectionMedia', normalizeId(mediaId)] as const,
  },
  notifications: {
    unreadCount: () => ['notifications', 'unreadCount'] as const,
    settings: (userId?: string | null) => ['notifications', 'settings', normalizeId(userId)] as const,
  },
  messaging: {
    unreadCount: () => ['messaging', 'unreadCount'] as const,
    inbox: (userId?: string | null) => ['messaging', 'inbox', normalizeId(userId)] as const,
  },
  comments: {
    listRoot: (targetType?: string | null, targetId?: string | null) =>
      ['comments', 'list', normalizeId(targetType), normalizeId(targetId)] as const,
    list: (
      targetType?: string | null,
      targetId?: string | null,
      params?: { cursor?: string | null; limit?: number | null },
    ) =>
      [
        'comments',
        'list',
        normalizeId(targetType),
        normalizeId(targetId),
        normalizeRecord({
          cursor: params?.cursor ?? null,
          limit: params?.limit ?? 20,
        }),
      ] as const,
    unifiedCollectionRoot: (collectionId?: string | null) =>
      ['comments', 'unifiedCollection', normalizeId(collectionId)] as const,
    unifiedCollection: (
      collectionId?: string | null,
      params?: { cursor?: string | null; limit?: number | null },
    ) =>
      [
        'comments',
        'unifiedCollection',
        normalizeId(collectionId),
        normalizeRecord({
          cursor: params?.cursor ?? null,
          limit: params?.limit ?? 20,
        }),
      ] as const,
    replies: (
      commentId?: string | null,
      params?: { cursor?: string | null; limit?: number | null },
    ) =>
      [
        'comments',
        'replies',
        normalizeId(commentId),
        normalizeRecord({
          cursor: params?.cursor ?? null,
          limit: params?.limit ?? 20,
        }),
      ] as const,
  },
  sizeFit: {
    myProfile: (userId?: string | null) => ['sizeFit', 'myProfile', normalizeId(userId)] as const,
    computed: (userId?: string | null, region?: string | null) =>
      ['sizeFit', 'computed', normalizeId(userId), normalizeId(region)] as const,
    shares: (userId?: string | null) => ['sizeFit', 'shares', normalizeId(userId)] as const,
  },
  customOrders: {
    displayChartPreference: (userId?: string | null) =>
      ['customOrders', 'displayChartPreference', normalizeId(userId)] as const,
    activeConfiguration: (sourceType?: string | null, sourceId?: string | null) =>
      ['customOrders', 'activeConfiguration', normalizeId(sourceType), normalizeId(sourceId)] as const,
    brandQueue: (params?: object | null) =>
      ['customOrders', 'brandQueue', normalizeRecord(params)] as const,
  },
  reviews: {
    brand: (brandId?: string | null) => ['reviews', 'brand', normalizeId(brandId)] as const,
    mine: () => ['reviews', 'mine'] as const,
  },
  /**
   * Runway = design feed UI (backend Design domain).
   * Keys use `runway` so they are not confused with commerce `market.*`.
   */
  runway: {
    feedCategories: () =>
      ['runway', 'feedCategories'] as const,
    feed: (params?: object | null) =>
      ['runway', 'feed', normalizeRecord(params)] as const,
  },
  /** Commerce Market (products, sections, suggestions) — not Runway/design feed. */
  market: {
    /** @deprecated Prefer queryKeys.runway.feedCategories */
    feedCategories: () =>
      ['runway', 'feedCategories'] as const,
    /** @deprecated Prefer queryKeys.runway.feed */
    feed: (params?: object | null) =>
      ['runway', 'feed', normalizeRecord(params)] as const,
    sections: (params?: object | null) =>
      ['market', 'sections', normalizeRecord(params)] as const,
    sectionDetail: (sectionKey?: string | null, params?: object | null) =>
      ['market', 'sectionDetail', normalizeId(sectionKey), normalizeRecord(params)] as const,
    fallbackProducts: (params?: object | null) =>
      ['market', 'fallbackProducts', normalizeRecord(params)] as const,
    suggestions: (params?: object | null) =>
      ['market', 'suggestions', normalizeRecord(params)] as const,
  },
};

// Single source of truth for which query roots hold user/brand-private data and
// must be purged on logout. sessionCleanup imports this instead of re-listing.
export const PRIVATE_QUERY_ROOTS = new Set<string>([
  'auth',
  'user',
  'brand',
  'brandPrivateAccess',
  'store',
  'saved',
  'notifications',
  'messaging',
  'sizeFit',
  'customOrders',
  'reviews',
  // Inline-keyed screen caches (MyOrders, OrderDetail, profile OrdersPanel,
  // studio OrderManagement) — user-private, must not survive logout.
  'orders',
  'profile',
  'studio',
  // PatchesTab keys inline as ['patches', profileId, scope]. It was missing
  // here, so the previous account's patched brands survived logout in memory —
  // and would have survived to disk the moment `patches` became persistable.
  'patches',
]);

/**
 * Which cached queries are written to storage and rehydrated on the next load.
 *
 * Reload/tab-discard behaviour, NOT freshness: rehydrated data still obeys
 * staleTime and revalidates silently, so the only thing persistence changes is
 * whether a returning user sees their content immediately or a cold skeleton.
 * Mobile browsers discard backgrounded tabs aggressively, which makes every
 * non-persisted screen a full cold load with a skeleton and a layout jump.
 *
 * Two things keep this safe rather than "persist everything":
 *  - every root listed here is also in PRIVATE_QUERY_ROOTS above, so logout
 *    purges it from disk;
 *  - payloads with real PII stay OUT. Orders (addresses, payment references),
 *    brand finance and the reviews dashboard are deliberately memory-only.
 */
export const isPersistableWiezQueryKey = (queryKey: readonly unknown[]) => {
  const [root, scope] = queryKey;
  if (root === 'brand') {
    return (
      scope === 'profile' ||
      scope === 'collections' ||
      scope === 'collectionDetail' ||
      // The owner's Drafts tab. Left out originally, so it was the one catalog
      // tab that always cold-loaded after a reload while Public/Private
      // repainted instantly from `brand.collections`.
      scope === 'drafts' ||
      scope === 'draft-collections'
    );
    // `brand.finance` and `brand.reviewsDashboard` intentionally fall through.
  }
  if (root === 'design' || root === 'designs' || root === 'config') {
    return true;
  }
  if (root === 'media') {
    return scope === 'publicUrl';
  }
  // Profile tabs the user actually round-trips between. These are read-only
  // display data with no PII, and they are exactly the tabs that came back
  // empty-then-flickering after a reload.
  if (root === 'reviews' || root === 'patches') {
    return true;
  }
  if (root === 'saved') {
    // The Saved TAB list only. `saved.status` / `saved.batch` are per-target
    // booleans probed for every card the user scrolls past — hundreds of tiny
    // entries that would crowd real content out of the 4MB storage budget for
    // no visible benefit (they re-resolve in one batched request).
    return scope === 'me';
  }
  if (root === 'market') {
    return (
      scope === 'feed' ||
      scope === 'feedCategories' ||
      scope === 'sections' ||
      scope === 'sectionDetail' ||
      scope === 'fallbackProducts'
    );
  }
  return false;
};
