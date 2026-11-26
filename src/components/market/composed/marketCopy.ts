import type { MarketV2ErrorKind } from '@/api/MarketV2Api';
import type { MarketSort } from '@/features/market-v2/marketFilterState';

export const MARKET_SORT_LABELS: Record<MarketSort, string> = {
  newest: 'Newest',
  popular: 'Popular',
  trending: 'Trending',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  best_selling: 'Best selling',
  most_saved: 'Most saved',
};

/** The section's own order, used by See All lists that are curated or source-ordered. */
export const MARKET_SECTION_ORDER_LABEL = 'Section order';

interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  /** One line under the last card when the next page fails. */
  readonly nextPage: string;
}

/** What each failure means to a shopper, and what to do about it. */
export function marketErrorCopy(kind: MarketV2ErrorKind | null): ErrorCopy {
  switch (kind) {
    case 'network':
      return {
        title: 'You seem to be offline',
        body: 'Check your connection, then try again.',
        nextPage: 'More pieces could not load. Check your connection and try again.',
      };
    case 'rate-limited':
      return {
        title: 'Too many requests',
        body: 'Give it a moment, then try again.',
        nextPage: 'Give it a moment, then load more pieces.',
      };
    case 'busy':
      return {
        title: 'Market is busy right now',
        body: 'Please try again in a moment.',
        nextPage: 'Market is busy. Try loading more in a moment.',
      };
    case 'invalid-filter':
      return {
        title: 'These filters can no longer be used',
        body: 'Some of them were removed or changed. Clear them to see everything.',
        nextPage: 'These filters can no longer be used. Clear them and try again.',
      };
    case 'unsupported-sort':
      return {
        title: 'That order is not available here',
        body: 'Choose another order.',
        nextPage: 'That order is not available here.',
      };
    case 'unavailable':
      return {
        title: 'This list is not available',
        body: 'It may have been retired. Head back to the Market for more.',
        nextPage: 'This list is not available any more.',
      };
    default:
      return {
        title: 'Something went wrong',
        body: 'We could not load this. Please try again.',
        nextPage: 'More pieces could not load. Please try again.',
      };
  }
}

const pieces = (count: number) => `${count.toLocaleString('en-NG')} piece${count === 1 ? '' : 's'}`;

export const marketPiecesLabel = pieces;
