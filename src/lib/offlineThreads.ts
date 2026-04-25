import { ReactionsApi } from '@/api/ReactionsApi';

type QueueItem = { kind: 'COLLECTION_TOGGLE' | 'COLLECTION_MEDIA_TOGGLE'; id: string; ts: number };
const KEY = 'offline_thread_queue_v1';

function load(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as QueueItem[]; } catch { return []; }
}
function save(items: QueueItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

let _threadsBound = false;
const _threadsOnlineHandler = () => { void OfflineThreads.flush(); };

export const OfflineThreads = {
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
          await ReactionsApi.toggleCollectionThread(it.id);
        } else if (it.kind === 'COLLECTION_MEDIA_TOGGLE') {
          await ReactionsApi.toggleCollectionMediaThread(it.id);
        }
      } catch {
        remaining.push(it); // keep for later if failed
      }
    }
    save(remaining);
  },
  attach() {
    if (_threadsBound) return;
    window.addEventListener('online', _threadsOnlineHandler);
    _threadsBound = true;
  },
  detach() {
    if (!_threadsBound) return;
    window.removeEventListener('online', _threadsOnlineHandler);
    _threadsBound = false;
  },
};

// auto attach on import
if (typeof window !== 'undefined') {
  OfflineThreads.attach();
}
