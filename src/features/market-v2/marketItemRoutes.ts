import type { MarketSectionItem } from '@/api/MarketApi';
import { getSectionItemTargetId } from '@/utils/marketSectionMapper';

/**
 * Where a Market card leads on the web.
 *
 * The composed Market sends server-side routes written for every client
 * (`/brands/<id>`, `/market-place/products/<slug>`), several of which are not
 * web routes. The destination is therefore derived from the entity type and
 * id, using the routes this app actually serves.
 */
export function marketItemHref(item: MarketSectionItem): string | null {
  const id = getSectionItemTargetId(item);
  if (!id) return null;
  const encoded = encodeURIComponent(id);
  switch (item.entityType) {
    case 'PRODUCT':
      return `/products/${encoded}`;
    case 'DESIGN':
      return `/designs/${encoded}`;
    case 'COLLECTION':
      return `/collections/${encoded}`;
    case 'BRAND':
      // The profile route accepts a brand id as well as its owner's user id.
      return `/profile/${encoded}?tab=Store`;
    case 'CATEGORY':
      return `/market?category=${encoded}`;
    default:
      return null;
  }
}

/** The accessible name of a card: "{name} by {brand}, {price}". */
export function marketItemLabel(item: MarketSectionItem, price: string | null): string {
  const parts = [item.title];
  if (item.brand?.name && item.entityType !== 'BRAND') parts[0] = `${item.title} by ${item.brand.name}`;
  if (price) parts.push(price);
  return parts.join(', ');
}
