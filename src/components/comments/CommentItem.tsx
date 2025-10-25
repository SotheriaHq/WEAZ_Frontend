import React from 'react';
import type { CommentV2Dto } from '@/types/comments';
import { Heart, Reply, Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { CommentsApi } from '@/api/CommentsApi';
import { toast } from 'react-toastify';
import { getSocket } from '@/lib/ws';

type Props = {
  comment: CommentV2Dto;
  onLike?: (commentId: string, likeCount: number, liked: boolean) => void;
  onReply?: (parentId: string) => void;
  onDelete?: (commentId: string) => void;
};

const CommentItem: React.FC<Props> = ({ comment, onLike, onReply, onDelete }) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [liked, setLiked] = React.useState(Boolean(comment.isLikedByMe));
  const [likeCount, setLikeCount] = React.useState(comment.likeCount ?? 0);

  React.useEffect(() => {
    // Join comment room for live like updates
    const s = getSocket();
    const room = `COMMENT:${comment.id}`;
    s.emit('join', { room });
    const onLiked = (p: any) => {
      if (p.commentId === comment.id) {
        setLikeCount(p.likeCount ?? likeCount);
        if (onLike) onLike(comment.id, p.likeCount ?? likeCount, undefined as any);
      }
    };
    s.on('comment.liked', onLiked);
    return () => {
      s.off('comment.liked', onLiked);
    };
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

  return (
    <div className="flex gap-3 py-2">
      <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold">
        {comment.user?.profileImage ? (
          <img src={comment.user.profileImage} className="h-full w-full object-cover" />
        ) : (
          <span>{(comment.user?.username ?? 'U').charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm">
          {(() => {
            const username = comment.user?.username;
            const full = `${comment.user?.firstName ?? ''} ${comment.user?.lastName ?? ''}`.trim();
            const display = (username ?? full) || 'User';
            return <span className="font-semibold mr-2">{display}</span>;
          })()}
          <span className="text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <div className={`text-sm mt-1 ${comment.deletedAt ? 'italic text-gray-500' : ''}`}>
          {comment.deletedAt ? '[deleted]' : comment.contentSanitized}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
          <button type="button" onClick={toggle} className={`flex items-center gap-1 ${liked ? 'text-rose-600' : ''}`}>
            <Heart className={liked ? 'fill-current' : ''} size={14} />
            <span>{likeCount}</span>
          </button>
          {comment.depth < 2 && (
            <button type="button" onClick={() => onReply?.(comment.id)} className="flex items-center gap-1">
              <Reply size={14} /> Reply
            </button>
          )}
          <button type="button" onClick={remove} className="flex items-center gap-1 text-gray-500 hover:text-red-600">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
