export interface MediaItem {
  id: string;
  isPrimary?: boolean;
}

export const normalizePrimary = <T extends MediaItem>(items: T[]): Array<T & { isPrimary: boolean }> => {
  if (items.length === 0) return [] as Array<T & { isPrimary: boolean }>;
  const primaryIndex = items.findIndex((item) => item.isPrimary);
  if (primaryIndex === -1) {
    return items.map((item, idx) => ({ ...item, isPrimary: idx === 0 }));
  }
  return items.map((item, idx) => ({ ...item, isPrimary: idx === primaryIndex }));
};

export const setPrimary = <T extends MediaItem>(items: T[], id: string): Array<T & { isPrimary: boolean }> => {
  return items.map((item) => ({ ...item, isPrimary: item.id === id }));
};

export const reorderItems = <T>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const validateMedia = (
  items: MediaItem[],
  max: number,
  minRequired = 4,
): { ok: boolean; error?: string } => {
  if (items.length > max) {
    return { ok: false, error: `You can upload up to ${max} images` };
  }
  if (items.length > 0 && items.length < minRequired) {
    return {
      ok: false,
      error: `Upload at least ${minRequired} images: front, left, right, and back`,
    };
  }
  if (items.length > 0 && !items.some((item) => item.isPrimary)) {
    return { ok: false, error: 'Please choose a cover image' };
  }
  return { ok: true };
};
