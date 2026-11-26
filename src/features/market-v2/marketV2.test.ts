import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPTY_MARKET_FILTERS,
  marketFiltersKey,
  parseMarketUrlState,
  serializeMarketUrlState,
  type MarketFilters,
} from './marketFilterState';
import { mergeMarketPages, type MarketListPage } from './mergeMarketPages';
import {
  isMarketHomeV2KnownUnavailable,
  markMarketHomeV2Unavailable,
  MARKET_V2_BUSY_TTL_MS,
  MARKET_V2_UNAVAILABLE_TTL_MS,
  resetMarketHomeV2Availability,
} from './marketV2Availability';

const CATEGORY = '00000000-0000-4000-8000-000000000001';
const parse = (query: string) => parseMarketUrlState(new URLSearchParams(query));

describe('Market URL filter state', () => {
  it('round-trips every filter and the sort through the URL', () => {
    const filters: MarketFilters = {
      ...EMPTY_MARKET_FILTERS,
      audience: ['WOMEN'],
      category: [CATEGORY],
      color: ['black', 'red'],
      size: ['8,5', 'M'],
      dimensions: { fabric: ['ankara'], occasion: ['wedding'] },
      priceMin: 0,
      priceMax: 50000.5,
      onSale: true,
      fulfilment: 'READY_TO_WEAR',
    };
    const query = serializeMarketUrlState({ filters, sort: 'price_asc' });
    const back = parseMarketUrlState(query);
    expect(back).toEqual({ filters, sort: 'price_asc', dropped: false });
    // A size containing a comma travels in the bracket form, never as CSV.
    expect(query.getAll('size[]')).toEqual(['8,5', 'M']);
  });

  it('gives equal filters one identity whatever the input order', () => {
    expect(marketFiltersKey(parse('color=red,black&audience=WOMEN').filters)).toBe(
      marketFiltersKey(parse('audience=WOMEN&color=black,red,red').filters),
    );
  });

  it('drops hostile or malformed values and says so', () => {
    const state = parse(
      'category=not-a-uuid&audience=ALIENS&sort=cheapest&price.min=-5&tag=%3Cscript%3E&dim.BAD%20SLUG=x&color=%00',
    );
    expect(state.filters).toEqual(EMPTY_MARKET_FILTERS);
    expect(state.sort).toBeNull();
    expect(state.dropped).toBe(true);
  });

  it('ignores parameters that are not Market filters and keeps them on write', () => {
    const state = parse('utm_source=ad&parent=home&color=red');
    expect(state.dropped).toBe(false);
    const query = serializeMarketUrlState(
      { filters: state.filters, sort: null },
      new URLSearchParams('utm_source=ad&parent=home&color=blue&sort=newest'),
    );
    expect(query.get('parent')).toBe('home');
    expect(query.get('utm_source')).toBe('ad');
    expect(query.get('color')).toBe('red');
    expect(query.has('sort')).toBe(false);
  });

  it('enforces the server limits per key', () => {
    const nine = Array.from({ length: 9 }, (_, n) => `c${n}`).join(',');
    const state = parse(`color=${nine}`);
    expect(state.filters.color).toHaveLength(8);
    expect(state.dropped).toBe(true);
  });

  it('refuses an inverted price range and normalizes tags and signed zero', () => {
    const inverted = parse('price.min=900&price.max=100');
    expect([inverted.filters.priceMin, inverted.filters.priceMax]).toEqual([null, null]);
    expect(inverted.dropped).toBe(true);
    expect(parse('tag=%23Aso%20Ebi').filters.tag).toEqual(['aso-ebi']);
    expect(parse('price.min=-0').filters.priceMin).toBe(0);
  });
});

describe('merging live Market pages', () => {
  const page = (
    ids: string[],
    reanchored = false,
    notice: MarketListPage['notice'] = null,
  ): MarketListPage =>
    ({ items: ids.map((id) => ({ entityType: 'PRODUCT', id })), reanchored, notice }) as unknown as MarketListPage;
  const ids = (list: { items: readonly unknown[] }) =>
    list.items.map((card) => (card as { id: string }).id);

  it('shows a card once, at its first position, in server order', () => {
    const merged = mergeMarketPages([page(['a', 'b']), page(['b', 'c'])]);
    expect(ids(merged)).toEqual(['a', 'b', 'c']);
    expect(merged.startPage).toBe(0);
  });

  it('starts again from a re-anchored page and keeps its notice', () => {
    const merged = mergeMarketPages([
      page(['a', 'b']),
      page(['c']),
      page(['x', 'a'], true, 'Prices updated'),
    ]);
    expect(ids(merged)).toEqual(['x', 'a']);
    expect(merged.startPage).toBe(2);
    expect(merged.notice).toBe('Prices updated');
  });
});

describe('Market home availability memo', () => {
  afterEach(() => resetMarketHomeV2Availability());

  it('remembers a switched-off server for ten minutes and a busy one for one', () => {
    const now = 1_000_000;
    markMarketHomeV2Unavailable(now, MARKET_V2_BUSY_TTL_MS);
    expect(isMarketHomeV2KnownUnavailable(now + MARKET_V2_BUSY_TTL_MS - 1)).toBe(true);
    expect(isMarketHomeV2KnownUnavailable(now + MARKET_V2_BUSY_TTL_MS + 1)).toBe(false);
    markMarketHomeV2Unavailable(now, MARKET_V2_UNAVAILABLE_TTL_MS);
    // A later, shorter memo never cuts the longer one short.
    markMarketHomeV2Unavailable(now, MARKET_V2_BUSY_TTL_MS);
    expect(isMarketHomeV2KnownUnavailable(now + MARKET_V2_UNAVAILABLE_TTL_MS - 1)).toBe(true);
  });
});
