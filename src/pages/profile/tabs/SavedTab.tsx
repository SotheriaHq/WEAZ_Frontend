import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { apiClient } from '@/api/httpClient';
import ContentTile from '@/components/catalog/ContentTile';
import { buildCollectionRoute, buildDesignRoute, buildProductRoute } from '@/utils/catalogRoutes';
import useCachedResource from '@/hooks/useCachedResource';
import useClipTarget, { type ClipTargetType } from '@/features/clipping/useClipTarget';
import { CLIPPED_EMOJI, UNCLIP_LABEL } from '@/constants/clipping';
import { formatPrice } from '@/utils/helpers';

interface SavedItem {
  id: string;
  targetType: ClipTargetType;
  targetId: string;
  designId?: string;
  productId?: string;
  collectionId?: string;
  legacyCollectionId?: string;
  /** Present on COLLECTION_MEDIA rows: the exact frame that was clipped. */
  mediaId?: string;
  title: string;
  thumbnail?: string;
  price?: number;
  brand: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  createdAt: string;
}

interface SavedTabProps {
  isOwner: boolean;
}

const toSavedItems = (raw: unknown): SavedItem[] => {
  const payload = (raw as { data?: unknown } | null)?.data ?? raw;
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown } | null)?.items)
      ? (payload as { items: unknown[] }).items
      : Array.isArray((payload as { savedItems?: unknown } | null)?.savedItems)
        ? (payload as { savedItems: unknown[] }).savedItems
        : [];

  return source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const brand = (item.brand as Record<string, unknown> | undefined) ?? {};
      const id = String(item.id ?? '');
      const targetId = String(item.targetId ?? '');
      if (!id || !targetId) return null;
      const rawTargetType = String(item.targetType ?? '').toUpperCase();
      const targetType: SavedItem['targetType'] =
        rawTargetType === 'DESIGN' ||
        rawTargetType === 'PRODUCT' ||
        rawTargetType === 'COLLECTION_MEDIA'
          ? rawTargetType
          : 'COLLECTION';

      return {
        id,
        targetType,
        targetId,
        designId: item.designId ? String(item.designId) : undefined,
        productId: item.productId ? String(item.productId) : undefined,
        collectionId: item.collectionId ? String(item.collectionId) : undefined,
        legacyCollectionId: item.legacyCollectionId ? String(item.legacyCollectionId) : undefined,
        mediaId: item.mediaId ? String(item.mediaId) : undefined,
        title: String(item.title ?? 'Untitled'),
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
        price: typeof item.price === 'number' ? item.price : undefined,
        brand: {
          id: String(brand.id ?? ''),
          username: String(brand.username ?? ''),
          firstName: String(brand.firstName ?? ''),
          lastName: String(brand.lastName ?? ''),
          profileImage: typeof brand.profileImage === 'string' ? brand.profileImage : undefined,
        },
        createdAt: String(item.createdAt ?? new Date(0).toISOString()),
      } as SavedItem;
    })
    .filter((item): item is SavedItem => Boolean(item));
};

const brandLabel = (brand: SavedItem['brand']): string =>
  [brand.firstName, brand.lastName].filter(Boolean).join(' ') || brand.username || 'Unknown';

/**
 * Where opening a clipped item should land.
 *
 * Every row here is a real destination, which was not true before: a
 * COLLECTION_MEDIA row is one FRAME of a design, so it has to carry
 * `openMedia` or the viewer opens the cover instead of the piece the shopper
 * actually clipped. Returns null only when the row has no id to open at all.
 */
const routeForSavedItem = (item: SavedItem): string | null => {
  if (item.targetType === 'COLLECTION_MEDIA') {
    const designId = item.collectionId ?? item.designId;
    if (!designId) return null;
    return buildDesignRoute({
      designId,
      legacyCollectionId: item.legacyCollectionId ?? designId,
      query: { openMedia: item.mediaId ?? item.targetId },
    });
  }
  if (item.targetType === 'DESIGN') {
    return buildDesignRoute({
      designId: item.designId ?? item.targetId,
      legacyCollectionId: item.legacyCollectionId ?? item.collectionId,
    });
  }
  if (item.targetType === 'PRODUCT') {
    return buildProductRoute({ productId: item.productId ?? item.targetId });
  }
  return item.targetId ? buildCollectionRoute({ collectionId: item.targetId }) : null;
};

export const SavedTab: React.FC<SavedTabProps> = ({ isOwner }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toggleClip } = useClipTarget();

  // Cached fetch: on revisit within the retention window, clipped items paint
  // instantly (no skeleton) and revalidate silently. See useCachedResource.
  const {
    data: savedItems = [],
    loading,
    error: fetchError,
    refetch,
  } = useCachedResource<SavedItem[]>({
    queryKey: ['saved', 'me'],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/saved/me', { signal });
      return toSavedItems(response.data);
    },
    enabled: isOwner,
  });
  const error = fetchError ? 'Failed to load your clips' : null;

  /**
   * Closing the viewer comes back HERE.
   *
   * `DesignDetailsPage` falls back to `/runway` when nobody tells it where the
   * reader came from, so opening a clip and pressing back dropped the shopper
   * into the feed with their tab, their scroll position and their place in the
   * list all gone. That is the broken flow.
   */
  const openItem = useCallback(
    (item: SavedItem) => {
      const to = routeForSavedItem(item);
      if (!to) return;
      const returnTo = `${location.pathname}${location.search}` || '/profile';
      navigate(to, { state: { returnTo } });
    },
    [location.pathname, location.search, navigate],
  );

  const unclip = useCallback(
    async (item: SavedItem) => {
      // Drop it from the visible list first — the grid IS the confirmation.
      queryClient.setQueryData<SavedItem[]>(['saved', 'me'], (current) =>
        Array.isArray(current) ? current.filter((row) => row.id !== item.id) : current,
      );
      const result = await toggleClip({
        targetType: item.targetType,
        targetId: item.targetId,
        clipped: true,
      });
      if (result === null) {
        // The server refused; put the row back rather than leave a hole.
        await refetch();
      }
    },
    [queryClient, refetch, toggleClip],
  );

  if (!isOwner) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {[...Array(6)].map((_, idx) => (
          <div
            key={idx}
            className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-200 dark:bg-white/10"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-center text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold">Your clips could not load</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <section className="glass-panel min-h-[340px] rounded-[2rem] border border-gray-200/70 bg-white/70 p-8 text-center backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-12">
        <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            {CLIPPED_EMOJI}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Nothing clipped yet</h3>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Clip a design, a product or a collection and it waits for you here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/runway')}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-6 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            Explore Trends
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {savedItems.map((item, index) => (
        <ContentTile
          key={item.id}
          title={item.title}
          subtitle={brandLabel(item.brand)}
          priceLabel={typeof item.price === 'number' ? formatPrice(item.price) : null}
          mediaUrl={item.thumbnail ?? null}
          mediaAlt={item.title}
          priority={index < 2}
          onOpen={() => openItem(item)}
          actions={
            /* The bookmark here used to be decoration — a badge that looked
               like a control and did nothing. It unclips now, which is the one
               thing a shopper wants from this grid. */
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void unclip(item);
              }}
              aria-label={`${UNCLIP_LABEL} ${item.title}`}
              title={UNCLIP_LABEL}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-black/45 text-base leading-none text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true">{CLIPPED_EMOJI}</span>
            </button>
          }
        />
      ))}
    </section>
  );
};
