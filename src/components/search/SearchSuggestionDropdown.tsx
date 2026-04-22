import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { buildSearchHref } from '@/lib/searchRouting';
import type { SearchItem, SearchSuggestionResponse } from '@/types/search';
import { DROPDOWN_SECTION_TITLE_CLASS } from '@/components/ui/Dropdown';

export interface SearchSuggestionEntry {
  id: string;
  label: string;
  kind: 'search' | 'recent' | 'trending' | 'item' | 'tag';
  href: string;
  section: string;
  query?: string;
  item?: SearchItem;
}

interface SearchSuggestionDropdownProps {
  suggestions: SearchSuggestionResponse | null;
  localRecent: string[];
  query: string;
  activeIndex: number;
  open: boolean;
  isLoading: boolean;
  onSelect: (entry: SearchSuggestionEntry) => void;
  dropdownId: string;
  error?: string | null;
}

function buildEntries(
  suggestions: SearchSuggestionResponse | null,
  localRecent: string[],
  query: string,
): SearchSuggestionEntry[] {
  const entries: SearchSuggestionEntry[] = [];
  const seenRecent = new Set<string>();
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    entries.push({
      id: `search:${trimmedQuery}`,
      label: `Search for "${trimmedQuery}"`,
      kind: 'search',
      href: buildSearchHref(trimmedQuery),
      section: 'Search',
      query: trimmedQuery,
    });
  }

  for (const recent of suggestions?.recent ?? []) {
    seenRecent.add(recent.query);
    entries.push({
      id: `recent:${recent.query}`,
      label: recent.query,
      kind: 'recent',
      href: recent.href,
      section: 'Recent',
      query: recent.query,
    });
  }

  for (const recent of localRecent) {
    if (seenRecent.has(recent)) {
      continue;
    }
    entries.push({
      id: `recent:local:${recent}`,
      label: recent,
      kind: 'recent',
      href: `/search?q=${encodeURIComponent(recent)}`,
      section: 'Recent',
      query: recent,
    });
  }

  for (const trending of suggestions?.trending ?? []) {
    entries.push({
      id: `trending:${trending.query}`,
      label: trending.query,
      kind: 'trending',
      href: trending.href,
      section: 'Trending',
      query: trending.query,
    });
  }

  for (const item of suggestions?.products?.items ?? []) {
    entries.push({ id: `product:${item.id}`, label: item.title, kind: 'item', href: item.href, section: 'Products', item });
  }
  for (const item of suggestions?.brands?.items ?? []) {
    entries.push({ id: `brand:${item.id}`, label: item.title, kind: 'item', href: item.href, section: 'Brands', item });
  }
  for (const item of suggestions?.designs?.items ?? []) {
    entries.push({ id: `design:${item.id}`, label: item.title, kind: 'item', href: item.href, section: 'Designs', item });
  }
  for (const item of suggestions?.storeCollections?.items ?? []) {
    entries.push({ id: `collection:${item.id}`, label: item.title, kind: 'item', href: item.href, section: 'Store Collections', item });
  }
  for (const tag of suggestions?.tags ?? []) {
    entries.push({ id: `tag:${tag.id}`, label: tag.title, kind: 'tag', href: tag.href, section: 'Tags', query: tag.title });
  }

  return entries;
}

export function flattenSuggestionEntries(
  suggestions: SearchSuggestionResponse | null,
  localRecent: string[],
  query: string,
) {
  return buildEntries(suggestions, localRecent, query);
}

const SearchSuggestionDropdown: React.FC<SearchSuggestionDropdownProps> = ({
  suggestions,
  localRecent,
  query,
  activeIndex,
  open,
  isLoading,
  onSelect,
  dropdownId,
  error,
}) => {
  if (!open) {
    return null;
  }

  const entries = buildEntries(suggestions, localRecent, query);
  let activeSection = '';

  return (
    <div
      id={dropdownId}
      role="listbox"
      className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-[120] w-full max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl glass-menu shadow-2xl backdrop-blur-xl"
    >
      <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto py-1">
        {error ? (
          <div className="px-4 py-6 text-sm text-red-500 dark:text-red-400">Search unavailable — try again later.</div>
        ) : isLoading && entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Searching...</div>
        ) : !isLoading && entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No suggestions yet. Keep typing or choose a result when it appears.</div>
        ) : null}

        {entries.map((entry, index) => {
          const showHeader = activeSection !== entry.section;
          activeSection = entry.section;

          return (
            <React.Fragment key={entry.id}>
              {showHeader ? <div className={DROPDOWN_SECTION_TITLE_CLASS}>{entry.section}</div> : null}
              <button
                id={`${dropdownId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(entry);
                }}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === activeIndex
                    ? 'bg-[color:var(--brand-primary)]/10 text-[color:var(--text-primary)] dark:bg-[color:var(--brand-primary)]/15'
                    : 'text-[color:var(--text-primary)] hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {entry.item?.imageUrl ? (
                  <ImageWithFallback
                    src={entry.item.imageUrl}
                    alt={entry.item.title}
                    fallbackName={entry.item.title}
                    className="h-full w-full object-cover"
                    containerClassName="h-10 w-10 overflow-hidden rounded-xl"
                    rounded="xl"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 text-lg dark:bg-white/8">
                    {entry.kind === 'search'
                      ? '🔎'
                      : entry.kind === 'recent'
                        ? '🕘'
                        : entry.kind === 'trending'
                          ? '🔥'
                          : entry.kind === 'tag'
                            ? '🏷️'
                            : '🔎'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-5">{entry.label}</div>
                  {entry.item?.subtitle ? (
                    <div className="truncate text-xs text-[color:var(--text-secondary)]">{entry.item.subtitle}</div>
                  ) : null}
                </div>

                {entry.item?.price != null ? (
                  <div className="text-xs font-semibold text-[color:var(--text-secondary)]">
                    {entry.item.currency || 'NGN'} {entry.item.salePrice ?? entry.item.price}
                  </div>
                ) : null}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SearchSuggestionDropdown;