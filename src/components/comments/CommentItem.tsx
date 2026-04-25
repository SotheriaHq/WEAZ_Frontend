import React from 'react';
import type { CommentV2Dto } from '@/types/comments';
import { Link2, Reply, Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { CommentsApi } from '@/api/CommentsApi';
import { toast } from 'sonner';
import { useRealtime } from '@/realtime';
import CommentInput from '@/components/ui/CommentInput';

type Props = {
  comment: CommentV2Dto;
  onThread?: (commentId: string, threadCount: number, threaded: boolean) => void;
  onReply?: (parentId: string) => void;
  onDelete?: (commentId: string) => void;
  currentUserId?: string; // for gating delete
  contentOwnerId?: string; // brand/content owner id for gating delete
  enableReplyComposer?: boolean; // show inline reply composer when Reply clicked
  onCreateReply?: (parentId: string, content: string) => Promise<void>;
};

const CommentItem: React.FC<Props> = ({ comment, onThread, onReply, onDelete, currentUserId, contentOwnerId, enableReplyComposer = false, onCreateReply }) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const navigate = useNavigate();
  const [threaded, setThreaded] = React.useState(Boolean(comment.isThreadedByMe));
  const [threadCount, setThreadCount] = React.useState(comment.threadCount ?? 0);

  const { onComment, joinComment } = useRealtime();
  React.useEffect(() => {
    joinComment(comment.id);
    const unsubscribe = onComment(`COMMENT:${comment.id}`, (p: any) => {
      if (p.commentId === comment.id) {
        setThreadCount(p.threadCount ?? (p.threadCount || threadCount));
        if (onThread) onThread(comment.id, p.threadCount ?? threadCount, undefined as any);
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment.id]);

  const toggle = async () => {
    if (!isAuth) {
      toast.info('Please sign in to thread comments.');
      return;
    }
    const next = !threaded;
    setThreaded(next);
    setThreadCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await CommentsApi.toggleThread(comment.id);
      setThreaded(res.threaded);
      setThreadCount(res.threadCount);
      if (onThread) onThread(comment.id, res.threadCount, res.threaded);
    } catch {
      setThreaded(!next);
      setThreadCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  };

  const remove = async () => {
    if (!isAuth) {
      toast.info('Please sign in.');
      return;
    }
    try {
      await CommentsApi.remove(comment.id);
      onDelete?.(comment.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to delete comment');
    }
  };

  const canDelete = !!currentUserId && (currentUserId === comment.userId || (!!contentOwnerId && currentUserId === contentOwnerId));
  const commenterProfileId =
    typeof comment.user?.id === 'string' && comment.user.id.trim().length > 0
      ? comment.user.id.trim()
      : typeof comment.userId === 'string' && comment.userId.trim().length > 0
        ? comment.userId.trim()
        : null;
  const commenterDisplayName = (() => {
    const username = comment.user?.username;
    const full = `${comment.user?.firstName ?? ''} ${comment.user?.lastName ?? ''}`.trim();
    return (username ?? full) || 'User';
  })();

  const handleOpenCommenterProfile = () => {
    if (!commenterProfileId) return;
    navigate(`/profile/${commenterProfileId}`);
  };

  const [replying, setReplying] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');
  const submittingReply = React.useRef(false);

  const submitReply = async () => {
    if (!enableReplyComposer || !onCreateReply || submittingReply.current) return;
    const text = replyText.trim();
    if (!text) return;
    submittingReply.current = true;
    try {
      await onCreateReply(comment.id, text);
      setReplyText('');
      setReplying(false);
    } catch (e:any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post reply');
    } finally { submittingReply.current = false; }
  };

  return (
    <div className="flex gap-2 py-0.5">
      {commenterProfileId ? (
        <button
          type="button"
          onClick={handleOpenCommenterProfile}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold transition-transform hover:scale-105"
          title={`Open ${commenterDisplayName} profile`}
        >
          {comment.user?.profileImage ? (
            <img
              src={comment.user.profileImage}
              alt={comment.user?.username ?? 'User'}
              className="h-8 w-8 rounded-xl object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span>{(comment.user?.username ?? 'U').charAt(0).toUpperCase()}</span>
          )}
        </button>
      ) : (
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold">
          {comment.user?.profileImage ? (
            <img
              src={comment.user.profileImage}
              alt={comment.user?.username ?? 'User'}
              className="h-8 w-8 rounded-xl object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span>{(comment.user?.username ?? 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* Header: Username on left, Time and Thread on right */}
        <div className="flex items-center justify-between gap-2 text-xs leading-snug">
          {commenterProfileId ? (
            <button
              type="button"
              onClick={handleOpenCommenterProfile}
              className="font-semibold truncate text-left transition-colors hover:text-indigo-600"
              title={`Open ${commenterDisplayName} profile`}
            >
              {commenterDisplayName}
            </button>
          ) : (
            <span className="font-semibold truncate">{commenterDisplayName}</span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-gray-500 text-[11px]">
              {formatRelativeTime(comment.createdAt)}
            </span>
            <button
              type="button"
              onClick={toggle}
              title={threaded ? 'Unthread this comment' : 'Thread this comment'}
              aria-label={threaded ? 'Unthread this comment' : 'Thread this comment'}
              className={`flex items-center gap-1 ${threaded ? 'text-indigo-600' : 'text-gray-600'}`}
            >
              <Link2 size={13} />
              <span className="text-[11px]">{threadCount}</span>
            </button>
          </div>
        </div>
        <div className={`text-xs mt-0.5 ${comment.deletedAt ? 'italic text-gray-500' : ''}`}>
          {comment.deletedAt ? '[deleted]' : comment.contentSanitized}
          {comment.optimistic && (
            <span className="ml-2 text-[10px] italic text-blue-500">(pending)</span>
          )}
        </div>
        {(comment.depth < 2 && enableReplyComposer) || canDelete ? (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-600">
            {comment.depth < 2 && enableReplyComposer && (
              <button type="button" onClick={() => { setReplying((p) => !p); onReply?.(comment.id); }} className="flex items-center gap-1">
                <Reply size={13} /> {replying ? 'Cancel' : 'Reply'}
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={remove} className="flex items-center gap-1 text-gray-500 hover:text-red-600">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        ) : null}
        {replying && enableReplyComposer && (
          <div className="mt-1 pl-1">
            <CommentInput
              value={replyText}
              onChange={setReplyText}
              onSubmit={() => void submitReply()}
              placeholder="Write a reply..."
              className="text-xs"
              maxLength={500}
            />
          </div>
        )}
      </div>
    </div>
  );
};
// Relative time helper (seconds/minutes/hours/days/weeks/months/years)
function formatRelativeTime(dateInput: string | number | Date): string {
  const now = Date.now();
  const ts = new Date(dateInput).getTime();
  const diff = Math.max(0, (now - ts) / 1000); // seconds
  // Map diff to appropriate unit boundary
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2629800) return `${Math.floor(diff / 604800)}w`;
  if (diff < 31557600) return `${Math.floor(diff / 2629800)}mo`;
  return `${Math.floor(diff / 31557600)}y`;
}

export default CommentItem;
