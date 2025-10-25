import React from 'react';
import { toast } from 'react-toastify';
import type { CommentTarget } from '@/types/comments';
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

type Props = {
  targetType: CommentTarget;
  targetId: string;
  parentId?: string;
  onCreated?: (comment: any) => void;
  className?: string;
};

const CommentComposer: React.FC<Props> = ({ targetType, targetId, parentId, onCreated, className }) => {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);

  const submit = async () => {
    if (!isAuth) {
      toast.info('Please sign in to comment.');
      return;
    }
    const content = text.trim();
    if (!content || content.length > 500) {
      toast.error('Comment must be 1-500 characters.');
      return;
    }
    setBusy(true);
    try {
      const created = await CommentsApi.create(targetType, targetId, content, parentId);
      setText('');
      onCreated?.(created);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        maxLength={500}
        className="w-full rounded-lg bg-white/80 dark:bg-white/10 backdrop-blur border border-white/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        className="px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-white disabled:opacity-60"
        onClick={submit}
        disabled={busy || text.trim().length === 0}
        type="button"
      >
        Post
      </button>
    </div>
  );
};

export default CommentComposer;

