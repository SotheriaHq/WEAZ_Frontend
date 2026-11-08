import React from 'react';
import { BAG_IT_EMOJI, BAG_IT_LABEL } from '@/constants/bagging';

/**
 * The one product card frame on WIEZ.
 *
 * Studio's store grid, a brand's Shop tab and every Market section render
 * products through these parts, so the same product looks like the same
 * object wherever a shopper or a brand meets it. Layout follows the familiar
 * video-feed pattern: the photograph owns the top of the card edge to edge,
 * and everything you read sits underneath it on the card surface, never on
 * the picture. That is what lets the image stay at full colour — nothing is
 * laid over it except small corner controls.
 *
 * Compose the parts; do not add boolean props to change their shape. A caller
 * that needs owner controls renders them in its own slots.
 */

/** Height of the photo frame as a multiple of the card width (100:148). */
export const PRODUCT_TILE_MEDIA_RATIO = 1.48;

/** Tailwind class for the frame ratio above. Keep the two in step. */
export const PRODUCT_TILE_MEDIA_ASPECT = 'aspect-[100/148]';

/** Cover crop for card thumbnails (product detail views use contain instead). */
export const PRODUCT_TILE_IMAGE_CLASS =
  'h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export interface ProductTileRootProps extends React.HTMLAttributes<HTMLElement> {
  /** Draws the selection ring used by bulk actions. */
  selected?: boolean;
  children: React.ReactNode;
}

function ProductTileRoot({ selected = false, className = '', children, ...rest }: ProductTileRootProps) {
  return (
    <article
      {...rest}
      className={[
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-white shadow-md shadow-purple-950/5 transition-shadow duration-300 ease-out dark:bg-zinc-900 dark:shadow-purple-950/30',
        selected
          ? 'ring-2 ring-purple-500'
          : 'hover:shadow-xl hover:shadow-purple-500/15',
        className,
      ].join(' ')}
    >
      {children}
    </article>
  );
}

function ProductTileMedia({ className = '', children, ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`relative w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-800/50 ${PRODUCT_TILE_MEDIA_ASPECT} ${className}`}
    >
      {children}
    </div>
  );
}

function ProductTileBody({ className = '', children, ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex flex-1 flex-col justify-between gap-1.5 p-2.5 pb-3 sm:p-3 sm:pb-3.5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Always reserves two lines, so a one-line name and a two-line name produce
 * cards of the same height and the price rows of a grid or rail line up.
 */
function ProductTileTitle({ className = '', children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      {...rest}
      className={`line-clamp-2 min-h-[2.75em] break-words text-xs font-bold leading-snug text-gray-900 [overflow-wrap:anywhere] dark:text-white sm:text-sm ${className}`}
    >
      {children}
    </h3>
  );
}

function ProductTileMeta({ className = '', children, ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold text-gray-500 dark:text-zinc-400 ${className}`}
    >
      {children}
    </div>
  );
}

export interface ProductTilePriceProps {
  price: string;
  /** The struck-through comparison amount, when there is one. */
  compareAt?: string | null;
  className?: string;
  children?: React.ReactNode;
}

function ProductTilePrice({ price, compareAt, className = '', children }: ProductTilePriceProps) {
  return (
    <div className={`flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
      <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 bg-clip-text text-sm font-black tracking-tight text-transparent dark:from-purple-300 dark:via-indigo-300 dark:to-pink-300 sm:text-base">
        {price}
      </span>
      {compareAt ? (
        <span className="text-[11px] font-semibold text-rose-500 line-through sm:text-xs">
          {compareAt}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export interface BagItButtonProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** No bag action is possible (sold out, own product, brand account). */
  disabled?: boolean;
  /** A bag request is in flight. */
  busy?: boolean;
  label?: string;
  title?: string;
  className?: string;
}

/**
 * The Bag It control, identical on every card.
 *
 * One mark everywhere: the shopping-bags emoji from `BAG_IT_EMOJI`, on the
 * same light chip the Shop tab uses, so the glyph never renders as a tiny
 * text-sized symbol squeezed into the button label. The button carries the
 * heartbeat whenever bagging is possible — the pulse is how a shopper learns
 * that the control is live — and goes still when it is not, so a still button
 * reads as "not available" without a second explanation.
 */
export function BagItButton({
  onClick,
  disabled = false,
  busy = false,
  label = BAG_IT_LABEL,
  title,
  className = '',
}: BagItButtonProps) {
  const live = !disabled && !busy;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!live) return;
        onClick(event);
      }}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-label={label}
      title={title ?? label}
      className={[
        'wiez-bag-it-button relative flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-0 px-3 py-1.5 text-xs font-bold tracking-wide shadow-md transition-colors',
        live
          ? 'wiez-bag-heartbeat bg-purple-600 text-white hover:bg-purple-500 active:scale-[0.98]'
          : busy
            ? 'cursor-wait bg-purple-600/80 text-white'
            : 'cursor-not-allowed bg-gray-200 text-gray-500 shadow-none dark:bg-zinc-800 dark:text-zinc-500',
        className,
      ].join(' ')}
    >
      <span className="wiez-bag-it-chip" aria-hidden="true">
        {BAG_IT_EMOJI}
      </span>
      <span className="truncate">{busy ? 'Bagging…' : label}</span>
      {live ? (
        <span aria-hidden="true" className="font-bold">
          ›
        </span>
      ) : null}
    </button>
  );
}

export const ProductTile = {
  Root: ProductTileRoot,
  Media: ProductTileMedia,
  Body: ProductTileBody,
  Title: ProductTileTitle,
  Meta: ProductTileMeta,
  Price: ProductTilePrice,
};

export default ProductTile;
