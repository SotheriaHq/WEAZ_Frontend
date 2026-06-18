import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import useSearch from '@/hooks/useSearch';
import type { SearchEntityType, SearchHighlightOffset, SearchItem } from '@/types/search';
import { resolveSearchIntent, resolveSearchResultRoute } from '@/lib/searchRouting';
import ImageWithFallback from '@/components/ImageWithFallback';
import MarketSuggestionBlocks from '@/components/market/MarketSuggestionBlocks';

const TABS: Array<{ key: SearchEntityType | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'profile', label: 'Profiles' },
  { key: 'product', label: 'Products' },
  { key: 'brand', label: 'Brands' },
  { key: 'design', label: 'Designs' },
  { key: 'collection', label: 'Collections' },
  { key: 'tag', label: 'Tags' },
];

function renderHighlightedText(
  value: string,
  offsets: SearchHighlightOffset[] | undefined,
): React.ReactNode {
  if (!offsets || offsets.length === 0) {
    return value;
  }

  const sorted = [...offsets].sort((left, right) => left.start - right.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  sorted.forEach((offset, index) => {
    if (offset.start > cursor) {
      nodes.push(<React.Fragment key={`text-${index}`}>{value.slice(cursor, offset.start)}</React.Fragment>);
    }

    nodes.push(
      <mark key={`mark-${index}`} className="rounded bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-500/30">
        {value.slice(offset.start, offset.end)}
      </mark>,
    );
    cursor = offset.end;
  });

  if (cursor < value.length) {
    nodes.push(<React.Fragment key="tail">{value.slice(cursor)}</React.Fragment>);
  }

  return nodes;
}

const SearchResultCard: React.FC<{ item: SearchItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex w-full items-start gap-4 rounded-3xl border border-gray-200 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
  >
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-2xl dark:bg-white/10">
      {item.imageUrl ? (
        <ImageWithFallback
          src={item.imageUrl}
          alt={item.title}
          fallbackName={item.title}
          fit="cover"
          className="h-full w-full object-cover"
          containerClassName="h-full w-full"
          rounded="xl"
        />
      ) : item.type === 'profile' ? '@' : item.type === 'product' ? '🧵' : item.type === 'brand' ? '🏷️' : item.type === 'design' ? '🎨' : item.type === 'collection' ? '🗂️' : '🔖'}
    </div>

    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {item.type}
        </span>
        {item.subtitle ? <span className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</span> : null}
      </div>

      <div className="truncate text-lg font-semibold text-gray-900 dark:text-white">
        {renderHighlightedText(item.title, item.highlights?.title)}
      </div>

      {item.description ? (
        <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          {renderHighlightedText(item.description, item.highlights?.description)}
        </p>
      ) : null}
    </div>

    {item.price != null ? (
      <div className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
        {item.currency || 'NGN'} {item.salePrice ?? item.price}
      </div>
    ) : null}
  </button>
);

const SearchResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const activeType = (searchParams.get('type') as SearchEntityType | 'all' | null) || 'all';
  const [draftQuery, setDraftQuery] = React.useState(query);
  const { results, isLoading, isLoadingMore, error, loadMore } = useSearch({
    query,
    type: activeType,
    enabled: Boolean(query.trim()),
  });

  React.useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  const updateType = (type: SearchEntityType | 'all') => {
    const next = new URLSearchParams(searchParams);
    if (type === 'all') {
      next.delete('type');
    } else {
      next.set('type', type);
    }
    setSearchParams(next);
  };

  const submitQuery = (nextQuery: string) => {
    const intent = resolveSearchIntent(nextQuery);
    const trimmed = intent.query;
    const next = new URLSearchParams(searchParams);
    if (!trimmed) {
      next.delete('q');
    } else {
      next.set('q', trimmed);
    }
    if (!trimmed || !intent.type || intent.type === 'all') {
      next.delete('type');
    } else {
      next.set('type', intent.type);
    }
    setSearchParams(next);
  };

  const displayCount =
    activeType === 'all'
      ? Object.values(results?.counts || {}).reduce((sum, value) => sum + value, 0)
      : results?.counts[activeType] || 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,208,78,0.18),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#f7f3ea_100%)] px-4 pb-20 pt-24 dark:bg-[linear-gradient(180deg,_#080808_0%,_#111111_100%)] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-gray-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Unified Search</p>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Find profiles, products, brands, designs, and collections</h1>
            </div>

            <SearchBarWithSuggestions
              initialValue={draftQuery}
              onValueChange={setDraftQuery}
              onSubmitQuery={submitQuery}
              enableGlobalShortcut={false}
              placeholder="Search profiles, products, brands, designs, collections, or use @handle and /tag"
              className="!max-w-none"
            />

            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateType(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeType === tab.key
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                      : 'bg-white text-gray-700 shadow-sm hover:bg-gray-100 dark:bg-white/8 dark:text-gray-200 dark:hover:bg-white/12'
                  }`}
                >
                  {tab.label}
                  {tab.key !== 'all' && results ? ` (${results.counts[tab.key] || 0})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!query.trim() ? (
          <div className="rounded-[2rem] bg-white/70 p-10 text-center text-gray-600 dark:bg-white/5 dark:text-gray-300">
            Enter a search query to explore the catalog.
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[2rem] bg-white/60 dark:bg-white/6" />
            ))}
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && query.trim() && results?.items.length === 0 ? (
          <div className="rounded-[2rem] bg-white/70 p-10 text-center dark:bg-white/5">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">No results for “{query}”</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Try broader terms or switch tabs to inspect a different entity type.</p>
          </div>
        ) : null}

        {!isLoading && !error && query.trim() && results?.items.length === 0 ? (
          <MarketSuggestionBlocks
            context="SEARCH_EMPTY"
            targetType="QUERY"
            query={query}
            className="rounded-[2rem] bg-white/70 p-6 dark:bg-white/5 sm:p-8"
          />
        ) : null}

        {!isLoading && !error && results?.items.length ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {displayCount} result{displayCount === 1 ? '' : 's'} for “{query}”
              </p>
            </div>

            <div className="grid gap-4">
              {results.items.map((item) => {
                const route = resolveSearchResultRoute(item, query);
                return (
                  <SearchResultCard
                    key={`${item.type}:${item.id}`}
                    item={item}
                    onOpen={() => navigate(route.to, route.state ? { state: route.state } : undefined)}
                  />
                );
              })}
            </div>

            {results.meta.hasNextPage ? (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950"
                >
                  {isLoadingMore ? 'Loading more...' : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchResultsPage;
