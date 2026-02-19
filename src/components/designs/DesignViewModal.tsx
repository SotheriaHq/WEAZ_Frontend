import React from 'react';
import { X, Smile, Send, Link as LinkIcon, Bookmark, Share2, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import type { MarketItem } from '@/types/market';
import { CommentsApi } from '@/api/CommentsApi';
import { apiClient } from '@/api/httpClient';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
import MediaRenderer from '@/components/media/MediaRenderer';
import ImageWithFallback from '@/components/ImageWithFallback';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatPrice } from '@/utils/helpers';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';

type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
};

const DesignViewModal: React.FC<Props> = ({ open, item, onClose, onCommentCountChange }) => {
  const [commentCount, setCommentCount] = React.useState<number>(0);
  const [commentText, setCommentText] = React.useState('');
  const [postingComment, setPostingComment] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [isPatched, setIsPatched] = React.useState(false);
  const [patchBusy, setPatchBusy] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [saveBusy, setSaveBusy] = React.useState(false);

  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const authProfile = useSelector((s: RootState) => s.user.profile);
  const currentUserId = authProfile?.id;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isRegularViewer = authProfile?.type === 'REGULAR';
  const itemId = item?.id ?? null;
  const brandId = item?.brandId ?? null;
  const isOwnBrandContent = Boolean(currentUserId && item?.brandId && currentUserId === item.brandId);
  const canPatchBrand = Boolean(isAuth && isRegularViewer && item?.brandId && !isOwnBrandContent);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setCommentText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  React.useEffect(() => {
    if (item) {
      setCommentCount(item.commentsCount ?? 0);
    }
  }, [item]);

  React.useEffect(() => {
    if (!open) return;
    onCommentCountChange?.(commentCount);
  }, [commentCount, onCommentCountChange, open]);

  React.useEffect(() => {
    if (!open) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    let mounted = true;

    const loadViewerState = async () => {
      if (!open || !itemId || !isAuth) {
        if (mounted) {
          setIsPatched(false);
          setIsSaved(false);
        }
        return;
      }

      try {
        const savedPromise = apiClient.get('/saved/check', {
          params: { targetType: 'COLLECTION_MEDIA', targetId: itemId },
        });
        const patchPromise = canPatchBrand && brandId
          ? apiClient.get(`/brands/${brandId}/patches/check`)
          : Promise.resolve({ data: { isPatched: false } });
        const [savedRes, patchRes] = await Promise.all([savedPromise, patchPromise]);

        if (!mounted) return;
        setIsSaved(Boolean(savedRes.data?.isSaved));
        setIsPatched(Boolean((patchRes as any).data?.isPatched));
      } catch {
        if (!mounted) return;
        setIsSaved(false);
        setIsPatched(false);
      }
    };

    void loadViewerState();
    return () => {
      mounted = false;
    };
  }, [open, itemId, brandId, isAuth, canPatchBrand]);

  if (!open || !item) return null;

  const baseBand = (() => {
    const min = typeof item.minPrice === 'number' ? formatPrice(item.minPrice) : undefined;
    const max = typeof item.maxPrice === 'number' ? formatPrice(item.maxPrice) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const saleBand = (() => {
    const min = typeof item.saleMinPrice === 'number' ? formatPrice(item.saleMinPrice) : undefined;
    const max = typeof item.saleMaxPrice === 'number' ? formatPrice(item.saleMaxPrice) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const brandLabel = item.brandName ?? item.username ?? 'Brand';
  const avatar = resolveProfileImageSource({
    brandLogo: item.brandLogo,
    brandLogoFileId: item.brandLogoFileId,
  });
  const avatarFallback = getAvatarFallback(brandLabel, item.username);

  const handleCommentSubmit = async () => {
    if (!isAuth) {
      toast.info('Please sign in to comment.');
      return;
    }
    const content = commentText.trim();
    if (!content || content.length > 500) {
      toast.error('Comment must be 1-500 characters.');
      return;
    }
    setPostingComment(true);
    try {
      await CommentsApi.create('COLLECTION_MEDIA', item.id, content);
      setCommentText('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleOpenCollectionProducts = () => {
    if (isOwnBrandContent) {
      toast.info('Brands cannot place orders on their own products.');
      return;
    }
    if (!item.collectionId) return;
    onClose();
    navigate(`/collections/${item.collectionId}`);
  };

  const handleOpenBrandCatalog = () => {
    if (!item.brandId) return;
    onClose();
    navigate(`/profile/${item.brandId}?tab=Store`);
  };

  const handleTogglePatch = async () => {
    if (!item.brandId) return;
    if (!canPatchBrand) {
      toast.info('Only regular users can patch brands.');
      return;
    }
    if (patchBusy) return;

    try {
      setPatchBusy(true);
      const next = !isPatched;
      if (isPatched) {
        await apiClient.delete(`/brands/${item.brandId}/patches`);
      } else {
        await apiClient.post(`/brands/${item.brandId}/patches`);
      }
      setIsPatched(next);
      toast.success(
        next
          ? 'Patched successfully. The brand can now notify you of patch updates.'
          : 'Unpatched successfully. Patch connection removed.',
      );
    } catch {
      toast.error('Unable to update patch status right now.');
    } finally {
      setPatchBusy(false);
    }
  };

  const handleToggleSave = async () => {
    if (!isAuth) {
      toast.info('Please sign in to save items.');
      return;
    }
    if (isOwnBrandContent) {
      toast.info('Brands cannot save their own products.');
      return;
    }
    if (saveBusy) return;

    try {
      setSaveBusy(true);
      if (isSaved) {
        await apiClient.delete('/saved', {
          data: { targetType: 'COLLECTION_MEDIA', targetId: item.id },
        });
        setIsSaved(false);
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION_MEDIA', targetId: item.id });
        setIsSaved(true);
        toast.success('Saved to your wishlist.');
      }
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/collections/${item.collectionId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard.');
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          ref={dialogRef}
          className="relative w-[95vw] md:w-[72vw] max-w-[980px] neu-modal-surface rounded-[28px] overflow-hidden shadow-2xl border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 inline-flex items-center justify-center size-9 rounded-full neu-modal-inset"
            aria-label="Close"
          >
            <X size={18} className="text-[color:var(--neu-text-muted)]" />
          </button>

          <div className="grid md:grid-cols-[minmax(0,55%)_minmax(0,45%)] max-h-[90vh]">
            <div className="h-[82vh] md:h-[90vh] min-w-0 overflow-hidden bg-[#0b1020]">
              <MediaRenderer
                kind={item.media?.type?.toUpperCase().includes('VIDEO') ? 'video' : 'image'}
                src={item.media.url || ''}
                fit="contain"
                className="h-full w-full"
                mediaClassName="h-full w-full object-contain"
                maxHeightClassName="max-h-full"
                maxWidthClassName="max-w-full"
                allowScroll={false}
                controls={false}
              />
            </div>

            <div className="h-[82vh] md:h-[90vh] min-w-0 overflow-y-auto p-4 md:p-5 space-y-4 bg-white/65 dark:bg-[#0f0b11]/70 text-slate-900 dark:text-white scrollbar-hide">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleOpenBrandCatalog}
                  className="flex min-w-0 items-center gap-3 text-left"
                  title={`Open ${brandLabel} catalog`}
                >
                  <div className="size-12 shrink-0 rounded-full overflow-hidden ring-2 ring-white/70 dark:ring-white/15">
                    <ImageWithFallback
                      src={avatar.src}
                      fileId={avatar.fileId}
                      alt={brandLabel}
                      fit="cover"
                      rounded="full"
                      fallbackName={avatarFallback}
                      containerClassName="size-12 rounded-full"
                      className="size-12 object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{brandLabel}</p>
                    {item.username ? <p className="text-xs text-slate-500 dark:text-white/50 truncate">@{item.username}</p> : null}
                  </div>
                </button>

                {canPatchBrand ? (
                  <button
                    type="button"
                    onClick={handleTogglePatch}
                    disabled={patchBusy}
                    className={`group relative inline-flex items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-2 text-xs font-semibold tracking-wide shadow-lg transition ${
                      isPatched
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                    } ${patchBusy ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                    aria-live="polite"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm ring-1 ring-black/5">
                      {isPatched ? '🧵' : '🪡'}
                    </span>
                    <span>{patchBusy ? 'Updating...' : isPatched ? 'Unpatch' : 'Patch'}</span>
                  </button>
                ) : null}
              </div>

              <div>
                <h1 className="text-lg font-bold leading-tight mb-0.5">{item.collectionTitle}</h1>
                {item.collectionDescription ? (
                  <p className="text-[12px] text-slate-600 dark:text-white/65 leading-relaxed">{item.collectionDescription}</p>
                ) : null}
              </div>

              {item.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-white/75 border border-slate-200 text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:bg-white/10 dark:border-white/10 dark:text-white">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700/30 inline-block">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{saleBand || baseBand || 'Price on request'}</p>
                {saleBand && baseBand ? (
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60 line-through">{baseBand}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  className="rounded-md px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-semibold hover:opacity-90 transition shadow-sm"
                  onClick={handleOpenCollectionProducts}
                  title={isOwnBrandContent ? 'Brands cannot place orders on their own products' : 'Open collection'}
                >
                  🛒 Add to Cart
                </button>
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={saveBusy}
                  title={isOwnBrandContent ? 'Brands cannot save their own products' : 'Save to wishlist'}
                  className="rounded-md px-2.5 py-1.5 bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold hover:bg-rose-200 transition dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700/40 disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-1">
                    <Bookmark className="h-3.5 w-3.5" />
                    {isSaved ? 'Saved' : 'Save'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-md px-2.5 py-1.5 bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold hover:bg-sky-200 transition dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700/40"
                >
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenBrandCatalog}
                  className="rounded-md px-2.5 py-1.5 bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-semibold hover:bg-amber-200 transition dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/40"
                >
                  <span className="inline-flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" />
                    Store
                  </span>
                </button>
              </div>

              <DesignCommentsPanel
                mediaId={item.id}
                collectionId={item.collectionId}
                contentOwnerId={item.brandId}
                currentUserId={currentUserId}
                onCommentAdded={() => setCommentCount((c) => c + 1)}
                onCommentRemoved={() => setCommentCount((c) => Math.max(0, c - 1))}
                showComposer={false}
              />

              <div className="relative sticky bottom-0">
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/90 border border-slate-200 dark:bg-black/25 dark:border-white/15">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCommentSubmit()}
                    disabled={postingComment}
                    placeholder="Share your thoughts..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
                  />
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1 text-slate-400 hover:text-purple-600 dark:text-white/40 dark:hover:text-purple-400 transition"
                    aria-label="Emoji"
                    type="button"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={handleCommentSubmit}
                    disabled={postingComment || !commentText.trim()}
                    className="p-1.5 rounded-full bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                </div>

                {showEmojiPicker ? (
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                    <div className="relative z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme={Theme.DARK}
                        height={320}
                        width={280}
                        searchDisabled
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="absolute right-4 bottom-28 z-20">
            <div className="group relative">
              <button
                type="button"
                className="flex flex-col items-center text-white/90 hover:scale-110 transition-transform"
                onClick={handleShare}
                aria-label="Share this collection"
              >
                <LinkIcon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-bold mt-1 drop-shadow">{item.collectionCollabCount ?? 0}</span>
              </button>
              <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded-lg bg-black/85 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                Share collection
              </span>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DesignViewModal;
