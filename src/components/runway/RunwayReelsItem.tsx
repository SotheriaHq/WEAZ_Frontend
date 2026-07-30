import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useReelDesignMedia, type ReelMedia } from '@/hooks/useReelDesignMedia';
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

// Content overlays clear the floating island bottom-nav (pill h-14 at
// bottom safe+10px). Anchored from the true viewport bottom because the reel
// stage now fills the screen (Runway.tsx bottom:0).
const DOTS_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 5rem)';
const META_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)';
const RAIL_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 6rem)';

// How long the tap-revealed meta stays before fading (native showMetaOverlay).
const META_REVEAL_MS = 4000;

// Landscape media is letterboxed on the black matte; portrait/square fills.
const fitForAspect = (aspect: number | null | undefined) => {
  const useContain =
    typeof aspect === 'number' && Number.isFinite(aspect) && aspect >= 1.05;
  return {
    fit: (useContain ? 'contain' : 'cover') as 'cover' | 'contain',
    objectClass: useContain ? 'object-contain' : 'object-cover',
  };
};

/**
 * Single full-viewport runway reel — Instagram/TikTok-style stage with an
 * inline horizontal angle carousel (swipe left/right through a design's media
 * without opening anything), a permanent right action rail, and tap-to-reveal
 * brand/meta that auto-hides. Deep-black matte in both themes so light mode
 * never flashes a pale frame between snaps. Mirrors native RunwayFeedItem +
 * FeedMediaCarousel + reveal-on-tap FeedMetaOverlay.
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

  // Inline angles — hydrated only once the reel is active/priority (native
  // parity: scrolling the feed never fans out a detail fetch per off-screen reel).
  const { media } = useReelDesignMedia(item, { enabled: isActive || priority });
  const slides: ReelMedia[] = media.length > 0 ? media : [];
  const hasMultiple = slides.length > 1;

  // ── Horizontal angle carousel ──────────────────────────────────────────
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const activeSlideRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const handleCarouselScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollerRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const idx = Math.max(0, Math.round(el.scrollLeft / width));
      if (idx !== activeSlideRef.current) {
        activeSlideRef.current = idx;
        setActiveSlide(idx);
      }
    });
  }, []);

  useEffect(() => {
    // Clamp if the resolved list is shorter than the tracked index.
    if (activeSlideRef.current > slides.length - 1) {
      activeSlideRef.current = Math.max(0, slides.length - 1);
      setActiveSlide(activeSlideRef.current);
    }
  }, [slides.length]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Only mount media within ±1 of the active slide (native shouldMountSlide).
  const shouldMountSlide = useCallback(
    (index: number) => Math.abs(index - activeSlide) <= 1,
    [activeSlide],
  );

  // ── Reveal-on-tap meta (auto-hide) ─────────────────────────────────────
  const [metaRevealed, setMetaRevealed] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealMeta = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setMetaRevealed(true);
    hideTimerRef.current = setTimeout(() => {
      setMetaRevealed(false);
      hideTimerRef.current = null;
    }, META_REVEAL_MS);
  }, []);

  // Meta never lingers onto another design; hide when this reel scrolls away.
  useEffect(() => {
    if (isActive) return;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setMetaRevealed(false);
  }, [isActive]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

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

  // `runway-reel-stage` carries the scroll-linked scale and declares the view
  // timeline every overlay below reads (see index.css → Runway reel transit).
  //
  // The snap-start/snap-always classes that used to be on the article are gone
  // on purpose. The wrapper in RunwayReelsFeed is already an identical
  // full-height snap target, so this was a duplicate snap position — harmless
  // until the article started carrying a transform, because the scroll snap area
  // is the *transformed* border box. A scaled second target sits a few vh off
  // the wrapper's, and two `snap-stop: always` positions that close together is
  // a double-stop. Exactly one snap target per page.
  return (
    <article
      className="runway-reel-stage relative h-full w-full shrink-0 overflow-hidden bg-black"
      data-runway-reel-id={item.id}
      aria-label={item.collectionTitle || 'Design'}
    >
      {/* Inline angle carousel — swipe left/right through the design's media.
          Tapping a slide reveals the meta overlay (no open/route). */}
      <div
        ref={scrollerRef}
        onScroll={hasMultiple ? handleCarouselScroll : undefined}
        className="runway-reels-hcarousel absolute inset-0 z-0 flex h-full w-full overflow-y-hidden bg-black"
        style={{ scrollSnapType: hasMultiple ? 'x mandatory' : undefined }}
      >
        {slides.map((slide, index) => {
          const { fit, objectClass } = fitForAspect(slide.aspectRatio);
          const isVideo = slide.type === 'video';
          const mounted = shouldMountSlide(index);
          const slideActive = isActive && index === activeSlide;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={revealMeta}
              aria-label={`${item.collectionTitle || 'Design'} — view ${index + 1} of ${slides.length}`}
              className="relative block h-full w-full shrink-0 cursor-pointer border-0 bg-black p-0"
              style={{
                minWidth: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              {mounted ? (
                isVideo ? (
                  <MediaRenderer
                    kind="video"
                    src={slide.url}
                    controls={false}
                    autoPlay={slideActive}
                    muted
                    loop
                    playsInline
                    fit={fit}
                    maxHeightClassName="max-h-none"
                    maxWidthClassName="max-w-none"
                    className="absolute inset-0 h-full w-full"
                    mediaClassName={`h-full w-full ${objectClass}`}
                    preload={slideActive || priority ? 'metadata' : 'none'}
                  />
                ) : (
                  <ImageWithFallback
                    src={slide.url}
                    fileId={slide.fileId}
                    alt={item.collectionTitle}
                    fit={fit}
                    rounded="none"
                    containerClassName="absolute inset-0 h-full w-full"
                    maxHeightClassName="max-h-none"
                    className={`h-full w-full ${objectClass}`}
                    fallbackName={item.collectionTitle}
                    loading={index === 0 && (priority || isActive) ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 && (priority || isActive) ? 'high' : 'low'}
                  />
                )
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Angle dots — visible at rest for multi-media designs (native parity),
          faded out during a vertical transit by runway-reel-chrome. Two rows of
          bright white pills sliding past each other is close to worst-case for
          pulling gaze: small, high-contrast and high spatial frequency. This was
          the last thing still at full opacity mid-swipe on native. */}
      {hasMultiple ? (
        <div
          className="runway-reel-chrome pointer-events-none absolute inset-x-0 z-[2] flex items-center justify-center gap-1.5"
          style={{ bottom: DOTS_BOTTOM }}
          aria-hidden
        >
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              className="h-1.5 rounded-full bg-white transition-all"
              style={{
                width: index === activeSlide ? 18 : 6,
                opacity: index === activeSlide ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Readability gradient — fades in with the tap-revealed meta only, so
          the default view stays clean like native.

          The transit fade sits on a WRAPPER rather than on this element, and
          that placement is load-bearing: a scroll-driven animation and a
          class-toggled opacity on the same element do not combine — the
          animation wins outright and would pin the gradient permanently on.
          Nested opacities multiply, which is what we actually want. The wrapper
          is `inset-0` so the inner box resolves exactly as it did before. */}
      <div className="runway-reel-chrome pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        <div
          className={`absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/80 via-black/35 to-transparent transition-opacity duration-300 ${
            metaRevealed ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Right action rail — visible at rest (native parity), faded during a
          vertical transit. Nothing here has a competing opacity of its own, so
          it takes runway-reel-chrome directly. Retiring it by 45% of a page is
          the single biggest win in the treatment: mid-swipe there are otherwise
          TWO rails at the same screen edge sliding past each other at different
          heights, and icons plus numeric counts hold foveal attention far
          harder than the imagery behind them. */}
      <div
        className="runway-reel-chrome absolute right-2 z-10 flex flex-col items-center gap-3.5 sm:right-3"
        style={{ bottom: RAIL_BOTTOM }}
      >
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

      {/* Bottom meta — hidden by default, revealed on tap, auto-hides (native
          FeedMetaOverlay). Brand avatar tap still routes to the brand.

          Same wrapper reasoning as the readability gradient, and here it is the
          difference between working and badly broken: this element's opacity is
          already driven by `metaRevealed`, so putting the transit fade on it
          directly would let the animation override that and leave the meta card
          permanently visible on every reel. The wrapper is `inset-0`, so
          `inset-x-0` + META_BOTTOM resolve exactly as they did before, and it is
          pointer-events-none, so the revealed state has to opt back in. */}
      <div className="runway-reel-chrome pointer-events-none absolute inset-0 z-10">
        <div
          className={`absolute inset-x-0 px-3 pr-16 transition-opacity duration-300 ${
            metaRevealed ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={{ bottom: META_BOTTOM }}
          aria-hidden={!metaRevealed}
        >
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
      </div>

      {/* Transit scrim — LAST child and the highest layer, so it dims the chrome
          as well as the media (native RunwayFeedItem orders it the same way).
          `opacity-0` is the untreated resting value: in a browser without
          scroll-driven animation support the @supports block never applies, this
          stays fully transparent, and the feed renders exactly as it does today.
          Where support exists the keyframes override it per scroll position. */}
      <div
        className="runway-reel-scrim pointer-events-none absolute inset-0 z-20 bg-black opacity-0"
        aria-hidden
      />
    </article>
  );
};

export default RunwayReelsItem;
