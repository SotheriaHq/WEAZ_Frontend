import React from 'react';
import { X, Share2, Plus, CheckCircle2, Smile, ShoppingBag, MessageCircle } from 'lucide-react'; // Added ShoppingBag, Plus
import type { MarketItem } from '@/types/market';
// MediaViewer removed
import LikeButton from '@/components/ui/LikeButton';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
// Tag, IconButton removed
import CommentInput from '@/components/ui/CommentInput';
import { formatPrice } from '@/utils/helpers';
// getTagColor removed
import { CommentsApi } from '@/api/CommentsApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { toast } from 'sonner';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { useCountdown } from '@/hooks/useCountdown';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';



type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
};

const DesignViewModal: React.FC<Props> = ({ open, item, onClose, onCommentCountChange }) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [commentCount, setCommentCount] = React.useState<number>(0);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [commentText, setCommentText] = React.useState('');
  const [postingComment, setPostingComment] = React.useState(false);
  const [commentPosted, setCommentPosted] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const currentUserId = useSelector((s: RootState) => s.user.profile?.id);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  
  // Calculate sale end time for countdown (always call hook)
  const saleEndTime = React.useMemo(() => {
    if (!item) return undefined;
    const now = Date.now();
    const hasValidSale = item.saleMinPrice || item.saleMaxPrice;
    const startOk = !item.saleStartAt || new Date(item.saleStartAt).getTime() <= now;
    const endOk = !item.saleEndAt || new Date(item.saleEndAt).getTime() >= now;
    const saleActive = Boolean(hasValidSale && startOk && endOk);
    return saleActive ? item.saleEndAt ?? undefined : undefined;
  }, [item]);
  
  const { label: countdownLabel, expired } = useCountdown(saleEndTime);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  // Sync comment count when item changes
  React.useEffect(() => {
    if (item) {
      setCommentCount(item.commentsCount ?? 0);
    }
  }, [item]);

  function onEmojiClick(emojiData: EmojiClickData) {
    setCommentText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false);
  }

  React.useEffect(() => {
    if (open) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [open]);

  // Guard rendering until item is available to avoid null property access.
  if (!open || !item) return null;

  const baseBand = (() => {
    const min = typeof item?.minPrice === 'number' ? formatPrice(item.minPrice) : undefined;
    const max = typeof item?.maxPrice === 'number' ? formatPrice(item.maxPrice) : undefined;
    if (min && max) return `${min} – ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return null;
  })();
  const saleBand = (() => {
    const min = typeof (item as any)?.saleMinPrice === 'number' ? formatPrice((item as any).saleMinPrice) : undefined;
    const max = typeof (item as any)?.saleMaxPrice === 'number' ? formatPrice((item as any).saleMaxPrice) : undefined;
    if (min && max) return `${min} – ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const saleActive = Boolean(saleEndTime); // Sale is active if saleEndTime is defined
  const brandLabel = item.brandName ?? item.username ?? 'Brand';

  // Two-section modal: left (media) and right (data + comments)
  const leftColsSm = 'sm:col-span-12';
  const leftColsMd = 'md:col-span-6';
  const rightColsSm = 'sm:col-span-12';
  const rightColsMd = 'md:col-span-6';

  const handleCommentSubmit = async () => {
    if (!isAuth) { toast.info('Please sign in to comment.'); return; }
    const content = commentText.trim();
    if (!content || content.length > 500) { toast.error('Comment must be 1-500 characters.'); return; }
    setPostingComment(true);
    try {
      await CommentsApi.create('COLLECTION_MEDIA', item.id, content);
      setCommentText('');
      setCommentPosted(true);
      setTimeout(() => setCommentPosted(false), 1200);
      // setCommentCount(prev => prev + 1); // Rely on realtime via MarketCommentsPanel
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally { setPostingComment(false); }
  };

  // (Handled earlier)

  // --- Custom Styles from Mockup ---
  
  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-8 font-sans transition-all duration-300"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        {/* Main Modal Container */}
        <div
          ref={dialogRef}
          className="relative w-full max-w-[1440px] h-[90vh] bg-black rounded-xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col lg:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button (Absolute - positioned nicely between panels or top right) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 lg:right-[calc(40%_+_1.5rem)] z-50 text-white/50 hover:text-white transition-colors p-2 bg-black/50 rounded-full lg:bg-transparent"
          >
            <X size={32} />
          </button>

          {/* Left Side: Media Showcase (60%) */}
          <div className="w-full lg:w-[60%] h-[40vh] lg:h-full relative group bg-black flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" /> {/* Inner glow */}
             
             <MediaRenderer 
                kind={item.media?.type?.includes('VIDEO') ? 'video' : 'image'}
                src={item.media.url || ''}
                fit="contain" // Mockup uses cover, but we need to see the whole design usually. User earlier asked for "renderred fully". 
                              // If I use cover, it might crop. I will stick to contain for now to be safe, or allow toggle.
                              // WAIT: Mockup says "w-full h-full object-cover". User check: "Images are supposed to take the full display container... if too big... add scroll".
                              // The mockup suggests a fixed container with object-cover. 
                              // Let's use object-contain with a black bg to ensure full visibility without crop, as "rendering was horrible" when it was cropped previously?
                              // Actually, user said: "Images are supposed to ... no border, no padding... If image is too big... add scroll".
                              // So I will stick to the SCROLLABLE Left Side implementation from before but styled like the mockup.
                className="w-full h-full" 
                mediaClassName="w-full h-full object-contain" // Keeping safe
                controls={false}
             />

            {/* Media Overlay Controls (Mockup) */}
            <div className="absolute bottom-8 left-8 z-20 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button className="size-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all text-white">
                <Plus size={24} /> {/* Zoom In proxy */}
              </button>
              <button className="size-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all text-white">
                <Share2 size={20} /> {/* Share proxy */}
              </button>
            </div>
          </div>

          {/* Right Side: Details & Interaction (40%) */}
          <div className="w-full lg:w-[40%] h-full flex flex-col relative bg-white/5 backdrop-blur-2xl border-l border-white/10 text-white">
            
            {/* Top Section: Brand & Header */}
            <div className="p-6 pb-4 sm:p-8 sm:pb-4 flex-shrink-0 z-20 bg-[#0a060e]/50 backdrop-blur-md">
                {/* Brand Identity */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-full border border-purple-500/50 p-0.5">
                             {item.brandLogo ? (
                                <img src={item.brandLogo} alt={brandLabel} className="size-full rounded-full object-cover" />
                             ) : (
                                <div className="size-full rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-lg font-bold">
                                    {brandLabel.charAt(0)}
                                </div>
                             )}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm tracking-wide text-white">{brandLabel}</h3>
                            {item.username && <p className="text-xs text-white/50">@{item.username}</p>}
                        </div>
                    </div>
                    <button className="px-4 py-1.5 rounded-full border border-white/10 text-xs font-semibold hover:bg-white/5 transition-colors text-white">
                        Follow
                    </button>
                </div>

                <h1 className="font-serif italic text-3xl sm:text-4xl mb-4 leading-tight text-white">{item.collectionTitle}</h1>
                {item.collectionDescription && (
                    <p className="text-white/70 text-sm leading-relaxed mb-6 line-clamp-3 hover:line-clamp-none transition-all">
                        {item.collectionDescription}
                    </p>
                )}

                {/* Tag Chips */}
                {item.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {item.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-widest border border-purple-500/30">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Pricing Block */}
                 <div className="p-4 rounded-lg flex items-center justify-between relative overflow-hidden bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                    <div>
                        <div className="flex items-baseline gap-2">
                           {saleBand ? (
                               <>
                                <span className="text-2xl font-bold text-white">{saleBand}</span>
                                {baseBand && <span className="text-sm text-white/40 line-through">{baseBand}</span>}
                               </>
                           ) : (
                                <span className="text-2xl font-bold text-white">{baseBand || 'Price on request'}</span>
                           )}
                        </div>
                        {saleBand && <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter mt-1">Current Sale Price</p>}
                    </div>
                    {saleActive && !expired && countdownLabel && (
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-white/40 uppercase mb-1">Offer Ends In</p>
                            <div className="text-rose-300 font-mono text-sm font-bold">
                                {countdownLabel}
                            </div>
                        </div>
                    )}
                 </div>
            </div>

            {/* Scrollable Area: Interaction & Comments */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-32">
                {/* Action Bar (Sticky relative to this container? Mockup says sticky top) */}
                <div className="sticky top-0 py-4 border-b border-white/5 -mx-8 px-8 z-30 bg-[#0a060e]/80 backdrop-blur-xl mb-6 flex gap-3">
                    <button className="flex-1 h-12 rounded-lg font-bold text-sm bg-gradient-to-r from-[#7f13ec] to-[#4c0b8e] hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(127,19,236,0.4)] text-white">
                        <ShoppingBag size={20} />
                        Add to Cart
                    </button>
                    <LikeButton
                        contentType="COLLECTION_MEDIA"
                        contentId={item.id}
                        initialCount={item.likesCount ?? 0}
                        initialLiked={item.isLiked}
                        ownerId={item.brandId}
                        parentCollectionId={item.collectionId}
                        className="!size-12 !rounded-lg !bg-white/5 !border !border-white/10 !flex !items-center !justify-center !text-purple-400 hover:!bg-purple-500/10 !transition-all !shadow-[inset_0_0_10px_rgba(127,19,236,0.1)] !p-0"
                        size={24}
                    />
                    <div className="relative">
                        <button className="size-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-all">
                            <MessageCircle size={20} />
                        </button>
                        {commentCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-black">
                                {commentCount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Comments Feed */}
                <div className="flex flex-col gap-6">
                     <DesignCommentsPanel
                        mediaId={item.id}
                        collectionId={item.collectionId}
                        contentOwnerId={item.brandId}
                        currentUserId={currentUserId}
                        onCommentAdded={() => setCommentCount(c => c + 1)}
                        onCommentRemoved={() => setCommentCount(c => Math.max(0, c - 1))}
                        showComposer={false}
                    />
                </div>
                
                {/* Spacer for floating input */}
                <div className="h-4" />
            </div>

            {/* Floating Comment Input */}
            <div className="absolute bottom-0 left-0 w-full p-6 pt-12 bg-gradient-to-t from-[#0a060e] via-[#0a060e]/90 to-transparent z-40">
                <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-2 flex items-center gap-2 relative">
                     <CommentInput
                        value={commentText}
                        onChange={setCommentText}
                        onSubmit={handleCommentSubmit}
                        disabled={postingComment}
                        busy={postingComment}
                        placeholder="Share your thoughts..."
                        className="!bg-transparent !border-none !text-xs !text-white placeholder:!text-white/30 focus:!ring-0 !p-0 !pl-2 flex-1"
                     />
                     
                    <button 
                         onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                         className="size-8 flex items-center justify-center text-white/40 hover:text-white transition-colors flex-shrink-0"
                    >
                         <Smile size={20} />
                    </button>
                    
                     <button 
                        onClick={handleCommentSubmit}
                        disabled={postingComment || !commentText.trim()}
                        className="bg-[#7f13ec] hover:bg-[#7f13ec]/80 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
                     >
                        {postingComment ? (
                            <span className="animate-spin text-white">C</span>
                        ) : (
                            <>
                                <span>Post</span>
                                {commentPosted && <CheckCircle2 size={14} />}
                            </>
                        )}
                    </button>

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-4 z-50 shadow-2xl rounded-xl overflow-hidden border border-white/10 bg-[#0a060e]">
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                         <div className="relative z-50">
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.DARK}
                                height={350}
                                width={300}
                                searchDisabled
                                skinTonesDisabled
                                previewConfig={{ showPreview: false }}
                            />
                        </div>
                    </div>
                 )}
                </div>
            </div>

          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DesignViewModal;

