import type { DesignMetadata } from '@/api/DesignApi';
import type { PublishTaskKind } from '@/utils/publishTracker';

export type PersistedDesignPublishJob = {
  taskId: string;
  ownerId?: string;
  title: string;
  description?: string;
  minPrice?: number;
  maxPrice?: number;
  tags: string[];
  files: Array<{
    file: File;
    viewSlot?: string | null;
  }>;
  coverIndex: number;
  designMetadata: DesignMetadata;
  existingDesignId?: string;
  pendingCustomOrderDraft?: Record<string, unknown> | null;
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX' | string;
  kind?: PublishTaskKind;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'wiez-design-publish-recovery';
const STORE_NAME = 'jobs';
const DB_VERSION = 1;
const MAX_JOB_AGE_MS = 24 * 60 * 60 * 1000;

const canUseIndexedDb = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'taskId' });
      }
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);
      let settled = false;

      if (request) {
        request.onsuccess = () => {
          settled = true;
          resolve(request.result);
        };
        request.onerror = () => {
          settled = true;
          reject(request.error ?? new Error('IndexedDB request failed'));
        };
      }

      tx.oncomplete = () => {
        if (!settled) resolve(undefined as T);
      };
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
};

export const saveDesignPublishRecovery = async (
  input: Omit<PersistedDesignPublishJob, 'createdAt' | 'updatedAt'>,
) => {
  const now = Date.now();
  await withStore('readwrite', (store) =>
    store.put({
      ...input,
      createdAt: now,
      updatedAt: now,
    } satisfies PersistedDesignPublishJob),
  );
};

export const readDesignPublishRecovery = async (taskId: string) => {
  const id = String(taskId || '').trim();
  if (!id) return null;
  const job = await withStore<PersistedDesignPublishJob | undefined>('readonly', (store) =>
    store.get(id),
  );
  if (!job) return null;
  if (Date.now() - job.updatedAt > MAX_JOB_AGE_MS) {
    await removeDesignPublishRecovery(id).catch(() => undefined);
    return null;
  }
  return job;
};

export const removeDesignPublishRecovery = async (taskId: string) => {
  const id = String(taskId || '').trim();
  if (!id) return;
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
};

