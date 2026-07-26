import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { MessageCircle, Bookmark } from 'lucide-react';
import type { RootState } from '@/store';
import type { MarketItem } from '@/types/market';
import MediaRenderer from '@/components/media/MediaRenderer';
import ImageWithFallback from '@/components/ImageWithFallback';
import ThreadButton from '@/components/ui/ThreadButton';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagFlow } from '@/features/bagging/BagFlowProvider';
import {
  ownsDesignBrand as checkOwnsDesignBrand,
  runDesignBagFlow,
} from '@/features/bagging/designBagActions';
import {
  BRAND_BAG_BLOCKED_MESSAGE,
  isBrandAccountBlockedFromBagging,
} from '@/lib/baggingAccess';
import { BAG_IT_LABEL } from '@/constants/bagging';
import { formatPrice } from '@/utils/helpers';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import { toast } from 'sonner';

export type RunwayReelsItemProps = {
  item: MarketItem;
  isActive: boolean;
  priority?: boolean;
  isSaved?: boolean;
  saveBusy?: boolean;
  isPatched?: boolean;
  patchBusy?: boolean;
  onOpenView?: (item: MarketItem) => void;
  onViewBrand?: (brandId: string, item: MarketItem) => void;
  onToggleSave?: (id: string) => void;
  onTogglePatch?: (brandId: string) => void;
};

/**
 * Single full-viewport runway reel — Instagram/TikTok-style stage with
 * right action rail + bottom brand/meta. Deep-black matte in both themes
 * so light mode never flashes a pale frame between snaps.
 */
export const RunwayReelsItem: React.FC<RunwayReelsItemProps> = ({
  item,
  isActive,
  priority = false,
  isSaved = false,
  saveBusy = false,
  isPatched = false,
  patchBusy = false,
  onOpenView,
  onViewBrand,
  onToggleSave,
  onTogglePatch,
}) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const user = useSelector((s: RootState) => s.user.profile);
  const bagFlow = useBagFlow();
  const [bagBusy, setBagBusy] = useState(false);

  const isVideo = Boolean(item.media.type?.toUpperCase().includes('VIDEO'));
  const isCustomAvailable = item.customAvailable === true;
  const brandId = typeof item.brandId === 'string' ? item.brandId.trim() : '';
  const ownsDesignBrand = checkOwnsDesignBrand(user, brandId);
  const brandBagBlocked = isBrandAccountBlockedFromBagging(user);
  const bagDisabled = bagBusy || ownsDesignBrand || brandBagBlocked;
  const isRegular = user?.type === 'REGULAR';

  const brandAvatar = resolveProfileImageSource({
    brandLogo: item.brandLogo,
    brandLogoFileId: item.brandLogoFileId,
  });
  const brandAvatarFallback = getAvatarFallback(item.brandName ?? null, item.username ?? null);

  const mediaSrc = useMemo(() => {
    // Active + first reel: prefer full display URL; neighbors stay on CARD preview.
    if (isActive || priority) {
      return item.media.url ?? item.media.previewUrl ?? '';
    }
    return item.media.previewUrl ?? item.media.url ?? '';
  }, [isActive, item.media.previewUrl, item.media.url, priority]);

  // Portrait-first cover; landscape contain on black matte (native runway policy).
  const aspect = item.media.aspectRatio;
  const useContain =
    typeof aspect === 'number' && Number.isFinite(aspect) && aspect >= 1.05;
  const fit: 'cover' | 'contain' = useContain ? 'contain' : 'cover';
  const objectClass = useContain ? 'object-contain' : 'object-cover';

  const priceLabel = useMemo(() => {
    const min = typeof item.minPrice === 'number' ? formatPrice(item.minPrice) : undefined;
    const max = typeof item.maxPrice === 'number' ? formatPrice(item.maxPrice) : undefined;
    if (min && max && min !== max) return `${min} – ${max}`;
    return min ?? max ?? null;
  }, [item.maxPrice, item.minPrice]);

  const handleBagDesign = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isCustomAvailable || bagBusy) return;
    if (brandBagBlocked) {
      toast.info(BRAND_BAG_BLOCKED_MESSAGE);
      return;
    }
    setBagBusy(true);
    try {
      await runDesignBagFlow({
        item,
        user,
        isAuthenticated: isAuth,
        bagFlow,
      });
    } finally {
      setBagBusy(false);
    }
  };

  const commentCount = item.commentsCount ?? 0;

  return (
    <article
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
      data-runway-reel-id={item.id}
      aria-label={item.collectionTitle || 'Design'}
    >
      {/* Media stage */}
      <button
        type="button"
        className="absolute inset-0 z-0 block h-full w-full cursor-pointer border-0 bg-black p-0"
        onClick={() => onOpenView?.(item)}
        aria-label={`Open ${item.collectionTitle || 'design'}`}
      >
        {isVideo ? (
          <MediaRenderer
            kind="video"
            src={mediaSrc}
            poster={item.media.previewUrl ?? undefined}
            controls={false}
            autoPlay={isActive}
            muted
            loop
            playsInline
            fit={fit}
            maxHeightClassName="max-h-none"
            maxWidthClassName="max-w-none"
            className="absolute inset-0 h-full w-full"
            mediaClassName={`h-full w-full ${objectClass}`}
            preload={isActive || priority ? 'metadata' : 'none'}
          />
        ) : (
          <ImageWithFallback
            src={mediaSrc}
            fileId={item.media.fileId || null}
            alt={item.collectionTitle}
            fit={fit}
            rounded="none"
            containerClassName="absolute inset-0 h-full w-full"
            maxHeightClassName="max-h-none"
            className={`h-full w-full ${objectClass}`}
            fallbackName={item.collectionTitle}
            loading={priority || isActive ? 'eager' : 'lazy'}
            fetchPriority={priority || isActive ? 'high' : 'low'}
          />
        )}
      </button>

      {/* Readability gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        aria-hidden
      />

      {/* Right action rail */}
      <div className="absolute bottom-28 right-2 z-10 flex flex-col items-center gap-3.5 sm:right-3">
        {isCustomAvailable ? (
          <button
            type="button"
            className="flex flex-col items-center text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleBagDesign}
            disabled={bagDisabled}
            aria-label={BAG_IT_LABEL}
            title={
              brandBagBlocked
                ? BRAND_BAG_BLOCKED_MESSAGE
                : ownsDesignBrand
                  ? 'Brands cannot bag their own designs'
                  : BAG_IT_LABEL
            }
          >
            <BagPulseIcon
              status={bagBusy ? 'bagging' : bagDisabled ? 'disabled' : 'not_bagged'}
              context="rail"
              size={36}
              disabled={bagDisabled}
            />
            <span className="mt-0.5 text-[10px] font-bold drop-shadow">{BAG_IT_LABEL}</span>
          </button>
        ) : null}

        <div className="flex flex-col items-center gap-0.5 text-white">
          <ThreadButton
            contentType="COLLECTION_MEDIA"
            contentId={item.id}
            initialCount={item.threadsCount ?? 0}
            initialThreaded={item.isThreaded}
            ownerId={item.brandId}
            parentCollectionId={item.collectionId}
            size={22}
          />
        </div>

        <button
          type="button"
          className="flex flex-col items-center text-white transition-transform active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onOpenView?.(item);
          }}
          aria-label="Comments"
          title="Comments"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </span>
          <span className="mt-0.5 text-[10px] font-bold drop-shadow">
            {commentCount > 0 ? commentCount : '·'}
          </span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center text-white transition-transform active:scale-95 disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave?.(item.id);
          }}
          disabled={saveBusy}
          aria-label={isSaved ? 'Unsave' : 'Save'}
          title={isSaved ? 'Unsave' : 'Save'}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
            <Bookmark
              className={`h-5 w-5 ${isSaved ? 'fill-white' : ''}`}
              aria-hidden
            />
          </span>
          <span className="mt-0.5 text-[10px] font-bold drop-shadow">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {isRegular && brandId ? (
          <button
            type="button"
            className="flex flex-col items-center text-white transition-transform active:scale-95 disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePatch?.(brandId);
            }}
            disabled={patchBusy}
            aria-label={isPatched ? 'Unpatch brand' : 'Patch brand'}
            title={isPatched ? 'Unpatch brand' : 'Patch brand'}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-base backdrop-blur-sm">
              {isPatched ? '✓' : '🧵'}
            </span>
            <span className="mt-0.5 text-[10px] font-bold drop-shadow">
              {isPatched ? 'Patched' : 'Patch'}
            </span>
          </button>
        ) : null}
      </div>

      {/* Bottom meta */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-4 pr-16 pt-8">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (brandId) onViewBrand?.(brandId, item);
          }}
          className="mb-1.5 flex max-w-[85%] items-center gap-2 rounded-lg text-left"
        >
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/35 shadow-md">
            <ImageWithFallback
              src={brandAvatar.src}
              fileId={brandAvatar.fileId}
              alt={item.brandName ?? item.username ?? 'Brand'}
              fit="cover"
              rounded="xl"
              fallbackName={brandAvatarFallback}
              containerClassName="h-9 w-9 rounded-xl"
              className="h-9 w-9 object-cover"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight text-white drop-shadow">
              {item.brandName ?? item.username ?? 'Brand'}
            </span>
            {item.username && item.brandName !== item.username ? (
              <span className="block text-[11px] leading-tight text-white/80">@{item.username}</span>
            ) : null}
          </span>
        </button>

        <h3 className="max-w-[88%] text-[15px] font-bold leading-snug text-white drop-shadow">
          {item.collectionTitle}
        </h3>

        {priceLabel ? (
          <p className="mt-1 text-xs font-semibold text-emerald-300 drop-shadow">{priceLabel}</p>
        ) : null}

        {item.tags?.length ? (
          <p className="mt-1.5 max-w-[90%] text-[11px] leading-snug text-white/75">
            {item.tags
              .slice(0, 4)
              .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
              .join(' ')}
          </p>
        ) : null}
      </div>
    </article>
  );
};

export default RunwayReelsItem;
