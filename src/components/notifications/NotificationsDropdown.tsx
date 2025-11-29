import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from '@/features/notificationsSlice';
import { X, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props { open: boolean; onClose: () => void; anchorRef: React.RefObject<HTMLElement>; }

const timeAgo = (iso: string) => {
  const date = new Date(iso); const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000); if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`; const days = Math.floor(hrs / 24); return `${days}d ago`;
};

export const NotificationsDropdown: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, initialized } = useSelector((s: RootState) => s.notifications);
  const user = useSelector((s: RootState) => s.user.profile);
  const isAuthenticated = useSelector((s: RootState) => s.user.isAuthenticated);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // initial fetch - only if authenticated
  useEffect(() => { 
    if (open && isAuthenticated) { 
      // Always refresh list and count when opening to ensure consistency
      dispatch(fetchNotifications({ limit: 30 })); 
      dispatch(fetchUnreadCount()); 
    } 
  }, [open, isAuthenticated, dispatch]);

  // outside click
  useEffect(() => { if (!open) return; const handler = (e: MouseEvent) => { if (!containerRef.current) return; if (containerRef.current.contains(e.target as Node)) return; if (anchorRef.current && anchorRef.current.contains(e.target as Node)) return; onClose(); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div ref={containerRef} className="absolute right-0 mt-2 w-[340px] max-h-[400px] flex flex-col rounded-xl shadow-2xl border border-white/30 dark:border-white/10 bg-white/95 dark:bg-gray-950 backdrop-blur-xl overflow-hidden z-50">
      <div className="px-4 py-2 flex items-center justify-between bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white">
        <div className="flex flex-col"><span className="text-xs font-semibold opacity-80">Notifications</span><span className="text-sm font-medium" aria-label="Username">{user?.username || user?.firstName || 'Guest'}</span></div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/20 transition-colors" aria-label="Close notifications"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/20 dark:border-white/10 text-xs">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold tracking-wide">{unreadCount} unread</span>
        <button
          onClick={() => dispatch(markAllNotificationsRead())}
          disabled={unreadCount === 0}
          className="px-2 py-1 rounded-md border border-emerald-600/60 text-emerald-700 dark:text-emerald-300 bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-semibold flex items-center gap-1"
        >
          <CheckCheck className="w-3.5 h-3.5"/>Mark all read
        </button>
      </div>
      <div className="flex-1 overflow-y-auto sleek-scrollbar divide-y divide-gray-200 dark:divide-gray-800 aria-live=polite">
        {loadingList && items.length === 0 && <div className="p-6 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2"/>Loading...</div>}
        {items.length === 0 && !loadingList && <div className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">No notifications yet.</div>}
        {items.map(n => {
          const hasAction = n.targetUrl && typeof n.targetUrl === 'string';
          const actorName = n.actor?.username || n.actor?.firstName || 'System';
          const actorImage = n.actor?.profileImage;

          return (
            <button
              key={n.id}
              onClick={() => {
                if (!n.isRead && isAuthenticated) dispatch(markNotificationRead(n.id));
                if (hasAction) {
                  navigate(n.targetUrl);
                  onClose();
                }
              }}
              className={`group w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition border-l-2 ${n.isRead ? 'border-transparent opacity-80' : 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/10'} ${hasAction ? 'cursor-pointer' : 'cursor-default'}`}
            > 
              {/* Avatar */}
              <div className="shrink-0 relative">
                {actorImage ? (
                  <img src={actorImage} alt={actorName} className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {actorName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {!n.isRead && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                  {/* Attempt to highlight actor name if present in message */}
                  {n.message.toLowerCase().startsWith(actorName.toLowerCase()) ? (
                    <>
                      <span className="font-medium italic text-purple-600 dark:text-purple-400">{actorName}</span>
                      <span dangerouslySetInnerHTML={{
                        __html: n.message.slice(actorName.length)
                          .replace(/\b(commented|created|deleted|liked|started following|replied)\b/gi, 
                            '<span class="font-semibold text-gray-900 dark:text-white decoration-purple-300/50 underline decoration-2 underline-offset-2">$1</span>')
                      }} />
                    </>
                  ) : (
                    n.message
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{timeAgo(n.createdAt)}</span>
                  {hasAction && (
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                      View <span className="text-xs">→</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {hasNextPage && (
          <div className="p-3 flex justify-center"><button onClick={() => dispatch(fetchNotifications({ cursor: endCursor || undefined, limit: 30 }))} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/30 hover:bg-white/90 dark:hover:bg-white/20 transition">Load more</button></div>
        )}
      </div>
    </div>
  );
};

export default NotificationsDropdown;
