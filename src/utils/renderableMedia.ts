export interface RenderableMediaSource {
  src: string | null;
  fileId: string | null;
}

type MediaLike = {
  id?: unknown;
  url?: unknown;
  type?: unknown;
  isPrimary?: unknown;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isRemoteMediaValue = (value: unknown): value is string => {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  return (
    normalized.startsWith("http") ||
    normalized.startsWith("/") ||
    normalized.startsWith("data:") ||
    normalized.includes("://") ||
    normalized.includes("?")
  );
};

export const isLikelyFileId = (value: unknown): value is string => {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  return !isRemoteMediaValue(normalized);
};

export const toRenderableMediaSource = (
  value: unknown,
): RenderableMediaSource => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { src: null, fileId: null };
  }
  return isRemoteMediaValue(normalized)
    ? { src: normalized, fileId: null }
    : { src: null, fileId: normalized };
};

const pushUniqueSource = (
  sources: RenderableMediaSource[],
  seen: Set<string>,
  src: string | null,
  fileId: string | null,
) => {
  if (!src && !fileId) return;
  const key = `${src ?? ""}|${fileId ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  sources.push({ src, fileId });
};

export const getRenderableProductMediaSources = (
  product: Record<string, unknown> | null | undefined,
): RenderableMediaSource[] => {
  if (!product || typeof product !== "object") return [];

  const sources: RenderableMediaSource[] = [];
  const seen = new Set<string>();

  const mediaItems = Array.isArray(product.media)
    ? (product.media as MediaLike[])
    : [];
  const orderedMediaItems = [...mediaItems].sort(
    (a, b) => Number(Boolean(b?.isPrimary)) - Number(Boolean(a?.isPrimary)),
  );

  orderedMediaItems.forEach((mediaItem) => {
    const mediaType = normalizeString(mediaItem?.type)?.toLowerCase() ?? "";
    if (mediaType.includes("video")) return;

    const rawUrl = normalizeString(mediaItem?.url);
    const mediaId = isLikelyFileId(mediaItem?.id) ? mediaItem.id : null;

    if (rawUrl) {
      if (isRemoteMediaValue(rawUrl)) {
        pushUniqueSource(sources, seen, rawUrl, mediaId);
        return;
      }
      pushUniqueSource(sources, seen, null, mediaId ?? rawUrl);
      return;
    }

    pushUniqueSource(sources, seen, null, mediaId);
  });

  const candidateValues = [
    product.coverImage,
    product.coverUrl,
    product.thumbnail,
    ...(Array.isArray(product.images) ? product.images : []),
  ];

  candidateValues.forEach((candidate) => {
    const renderable = toRenderableMediaSource(candidate);
    pushUniqueSource(sources, seen, renderable.src, renderable.fileId);
  });

  if (Array.isArray(product.mediaIds)) {
    product.mediaIds.forEach((mediaId) => {
      pushUniqueSource(
        sources,
        seen,
        null,
        isLikelyFileId(mediaId) ? mediaId : null,
      );
    });
  }

  return sources;
};
