export type ImageSurface = 'avatar' | 'banner' | 'feed' | 'card' | 'detail' | 'zoom';

export type VariantDescriptor = {
  url: string;
  width: number;
  height: number;
  format?: string;
};

export type VariantPayload = {
  processingStatus?: 'PENDING' | 'READY' | 'FAILED' | string;
  variants?: {
    thumb?: VariantDescriptor;
    card?: VariantDescriptor;
    detail?: VariantDescriptor;
    zoom?: VariantDescriptor;
    avatar?: VariantDescriptor;
    banner?: VariantDescriptor;
  };
  fallbackUrl?: string;
  s3Url?: string;
};

export type SelectedVariant = {
  src: string;
  srcSet?: string;
  sizes?: string;
  pending: boolean;
  failed: boolean;
};

const SURFACE_FALLBACK_ORDER: Record<ImageSurface, Array<keyof NonNullable<VariantPayload['variants']>>> = {
  avatar: ['avatar', 'thumb', 'card', 'detail'],
  banner: ['banner', 'detail', 'card'],
  feed: ['card', 'thumb', 'detail'],
  card: ['card', 'thumb', 'detail'],
  detail: ['detail', 'zoom', 'card'],
  zoom: ['zoom', 'detail', 'card'],
};

const SURFACE_SIZES: Record<ImageSurface, string> = {
  avatar: '128px',
  banner: '100vw',
  feed: '(max-width: 768px) 100vw, 50vw',
  card: '(max-width: 768px) 100vw, 33vw',
  detail: '(max-width: 768px) 100vw, 80vw',
  zoom: '100vw',
};

export function selectImageVariant(
  media: VariantPayload | null | undefined,
  surface: ImageSurface,
): SelectedVariant {
  const fallback = media?.fallbackUrl || media?.s3Url || '';
  const processing = String(media?.processingStatus || 'READY').toUpperCase();

  const orderedKeys = SURFACE_FALLBACK_ORDER[surface] || ['detail', 'card', 'thumb'];
  const variants = media?.variants || {};
  const selected = orderedKeys
    .map((key) => variants[key])
    .find((item): item is VariantDescriptor => Boolean(item?.url));

  if (!selected) {
    return {
      src: fallback,
      pending: processing === 'PENDING',
      failed: processing === 'FAILED',
    };
  }

  const srcSetCandidates = orderedKeys
    .map((key) => variants[key])
    .filter((item): item is VariantDescriptor => Boolean(item?.url && item.width))
    .sort((a, b) => a.width - b.width)
    .map((item) => `${item.url} ${item.width}w`);

  return {
    src: selected.url,
    srcSet: srcSetCandidates.length > 1 ? srcSetCandidates.join(', ') : undefined,
    sizes: srcSetCandidates.length > 1 ? SURFACE_SIZES[surface] : undefined,
    pending: processing === 'PENDING',
    failed: processing === 'FAILED',
  };
}
