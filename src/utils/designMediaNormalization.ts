import type { MediaItemKind } from '@/types/media';

export type NormalizedDesignMedia = {
  id: string;
  remoteId?: string;
  fileId?: string;
  previewUrl?: string;
  kind: MediaItemKind;
  viewSlot?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return undefined;
};

const resolveKind = (media: Record<string, unknown>, file: Record<string, unknown>): MediaItemKind => {
  const raw = firstString(media.type, media.kind, file.fileType, file.mimeType, file.type) ?? '';
  return /video/i.test(raw) ? 'video' : 'image';
};

const collectMediaRows = (source: Record<string, unknown>) => {
  const rows = [
    source.medias,
    source.media,
    source.images,
    source.mediaItems,
  ].find(Array.isArray);
  return Array.isArray(rows) ? rows : [];
};

export function normalizeDesignMediaResponse(source: unknown): NormalizedDesignMedia[] {
  const record = asRecord(source);
  const rows = collectMediaRows(record);
  const seen = new Set<string>();

  return rows
    .map((row, index): NormalizedDesignMedia | null => {
      const media = asRecord(row);
      const file = asRecord(media.file);
      const fileId = firstString(
        media.fileId,
        media.fileUploadId,
        media.file_upload_id,
        file.id,
        file.fileId,
      );
      const remoteId = firstString(
        media.id,
        media.mediaId,
        media.collectionMediaId,
        media.legacyCollectionMediaId,
      );
      const previewUrl = firstString(
        media.previewUrl,
        media.remoteUrl,
        media.url,
        media.s3Url,
        media.thumbnailUrl,
        media.coverImage,
        file.signedUrl,
        file.s3Url,
        file.url,
      );
      const id = remoteId ?? fileId ?? `remote-media-${index}`;
      const dedupeKey = `${id}|${fileId ?? ''}|${previewUrl ?? ''}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      return {
        id,
        remoteId,
        fileId,
        previewUrl,
        kind: resolveKind(media, file),
        viewSlot: firstString(media.viewSlot, media.view_slot),
      };
    })
    .filter((item): item is NormalizedDesignMedia => Boolean(item));
}
