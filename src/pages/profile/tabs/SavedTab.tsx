import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Bookmark } from 'lucide-react';
import { apiClient } from '@/api/httpClient';
import MediaRenderer from '@/components/media/MediaRenderer';
import { buildCollectionRoute, buildDesignRoute } from '@/utils/catalogRoutes';

interface SavedItem {
  id: string;
  targetType: 'COLLECTION' | 'COLLECTION_MEDIA';
  targetId: string;
  collectionId?: string;
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

      return {
        id,
        targetType: item.targetType === 'COLLECTION_MEDIA' ? 'COLLECTION_MEDIA' : 'COLLECTION',
        targetId,
        collectionId: item.collectionId ? String(item.collectionId) : undefined,
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

const formatPrice = (value?: number): string | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

export const SavedTab: React.FC<SavedTabProps> = ({ isOwner }) => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedItems = async () => {
      if (!isOwner) {
        setSavedItems([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get('/saved/me');
        setSavedItems(toSavedItems(response.data));
        setError(null);
      } catch (err) {
        setSavedItems([]);
        setError('Failed to load saved items');
        console.error('Error fetching saved items:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchSavedItems();
  }, [isOwner]);

  if (!isOwner) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, idx) => (
          <div
            key={idx}
            className="rounded-3xl border border-gray-200/70 bg-white/70 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 animate-pulse"
          >
            <div className="mb-3 aspect-[4/5] rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="mb-2 h-4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
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
        <p className="text-sm font-semibold">Error Loading Saved Items</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <section className="glass-panel min-h-[340px] rounded-[2rem] border border-gray-200/70 bg-white/70 p-8 text-center backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:p-12">
        <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center">
          <div className="mb-4 text-6xl">🗂️</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">No saved items yet</h3>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Save designs to revisit them later. Your curated collection starts with a single click.
          </p>
          <button
            type="button"
            onClick={() => navigate('/market')}
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
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {savedItems.map((item) => {
        const brandName =
          [item.brand.firstName, item.brand.lastName].filter(Boolean).join(' ') ||
          item.brand.username ||
          'Unknown';
        const price = formatPrice(item.price);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.targetType === 'COLLECTION_MEDIA') {
                const designId = item.collectionId;
                if (designId) {
                  navigate(buildDesignRoute({ designId, legacyCollectionId: designId }));
                }
                return;
              }
              if (item.targetId) {
                navigate(buildCollectionRoute({ collectionId: item.targetId }));
              }
            }}
            className="group overflow-hidden rounded-3xl border border-gray-200/70 bg-white/70 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
              {item.thumbnail ? (
                <MediaRenderer
                  kind="image"
                  src={item.thumbnail}
                  alt={item.title}
                  fit="cover"
                  className="h-full w-full"
                  mediaClassName="transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No preview
                </div>
              )}

              <span className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-black/35 text-white backdrop-blur-sm">
                <Bookmark className="h-4 w-4" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                  {item.title}
                </h3>
                {price ? (
                  <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">{price}</span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                  {(item.brand.firstName?.charAt(0) ||
                    item.brand.lastName?.charAt(0) ||
                    item.brand.username?.charAt(0) ||
                    '?')
                    .toUpperCase()}
                </span>
                <span className="line-clamp-1">{brandName}</span>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
};
