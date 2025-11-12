import React from 'react';
import type { CommentV2Dto } from '@/types/comments';
import { Heart, Reply, Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { CommentsApi } from '@/api/CommentsApi';
import { toast } from 'react-toastify';
import { useRealtime } from '@/realtime';

type Props = {
  comment: CommentV2Dto;
  onLike?: (commentId: string, likeCount: number, liked: boolean) => void;
  onReply?: (parentId: string) => void;
  onDelete?: (commentId: string) => void;
  currentUserId?: string; // for gating delete
  contentOwnerId?: string; // brand/content owner id for gating delete
  enableReplyComposer?: boolean; // show inline reply composer when Reply clicked
  onCreateReply?: (parentId: string, content: string) => Promise<void>;
};

const CommentItem: React.FC<Props> = ({ comment, onLike, onReply, onDelete, currentUserId, contentOwnerId, enableReplyComposer = false, onCreateReply }) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [liked, setLiked] = React.useState(Boolean(comment.isLikedByMe));
  const [likeCount, setLikeCount] = React.useState(comment.likeCount ?? 0);

  const { onComment, joinComment } = useRealtime();
  React.useEffect(() => {
    joinComment(comment.id);
    const unsubscribe = onComment(`COMMENT:${comment.id}`, (p: any) => {
      if (p.commentId === comment.id) {
        setLikeCount(p.likeCount ?? (p.likeCount || likeCount));
        if (onLike) onLike(comment.id, p.likeCount ?? likeCount, undefined as any);
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment.id]);

  const toggle = async () => {
    if (!isAuth) {
      toast.info('Please sign in to like comments.');
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await CommentsApi.toggleLike(comment.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      if (onLike) onLike(comment.id, res.likeCount, res.liked);
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
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
    <div className="flex gap-3 py-1">
      <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold">
        {comment.user?.profileImage ? (
          <img src={comment.user.profileImage} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span>{(comment.user?.username ?? 'U').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1">
        <div className="text-xs leading-snug">
          {(() => {
            const username = comment.user?.username;
            const full = `${comment.user?.firstName ?? ''} ${comment.user?.lastName ?? ''}`.trim();
            const display = (username ?? full) || 'User';
            return <span className="font-semibold mr-2">{display}</span>;
          })()}
          <span className="text-gray-500">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <div className={`text-xs mt-0.5 ${comment.deletedAt ? 'italic text-gray-500' : ''}`}>
          <span className="mr-2 inline-flex items-center rounded bg-gray-200/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
            {comment.targetType === 'COLLECTION_MEDIA' ? 'MEDIA' : comment.targetType === 'COLLECTION' ? 'COLL' : 'POST'}
          </span>
          {comment.deletedAt ? '[deleted]' : comment.contentSanitized}
          {comment.optimistic && (
            <span className="ml-2 text-[10px] italic text-blue-500">(pending)</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-600">
          <button type="button" onClick={toggle} className={`flex items-center gap-1 ${liked ? 'text-rose-600' : ''}`}>
            <Heart className={liked ? 'fill-current' : ''} size={14} />
            <span>{likeCount}</span>
          </button>
          {comment.depth < 2 && enableReplyComposer && (
            <button type="button" onClick={() => { setReplying((p) => !p); onReply?.(comment.id); }} className="flex items-center gap-1">
              <Reply size={14} /> {replying ? 'Cancel' : 'Reply'}
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={remove} className="flex items-center gap-1 text-gray-500 hover:text-red-600">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
        {replying && enableReplyComposer && (
          <div className="mt-1 pl-1 flex flex-col gap-1">
            <textarea
              className="w-full rounded bg-white/10 dark:bg-black/20 text-xs p-2 border border-white/20 focus:outline-none"
              rows={2}
              value={replyText}
              maxLength={500}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
            />
            <div className="flex justify-end gap-2">
              <button type="button" disabled={!replyText.trim()} onClick={() => void submitReply()} className="px-2 py-1 rounded text-[11px] bg-purple-600 text-white disabled:opacity-40">
                {submittingReply.current ? 'Posting…' : 'Post'}
              </button>
            </div>
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
