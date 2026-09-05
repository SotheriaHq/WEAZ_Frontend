import type { MarketItem } from '@/types/market';

/**
 * Build a public brand profile/catalog path from feed/card identity fields.
 *
 * Runway items often set `brandId` to Brand table id (`owner.brand?.id`).
 * Profile routes historically expected owner User id. Prefer username when
 * available (`/u/:username`); otherwise use brandId (backend now accepts both).
 */
export function buildBrandProfilePath(
  input: {
    brandId?: string | null;
    username?: string | null;
    ownerUserId?: string | null;
    tab?: 'Store' | 'Content' | 'Reviews' | 'Us' | string | null;
  } | null | undefined,
): string | null {
  if (!input) return null;
  const tab =
    typeof input.tab === 'string' && input.tab.trim().length > 0
      ? input.tab.trim()
      : null;
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';

  const username =
    typeof input.username === 'string' ? input.username.trim().replace(/^@+/, '') : '';
  if (username) {
    return `/u/${encodeURIComponent(username)}${query}`;
  }

  const ownerUserId =
    typeof input.ownerUserId === 'string' ? input.ownerUserId.trim() : '';
  if (ownerUserId) {
    return `/profile/${encodeURIComponent(ownerUserId)}${query}`;
  }

  const brandId = typeof input.brandId === 'string' ? input.brandId.trim() : '';
  if (brandId) {
    return `/profile/${encodeURIComponent(brandId)}${query}`;
  }

  return null;
}

export function buildBrandProfilePathFromMarketItem(
  item: Pick<MarketItem, 'brandId' | 'username'> | null | undefined,
  tab?: 'Store' | 'Content' | 'Reviews' | 'Us' | string | null,
): string | null {
  if (!item) return null;
  return buildBrandProfilePath({
    brandId: item.brandId,
    username: item.username,
    tab,
  });
}
