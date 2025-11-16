import React from 'react';
import { CommentsApi } from '@/api/CommentsApi';
import type { CommentV2Dto } from '@/types/comments';
import CommentInput from '@/components/ui/CommentInput';
import { Smile } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';
import CommentItem from '@/components/comments/CommentItem';
import { toast } from 'react-toastify';

interface Props {
  collectionId: string;
}

const UnifiedCollectionComments: React.FC<Props> = ({ collectionId }) => {
  const [items, setItems] = React.useState<CommentV2Dto[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasNext, setHasNext] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [text, setText] = React.useState('');
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);
  
  // 🔧 FIX #3: Add state for reply functionality
  const me = React.useMemo(() => {
    // Get current user from Redux store if available
    try {
      const state = (window as any).__REDUX_STATE__ || {};
      return state.user?.profile || null;
    } catch {
      return null;
    }
  }, []);

  const load = async (reset = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await CommentsApi.listUnifiedForCollection(collectionId, reset ? undefined : cursor ?? undefined, 20);
      if (reset) setItems(res.items); else setItems((prev) => [...prev, ...res.items]);
      setHasNext(res.hasNextPage);
      setCursor(res.endCursor);
    } catch (e: any) {
      console.error('[UnifiedComments] Failed to load comments:', e);
      toast.error(e?.response?.data?.message ?? 'Failed to load comments');
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => { setItems([]); setCursor(null); setHasNext(false); void load(true); }, [collectionId]);

  // Click outside handler for emoji picker
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const applyCreated = (c: CommentV2Dto) => setItems((prev) => [c, ...prev]);
  const handleLike = (commentId: string, likeCount: number) => setItems((prev) => prev.map((c) => c.id === commentId ? { ...c, likeCount } : { ...c, children: c.children?.map(r => r.id === commentId ? { ...r, likeCount } : r) }));
  const handleDelete = (commentId: string) => setItems((prev) => prev.filter((c) => c.id !== commentId).map((c) => ({ ...c, children: c.children?.filter(r => r.id !== commentId) })));
  const toggleReplies = (parentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="flex flex-col"
      style={{ height: '100%', minHeight: 0, maxHeight: '100%' }}
    >
      {/* Scrollable Comments Area - NOW AT TOP */}
      <div
        ref={scrollRef}
        className="overflow-y-scroll overscroll-contain unified-comments-scroll"
        style={{ 
          flex: '1 1 0',
          minHeight: 0,
          maxHeight: '100%',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        <style>{`
          /* Elegant scrollbar styling - minimal, no background */
          .unified-comments-scroll::-webkit-scrollbar {
            width: 4px;
          }
          
          .unified-comments-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .unified-comments-scroll::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.3);
            border-radius: 2px;
            transition: background 0.2s ease;
          }
          
          .unified-comments-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(139, 92, 246, 0.5);
          }
          
          .dark .unified-comments-scroll::-webkit-scrollbar-thumb {
            background: rgba(167, 139, 250, 0.3);
          }
          
          .dark .unified-comments-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(167, 139, 250, 0.5);
          }
          
          /* Firefox scrollbar */
          .unified-comments-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
          }
        `}</style>
        <div className="space-y-0 px-1 pb-2">
          {items.map((c) => {
            return (
              <div key={c.id} className="py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                <CommentItem 
                  comment={c} 
                  onLike={handleLike} 
                  onDelete={handleDelete} 
                  onReply={(parentId) => {
                    // Auto-expand replies when user clicks Reply
                    if (!expanded.has(parentId)) {
                      toggleReplies(parentId);
                    }
                  }}
                  currentUserId={me?.id}
                  enableReplyComposer={true}
                  onCreateReply={async (parentId: string, content: string) => {
                    // Use the parent's own target to avoid backend mismatch (collection vs media)
                    const targetType = c.targetType;
                    const targetId = c.targetId;
                    const created = await CommentsApi.create(targetType, targetId, content, parentId);
                    setItems((prev) => prev.map((c) => {
                      if (c.id === parentId) {
                        return { ...c, children: [...(c.children || []), created] };
                      }
                      return c;
                    }));
                    if (!expanded.has(parentId)) {
                      setExpanded((prev) => new Set(prev).add(parentId));
                    }
                    toast.success('Reply posted!');
                  }}
                />
                {c.children && c.children.length > 0 && (
                  <div className="pl-6 mt-0.5">
                    <button
                      type="button"
                      className="text-[10px] text-gray-600 dark:text-gray-300 hover:underline"
                      onClick={() => toggleReplies(c.id)}
                    >
                      {expanded.has(c.id) ? 'Hide replies' : `View replies (${c.children.length})`}
                    </button>
                    {expanded.has(c.id) && (
                      <div className="mt-0.5 space-y-0.5">
                        {c.children.map((r) => (
                          <CommentItem 
                            key={r.id} 
                            comment={r} 
                            onLike={handleLike} 
                            onDelete={handleDelete} 
                            onReply={() => {}} 
                            currentUserId={me?.id}
                            enableReplyComposer={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!items.length && <div className="text-xs text-gray-500 py-4">Be the first to comment.</div>}
          {hasNext && (
            <div className="py-2 text-center">
              <button type="button" className="px-2 py-1.5 text-[11px] rounded bg-white/30 dark:bg-white/10 border border-white/30" onClick={() => load(false)} disabled={busy}>Load more</button>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Input at BOTTOM */}
      <div className="flex-shrink-0 pt-3 mt-2 border-t border-gray-200 dark:border-white/20 bg-white dark:bg-black sticky bottom-0 z-20 shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.25)]">
        <div className="relative w-full">
          <CommentInput
            value={text}
            onChange={setText}
            onSubmit={async () => {
              const content = text.trim();
              if (!content) return;
              setBusy(true);
              try {
                const created = await CommentsApi.create('COLLECTION', collectionId, content);
                setText('');
                applyCreated(created);
              } catch (e: any) {
                toast.error(e?.response?.data?.message ?? 'Failed to post comment');
              } finally { setBusy(false); }
            }}
            disabled={busy}
            busy={busy}
            placeholder="Add a comment..."
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker((p) => !p)}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Smile size={18} />
          </button>
          {showEmojiPicker && (
            <div 
              ref={emojiPickerRef}
              className="absolute bottom-full right-0 mb-2 z-50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
              style={{ width: 320, height: 380 }}
            >
              <style>{`
                /* Emoji Picker Custom Styling */
                .emoji-picker-react {
                  background: rgba(255, 255, 255, 0.95) !important;
                  border: 1px solid rgba(139, 92, 246, 0.2) !important;
                  border-radius: 12px !important;
                  box-shadow: 0 20px 25px -5px rgba(139, 92, 246, 0.1), 0 10px 10px -5px rgba(139, 92, 246, 0.04) !important;
                }
                
                .dark .emoji-picker-react {
                  background: rgba(17, 24, 39, 0.95) !important;
                  border: 1px solid rgba(139, 92, 246, 0.3) !important;
                }
                
                /* Hide all scrollbars in emoji picker */
                .emoji-picker-react .emoji-scroll-wrapper,
                .emoji-picker-react .emoji-categories,
                .emoji-picker-react .emoji-group,
                .emoji-picker-react * {
                  scrollbar-width: none !important;
                  -ms-overflow-style: none !important;
                }
                
                .emoji-picker-react .emoji-scroll-wrapper::-webkit-scrollbar,
                .emoji-picker-react .emoji-categories::-webkit-scrollbar,
                .emoji-picker-react .emoji-group::-webkit-scrollbar,
                .emoji-picker-react *::-webkit-scrollbar {
                  display: none !important;
                  width: 0 !important;
                  height: 0 !important;
                }
                
                /* Style emoji picker header */
                .emoji-picker-react .emoji-header {
                  padding: 8px 12px !important;
                  border-bottom: 1px solid rgba(139, 92, 246, 0.1) !important;
                }
                
                /* Category buttons styling */
                .emoji-picker-react .emoji-categories button {
                  transition: all 0.2s ease !important;
                }
                
                .emoji-picker-react .emoji-categories button:hover {
                  background: rgba(139, 92, 246, 0.1) !important;
                }
                
                /* Selected category */
                .emoji-picker-react .emoji-categories button.active {
                  background: rgba(139, 92, 246, 0.2) !important;
                  border-color: rgba(139, 92, 246, 0.4) !important;
                }
              `}</style>
              <EmojiPicker
                onEmojiClick={(e: EmojiClickData) => { 
                  setText((prev) => prev + e.emoji); 
                  setShowEmojiPicker(false); 
                }}
                emojiStyle={EmojiStyle.NATIVE}
                theme={Theme.AUTO}
                searchDisabled
                skinTonesDisabled
                lazyLoadEmojis
                width="100%"
                height="100%"
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedCollectionComments;
