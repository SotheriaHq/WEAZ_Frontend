import React from 'react';
import { X, Smile, Send, Link as LinkIcon, Bookmark, Share2, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import type { MarketItem } from '@/types/market';
import { CommentsApi } from '@/api/CommentsApi';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
import MediaRenderer from '@/components/media/MediaRenderer';
import ImageWithFallback from '@/components/ImageWithFallback';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatPrice } from '@/utils/helpers';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import VLoader from '@/components/loaders/VLoader';

type Props = {
  open: boolean;
  item: MarketItem | null;
  onClose: () => void;
  onCommentCountChange?: (newCount: number) => void;
};

type ModalMedia = {
  id: string;
  type: 'POST_IMAGE' | 'POST_VIDEO';
  url: string;
  fileId?: string | null;
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
  const [mediaItems, setMediaItems] = React.useState<ModalMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0);
  const [loadingMedia, setLoadingMedia] = React.useState(false);

  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const authProfile = useSelector((s: RootState) => s.user.profile);
  const currentUserId = authProfile?.id;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fallbackMedia = React.useMemo<ModalMedia | null>(() => {
    if (!item) return null;
    return {
      id: item.id,
      type: item.media?.type?.toUpperCase().includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE',
      url: item.media?.url || '',
    };
  }, [item?.id, item?.media?.type, item?.media?.url]);

  const activeMedia = mediaItems[activeMediaIndex] ?? fallbackMedia;
  const activeMediaId = activeMedia?.id ?? item?.id ?? null;

  const isRegularViewer = authProfile?.type === 'REGULAR';
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
    if (!item) return;
    setCommentCount(item.commentsCount ?? 0);
    const seeded: ModalMedia = {
      id: item.id,
      type: item.media?.type?.toUpperCase().includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE',
      url: item.media?.url || '',
    };
    setMediaItems([seeded]);
    setActiveMediaIndex(0);
  }, [item]);

  React.useEffect(() => {
    let mounted = true;

    const loadAllDesignMedia = async () => {
      if (!open || !item?.collectionId) return;

      setLoadingMedia(true);
      try {
        const detail = await brandApi.getCollectionDetail(item.collectionId, { scope: 'design' });
        const rawMedias = Array.isArray(detail?.medias) ? detail.medias : [];

        const parsed: ModalMedia[] = rawMedias
          .map((m: any): ModalMedia | null => {
            const mediaId = typeof m?.id === 'string' ? m.id : null;
            if (!mediaId) return null;
            const file = m?.file;
            const rawType = String(m?.mediaType ?? file?.mimeType ?? '').toUpperCase();
            const mediaType: 'POST_IMAGE' | 'POST_VIDEO' = rawType.includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE';
            const url = String(file?.s3Url ?? file?.url ?? '');
            const fileId = typeof file?.id === 'string' ? file.id : null;
            return { id: mediaId, type: mediaType, url, fileId };
          })
          .filter((m: ModalMedia | null): m is ModalMedia => Boolean(m));

        const hydrated = await Promise.all(
          parsed.map(async (m) => {
            if (!m.fileId) return m;
            try {
              const signed = await brandApi.getSignedFileUrl(m.fileId);
              return { ...m, url: signed || m.url };
            } catch {
              return m;
            }
          }),
        );

        const deduped = hydrated.filter((m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx);
        const nextMedias = deduped.length > 0 ? deduped : (fallbackMedia ? [fallbackMedia] : []);

        if (!mounted) return;
        setMediaItems(nextMedias);

        const preferredId = item.id;
        const idx = nextMedias.findIndex((m) => m.id === preferredId);
        setActiveMediaIndex(idx >= 0 ? idx : 0);
      } catch {
        if (!mounted) return;
        if (fallbackMedia) {
          setMediaItems([fallbackMedia]);
          setActiveMediaIndex(0);
        }
      } finally {
        if (mounted) setLoadingMedia(false);
      }
    };

    void loadAllDesignMedia();
    return () => {
      mounted = false;
    };
  }, [open, item?.collectionId, item?.id, fallbackMedia]);

  const onCommentCountChangeRef = React.useRef(onCommentCountChange);
  React.useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  React.useEffect(() => {
    if (!open) return;
    onCommentCountChangeRef.current?.(commentCount);
  }, [commentCount, open]);

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
      if (!open || !activeMediaId || !isAuth) {
        if (mounted) {
          setIsPatched(false);
          setIsSaved(false);
        }
        return;
      }

      try {
        const savedPromise = apiClient.get('/saved/check', {
          params: { targetType: 'COLLECTION_MEDIA', targetId: activeMediaId },
        });
        const patchPromise = canPatchBrand && brandId
          ? apiClient.get(`/brands/${brandId}/patches/check`)
          : Promise.resolve({ data: { isPatched: false } });
        const [savedRes, patchRes] = await Promise.all([savedPromise, patchPromise]);
        const patchedValue =
          (patchRes as any)?.data?.isPatched ??
          (patchRes as any)?.data?.data?.isPatched ??
          false;

        if (!mounted) return;
        setIsSaved(Boolean(savedRes.data?.isSaved));
        setIsPatched(Boolean(patchedValue));
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
  }, [open, activeMediaId, brandId, isAuth, canPatchBrand]);

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
    if (!activeMediaId) return;

    const content = commentText.trim();
    if (!content || content.length > 500) {
      toast.error('Comment must be 1-500 characters.');
      return;
    }
    setPostingComment(true);
    try {
      await CommentsApi.create('COLLECTION_MEDIA', activeMediaId, content);
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
      toast.success(next ? 'Patched successfully.' : 'Unpatched successfully.');
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
    if (!activeMediaId || saveBusy) return;

    try {
      setSaveBusy(true);
      if (isSaved) {
        await apiClient.delete('/saved', {
          data: { targetType: 'COLLECTION_MEDIA', targetId: activeMediaId },
        });
        setIsSaved(false);
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION_MEDIA', targetId: activeMediaId });
        setIsSaved(true);
        toast.success('Saved to your saved items.');
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

  const showMediaNav = mediaItems.length > 1;

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
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
            <div className="relative h-[82vh] md:h-[90vh] min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar bg-white/5 dark:bg-black/20 backdrop-blur-xl">
              <MediaRenderer
                kind={activeMedia?.type === 'POST_VIDEO' ? 'video' : 'image'}
                src={activeMedia?.url || ''}
                fit="contain" // Override MediaRenderer's default cover constraints
                className="h-auto min-h-full w-full"
                mediaClassName="w-full h-auto min-h-full object-cover"
                maxHeightClassName="" // remove max-h
                allowScroll={true}
                controls={true}
              />

              {loadingMedia ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <VLoader size={30} progress={58} phase="loading" showLabel={false} />
                </div>
              ) : null}

              {showMediaNav ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) => (prev + 1) % mediaItems.length);
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                    {activeMediaIndex + 1} / {mediaItems.length}
                  </div>
                </>
              ) : null}
            </div>

            <div className="h-[82vh] md:h-[90vh] min-w-0 p-3.5 md:p-4 bg-white/65 dark:bg-[#0f0b11]/70 text-slate-900 dark:text-white flex flex-col">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 pr-8">
                  <button
                    type="button"
                    onClick={handleOpenBrandCatalog}
                    className="flex min-w-0 items-center gap-3 text-left"
                    title={`Open ${brandLabel} catalog`}
                  >
                    <div className="size-10 shrink-0 rounded-full overflow-hidden ring-2 ring-white/70 dark:ring-white/15">
                      <ImageWithFallback
                        src={avatar.src}
                        fileId={avatar.fileId}
                        alt={brandLabel}
                        fit="cover"
                        rounded="full"
                        fallbackName={avatarFallback}
                        containerClassName="size-10 rounded-full"
                        className="size-10 object-cover"
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
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                        isPatched
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                      } ${patchBusy ? 'cursor-not-allowed opacity-70' : ''}`}
                      aria-live="polite"
                    >
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
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    disabled={saveBusy}
                    title={isOwnBrandContent ? 'Brands cannot save their own products' : 'Save item'}
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
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/55 dark:bg-black/20 p-2">
                <DesignCommentsPanel
                  mediaId={activeMediaId ?? item.id}
                  collectionId={item.collectionId}
                  contentOwnerId={item.brandId}
                  currentUserId={currentUserId}
                  className="h-full"
                  onCommentAdded={() => setCommentCount((c) => c + 1)}
                  onCommentRemoved={() => setCommentCount((c) => Math.max(0, c - 1))}
                  showComposer={false}
                />
              </div>

              <div className="relative mt-3 pt-2 border-t border-slate-200/80 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/90 border border-slate-200 dark:bg-black/25 dark:border-white/15">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleCommentSubmit();
                      }
                    }}
                    disabled={postingComment}
                    placeholder="Share your thoughts..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker((p) => !p);
                    }}
                    className="p-1 text-slate-400 hover:text-purple-600 dark:text-white/40 dark:hover:text-purple-400 transition"
                    aria-label="Emoji"
                    type="button"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCommentSubmit();
                    }}
                    disabled={postingComment || !commentText.trim()}
                    className="p-1.5 rounded-full bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-700 transition"
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                </div>

                {showEmojiPicker ? (
                  <div className="absolute bottom-full right-0 mb-2 z-50">
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(false);
                      }}
                    />
                    <div className="relative z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
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
