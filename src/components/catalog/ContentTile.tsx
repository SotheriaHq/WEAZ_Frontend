import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';

/**
 * The one card shell.
 *
 * Every content surface in the app — a product in Market, a design in a brand's
 * catalogue, a rail tile, a saved item — is the same object: full-bleed media at
 * 4:5, and a frosted copy panel that blends up out of the bottom of the
 * photograph rather than sitting on it as a separate slab. The panel's exact
 * recipe (gradient + `backdrop-blur-md backdrop-saturate-150` + a soft mask so
 * there is no hard top edge) was duplicated in three places by hand, which is
 * how the Saved tab ended up with a white box, a cropped thumbnail and text
 * stacked underneath while everything around it was full-bleed.
 *
 * Only the CONTENTS of the panel differ between surfaces, because only the
 * contents genuinely differ: a product has a price, a brand has a handle, a
 * category has neither. Anything that is not title/subtitle/price belongs in a
 * slot, not in a new variant of the shell.
 */

export interface ContentTileProps {
  title: string;
  /** Brand name, handle, category — the one line under the title. */
  subtitle?: string | null;
  /** Already formatted. This component never guesses a currency. */
  priceLabel?: string | null;
  mediaUrl?: string | null;
  mediaFileId?: string | null;
  mediaAlt?: string | null;
  /** Opening the tile. Omit for a tile that is not a destination. */
  onOpen?: () => void;
  disabled?: boolean;
  /** Top-left: a kind badge, a status chip. */
  badge?: React.ReactNode;
  /** Top-right: save/tag, overflow, dismiss. Rendered OUTSIDE the open button. */
  actions?: React.ReactNode;
  /** Anything that must sit over the media above the copy panel. */
  overlay?: React.ReactNode;
  /** Extra rows inside the frosted panel, under the price. */
  footer?: React.ReactNode;
  /** First-row / LCP tiles. Default lazy. */
  priority?: boolean;
  className?: string;
  /** Defaults to `SYSTEM_TILE_ASPECT`. Override only for a genuinely different object. */
  aspectClassName?: string;
}

/**
 * One card proportion, across web and the native app.
 *
 * The native card is `width × 1.58`; web was `4/5` (1 × 1.25). Side by side on
 * a phone that reads as two different products, which is the whole complaint.
 * On a phone the web card now takes the native proportion exactly. From `sm:`
 * up it returns to 4:5, because a 300px rail card at 1.58 is 474px tall and a
 * desktop row of those scrolls like a wall — the phone is where the two
 * surfaces sit next to each other in a reader's memory, so the phone is where
 * they have to match.
 */
export const SYSTEM_TILE_ASPECT = 'aspect-[1/1.58] sm:aspect-[4/5]';

/** The frosted panel, verbatim from `StoreProductCard`. Do not re-tune per surface. */
const COPY_PANEL_CLASS =
  'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/50 via-black/25 to-transparent ' +
  'px-3.5 pb-2.5 pt-7 backdrop-blur-md backdrop-saturate-150 ' +
  '[mask-image:linear-gradient(to_bottom,transparent_0%,black_24px,black_100%)] ' +
  '[-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_24px,black_100%)]';

/** Copy sits over untouched artwork in places, so every line carries its own shadow. */
const TITLE_SHADOW = '[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]';
const SUB_SHADOW = '[text-shadow:0_1px_2px_rgba(0,0,0,0.8)]';

const ContentTile: React.FC<ContentTileProps> = ({
  title,
  subtitle,
  priceLabel,
  mediaUrl,
  mediaFileId,
  mediaAlt,
  onOpen,
  disabled = false,
  badge,
  actions,
  overlay,
  footer,
  priority = false,
  className,
  aspectClassName = SYSTEM_TILE_ASPECT,
}) => {
  const hasMedia = Boolean(mediaUrl || mediaFileId);
  const canOpen = Boolean(onOpen) && !disabled;

  const media = (
    <>
      {hasMedia ? (
        <ImageWithFallback
          src={mediaUrl ?? ''}
          fileId={mediaFileId ?? null}
          alt={mediaAlt || title}
          fit="cover"
          rounded="none"
          containerClassName="absolute inset-0 h-full w-full bg-neutral-950"
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          maxHeightClassName="max-h-full"
          fallbackName={title}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'low'}
        />
      ) : (
        <div className="absolute inset-0 flex w-full items-center justify-center bg-gray-100 text-3xl text-gray-400 dark:bg-white/5 dark:text-white/30">
          <span aria-hidden="true">🧵</span>
        </div>
      )}

      {overlay}

      <div className={COPY_PANEL_CLASS}>
        <p className={`line-clamp-1 text-sm font-semibold leading-snug text-white ${TITLE_SHADOW}`}>
          {title}
        </p>
        {subtitle ? (
          <p className={`mt-0.5 line-clamp-1 text-[11px] text-white/80 ${SUB_SHADOW}`}>{subtitle}</p>
        ) : null}
        {priceLabel ? (
          <p className={`mt-1 text-sm font-bold text-white ${TITLE_SHADOW}`}>{priceLabel}</p>
        ) : null}
        {footer}
      </div>
    </>
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-transparent text-left shadow-sm transition hover:shadow-lg ${
        className ?? ''
      }`}
    >
      {canOpen ? (
        <button
          type="button"
          onClick={onOpen}
          /* The title is the accessible name; the panel repeats it visually. */
          className={`relative block w-full overflow-hidden rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent,#a855f7)] focus-visible:ring-offset-2 ${aspectClassName}`}
        >
          {media}
        </button>
      ) : (
        <div className={`relative block w-full overflow-hidden rounded-2xl ${aspectClassName}`}>
          {media}
        </div>
      )}

      {badge ? <div className="pointer-events-none absolute left-2 top-2 z-20">{badge}</div> : null}
      {actions ? <div className="absolute right-2 top-2 z-20">{actions}</div> : null}
    </div>
  );
};

export default React.memo(ContentTile);
