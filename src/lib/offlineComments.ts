import { CommentsApi } from '@/api/CommentsApi';
import type { CommentTarget, CommentV2Dto } from '@/types/comments';

type QueueItem = {
  id: string; // provisional id
  targetType: CommentTarget;
  targetId: string;
  parentId?: string | null;
  content: string;
  ts: number;
};

const KEY = 'offline_comment_queue_v1';

function load(): QueueItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as QueueItem[]; } catch { return []; }
}
function save(items: QueueItem[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

let _commentsBound = false;
const _commentsOnlineHandler = () => { void OfflineComments.flush(); };

export const OfflineComments = {
  enqueue(targetType: CommentTarget, targetId: string, content: string, parentId?: string | null): CommentV2Dto {
    const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const items = load();
    items.push({ id, targetType, targetId, parentId: parentId ?? null, content, ts: Date.now() });
    save(items);
    return {
      id,
      targetType,
      targetId,
      userId: 'me',
      user: { id: 'me', username: 'You' },
      parentId: parentId ?? null,
      depth: parentId ? 1 : 0,
      contentRaw: content,
      contentSanitized: content.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      threadCount: 0,
      replyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      isThreadedByMe: false,
      children: [],
      optimistic: true,
      pending: true,
    };
  },
  async flush() {
    const items = load();
    if (!items.length) return [] as string[];
    const succeeded: string[] = [];
    const remaining: QueueItem[] = [];
    for (const it of items) {
      try {
        await CommentsApi.create(it.targetType, it.targetId, it.content, it.parentId || undefined);
        succeeded.push(it.id);
      } catch {
        remaining.push(it);
      }
    }
    save(remaining);
    return succeeded;
  },
  attach() {
    if (_commentsBound) return;
    window.addEventListener('online', _commentsOnlineHandler);
    _commentsBound = true;
  },
  detach() {
    if (!_commentsBound) return;
    window.removeEventListener('online', _commentsOnlineHandler);
    _commentsBound = false;
  },
};

if (typeof window !== 'undefined') OfflineComments.attach();
