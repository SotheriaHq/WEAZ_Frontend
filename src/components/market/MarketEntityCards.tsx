import ImageWithFallback from '@/components/ImageWithFallback';
import type { MarketSectionItem } from '@/api/MarketApi';
import { ProductTile, PRODUCT_TILE_IMAGE_CLASS } from '@/components/commerce/ProductTile';

/**
 * Cards for everything on Market that is not a single product.
 *
 * Products always render as the shared product tile. These cover the other
 * entities a section can hold, each in the shape that suits it — the way a
 * video feed mixes portrait shorts, landscape videos and round channel marks
 * on one page. Variety by entity is deliberate: a run of identical rails makes
 * every section look like the last one, and the eye loses its place.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const formatAmount = (amount: number, currency: string) => {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
};

/** "₦12,000", "From ₦8,000", "₦8,000 – ₦30,000" or null — never a made-up value. */
export function formatMarketItemPrice(item: MarketSectionItem): string | null {
  const currency = item.price?.currency || item.priceRange?.currency || 'NGN';
  const amount = item.price?.effectiveAmount ?? item.price?.amount ?? null;
  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    return formatAmount(amount, currency);
  }
  const min = item.priceRange?.min;
  const max = item.priceRange?.max;
  if (typeof min === 'number' && min > 0 && typeof max === 'number' && max > min) {
    return `${formatAmount(min, currency)} – ${formatAmount(max, currency)}`;
  }
  if (typeof min === 'number' && min > 0) return `From ${formatAmount(min, currency)}`;
  return null;
}

const piecesLabel = (count?: number | null) =>
  typeof count === 'number' && count > 0 ? `${count} piece${count === 1 ? '' : 's'}` : null;

const itemImage = (item: MarketSectionItem) => ({
  src: item.media?.thumbnailUrl || item.media?.url || null,
  fileId: item.media?.fileId ?? null,
});

interface CardProps {
  item: MarketSectionItem;
  onOpen: (item: MarketSectionItem) => void;
  className?: string;
}

/**
 * A design (or any non-product item that lands in a product rail), on the
 * same tile frame as a product so a rail never changes height mid-row. Designs
 * are made to order and are not bagged from a card, so the action is View.
 */
export function MarketItemTile({ item, onOpen, className = '' }: CardProps) {
  const image = itemImage(item);
  const price = formatMarketItemPrice(item);

  return (
    <ProductTile.Root
      className={`cursor-pointer ${className}`}
      onClick={() => onOpen(item)}
      data-entity-type={item.entityType}
    >
      <ProductTile.Media>
        <ImageWithFallback
          src={image.src}
          fileId={image.fileId}
          alt={item.media?.alt || item.title}
          fit="cover"
          rounded="none"
          containerClassName="h-full w-full"
          className={PRODUCT_TILE_IMAGE_CLASS}
          maxHeightClassName="max-h-full"
          fallbackName={item.title}
        />
      </ProductTile.Media>
      <ProductTile.Body>
        <div className="min-w-0">
          <ProductTile.Title>{item.title}</ProductTile.Title>
          <ProductTile.Meta className="mt-0.5">
            <span className="truncate">{item.brand?.name || item.subtitle || 'WIEZ brand'}</span>
          </ProductTile.Meta>
          {price ? <ProductTile.Price className="mt-1" price={price} /> : null}
        </div>
        <div className="flex items-center pt-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item);
            }}
            className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            <span>View</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </ProductTile.Body>
    </ProductTile.Root>
  );
}

export interface MarketCollectionCardProps extends CardProps {
  /**
   * Cover photos of the products inside the collection, first one largest.
   * Falls back to the item's own cover (itself the lead product's photo) when
   * the source carries no product list.
   */
  productImages?: ReadonlyArray<{ src: string | null; fileId?: string | null }>;
}

const collageCellClass = (count: number, index: number) => {
  if (count === 1) return 'col-span-3 row-span-2';
  if (index === 0) return 'col-span-2 row-span-2';
  return count === 2 ? 'col-span-1 row-span-2' : 'col-span-1 row-span-1';
};

/**
 * A collection as a wide card: a collage of its products' cover photos with
 * the title and facts underneath, like a playlist in a video feed. A
 * collection is a group of pieces, so showing the pieces says what it is
 * faster than any label could.
 */
export function MarketCollectionCard({ item, onOpen, productImages, className = '' }: MarketCollectionCardProps) {
  const covers = (productImages && productImages.length > 0 ? productImages : [itemImage(item)])
    .filter((entry) => Boolean(entry.src || entry.fileId))
    .slice(0, 3);
  const price = formatMarketItemPrice(item);
  const pieces = piecesLabel(item.stats?.products);
  const facts = [item.brand?.name || item.subtitle, pieces].filter(Boolean).join(' · ');

  return (
    <article
      onClick={() => onOpen(item)}
      data-entity-type="COLLECTION"
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-purple-950/5 transition-shadow hover:shadow-xl hover:shadow-purple-500/15 dark:bg-zinc-900 dark:shadow-purple-950/30 ${className}`}
    >
      <div className="relative grid aspect-[16/9] w-full grid-cols-3 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-800/50">
        {covers.length === 0 ? (
          <div className="col-span-3 row-span-2 flex items-center justify-center text-3xl" aria-hidden="true">
            🧵
          </div>
        ) : (
          covers.map((cover, index) => (
            <div
              key={`${cover.fileId ?? cover.src ?? 'cover'}-${index}`}
              className={`relative overflow-hidden ${collageCellClass(covers.length, index)}`}
            >
              <ImageWithFallback
                src={cover.src}
                fileId={cover.fileId ?? null}
                alt={index === 0 ? item.title : ''}
                fit="cover"
                rounded="none"
                      containerClassName="h-full w-full"
                className={PRODUCT_TILE_IMAGE_CLASS}
                maxHeightClassName="max-h-full"
                fallbackName={item.title}
              />
            </div>
          ))
        )}
        {pieces ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {pieces}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <h3 className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">{item.title}</h3>
        {facts ? (
          <p className="truncate text-xs font-semibold text-gray-500 dark:text-zinc-400">{facts}</p>
        ) : null}
        {price ? (
          <p className="mt-0.5 text-sm font-black tracking-tight text-purple-700 dark:text-purple-300">{price}</p>
        ) : null}
      </div>
    </article>
  );
}

/** A brand as a rounded-square mark with its name — never a circle. */
export function MarketBrandTile({ item, onOpen, className = '' }: CardProps) {
  const logo = item.brand?.logoUrl || item.media?.thumbnailUrl || item.media?.url || null;
  const pieces = piecesLabel(item.stats?.products);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-gray-100/70 dark:hover:bg-white/5 ${className}`}
    >
      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-gray-100 shadow-md shadow-purple-950/10 dark:bg-zinc-800 sm:h-24 sm:w-24">
        <ImageWithFallback
          src={logo}
          fileId={logo ? null : item.media?.fileId ?? null}
          alt={item.title}
          fit="cover"
          rounded="none"
          containerClassName="h-full w-full"
          className="h-full w-full object-cover"
          maxHeightClassName="max-h-full"
          fallbackName={item.title}
        />
      </div>
      <span className="line-clamp-2 text-xs font-bold leading-snug text-gray-900 dark:text-white">{item.title}</span>
      {pieces ? <span className="-mt-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{pieces}</span> : null}
    </button>
  );
}

/** A style or category as a short photo tile with its name. */
export function MarketCategoryTile({ item, onOpen, className = '' }: CardProps) {
  const image = itemImage(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gray-100 text-left shadow-md shadow-purple-950/5 dark:bg-zinc-800 ${className}`}
    >
      <ImageWithFallback
        src={image.src}
        fileId={image.fileId}
        alt=""
        fit="cover"
        rounded="none"
        containerClassName="absolute inset-0 h-full w-full"
        className={PRODUCT_TILE_IMAGE_CLASS}
        maxHeightClassName="max-h-full"
        fallbackName={item.title}
      />
      {/* A band under the label only — the rest of the photo stays clear. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
        <span className="line-clamp-1 text-sm font-extrabold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {item.title}
        </span>
      </div>
    </button>
  );
}
