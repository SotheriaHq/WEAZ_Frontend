import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from '@/features/notificationsSlice';
import { X, CheckCheck, Loader2 } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement>; }

const timeAgo = (iso: string) => {
  const date = new Date(iso); const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000); if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; const days = Math.floor(hrs / 24); return `${days}d ago`;
};

export const NotificationsDropdown: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const dispatch = useDispatch();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, initialized } = useSelector((s: RootState) => s.notifications);
  const user = useSelector((s: RootState) => s.user.profile);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // initial fetch
  useEffect(() => { if (open && !initialized) { dispatch(fetchNotifications({ limit: 30 })); dispatch(fetchUnreadCount()); } }, [open, initialized, dispatch]);

  // outside click
  useEffect(() => { if (!open) return; const handler = (e: MouseEvent) => { if (!containerRef.current) return; if (containerRef.current.contains(e.target as Node)) return; if (anchorRef.current && anchorRef.current.contains(e.target as Node)) return; onClose(); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div ref={containerRef} className="absolute right-0 mt-2 w-[360px] max-h-[520px] flex flex-col rounded-xl shadow-2xl border border-white/30 dark:border-white/10 bg-white/95 dark:bg-gray-950 backdrop-blur-xl overflow-hidden z-50">
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white">
        <div className="flex flex-col"><span className="text-xs font-semibold opacity-80">Notifications</span><span className="text-sm font-medium" aria-label="Username">{user?.username || user?.firstName || 'Guest'}</span></div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors" aria-label="Close notifications"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/20 dark:border-white/10 text-xs">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold tracking-wide">{unreadCount} unread</span>
        <button onClick={() => dispatch(markAllNotificationsRead())} disabled={unreadCount === 0} className="px-2 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-semibold flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5"/>Mark all read</button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 aria-live=polite">
        {loadingList && items.length === 0 && <div className="p-6 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}
        {items.length === 0 && !loadingList && <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">No notifications yet.</div>}
        {items.map(n => (
          <button key={n.id} onClick={() => !n.isRead && dispatch(markNotificationRead(n.id))} className={`group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition ${n.isRead ? 'opacity-70' : ''}`}> 
            <div className={`mt-1 w-2 h-2 rounded-full ${n.isRead ? 'bg-gray-300 dark:bg-gray-600' : 'bg-purple-500 animate-pulse'}`}/> 
            <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2" aria-label="Notification message">{n.message}</p><p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{timeAgo(n.createdAt)}</p></div>
          </button>
        ))}
        {hasNextPage && (
          <div className="p-3 flex justify-center"><button onClick={() => dispatch(fetchNotifications({ cursor: endCursor || undefined, limit: 30 }))} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/30 hover:bg-white/90 dark:hover:bg-white/20 transition">Load more</button></div>
        )}
      </div>
    </div>
  );
};

export default NotificationsDropdown;
