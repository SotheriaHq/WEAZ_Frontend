export type CollectionProductQueueStatus =
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

export type CollectionProductQueueType = 'draft' | 'existing';

export interface CollectionProductQueueItem {
  tempId: string;
  sessionId: string;
  type: CollectionProductQueueType;
  status: CollectionProductQueueStatus;
  name?: string;
  productId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'threadly.collectionProductQueue.';
const EVENT_NAME = 'threadly:collection-product-queue-changed';

type QueueChangeEventDetail = {
  sessionId: string;
  items: CollectionProductQueueItem[];
};

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const storageKey = (sessionId: string) => `${STORAGE_PREFIX}${sessionId}`;

const normalizeItems = (sessionId: string, items: CollectionProductQueueItem[]) => {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (typeof item.tempId !== 'string' || item.tempId.trim().length === 0) {
        return false;
      }
      if (seen.has(item.tempId)) return false;
      seen.add(item.tempId);
      return true;
    })
    .map((item) => ({
      ...item,
      sessionId,
      tempId: String(item.tempId),
      status: item.status,
      updatedAt:
        typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
          ? item.updatedAt
          : Date.now(),
      createdAt:
        typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
          ? item.createdAt
          : Date.now(),
    }));
};

const dispatchQueueChanged = (
  sessionId: string,
  items: CollectionProductQueueItem[],
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<QueueChangeEventDetail>(EVENT_NAME, {
      detail: { sessionId, items },
    }),
  );
};

export const getCollectionProductQueueItems = (
  sessionId: string,
): CollectionProductQueueItem[] => {
  if (!canUseStorage() || !sessionId) return [];

  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeItems(sessionId, parsed as CollectionProductQueueItem[]);
  } catch {
    return [];
  }
};

const writeCollectionProductQueueItems = (
  sessionId: string,
  items: CollectionProductQueueItem[],
) => {
  if (!canUseStorage() || !sessionId) return;

  const normalized = normalizeItems(sessionId, items);

  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(storageKey(sessionId));
    } else {
      window.localStorage.setItem(storageKey(sessionId), JSON.stringify(normalized));
    }
  } catch {
    // Ignore storage write errors.
  }

  dispatchQueueChanged(sessionId, normalized);
};

export const addCollectionProductQueueItem = (
  sessionId: string,
  item: Omit<CollectionProductQueueItem, 'sessionId' | 'createdAt' | 'updatedAt'>,
): CollectionProductQueueItem => {
  const now = Date.now();
  const nextItem: CollectionProductQueueItem = {
    ...item,
    sessionId,
    createdAt: now,
    updatedAt: now,
  };

  const items = getCollectionProductQueueItems(sessionId);
  const filtered = items.filter((entry) => entry.tempId !== nextItem.tempId);
  writeCollectionProductQueueItems(sessionId, [...filtered, nextItem]);
  return nextItem;
};

export const updateCollectionProductQueueItem = (
  sessionId: string,
  tempId: string,
  updates: Partial<
    Omit<CollectionProductQueueItem, 'tempId' | 'sessionId' | 'createdAt'>
  >,
): CollectionProductQueueItem | null => {
  const items = getCollectionProductQueueItems(sessionId);
  let updatedItem: CollectionProductQueueItem | null = null;

  const next = items.map((item) => {
    if (item.tempId !== tempId) return item;
    updatedItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
    };
    return updatedItem;
  });

  if (!updatedItem) return null;

  writeCollectionProductQueueItems(sessionId, next);
  return updatedItem;
};

export const removeCollectionProductQueueItem = (
  sessionId: string,
  tempId: string,
) => {
  const items = getCollectionProductQueueItems(sessionId);
  const next = items.filter((item) => item.tempId !== tempId);
  writeCollectionProductQueueItems(sessionId, next);
};

export const clearCollectionProductQueue = (sessionId: string) => {
  writeCollectionProductQueueItems(sessionId, []);
};

export const subscribeToCollectionProductQueue = (
  sessionId: string,
  callback: (items: CollectionProductQueueItem[]) => void,
) => {
  if (typeof window === 'undefined' || !sessionId) {
    return () => {};
  }

  const emitCurrent = () => {
    callback(getCollectionProductQueueItems(sessionId));
  };

  const handleQueueEvent = (event: Event) => {
    const customEvent = event as CustomEvent<QueueChangeEventDetail>;
    if (!customEvent.detail || customEvent.detail.sessionId !== sessionId) return;
    callback(customEvent.detail.items);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(sessionId)) return;
    emitCurrent();
  };

  window.addEventListener(EVENT_NAME, handleQueueEvent as EventListener);
  window.addEventListener('storage', handleStorage);
  emitCurrent();

  return () => {
    window.removeEventListener(EVENT_NAME, handleQueueEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
};
