import React from 'react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import type { MarketItem } from '@/types/market';
import { CommentsApi } from '@/api/CommentsApi';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import DesignCommentsPanel from '@/components/designs/DesignCommentsPanel';
import MediaRenderer from '@/components/media/MediaRenderer';
import useImagePreload from '@/hooks/useImagePreload';
import PinchZoomImage from '@/components/media/PinchZoomImage';
import ImageWithFallback from '@/components/ImageWithFallback';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { selectIsMobile } from '@/features/uiSlice';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { formatPrice } from '@/utils/helpers';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagFlow } from '@/features/bagging/BagFlowProvider';
import {
  ownsDesignBrand,
  runDesignBagFlow,
} from '@/features/bagging/designBagActions';
import {
  BRAND_BAG_BLOCKED_MESSAGE,
  isBrandAccountBlockedFromBagging,
} from '@/lib/baggingAccess';
import { BAG_IT_LABEL } from '@/constants/bagging';
import type { CommentV2Dto } from '@/types/comments';
import {
  CONTENT_DISPLAY_FRAME_CLASS,
  CONTENT_DISPLAY_MEDIA_CLASS,
  CONTENT_DISPLAY_RENDERER_CLASS,
} from '@/components/media/contentDisplayPresets';
import { useBrandPatchState } from '@/context/BrandPatchContext';
import {
  patchButtonColorClasses,
  patchButtonLabel,
  patchToastMessage,
} from '@/lib/patchPresentation';
import { buildDesignUrl } from '@/utils/publicUrlBuilder';
import { buildBrandProfilePathFromMarketItem } from '@/utils/brandProfileRoute';
import {
  fetchActiveCustomOrderConfigurationQuery,
  fetchCollectionDetailQuery,
  useSavedStatusQuery,
} from '@/query/queries';
import { WIEZ_QUERY_STALE_TIME_MS } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import ReportContentButton from '@/components/content-integrity/ReportContentButton';

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

/**
 * Metadata-panel action tiles.
 *
 * `h-14` is fixed on purpose: the tiles hold their box while their labels change
 * ("Save"→"Saved", "Bag It"→"Loading"), so the grid never reflows and the panel
 * never jumps under the cursor mid-interaction.
 */
const ACTION_TILE_CLASS =
  'flex h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center transition-colors';
const ACTION_TILE_NEUTRAL_CLASS =
  'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]';
const ACTION_TILE_LABEL_CLASS = 'w-full truncate text-[9px] font-bold leading-none';

const DesignViewModal: React.FC<Props> = ({ open, item, onClose, onCommentCountChange }) => {
  const [commentCount, setCommentCount] = React.useState<number>(0);
  const [commentText, setCommentText] = React.useState('');
  const [showCommentEmojiPicker, setShowCommentEmojiPicker] = React.useState(false);
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
  const isMobile = useSelector(selectIsMobile);
  const currentUserId = authProfile?.id;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  // Mobile modal keeps a compact, image-first view: brand/price/actions are
  // always visible and the heavier metadata (description, tags, comments)
  // collapses. Starts collapsed so the design dominates.
  const [mobileDetailsOpen, setMobileDetailsOpen] = React.useState(false);
  // Swipe up/down on the meta header expands/collapses the details section.
  const metaSwipeStartYRef = React.useRef<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bagFlow = useBagFlow();
  const itemId = item?.id ?? null;
  const itemCollectionId = item?.collectionId ?? null;
  const itemMediaType = item?.media?.type ?? null;
  const itemMediaUrl = item?.media?.url ?? null;
  const itemCommentsCount = item?.commentsCount ?? 0;

  const fallbackMedia = React.useMemo<ModalMedia | null>(() => {
    if (!itemId) return null;
    return {
      id: itemId,
      type: itemMediaType?.toUpperCase().includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE',
      url: itemMediaUrl || '',
    };
  }, [itemId, itemMediaType, itemMediaUrl]);

  const activeMedia = mediaItems[activeMediaIndex] ?? fallbackMedia;
  const activeMediaId = activeMedia?.id ?? itemId;
  const savedStatusQuery = useSavedStatusQuery('COLLECTION_MEDIA', activeMediaId, {
    enabled: Boolean(open && activeMediaId && isAuth),
  });

  // Every image in this creation already had its display URL resolved once by
  // loadAllDesignMedia. Warm the browser cache + decode for ALL of them up front
  // so flipping left/right is instant and swiping back never re-downloads an
  // already-viewed image (fixes the "swipe stalls / repeated per-image calls").
  const mediaPreloadUrls = React.useMemo(
    () => mediaItems.map((m) => m.url),
    [mediaItems],
  );
  useImagePreload(mediaPreloadUrls);

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
  const isOwnBrandContent = ownsDesignBrand(authProfile, item?.brandId);
  const brandBagBlocked = isBrandAccountBlockedFromBagging(authProfile);
  const canPatchBrand = Boolean(isAuth && isPatchCapable && isRegularViewer && item?.brandId && !isOwnBrandContent);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: onClose,
  });

  // On mobile, the back gesture must close this overlay in place rather than
  // popping the underlying route (which used to dump the user into their
  // catalog when a design was opened from the Runway).
  useOverlayBackClose(open, onClose, isMobile);

  React.useEffect(() => {
    if (!open || !itemId) return;

    setCommentCount(itemCommentsCount);
    setExternalComment(null);
    const seeded: ModalMedia = {
      id: itemId,
      type: itemMediaType?.toUpperCase().includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE',
      url: itemMediaUrl || '',
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
  }, [open, itemCommentsCount, itemId, itemMediaType, itemMediaUrl]);

  React.useEffect(() => {
    let mounted = true;

    const loadAllDesignMedia = async () => {
      if (!open || !itemCollectionId) return;

      setLoadingMedia(true);
      try {
        const detail = await fetchCollectionDetailQuery(queryClient, itemCollectionId, 'design');
        const rawMedias = Array.isArray(detail?.medias) ? detail.medias : [];

        const parsed: ModalMedia[] = rawMedias
          .map((m: any): ModalMedia | null => {
            const mediaId = typeof m?.id === 'string' ? m.id : null;
            if (!mediaId) return null;
            const file = m?.file;
            const rawType = String(m?.mediaType ?? file?.mimeType ?? '').toUpperCase();
            const mediaType: 'POST_IMAGE' | 'POST_VIDEO' = rawType.includes('VIDEO') ? 'POST_VIDEO' : 'POST_IMAGE';
            const fileId = typeof file?.id === 'string' ? file.id : null;
            // Don't seed raw S3 URLs when fileId exists — they bypass API URL resolution at line 171
            const url = fileId ? '' : String(file?.s3Url ?? file?.url ?? '');
            return { id: mediaId, type: mediaType, url, fileId };
          })
          .filter((m: ModalMedia | null): m is ModalMedia => Boolean(m));

        const hydrated = await Promise.all(
          parsed.map(async (m) => {
            if (!m.fileId) return m;
            if (m.url && /^https?:\/\//i.test(m.url)) return m;
            let publicUrl: string | null = null;
            try {
              publicUrl = await queryClient.fetchQuery({
                queryKey: queryKeys.media.publicUrl(m.fileId),
                queryFn: () => brandApi.getPublicFileUrl(String(m.fileId)),
                staleTime: WIEZ_QUERY_STALE_TIME_MS,
                retry: false,
              });
            } catch {
              publicUrl = null;
            }

            try {
              const signed = publicUrl ?? await queryClient.fetchQuery({
                queryKey: queryKeys.media.signedUrl(m.fileId),
                queryFn: () => brandApi.getPrivateSignedFileUrl(String(m.fileId)),
                staleTime: WIEZ_QUERY_STALE_TIME_MS,
                gcTime: WIEZ_QUERY_STALE_TIME_MS,
                retry: false,
              });
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

        const preferredId = itemId;
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
  }, [open, itemCollectionId, itemId, fallbackMedia, queryClient]);

  React.useEffect(() => {
    let mounted = true;

    const resolveCustomConfiguration = async () => {
      if (!open || !itemCollectionId) {
        if (mounted) {
          setCustomConfigurationId(null);
          setResolvingCustomConfiguration(false);
        }
        return;
      }

      setResolvingCustomConfiguration(true);
      try {
        const activeConfiguration = await fetchActiveCustomOrderConfigurationQuery(
          queryClient,
          'DESIGN',
          itemCollectionId,
        );
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
  }, [open, itemCollectionId, queryClient]);

  const onCommentCountChangeRef = React.useRef(onCommentCountChange);
  React.useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  React.useEffect(() => {
    if (!open) return;
    onCommentCountChangeRef.current?.(commentCount);
  }, [commentCount, open]);

  // Fresh open (or navigating to a new item) starts the mobile drawer collapsed.
  React.useEffect(() => {
    if (open) setMobileDetailsOpen(false);
  }, [open, itemId]);

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
    if (!open || !activeMediaId || !isAuth) {
      setIsSaved((current) => (current ? false : current));
      return;
    }
    if (typeof savedStatusQuery.data === 'boolean') {
      setIsSaved((current) => (current === savedStatusQuery.data ? current : savedStatusQuery.data));
    }
  }, [activeMediaId, isAuth, open, savedStatusQuery.data]);

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
    if (!item) return;
    if (openingCustomComposer) return;
    if (resolvingCustomConfiguration) {
      toast.info('Checking custom-order setup...');
      return;
    }

    setOpeningCustomComposer(true);
    try {
      await runDesignBagFlow({
        item,
        user: authProfile,
        isAuthenticated: isAuth,
        bagFlow,
        onOpenCustomComposer: async (configurationId) => {
          setCustomConfigurationId(configurationId);
          setCustomComposerOpen(true);
        },
      });
    } finally {
      setOpeningCustomComposer(false);
    }
  };

  const handleOpenBrandCatalog = () => {
    const path = buildBrandProfilePathFromMarketItem(item, 'Store');
    if (!path) return;
    onClose();
    navigate(path);
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
      toast.success(patchToastMessage(next, item.brandName));
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
        queryClient.setQueryData(
          queryKeys.saved.status('COLLECTION_MEDIA', activeMediaId),
          false,
        );
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION_MEDIA', targetId: activeMediaId });
        setIsSaved(true);
        queryClient.setQueryData(
          queryKeys.saved.status('COLLECTION_MEDIA', activeMediaId),
          true,
        );
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
  const isVideoMedia = activeMedia?.type === 'POST_VIDEO';

  // Shared bag-button semantics (identical on desktop + mobile).
  const bagDisabled =
    openingCustomComposer ||
    resolvingCustomConfiguration ||
    isOwnBrandContent ||
    brandBagBlocked;
  const bagTitle = brandBagBlocked
    ? BRAND_BAG_BLOCKED_MESSAGE
    : isOwnBrandContent
      ? 'Brands cannot place custom orders on their own designs'
      : resolvingCustomConfiguration
        ? 'Checking custom-order setup for this design'
        : !customConfigurationId
          ? 'Check custom-order setup for this design'
          : 'Bag this design as a custom order';
  const bagStatus: 'bagging' | 'disabled' | 'not_bagged' =
    openingCustomComposer || resolvingCustomConfiguration
      ? 'bagging'
      : isOwnBrandContent ||
          brandBagBlocked ||
          (!customConfigurationId && !resolvingCustomConfiguration)
        ? 'disabled'
        : 'not_bagged';

  // Custom-order composer overlay — shared between the desktop and mobile
  // layouts so the composer logic lives in exactly one place.
  const customComposerOverlay =
    customComposerOpen && customConfigurationId ? (
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
    ) : null;

  // ------------------------------------------------------------------
  // MOBILE: keep a true MODAL (open/close, backdrop). ASPECT-AWARE layout:
  // the media region is sized by the image's natural aspect ratio and
  // SHRINKS (object-contain — never cropped, never pushed down) so the
  // metadata always sits BELOW the image, never covering it while
  // collapsed. Vertical and horizontal images are both fully visible.
  // Tap the image (outside controls) closes the modal. Back gesture
  // closes the overlay in place via useOverlayBackClose.
  // ------------------------------------------------------------------
  if (isMobile) {
    const mobileActionBtn =
      'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10';

    return (
      <OverlayPortal>
        <div
          className="fixed inset-0 z-layer-modal flex items-end justify-center bg-black/70 sm:items-center sm:p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={item.collectionTitle || 'Design'}
        >
          <div
            ref={dialogRef}
            className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-black shadow-2xl sm:rounded-3xl"
            style={{ maxHeight: '94vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close chip */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-30 flex size-9 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <span aria-hidden="true" className="text-lg">×</span>
            </button>

            {/* MEDIA REGION — flexes to the image's natural height and shrinks
                when the sheet needs room. object-contain keeps the FULL image
                visible for every aspect ratio (portrait and landscape). */}
            <div
              className="relative min-h-0 flex-auto"
              onClick={(e) => {
                // Tap image background closes; ignore interactive controls.
                const t = e.target as HTMLElement | null;
                if (t?.closest('button, a, input, textarea, video')) {
                  return;
                }
                onClose();
              }}
            >
              {isVideoMedia ? (
                <MediaRenderer
                  kind="video"
                  src={activeMedia?.url || ''}
                  fit="contain"
                  className="h-full w-full"
                  mediaClassName="block h-auto max-h-full w-full object-contain"
                  maxHeightClassName="max-h-full"
                  controls={true}
                />
              ) : (
                <PinchZoomImage
                  src={activeMedia?.url || ''}
                  alt={item.collectionTitle || 'Design image'}
                  className="h-full max-h-full"
                />
              )}

              {/* Only show media spinner when we have no usable preview yet */}
              {loadingMedia && !activeMedia?.url ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <MuseLoader size={28} />
                </div>
              ) : null}

              {showMediaNav ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex(
                        (prev) => (prev - 1 + mediaItems.length) % mediaItems.length,
                      );
                    }}
                  >
                    <span aria-hidden="true" className="text-lg">‹</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIndex((prev) => (prev + 1) % mediaItems.length);
                    }}
                  >
                    <span aria-hidden="true" className="text-lg">›</span>
                  </button>
                  <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                    {activeMediaIndex + 1} / {mediaItems.length}
                  </div>
                </>
              ) : null}
            </div>

            {/* META REGION — in normal flow BELOW the media (never covers it
                while collapsed). Details expand with a smooth pure-CSS
                grid-rows transition; swipe up/down on the handle also
                expands/collapses. */}
            <div
              className="shrink-0 border-t border-white/10 bg-white/95 backdrop-blur-md dark:bg-[#0f0b11]/95"
              onTouchStart={(e) => {
                const t = e.target as HTMLElement | null;
                if (t?.closest('[data-meta-sheet-scroll]')) return;
                metaSwipeStartYRef.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                const startY = metaSwipeStartYRef.current;
                metaSwipeStartYRef.current = null;
                if (startY === null) return;
                const endY = e.changedTouches[0]?.clientY ?? startY;
                const dy = endY - startY;
                if (Math.abs(dy) < 30) return;
                setMobileDetailsOpen(dy < 0);
              }}
            >
              {/* Drag handle */}
              <button
                type="button"
                aria-label={mobileDetailsOpen ? 'Collapse details' : 'Expand details'}
                onClick={() => setMobileDetailsOpen((v) => !v)}
                className="flex w-full items-center justify-center pb-1 pt-2"
              >
                <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-white/25" />
              </button>

              <div className="px-4 pb-3">
                <>
                      <div className="flex items-center justify-between gap-2 pr-1">
                        <button
                          type="button"
                          onClick={handleOpenBrandCatalog}
                          className="group flex min-w-0 items-center gap-2.5 text-left"
                          title={`Open ${brandLabel} catalog`}
                        >
                          <span className="size-9 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
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
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                              {brandLabel}
                            </span>
                            {item.username ? (
                              <span className="block truncate text-[11px] text-slate-400 dark:text-white/40">
                                @{item.username}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileDetailsOpen((v) => !v)}
                          aria-expanded={mobileDetailsOpen}
                          className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200"
                        >
                          {mobileDetailsOpen ? 'Hide' : 'Details'}
                          {commentCount > 0 && !mobileDetailsOpen ? ` · ${commentCount}` : ''}
                        </button>
                      </div>

                      <h1 className="mt-2 text-base font-bold leading-snug text-slate-900 dark:text-white">
                        {item.collectionTitle}
                      </h1>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {saleBand || baseBand || 'Price on request'}
                        </span>
                        {saleBand && baseBand ? (
                          <span className="text-[10px] text-slate-400 line-through">{baseBand}</span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={bagDisabled}
                          onClick={() => {
                            void handleOpenDesignCustomOrder();
                          }}
                          title={bagTitle}
                          aria-label={BAG_IT_LABEL}
                          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                        >
                          <BagPulseIcon status={bagStatus} context="detail" size={26} disabled={bagDisabled} />
                          {openingCustomComposer ? 'Loading...' : BAG_IT_LABEL}
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleSave}
                          disabled={saveBusy}
                          title={isOwnBrandContent ? 'Brands cannot save their own products' : isSaved ? 'Unsave' : 'Save'}
                          className={`${mobileActionBtn} disabled:opacity-50`}
                        >
                          <span aria-hidden="true">🔖</span>
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button type="button" onClick={handleShare} className={mobileActionBtn}>
                          <span aria-hidden="true">🔗</span>
                          Share
                        </button>
                        {item ? (
                          <ReportContentButton
                            targetType={item.designId ? 'DESIGN' : 'COLLECTION'}
                            targetId={item.designId ?? item.collectionId ?? item.id}
                            label="Report"
                            className={mobileActionBtn}
                          />
                        ) : null}
                        <button type="button" onClick={handleOpenBrandCatalog} className={mobileActionBtn}>
                          <span aria-hidden="true">🏬</span>
                          Store
                        </button>
                      </div>
                </>
              </div>

              {/* Collapsible details/comments — smooth pure-CSS grid-rows
                  transition (expanding compresses the media region above,
                  it never slides OVER the image). */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: mobileDetailsOpen ? '1fr' : '0fr' }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    data-meta-sheet-scroll
                    className="max-h-[42vh] overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
                    style={{ touchAction: 'pan-y' }}
                  >
                    <div className="space-y-3 pt-1">
                      {item.collectionDescription ? (
                        <p className="text-xs leading-relaxed text-slate-500 dark:text-white/60">
                          {item.collectionDescription}
                        </p>
                      ) : null}

                      {item.tags?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-700 dark:border dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="pt-3">
                        <div className="relative flex items-center gap-1.5 rounded-xl bg-slate-900/5 px-2.5 py-2 dark:bg-white/10">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void handleCommentSubmit();
                              }
                            }}
                            disabled={postingComment}
                            placeholder="Add a comment..."
                            maxLength={500}
                            className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCommentEmojiPicker((prev) => !prev)}
                            aria-label="Insert emoji"
                            aria-expanded={showCommentEmojiPicker}
                            className="shrink-0 rounded-lg px-1.5 py-1 text-base leading-none transition hover:bg-slate-900/10 dark:hover:bg-white/10"
                          >
                            <span aria-hidden="true">🙂</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleCommentSubmit();
                            }}
                            disabled={postingComment || !commentText.trim()}
                            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
                            aria-label="Post comment"
                          >
                            {postingComment ? '...' : 'Post'}
                          </button>
                          {showCommentEmojiPicker && (
                            <div className="absolute bottom-full right-0 z-50 mb-2">
                              <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                  setCommentText((prev) => `${prev}${emojiData.emoji}`);
                                  setShowCommentEmojiPicker(false);
                                }}
                                emojiStyle={EmojiStyle.NATIVE}
                                theme={Theme.AUTO}
                                searchDisabled
                                skinTonesDisabled
                                lazyLoadEmojis
                                width={280}
                                height={320}
                              />
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
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
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {customComposerOverlay}
      </OverlayPortal>
    );
  }

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
                  <MuseLoader size={30} />
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

            <div className="flex h-full min-w-0 flex-col overflow-hidden bg-white/65 text-slate-900 dark:bg-[#0f0b11]/70 dark:text-white">
              {/* Fixed metadata header — never scrolls; only the comments feed below does. */}
              <div className="shrink-0 space-y-2.5 border-b border-slate-900/[0.08] p-3.5 dark:border-white/10 md:p-4">
                {/* Brand row */}
                <div className="flex items-center justify-between gap-2 pr-8">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleOpenBrandCatalog}
                      className="group flex min-w-0 items-center gap-2.5 text-left"
                      title={`Open ${brandLabel} catalog`}
                    >
                      <div className="size-9 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
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
                        <p className="truncate text-[13px] font-semibold leading-tight transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{brandLabel}</p>
                        {item.username ? <p className="truncate text-[10px] leading-tight text-slate-500 dark:text-white/45">@{item.username}</p> : null}
                      </div>
                    </button>
                    {canPatchBrand ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleTogglePatch();
                        }}
                        disabled={patchBusy}
                        aria-live="polite"
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-sm transition ${patchButtonColorClasses(
                          isPatched,
                        )} ${patchBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {patchButtonLabel(isPatched, patchBusy)}
                      </button>
                    ) : null}
                  </div>

                </div>

                {/* Title + description */}
                <div>
                  <h1 className="text-[17px] font-bold leading-tight tracking-tight">{item.collectionTitle}</h1>
                  {item.collectionDescription ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] font-medium italic leading-snug text-indigo-600/90 dark:text-indigo-300/90">{item.collectionDescription}</p>
                  ) : null}
                </div>

                {/* Tags */}
                {item.tags?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded border border-indigo-200/70 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Price + Custom Order badge — labelled column on the left so the
                    number is never mistaken for a single price, badge pinned right
                    on its own baseline. */}
                <div className="flex items-end justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/45">
                      {saleBand && baseBand ? 'Sale price' : 'Price range'}
                    </span>
                    <span className="truncate text-[15px] font-bold leading-tight text-emerald-600 dark:text-emerald-400">
                      {saleBand || baseBand || 'Price on request'}
                    </span>
                    {saleBand && baseBand ? (
                      <span className="text-[10px] leading-tight text-slate-400 line-through">{baseBand}</span>
                    ) : null}
                  </div>
                  {item.customAvailable ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pink-400/25 bg-pink-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-pink-600 dark:text-pink-400">
                      <span aria-hidden="true">✂️</span>
                      Custom
                    </span>
                  ) : null}
                </div>

                {/* Action tiles — fixed 5-up grid.
                    Every tile is the same height and the labels sit under the
                    glyph, so nothing reflows when a label changes length
                    ("Save"→"Saved", "Bag It"→"Loading..."). The old wrap-flow of
                    pills re-laid-out on every state change, which is what read
                    as the panel shaking. */}
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    disabled={
                      openingCustomComposer ||
                      resolvingCustomConfiguration ||
                      isOwnBrandContent ||
                      brandBagBlocked
                    }
                    className={`${ACTION_TILE_CLASS} bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400`}
                    onClick={() => {
                      void handleOpenDesignCustomOrder();
                    }}
                    title={
                      brandBagBlocked
                        ? BRAND_BAG_BLOCKED_MESSAGE
                        : isOwnBrandContent
                          ? 'Brands cannot place custom orders on their own designs'
                          : resolvingCustomConfiguration
                            ? 'Checking custom-order setup for this design'
                            : !customConfigurationId
                              ? 'Check custom-order setup for this design'
                              : 'Bag this design as a custom order'
                    }
                    aria-label={BAG_IT_LABEL}
                  >
                    <BagPulseIcon
                      status={
                        openingCustomComposer || resolvingCustomConfiguration
                          ? 'bagging'
                          : isOwnBrandContent ||
                              brandBagBlocked ||
                              (!customConfigurationId && !resolvingCustomConfiguration)
                            ? 'disabled'
                            : 'not_bagged'
                      }
                      context="detail"
                      size={22}
                      disabled={
                        openingCustomComposer ||
                        resolvingCustomConfiguration ||
                        isOwnBrandContent ||
                        brandBagBlocked
                      }
                    />
                    <span className={ACTION_TILE_LABEL_CLASS}>
                      {openingCustomComposer ? 'Loading' : BAG_IT_LABEL}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    disabled={saveBusy}
                    title={isOwnBrandContent ? 'Brands cannot save their own products' : isSaved ? 'Unsave' : 'Save'}
                    className={`${ACTION_TILE_CLASS} ${ACTION_TILE_NEUTRAL_CLASS} disabled:opacity-50`}
                  >
                    <span aria-hidden="true" className="text-base leading-none">{isSaved ? '🔖' : '🏷️'}</span>
                    <span className={ACTION_TILE_LABEL_CLASS}>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className={`${ACTION_TILE_CLASS} ${ACTION_TILE_NEUTRAL_CLASS}`}
                  >
                    <span aria-hidden="true" className="text-base leading-none">🔗</span>
                    <span className={ACTION_TILE_LABEL_CLASS}>Share</span>
                  </button>
                  {item ? (
                    <ReportContentButton
                      targetType={item.designId ? 'DESIGN' : 'COLLECTION'}
                      targetId={item.designId ?? item.collectionId ?? item.id}
                      label="Report"
                      className={`${ACTION_TILE_CLASS} ${ACTION_TILE_NEUTRAL_CLASS} [&>span]:text-[9px]`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={handleOpenBrandCatalog}
                    className={`${ACTION_TILE_CLASS} ${ACTION_TILE_NEUTRAL_CLASS}`}
                  >
                    <span aria-hidden="true" className="text-base leading-none">🏬</span>
                    <span className={ACTION_TILE_LABEL_CLASS}>Store</span>
                  </button>
                </div>
              </div>

              {/* Comments sit directly on the panel surface: no card, no border,
                  no tinted inner box — the list scrolls inline against the modal
                  background so the text reads as part of the content. */}
              <div className="min-h-0 flex-1 overflow-hidden bg-slate-900/[0.03] px-3.5 py-3 dark:bg-black/25 md:px-4">
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

              {/* Sticky composer — pinned below the scrolling feed. */}
              <div className="relative shrink-0 border-t border-slate-900/[0.08] p-3 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-900/5 px-2.5 py-1.5 dark:bg-white/10">
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
                    className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/50"
                  />
                  {/* The emoji affordance lived only on DesignCommentsPanel's own
                      composer, which this modal renders with showComposer={false}
                      — so on the design modal there was no emoji button at all. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommentEmojiPicker((prev) => !prev);
                    }}
                    aria-label="Insert emoji"
                    aria-expanded={showCommentEmojiPicker}
                    className="shrink-0 rounded-lg px-1.5 py-1 text-base leading-none transition hover:bg-slate-900/10 dark:hover:bg-white/10"
                  >
                    <span aria-hidden="true">🙂</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCommentSubmit();
                    }}
                    disabled={postingComment || !commentText.trim()}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    aria-label="Post comment"
                    type="button"
                  >
                    {postingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
                {showCommentEmojiPicker && (
                  <div className="absolute bottom-full right-0 z-50 mb-2">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        setCommentText((prev) => `${prev}${emojiData.emoji}`);
                        setShowCommentEmojiPicker(false);
                      }}
                      emojiStyle={EmojiStyle.NATIVE}
                      theme={Theme.AUTO}
                      searchDisabled
                      skinTonesDisabled
                      lazyLoadEmojis
                      width={300}
                      height={360}
                    />
                  </div>
                )}
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

      {customComposerOverlay}
    </OverlayPortal>
  );
};

export default DesignViewModal;
