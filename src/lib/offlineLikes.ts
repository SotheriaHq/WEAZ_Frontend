import { ReactionsApi } from '@/api/ReactionsApi';

type QueueItem = { kind: 'COLLECTION_TOGGLE' | 'COLLECTION_MEDIA_TOGGLE'; id: string; ts: number };
const KEY = 'offline_like_queue_v1';

function load(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as QueueItem[]; } catch { return []; }
}
function save(items: QueueItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

export const OfflineLikes = {
  enqueueCollectionToggle(id: string) {
    const items = load();
    items.push({ kind: 'COLLECTION_TOGGLE', id, ts: Date.now() });
    save(items);
  },
  enqueueCollectionMediaToggle(id: string) {
    const items = load();
    items.push({ kind: 'COLLECTION_MEDIA_TOGGLE', id, ts: Date.now() });
    save(items);
  },
  async flush() {
    const items = load();
    if (items.length === 0) return;
    const remaining: QueueItem[] = [];
    for (const it of items) {
      try {
        if (it.kind === 'COLLECTION_TOGGLE') {
          await ReactionsApi.toggleCollectionLike(it.id);
        } else if (it.kind === 'COLLECTION_MEDIA_TOGGLE') {
          await ReactionsApi.toggleCollectionMediaLike(it.id);
        }
      } catch {
        remaining.push(it); // keep for later if failed
      }
    }
    save(remaining);
  },
  attach() {
    window.addEventListener('online', () => { void OfflineLikes.flush(); });
  },
};

// auto attach on import
if (typeof window !== 'undefined') {
  OfflineLikes.attach();
}

