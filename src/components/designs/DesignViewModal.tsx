import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { customOrderConfigurationsApi } from '@/api/CustomOrderApi';
import { BagApi } from '@/api/BagApi';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagFlow } from '@/features/bagging/BagFlowProvider';
import type { CommentV2Dto } from '@/types/comments';
import {
  CONTENT_DISPLAY_FRAME_CLASS,
  CONTENT_DISPLAY_MEDIA_CLASS,
  CONTENT_DISPLAY_RENDERER_CLASS,
} from '@/components/media/contentDisplayPresets';
import { useBrandPatchState } from '@/context/BrandPatchContext';
import { buildDesignUrl } from '@/utils/publicUrlBuilder';

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
  const [externalComment, setExternalComment] = React.useState<CommentV2Dto | null>(null);
  const [isSaved, setIsSaved] = React.useState(false);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [mediaItems, setMediaItems] = React.useState<ModalMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0);
  const [loadingMedia, setLoadingMedia] = React.useState(false);
  const [customComposerOpen, setCustomComposerOpen] = React.useState(false);
  const [customConfigurationId, setCustomConfigurationId] = React.useState<string | null>(null);
  const [openingCustomComposer, setOpeningCustomComposer] = React.useState(false);
  const [resolvingCustomConfiguration, setResolvingCustomConfiguration] = React.useState(false);

  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const authProfile = useSelector((s: RootState) => s.user.profile);
  const currentUserId = authProfile?.id;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const bagFlow = useBagFlow();

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
  const {
    isPatchCapable,
    getPatched,
    isLoading: isPatchLoading,
    ensureStatus,
    toggleStatus,
  } = useBrandPatchState();
  const isPatched = brandId ? getPatched(brandId) : false;
  const patchBusy = brandId ? isPatchLoading(brandId) : false;
  const isOwnBrandContent = Boolean(currentUserId && item?.brandId && currentUserId === item.brandId);
  const canPatchBrand = Boolean(isAuth && isPatchCapable && isRegularViewer && item?.brandId && !isOwnBrandContent);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  React.useEffect(() => {
    if (!open || !item) return;

    setCommentCount(item.commentsCount ?? 0);
    setExternalComment(null);
    const seeded: ModalMedia = {
      id: item.id,
      type: item.media?.type?.toUpperCase().includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE',
      url: item.media?.url || '',
    };

    // Avoid setting identical media state repeatedly when parent re-renders the same item object.
    setMediaItems((current) => {
      const existing = current[0];
      if (
        current.length === 1 &&
        existing?.id === seeded.id &&
        existing?.type === seeded.type &&
        existing?.url === seeded.url
      ) {
        return current;
      }
      return [seeded];
    });
    setActiveMediaIndex(0);
  }, [open, item?.id]);

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

  React.useEffect(() => {
    let mounted = true;

    const resolveCustomConfiguration = async () => {
      if (!open || !item?.collectionId) {
        if (mounted) {
          setCustomConfigurationId(null);
          setResolvingCustomConfiguration(false);
        }
        return;
      }

      setResolvingCustomConfiguration(true);
      try {
        const activeConfiguration = await customOrderConfigurationsApi.getActiveForDesign(item.collectionId);
        if (!mounted) return;
        setCustomConfigurationId(activeConfiguration?.id ?? null);
      } catch {
        if (!mounted) return;
        // 404 is expected for designs without completed custom-order setup.
        setCustomConfigurationId(null);
      } finally {
        if (mounted) {
          setResolvingCustomConfiguration(false);
        }
      }
    };

    void resolveCustomConfiguration();
    return () => {
      mounted = false;
    };
  }, [open, item?.collectionId]);

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
          setIsSaved(false);
        }
        return;
      }

      try {
        const savedRes = await apiClient.get('/saved/check', {
          params: { targetType: 'COLLECTION_MEDIA', targetId: activeMediaId },
        });

        if (!mounted) return;
        setIsSaved(Boolean(savedRes.data?.isSaved));
      } catch {
        if (!mounted) return;
        setIsSaved(false);
      }
    };

    void loadViewerState();
    return () => {
      mounted = false;
    };
  }, [open, activeMediaId, isAuth]);

  React.useEffect(() => {
    if (!open || !canPatchBrand || !brandId) return;
    void ensureStatus(brandId);
  }, [brandId, canPatchBrand, ensureStatus, open]);

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
    if (!activeMediaId) {
      toast.error('Comment thread is unavailable for this design.');
      return;
    }

    const content = commentText.trim();
    if (!content || content.length > 500) {
      toast.error('Comment must be 1-500 characters.');
      return;
    }
    setPostingComment(true);
    try {
      const created = await CommentsApi.create('COLLECTION_MEDIA', activeMediaId, content);
      setExternalComment(created);
      setCommentText('');
      toast.success('Comment posted');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleOpenDesignCustomOrder = async () => {
    if (isOwnBrandContent) {
      toast.info('Brands cannot place custom orders on their own designs.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to place a custom order.');
      return;
    }
    if (!item.collectionId) {
      toast.error('Design reference is unavailable for custom order.');
      return;
    }
    if (openingCustomComposer) {
      return;
    }
    if (resolvingCustomConfiguration) {
      toast.info('Checking custom-order setup...');
      return;
    }

    setOpeningCustomComposer(true);
    try {
      const sourceStatus = await BagApi.getSourceBagStatus('DESIGN', item.collectionId);
      const duplicateClasses = sourceStatus.duplicateState?.classifications ?? [];
      const designName = item.collectionTitle || 'this design';
      if (sourceStatus.custom.alreadyBagged || duplicateClasses.includes('IN_BAG')) {
        bagFlow?.openExistingBag({ id: item.collectionId, name: designName }, sourceStatus);
        toast.info('This custom request is already in your bag.');
        return;
      }
      if (duplicateClasses.includes('SUBMITTED_UNPAID')) {
        bagFlow?.openExistingBag({ id: item.collectionId, name: designName }, sourceStatus);
        toast.info('Resume this custom request from My Bag.');
        return;
      }
      if (duplicateClasses.includes('PAID_ACTIVE')) {
        toast.error('You already have an active paid custom order for this design.');
        return;
      }
      if (duplicateClasses.includes('COMPLETED_BLOCKED')) {
        toast.error(sourceStatus.duplicateState?.reason || 'This completed custom order cannot be repeated.');
        return;
      }
      if (sourceStatus.ui.defaultAction === 'OPEN_FITTINGS') {
        bagFlow?.openFittings({ id: item.collectionId, name: designName }, sourceStatus);
        return;
      }
      if (
        sourceStatus.ui.defaultAction === 'CONFIRM_STALE_FITTINGS' ||
        sourceStatus.custom.requiresStaleConfirmation ||
        sourceStatus.custom.freshnessState === 'STALE'
      ) {
        bagFlow?.openStaleConfirmation({ id: item.collectionId, name: designName }, sourceStatus);
        return;
      }

      let resolvedConfigurationId = sourceStatus.custom.configurationId || customConfigurationId;
      if (!resolvedConfigurationId) {
        const activeConfiguration = await customOrderConfigurationsApi.getActiveForDesign(item.collectionId);
        resolvedConfigurationId = activeConfiguration?.id ?? null;
      }
      if (!resolvedConfigurationId) {
        toast.error('This design is not configured for custom orders yet. Ask the brand to complete custom-order setup.');
        return;
      }
      setCustomConfigurationId(resolvedConfigurationId);
      setCustomComposerOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to bag this design.');
    } finally {
      setOpeningCustomComposer(false);
    }
  };

  const handleOpenBrandCatalog = () => {
    if (!item.brandId) return;
    onClose();
    navigate(`/profile/${item.brandId}?tab=Store`);
  };

  const handleCustomOrderComposerDismiss = () => {
    setCustomComposerOpen(false);
    onClose();
  };

  const handleTogglePatch = async () => {
    if (!item.brandId) return;
    if (!canPatchBrand) {
      toast.info('Only regular users can patch brands.');
      return;
    }

    try {
      const next = await toggleStatus(item.brandId);
      toast.success(next ? 'Patched successfully.' : 'Unpatched successfully.');
    } catch {
      toast.error('Unable to update patch status right now.');
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
    const shareUrl = buildDesignUrl({
      id: item.collectionId,
      legacyCollectionId: item.collectionId,
    });
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
          className="relative w-[98vw] md:w-[88vw] max-w-[1360px] neu-modal-surface rounded-[28px] overflow-hidden shadow-2xl border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 inline-flex items-center justify-center size-9 rounded-full neu-modal-inset"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-lg text-[color:var(--neu-text-muted)]">×</span>
          </button>

          <div className="grid md:grid-cols-[minmax(0,58%)_minmax(0,42%)] h-[min(92vh,860px)]">
            <div className={CONTENT_DISPLAY_FRAME_CLASS}>
              <MediaRenderer
                kind={activeMedia?.type === 'POST_VIDEO' ? 'video' : 'image'}
                src={activeMedia?.url || ''}
                fit="contain" // Override MediaRenderer's default cover constraints
                className={CONTENT_DISPLAY_RENDERER_CLASS}
                mediaClassName={CONTENT_DISPLAY_MEDIA_CLASS}
                maxHeightClassName="" // remove max-h
                allowScroll={true}
                controls={true}
              />

              {loadingMedia ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <VLoader size={30} phase="loading" showLabel={false} />
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
                    <span aria-hidden="true" className="text-lg">‹</span>
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
                    <span aria-hidden="true" className="text-lg">›</span>
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                    {activeMediaIndex + 1} / {mediaItems.length}
                  </div>
                </>
              ) : null}
            </div>

            <div className="h-full min-w-0 p-3.5 md:p-4 bg-white/65 dark:bg-[#0f0b11]/70 text-slate-900 dark:text-white flex flex-col overflow-hidden">
              <div className="space-y-3">
                {/* Brand row */}
                <div className="flex items-center justify-between gap-2 pr-8">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenBrandCatalog}
                      className="group flex min-w-0 items-center gap-2.5 text-left"
                      title={`Open ${brandLabel} catalog`}
                    >
                      <div className="size-9 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/8 dark:ring-white/12">
                        <ImageWithFallback
                          src={avatar.src}
                          fileId={avatar.fileId}
                          alt={brandLabel}
                          fit="cover"
                          rounded="xl"
                          fallbackName={avatarFallback}
                          containerClassName="size-9 rounded-2xl"
                          className="size-9 object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13px] font-semibold transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{brandLabel}</p>
                        </div>
                        {item.username ? <p className="truncate text-[11px] text-slate-400 dark:text-white/40">@{item.username}</p> : null}
                      </div>
                    </button>
                    {canPatchBrand ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleTogglePatch();
                        }}
                        disabled={patchBusy}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-sm transition ${
                          isPatched
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                            : 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-700 hover:bg-fuchsia-500/25 dark:text-fuchsia-300'
                        } ${patchBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {patchBusy ? '...' : isPatched ? 'Patched' : 'Patch'}
                      </button>
                    ) : null}
                  </div>

                </div>

                {/* Title + description */}
                <div>
                  <h1 className="text-base font-bold leading-snug">{item.collectionTitle}</h1>
                  {item.collectionDescription ? (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/55 leading-relaxed line-clamp-2">{item.collectionDescription}</p>
                  ) : null}
                </div>

                {/* Tags */}
                {item.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-semibold uppercase tracking-wider text-slate-700 dark:border dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Price + Custom Order badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{saleBand || baseBand || 'Price on request'}</span>
                  {saleBand && baseBand ? (
                    <span className="text-[10px] text-slate-400 line-through">{baseBand}</span>
                  ) : null}
                  {item.customAvailable ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                      <span aria-hidden="true">✂️</span>
                      Custom
                    </span>
                  ) : null}
                </div>

                {/* Action buttons — compact icon-led pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={
                      openingCustomComposer ||
                      resolvingCustomConfiguration ||
                      isOwnBrandContent
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                    onClick={() => {
                      void handleOpenDesignCustomOrder();
                    }}
                    title={
                      isOwnBrandContent
                        ? 'Brands cannot place custom orders on their own designs'
                        : resolvingCustomConfiguration
                          ? 'Checking custom-order setup for this design'
                          : !customConfigurationId
                            ? 'Check custom-order setup for this design'
                          : 'Request a custom order from this design'
                    }
                    aria-label="Request custom order"
                  >
                    <BagPulseIcon
                      status={
                        openingCustomComposer || resolvingCustomConfiguration
                          ? 'bagging'
                          : isOwnBrandContent || (!customConfigurationId && !resolvingCustomConfiguration)
                            ? 'disabled'
                            : 'not_bagged'
                      }
                      context="detail"
                      size={28}
                      disabled={openingCustomComposer || resolvingCustomConfiguration || isOwnBrandContent}
                    />
                    {openingCustomComposer ? 'Loading...' : 'Request Custom'}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    disabled={saveBusy}
                    title={isOwnBrandContent ? 'Brands cannot save their own products' : isSaved ? 'Unsave' : 'Save'}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 disabled:opacity-50"
                  >
                    <span aria-hidden="true">🔖</span>
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <span aria-hidden="true">🔗</span>
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenBrandCatalog}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <span aria-hidden="true">🏬</span>
                    Store
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
                  externalComment={externalComment}
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
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCommentSubmit();
                    }}
                    disabled={postingComment || !commentText.trim()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    aria-label="Post comment"
                    type="button"
                  >
                    {postingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
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
                <span aria-hidden="true" className="text-lg">🔗</span>
                <span className="text-xs font-bold mt-1 drop-shadow">{item.collectionCollabCount ?? 0}</span>
              </button>
              <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded-lg bg-black/85 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                Share collection
              </span>
            </div>
          </div>
        </div>
      </div>

      {customComposerOpen && customConfigurationId ? (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCustomComposerOpen(false);
              }
            }}
          >
            <div className="relative h-[92vh] w-[98vw] max-w-[1280px] overflow-y-auto rounded-3xl border border-white/20 bg-white/90 p-4 text-slate-900 shadow-2xl dark:bg-[#0d0b12] dark:text-white">
              <button
                type="button"
                aria-label="Close custom order composer"
                onClick={() => setCustomComposerOpen(false)}
                className="sticky top-2 float-right z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/80 text-slate-700 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <span aria-hidden="true" className="text-base">×</span>
              </button>
              <LazyCustomOrderComposerPage
                embedded
                configurationIdOverride={customConfigurationId}
                onClose={handleCustomOrderComposerDismiss}
                onOrderCreated={handleCustomOrderComposerDismiss}
              />
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </OverlayPortal>
  );
};

export default DesignViewModal;
