import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { brandApi } from '@/api/BrandApi';
import { fetchCollectionDetailQuery } from '@/query/queries';
import { WIEZ_QUERY_STALE_TIME_MS } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import type { MarketItem } from '@/types/market';

/**
 * A single runway reel media slide (design angle). Deliberately lean — the
 * inline reel carousel only needs a stable id, a resolved URL, and enough
 * hints to pick image-vs-video + fit.
 */
export type ReelMedia = {
  id: string;
  type: 'image' | 'video';
  url: string;
  fileId: string | null;
  aspectRatio: number | null;
};

const toReelMediaType = (raw?: string | null): 'image' | 'video' =>
  String(raw ?? '').toUpperCase().includes('VIDEO') ? 'video' : 'image';

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Seed slide built from the feed cover media so slide 0 paints instantly
 * before the full angle list hydrates (native parity — the first frame is
 * never a shimmer).
 */
const buildSeedMedia = (item: MarketItem): ReelMedia | null => {
  const url = item.media?.url ?? item.media?.previewUrl ?? '';
  const fileId = item.media?.fileId ?? null;
  if (!url && !fileId) return null;
  return {
    id: item.id,
    type: toReelMediaType(item.media?.type),
    url: url ?? '',
    fileId: fileId || null,
    aspectRatio:
      typeof item.media?.aspectRatio === 'number' ? item.media.aspectRatio : null,
  };
};

/**
 * Resolve the full list of angles for a design (Runway reel), reusing the
 * exact hydration `DesignViewModal` uses: `fetchCollectionDetailQuery(...,
 * 'design')` for the media list, then a public → signed URL resolution per
 * media. Enabled lazily (only when the reel is active/priority) so scrolling
 * the feed never fans out a detail fetch per off-screen reel.
 */
export function useReelDesignMedia(
  item: MarketItem,
  { enabled }: { enabled: boolean },
): { media: ReelMedia[]; loading: boolean } {
  const queryClient = useQueryClient();
  const seed = React.useMemo(() => buildSeedMedia(item), [item]);
  const [media, setMedia] = React.useState<ReelMedia[]>(() => (seed ? [seed] : []));
  const [loading, setLoading] = React.useState(false);
  const hydratedIdRef = React.useRef<string | null>(null);

  const collectionId = item.collectionId;

  // Keep slide 0 in sync with the feed cover until the full list hydrates.
  React.useEffect(() => {
    if (hydratedIdRef.current === collectionId) return;
    setMedia(seed ? [seed] : []);
  }, [collectionId, seed]);

  React.useEffect(() => {
    if (!enabled || !collectionId) return;
    if (hydratedIdRef.current === collectionId) return;

    let mounted = true;
    setLoading(true);

    const hydrate = async () => {
      try {
        const detail: any = await fetchCollectionDetailQuery(
          queryClient,
          collectionId,
          'design',
        );
        const rawMedias: any[] = Array.isArray(detail?.medias)
          ? detail.medias
          : Array.isArray(detail?.media)
            ? detail.media
            : [];

        const parsed: ReelMedia[] = rawMedias
          .map((m: any): ReelMedia | null => {
            const mediaId = typeof m?.id === 'string' ? m.id : null;
            if (!mediaId) return null;
            const file = m?.file ?? {};
            const fileId = typeof file?.id === 'string' ? file.id : null;
            // Don't seed raw S3 URLs when a fileId exists — they bypass API URL
            // resolution below (same rule as DesignViewModal).
            const url = fileId ? '' : String(file?.s3Url ?? file?.url ?? m?.url ?? '');
            const aspectRatio =
              toFiniteNumber(m?.aspectRatio ?? file?.aspectRatio) ??
              (toFiniteNumber(file?.width) && toFiniteNumber(file?.height)
                ? (toFiniteNumber(file?.width) as number) /
                  (toFiniteNumber(file?.height) as number)
                : null);
            return {
              id: mediaId,
              type: toReelMediaType(m?.mediaType ?? m?.type ?? file?.mimeType),
              url,
              fileId,
              aspectRatio,
            };
          })
          .filter((m: ReelMedia | null): m is ReelMedia => Boolean(m));

        const hydrated = await Promise.all(
          parsed.map(async (m) => {
            if (!m.fileId) return m;
            if (m.url && /^https?:\/\//i.test(m.url)) return m;
            let publicUrl: string | null = null;
            try {
              publicUrl = await queryClient.fetchQuery({
                queryKey: queryKeys.media.publicUrl(m.fileId),
                queryFn: () => brandApi.getPublicFileUrl(String(m.fileId)),
                staleTime: WIEZ_QUERY_STALE_TIME_MS,
                retry: false,
              });
            } catch {
              publicUrl = null;
            }
            try {
              const signed =
                publicUrl ??
                (await queryClient.fetchQuery({
                  queryKey: queryKeys.media.signedUrl(m.fileId),
                  queryFn: () => brandApi.getPrivateSignedFileUrl(String(m.fileId)),
                  staleTime: WIEZ_QUERY_STALE_TIME_MS,
                  gcTime: WIEZ_QUERY_STALE_TIME_MS,
                  retry: false,
                }));
              return { ...m, url: signed || m.url };
            } catch {
              return m;
            }
          }),
        );

        const deduped = hydrated.filter(
          (m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx,
        );
        const usable = deduped.filter((m) => Boolean(m.url) || Boolean(m.fileId));
        if (!mounted) return;
        if (usable.length > 0) {
          hydratedIdRef.current = collectionId;
          setMedia(usable);
        }
      } catch {
        // Keep the seed cover on failure — the reel still shows something.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [enabled, collectionId, queryClient]);

  return { media, loading };
}

export default useReelDesignMedia;
