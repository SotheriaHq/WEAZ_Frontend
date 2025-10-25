import type { MediaItem, MediaItemKind } from '../../types/media';

function detectKind(file: File): MediaItemKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

/**
 * Create MediaItem wrappers for a set of File objects.
 * - Deduplicates by name-size-lastModified fingerprint
 * - Assigns a stable id (uuid)
 * - Detects media type
 * - Does NOT create object URLs here (previewUrl left undefined)
 *
 * This keeps logic centralized so other upload flows can reuse the same
 * deduplication and id semantics.
 */
const genId = () => {
  try {
    // Prefer browser/Node crypto if available
    const g = (globalThis as unknown) as { crypto?: { randomUUID?: () => string } };
    if (g && g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

export function createMediaItems(files: File[]): MediaItem[] {
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  for (const f of files) {
    const key = `${f.name}_${f.size}_${f.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: genId(), file: f, kind: detectKind(f), previewUrl: '' });
  }
  return items;
}

export default createMediaItems;
