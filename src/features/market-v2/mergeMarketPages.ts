import type { MarketSectionItem } from '@/api/MarketApi';

export type MarketListNotice = 'Updated' | 'Prices updated';

export interface MarketListPage<T extends MarketSectionItem = MarketSectionItem> {
  readonly items: readonly T[];
  readonly reanchored: boolean;
  readonly notice: MarketListNotice | null;
}

export interface MergedMarketList<T extends MarketSectionItem = MarketSectionItem> {
  readonly items: T[];
  /** Index of the page the visible list now starts from. */
  readonly startPage: number;
  /** The notice to show for the most recent server refresh, if any. */
  readonly notice: MarketListNotice | null;
}

/** Cards are the same card when entity type and id match, whatever the source. */
export const marketItemKey = (item: Pick<MarketSectionItem, 'entityType' | 'id'>): string =>
  `${item.entityType}:${item.id}`;

/**
 * Merge loaded pages of a live keyset list into what the shopper sees.
 *
 * - A page the server re-anchored starts the list again: its order replaces
 *   everything loaded before it, because the earlier pages belong to an order
 *   that no longer exists (stock moved, prices changed, the epoch rolled).
 * - Across the remaining pages a card appears once, at its first position, so
 *   an item that moved while the shopper scrolled is never shown twice.
 * - Server order is kept exactly; nothing is re-sorted on the client.
 */
export function mergeMarketPages<T extends MarketSectionItem>(
  pages: readonly MarketListPage<T>[],
): MergedMarketList<T> {
  let startPage = 0;
  for (let index = pages.length - 1; index > 0; index -= 1) {
    if (pages[index].reanchored) {
      startPage = index;
      break;
    }
  }
  const seen = new Set<string>();
  const items: T[] = [];
  let notice: MarketListNotice | null = null;
  for (let index = startPage; index < pages.length; index += 1) {
    const page = pages[index];
    if (page.notice) notice = page.notice;
    for (const item of page.items) {
      const key = marketItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return { items, startPage, notice };
}
