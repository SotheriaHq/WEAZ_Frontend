import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NotificationsApi } from '@/api/NotificationsApi';
import { useRealtime } from '@/realtime';
import { useDispatch } from 'react-redux';
import { setUnreadCount } from '@/features/notificationsSlice';

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actor?: { id: string; username?: string | null; firstName?: string | null; lastName?: string | null; profileImage?: string | null } | null;
}

interface ListResponse {
  items: NotificationItem[];
  hasNextPage: boolean;
  endCursor?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const formatTime = (iso: string) => {
  try {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch { return ''; }
};

export const NotificationsDropdown: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dispatch = useDispatch();
  const { onNotification } = useRealtime();

  const fetchList = async (reset = false) => {
    if (loading) return; setLoading(true);
    try {
      const res = await NotificationsApi.list(reset ? undefined : cursor ?? undefined, 20);
      const data = res as ListResponse;
      if (reset) {
        setItems(data.items);
      } else {
        setItems((prev) => [...prev, ...data.items]);
      }
      setHasNext(data.hasNextPage);
      setCursor(data.endCursor ?? null);
    } catch {} finally { setLoading(false); }
  };

  // Load on first open
  useEffect(() => {
    if (open && !initialLoaded) {
      void fetchList(true).then(() => setInitialLoaded(true));
    }
  }, [open, initialLoaded]);

  // Mark all as read on every open (per spec: viewed when dropdown opened)
  useEffect(() => {
    if (open) {
      (async () => {
        try {
          await NotificationsApi.markAllAsRead();
          dispatch(setUnreadCount(0));
        } catch {}
      })();
    }
  }, [open, dispatch]);

  // Realtime prepend
  useEffect(() => {
    if (!open) return; // only join while dropdown open for resource savings
    const unsub = onNotification((payload) => {
      setItems((prev) => [{
        id: payload.id,
        type: payload.type,
        message: payload.message ?? 'New notification',
        createdAt: payload.createdAt,
        isRead: payload.isRead ?? false,
        actor: payload.actor ?? null,
      }, ...prev]);
    });
    return () => { unsub(); };
  }, [open, onNotification]);

  // Click outside handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target) && anchorRef.current && !anchorRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  const loadMore = useCallback(() => {
    if (!hasNext || loading) return; void fetchList(false);
  }, [hasNext, loading]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 mt-2 w-[300px] max-h-[480px] glass-panel bg-white/95 dark:bg-gray-950 backdrop-blur-xl rounded-lg shadow-xl border border-white/30 dark:border-white/10 py-2 z-50 flex flex-col"
    >
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-300 italic">Notifications</span>
        <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Close</button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-1 space-y-1">
        {items.map((n) => (
          <div key={n.id} className="px-3 py-2 rounded-md bg-white/70 dark:bg-white/5 border border-white/30 dark:border-white/10 text-xs flex flex-col gap-1">
            <div className="italic text-gray-700 dark:text-gray-200 leading-snug">{n.message}</div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
              <span>{formatTime(n.createdAt)}</span>
              {n.actor && (
                <span className="truncate max-w-[120px]">{n.actor.username || [n.actor.firstName, n.actor.lastName].filter(Boolean).join(' ')}</span>
              )}
            </div>
          </div>
        ))}
        {!items.length && !loading && (
          <div className="px-3 py-6 text-center text-xs text-gray-500">No notifications yet.</div>
        )}
        {loading && (
          <div className="px-3 py-2 text-xs text-gray-400">Loading…</div>
        )}
      </div>
      {hasNext && (
        <div className="px-2 pt-1 pb-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="w-full text-xs px-3 py-1.5 rounded bg-white/80 dark:bg-white/10 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-white/20 disabled:opacity-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
