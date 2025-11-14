import React from 'react';
import { Smile } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
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
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
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

  const onEmojiClick = (e: EmojiClickData) => {
    setText((prev) => prev + e.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className={`relative flex items-center gap-2 ${className ?? ''}`}>
      <div className="flex-1 relative">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={500}
          className="w-full rounded-lg bg-white/80 dark:bg-black/40 backdrop-blur-md border border-white/60 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/70 pl-3 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/60 dark:focus:ring-purple-500/30 shadow-lg"
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker((p) => !p)}
          className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <Smile size={18} />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              emojiStyle={EmojiStyle.NATIVE}
              theme={Theme.DARK}
              searchDisabled
              skinTonesDisabled
              lazyLoadEmojis
            />
          </div>
        )}
      </div>
      <button
        className="px-3 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white disabled:opacity-60"
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

