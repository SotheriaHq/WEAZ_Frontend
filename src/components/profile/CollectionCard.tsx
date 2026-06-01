import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Share2, MoreVertical, AlertTriangle, Bookmark } from 'lucide-react';
import { useSelector } from 'react-redux';
import ThreadButton from '@/components/ui/ThreadButton';
import type { CollectionDto } from '../../types/profile';
import { formatPrice } from '@/utils/helpers';
import { brandApi } from '@/api/BrandApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@/components/ui/Dropdown';
import ManageAccessModal from './ManageAccessModal';
import MediaRenderer from '@/components/media/MediaRenderer';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import VLoader from '@/components/loaders/VLoader';
import { getCatalogEntityCardCopy, resolveCatalogEntityCardBranch } from './catalogEntityCardModel';
import { mapCatalogTargetForLegacyApi } from '@/utils/catalogTarget';
import { getCompactPublishTaskStatusLabel } from '@/utils/publishTracker';
import { getContentStatusLabel, getContentStatusTone } from '@/utils/contentIntegrity';

export interface CollectionCardProps {
  collection: CollectionDto;
  cardKind?: 'design' | 'collection';
  onClick?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  showActions?: boolean;
  isDraft?: boolean;
  isDeleted?: boolean;
  onRetryPublish?: (id: string) => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
  saveBusy?: boolean;
}

const CollectionCardComponent: React.FC<CollectionCardProps> = ({
  collection, 
  cardKind,
  onClick,
  onEdit, 
  onDelete,
  onRestore,
  onPermanentDelete,
  showActions = true,
  isDraft = false,
  isDeleted = false,
  onRetryPublish,
  isSaved: isSavedProp,
  onToggleSave,
  saveBusy: saveBusyProp,
}) => {
  const {
    title,
    coverImage,
    coverFileId,
    previewImages,
    threadsCount = 0,
    commentsCount = 0,
    itemCount = 0,
    postsCount = 0,
    minPrice = 0,
    maxPrice = 0,
    saleMinPrice,
    saleMaxPrice,
    saleStartAt,
    saleEndAt,
    brandName,
    username,
    brandLogo,
    isAvailableInStore = false,
  } = collection;
  const inferredBranch = resolveCatalogEntityCardBranch(
    collection,
    isAvailableInStore ? 'COLLECTION' : 'DESIGN',
  );
  const cardBranch = cardKind ?? (inferredBranch === 'collection' ? 'collection' : 'design');
  const entityType = cardBranch === 'collection' ? 'COLLECTION' : 'DESIGN';
  const savedTarget = useMemo(
    () => mapCatalogTargetForLegacyApi({
      targetType: entityType,
      targetId: collection.id,
      designId: entityType === 'DESIGN' ? collection.id : undefined,
      collectionId: collection.id,
      legacyCollectionId: entityType === 'DESIGN' ? collection.id : undefined,
    }),
    [collection.id, entityType],
  );
  const copy = getCatalogEntityCardCopy(cardBranch);
  const displayTitle = title?.trim() || copy.titleFallback;

  const clientStatus = collection.clientStatus;
  const isPublishing = clientStatus === 'publishing';
  const publishFailed = clientStatus === 'publish-failed';
  const publishProgress = typeof collection.clientStatusMeta?.progress === 'number'
    ? Math.max(0, Math.min(100, Math.round(collection.clientStatusMeta.progress)))
    : null;
  const compactStatusLabel = getCompactPublishTaskStatusLabel({
    status: isPublishing ? 'uploading' : publishFailed ? 'publish-failed' : 'published',
    kind: collection.clientStatusMeta?.kind,
    progress: publishProgress,
  });
  const backendStatus = String(collection.publicationStatus ?? collection.status ?? '').toUpperCase();
  const reviewStatusLabel =
    backendStatus === 'IN_REVIEW' ||
    backendStatus === 'CHANGES_REQUESTED' ||
    backendStatus === 'REJECTED' ||
    backendStatus === 'FAILED'
      ? getContentStatusLabel(backendStatus)
      : null;
  const reviewStatusClassName = reviewStatusLabel
    ? getContentStatusTone(backendStatus)
    : 'bg-sky-500/90 text-white';
  const clientPreviewUrl = collection.clientStatusMeta?.previewUrl;
  const hasPersistedCollectionId = !collection.id.startsWith('publish_');

  const displayItemCount = itemCount || postsCount;
  const [resolvedCover, setResolvedCover] = useState<string | undefined>(coverImage && coverImage.length > 0 ? coverImage : undefined);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    const maybeResolve = async () => {
      // Guard: skip empty-string coverImage so coverFileId branch is reached
      if (coverImage && coverImage.length > 0 && (coverImage.includes('?') || !coverImage.includes('s3'))) {
         setResolvedCover(coverImage);
         return;
      }

      // Handle raw unsigned S3 URLs (contain '.s3.' but no '?' query params)
      if (coverImage && coverImage.length > 0 && coverImage.includes('.s3.') && !coverImage.includes('?')) {
        try {
          const signedUrl = await brandApi.getSignedS3Url(coverImage);
          if (mounted && signedUrl) setResolvedCover(signedUrl);
        } catch {
          if (mounted) setResolvedCover(coverImage);
        }
        return;
      }

      if (coverFileId) {
        const url = await brandApi.getSignedFileUrl(coverFileId);
        if (mounted) setResolvedCover(url ?? undefined);
        return;
      }
      if (coverImage && coverImage.length > 0) {
        setResolvedCover(coverImage);
        return;
      }
    };
    void maybeResolve();
    return () => {
      mounted = false;
    };
  }, [coverImage, coverFileId]);

  // Reset loaded flag when image source changes
  useEffect(() => {
    setImgLoaded(false);
  }, [resolvedCover]);

  // ─── Preview images & hover cycling ───────────────────────────────
  const previewSources = useMemo(() => {
    const sources: Array<{ src: string | null; fileId: string | null; productName?: string }> = [];
    const seen = new Set<string>();
    const push = (src: string | null | undefined, fileId: string | null | undefined, productName?: string) => {
      const s = typeof src === 'string' && src.length > 0 ? src : null;
      const f = typeof fileId === 'string' && fileId.length > 0 ? fileId : null;
      if (!s && !f) return;
      const key = `${s ?? ''}|${f ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      sources.push({ src: s, fileId: f, productName });
    };
    (previewImages ?? []).forEach((img) => push(img.url ?? null, img.fileId ?? null, (img as any)?.productName));
    if (sources.length === 0) push(coverImage ?? null, coverFileId ?? null);
    return sources;
  }, [previewImages, coverImage, coverFileId]);

  const [hoverFrame, setHoverFrame] = useState(0);
  const hoverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (previewSources.length <= 1) return;
    setHoverFrame(0);
    hoverTimerRef.current = setInterval(() => {
      setHoverFrame((prev) => (prev + 1) % previewSources.length);
    }, 1200);
  }, [previewSources.length]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearInterval(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverFrame(0);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearInterval(hoverTimerRef.current);
    };
  }, []);

  const [resolvedHoverSrc, setResolvedHoverSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (previewSources.length <= 1 || hoverFrame === 0) {
      setResolvedHoverSrc(undefined);
      return;
    }
    let mounted = true;
    const source = previewSources[hoverFrame];
    if (source?.src && source.src.length > 0) {
      setResolvedHoverSrc(source.src);
    } else if (source?.fileId) {
      void brandApi.getSignedFileUrl(source.fileId).then((url) => {
        if (mounted && url) setResolvedHoverSrc(url);
      });
    }
    return () => { mounted = false; };
  }, [hoverFrame, previewSources]);

  // The image to actually display: hover preview takes priority over resolved cover
  const displaySrc = resolvedHoverSrc || resolvedCover;
  const resolvedDisplaySrc = displaySrc || (isPublishing ? clientPreviewUrl : undefined);
  const [accessOpen, setAccessOpen] = useState(false);

  // Compute compact price bands (align with MarketCard)
  const baseBand = (() => {
    const hasMin = typeof minPrice === 'number' && Number.isFinite(minPrice) && minPrice > 0;
    const hasMax = typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice > 0;
    const min = hasMin ? formatPrice(minPrice) : undefined;
    const max = hasMax ? formatPrice(maxPrice) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })();

  const now = Date.now();
  const saleWindowOk = (() => {
    // Allow 5 minute clock skew buffer for start time
    const startOk = !saleStartAt || (new Date(saleStartAt).getTime() <= now + 5 * 60 * 1000);
    const endOk = !saleEndAt || (new Date(saleEndAt).getTime() >= now);
    return startOk && endOk;
  })();

  const hasSaleMin = typeof saleMinPrice === 'number' && Number.isFinite(saleMinPrice);
  const hasSaleMax = typeof saleMaxPrice === 'number' && Number.isFinite(saleMaxPrice);
  const saleBand = saleWindowOk ? (() => {
    const min = hasSaleMin ? formatPrice(saleMinPrice as number) : undefined;
    const max = hasSaleMax ? formatPrice(saleMaxPrice as number) : undefined;
    if (min && max) return `${min} - ${max}`;
    if (min) return `${min}+`;
    if (max) return `Up to ${max}`;
    return null;
  })() : null;

  const showStacked = Boolean(saleBand && baseBand);
  const singleBand = saleBand ?? baseBand;
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [isSavedLocal, setIsSavedLocal] = useState(false);
  const [saveBusyLocal, setSaveBusyLocal] = useState(false);
  const isControlled = typeof isSavedProp === 'boolean' && typeof onToggleSave === 'function';
  const resolvedSaved = isControlled ? (isSavedProp as boolean) : isSavedLocal;
  const resolvedSaveBusy = isControlled ? Boolean(saveBusyProp) : saveBusyLocal;

  useEffect(() => {
    let mounted = true;
    const loadSaved = async () => {
      if (isControlled) return;
      if (!isAuth) {
        if (mounted) setIsSavedLocal(false);
        return;
      }
      try {
        const res = await apiClient.get('/saved/check', {
          params: savedTarget,
        });
        if (mounted) {
          setIsSavedLocal(Boolean(res.data?.isSaved));
        }
      } catch {
        if (mounted) setIsSavedLocal(false);
      }
    };
    void loadSaved();
    return () => { mounted = false; };
  }, [collection.id, isAuth, isControlled, savedTarget]);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isControlled) {
      onToggleSave?.(collection.id);
      return;
    }
    if (!isAuth) {
      toast.info(copy.signInSaveMessage);
      return;
    }
    if (saveBusyLocal) return;
    try {
      setSaveBusyLocal(true);
      if (isSavedLocal) {
        await apiClient.delete('/saved', { data: savedTarget });
        setIsSavedLocal(false);
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', savedTarget);
        setIsSavedLocal(true);
        toast.success('Saved for later.');
      }
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSaveBusyLocal(false);
    }
  };

  return (
    <>
    <div 
      data-entity-type={entityType}
      data-card-branch={cardBranch}
      className={`relative group w-full overflow-hidden shadow-md transition-transform duration-200 rounded-xl ${
        isDeleted ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'
      }`}
      onClick={isPublishing || isDeleted ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Media */}
      <div className="relative w-full overflow-hidden bg-transparent">
        {(isPublishing || publishFailed) && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center text-white backdrop-blur-sm">
            {isPublishing ? (
              <>
                <VLoader size={24} progress={publishProgress} phase="loading" showLabel={false} />
                <div className="text-sm font-semibold">{compactStatusLabel}</div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-300" />
                <div className="text-sm font-semibold">{compactStatusLabel}</div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasPersistedCollectionId && onEdit ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(collection.id);
                      }}
                      className="px-3 py-1 rounded-lg bg-white/20 border border-white/30 text-xs font-semibold hover:bg-white/25"
                    >
                      Open editor
                    </button>
                  ) : null}
                  {onRetryPublish && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRetryPublish(collection.id); }}
                      className="px-3 py-1 rounded-lg bg-white/15 border border-white/25 text-xs font-semibold hover:bg-white/20"
                    >
                      Retry status
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {resolvedDisplaySrc ? (
          <div className="relative w-full min-h-[320px]">
            {!imgLoaded && (
              <div className="absolute inset-0 min-h-[320px] animate-pulse bg-black/15 dark:bg-black/35" />
            )}

            {/* Check if video based on extension */}
            {(() => {
              const isVideo = resolvedDisplaySrc.match(/\.(mp4|webm|mov|m4v)($|\?)/i);
              if (isVideo) {
                return (
                  <MediaRenderer
                    kind="video"
                    src={resolvedDisplaySrc}
                    controls={false}
                    autoPlay
                    muted
                    loop
                    playsInline
                    fit="contain"
                    maxHeightClassName="max-h-none"
                    maxWidthClassName="max-w-full"
                    className="w-full"
                    mediaClassName="block w-full h-auto object-contain"
                    onLoadedData={() => setImgLoaded(true)}
                  />
                );
              }
              return (
                <MediaRenderer
                  kind="image"
                  src={resolvedDisplaySrc}
                  alt={displayTitle}
                  fit="contain"
                  maxHeightClassName="max-h-none"
                  maxWidthClassName="max-w-full"
                  className="w-full"
                  mediaClassName="block w-full h-auto object-contain"
                  onLoad={() => setImgLoaded(true)}
                />
              );
            })()}
            {previewSources.length > 1 && previewSources[hoverFrame]?.productName && (
              <div className="absolute bottom-2 left-3 z-20 max-w-[calc(100%-4rem)]">
                <span className="inline-block rounded-full border border-white/20 bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md truncate shadow-sm transition-opacity duration-300">
                  {previewSources[hoverFrame].productName}
                </span>
              </div>
            )}
            {previewSources.length > 1 && (
              <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1">
                {previewSources.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                      idx === hoverFrame ? 'bg-white scale-125' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
            <div className="relative flex min-h-[320px] items-center justify-center bg-black/15 dark:bg-black/40 glass-panel">
              <span className="text-white text-3xl font-bold opacity-70">
                {displayTitle.charAt(0)}
              </span>
              {/* Resolving signed URL skeleton shimmer */}
              {coverFileId && (
                <div className="absolute inset-0 animate-pulse bg-white/10 dark:bg-white/5" />
              )}
            </div>
          )}
        
        {/* Always-visible gradient overlay for text readability - lighter for more image visibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        
        {/* Entity badge (top left) */}
        <div className="absolute top-3 left-3 z-20">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/80 backdrop-blur-sm text-white text-xs font-medium rounded-full">
            <span>{copy.badgeLabel}</span>
          </div>
        </div>
        
        {/* Three-dot menu for owners (top right) */}
        {showActions && (onEdit || onDelete || onRestore || onPermanentDelete) && (
          <div className="absolute top-3 right-3 z-50" onClick={(e) => e.stopPropagation()}>
            <Dropdown>
              <DropdownTrigger className="btn-tight-xs">
                <MoreVertical className="w-4 h-4" />
              </DropdownTrigger>
              <DropdownMenu className="w-[min(13rem,calc(100vw-1rem))]">
                {isDeleted ? (
                  <>
                    {onRestore && (
                      <DropdownItem onClick={() => onRestore(collection.id)}>Restore</DropdownItem>
                    )}
                    {onPermanentDelete && (
                      <DropdownItem onClick={() => onPermanentDelete(collection.id)}>Delete Permanently</DropdownItem>
                    )}
                  </>
                ) : (
                  <>
                {/* For drafts: only show Delete. For published: show Edit, Delete, Manage Access */}
                {!isDraft && onEdit && (
                  <DropdownItem onClick={() => onEdit(collection.id)}>{copy.editLabel}</DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem onClick={() => onDelete(collection.id)}>{copy.deleteLabel}</DropdownItem>
                )}
                {!isDraft && (
                  <DropdownItem onClick={() => setAccessOpen(true)}>Manage Access</DropdownItem>
                )}
                  </>
                )}
              </DropdownMenu>
            </Dropdown>
          </div>
        )}

        {/* Vertical Action Bar (like in Reels) - Right side */}
        {!isDraft && !isDeleted && (
        <div className="absolute bottom-28 right-2 z-10 flex flex-col items-center gap-3">
          {/* Legacy thread targets are still collection-backed for design rows. */}
          <ThreadButton
            contentType="COLLECTION"
            contentId={collection.id}
            initialCount={threadsCount}
            initialThreaded={typeof collection.isThreaded === 'boolean' ? collection.isThreaded : undefined}
            ownerId={collection.ownerId}
          />
          <button
            type="button"
            className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            onClick={handleToggleSave}
            disabled={resolvedSaveBusy}
            aria-label={resolvedSaved ? copy.unsaveLabel : copy.saveLabel}
          >
            <Bookmark className={`w-5 h-5 ${resolvedSaved ? 'fill-white' : ''}`} />
          </button>
          <button className="flex flex-col items-center text-white hover:scale-110 transition-transform" onClick={(e) => e.stopPropagation()}>
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{commentsCount}</span>
          </button>
          <button className="flex flex-col items-center text-white hover:scale-110 transition-transform" onClick={(e) => e.stopPropagation()}>
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        )}

        {/* Bottom Info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white z-10">
          {/* Brand Info with Avatar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 flex-shrink-0 ring-1 ring-white/30 rounded-sm overflow-hidden">
              <ImageWithFallback
                src={brandLogo}
                fileId={collection.brandLogoFileId}
                alt={brandName || username || 'Brand'}
                fit="cover"
                containerClassName="w-full h-full"
                rounded="sm"
                fallbackName={brandName || username || 'B'}
              />
            </div>
            <div className="flex-1 min-w-0">
              {brandName && (
                <p className="text-white font-bold text-xs truncate leading-tight">{brandName}</p>
              )}
              {username && (
                <p className="text-white/70 text-[10px] truncate leading-tight">@{username}</p>
              )}
            </div>
          </div>

          {/* Collection Title */}
          <h3 className="text-base font-bold mb-1 line-clamp-2 leading-tight">{displayTitle}</h3>
          
          {/* Collection Stats */}
          <div className="flex items-center gap-1.5 text-[11px] text-white/90 mb-2">
            <span>{displayItemCount} {displayItemCount === 1 ? copy.countSingular : copy.countPlural}</span>
          </div>
          {/* Sale / Price Container */}
          {(baseBand || saleBand) && (
            <div className="mb-2 rounded-md bg-white/15 backdrop-blur-sm border border-white/25 p-2 flex flex-col gap-1">
              {showStacked ? (
                <>
                  {baseBand && (
                    <div className="text-[10px] text-white/70 line-through" aria-label="Original price">{baseBand}</div>
                  )}
                  <div className="flex items-center justify-between">
                    {saleBand && (
                      <div className="text-xs font-bold text-emerald-300" aria-label="Sale price">{saleBand}</div>
                    )}
                    {saleBand && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/40 border border-emerald-400/60 text-white" aria-label="Sale badge">Sale</span>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className={`text-xs font-semibold ${saleBand ? 'text-emerald-300' : 'text-white'}`}
                  aria-label="Price band"
                >
                  {singleBand}
                </div>
              )}
            </div>
          )}

          {/* Footer row - hide comment input for drafts, show completion status instead */}
          <div className="flex items-center gap-2">
            {isDeleted ? (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-rose-500/20 border border-rose-400/30 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-[10px] font-medium text-rose-200">Deleted</span>
                  </div>
                </div>
                {onRestore && (
                  <button
                    className="shrink-0 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-all shadow-md"
                    onClick={(e) => { e.stopPropagation(); onRestore(collection.id); }}
                  >
                    Restore
                  </button>
                )}
              </>
            ) : isDraft ? (
              /* Draft completion indicator */
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/30 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-medium text-amber-200">Draft - {displayItemCount} {copy.draftCountLabel}</span>
                  </div>
                </div>
                <button
                  className="shrink-0 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[11px] font-medium hover:from-purple-600 hover:to-indigo-600 transition-all shadow-md"
                  onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                >
                  {copy.continueLabel}
                </button>
              </>
            ) : reviewStatusLabel ? (
              <>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md border backdrop-blur-sm ${reviewStatusClassName}`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                    <span className="text-[10px] font-medium">{reviewStatusLabel}</span>
                  </div>
                </div>
                {(backendStatus === 'CHANGES_REQUESTED' || backendStatus === 'REJECTED' || backendStatus === 'FAILED') && (
                  <button
                    className="shrink-0 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[11px] font-medium hover:from-purple-600 hover:to-indigo-600 transition-all shadow-md"
                    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                  >
                    Edit
                  </button>
                )}
              </>
            ) : (
              /* Normal entity footer with comment input */
              <>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder={copy.commentPlaceholder}
                    className="w-full rounded-md bg-white/10 text-white placeholder-white/60 border border-white/20 backdrop-blur-sm px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40"
                    onClick={(e) => e.stopPropagation()}
                    readOnly
                  />
                </div>
                <button
                  className="shrink-0 px-3 py-1 rounded-md bg-white/10 border border-white/20 text-white text-[11px] font-medium backdrop-blur-sm hover:bg-white/15 transition"
                  onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                >
                  {copy.viewLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    {!isDeleted && (
      <ManageAccessModal open={accessOpen} collectionId={collection.id} onClose={() => setAccessOpen(false)} />
    )}
    </>
  );
};

export default React.memo(CollectionCardComponent);


