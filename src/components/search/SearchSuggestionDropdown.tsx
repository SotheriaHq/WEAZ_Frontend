import React from 'react';
import ImageWithFallback from '@/components/ImageWithFallback';
import type { SearchItem, SearchSuggestionResponse } from '@/types/search';

export interface SearchSuggestionEntry {
  id: string;
  label: string;
  kind: 'recent' | 'trending' | 'item' | 'tag';
  href: string;
  section: string;
  query?: string;
  item?: SearchItem;
}

interface SearchSuggestionDropdownProps {
  suggestions: SearchSuggestionResponse | null;
  localRecent: string[];
  activeIndex: number;
  open: boolean;
  isLoading: boolean;
  onSelect: (entry: SearchSuggestionEntry) => void;
  dropdownId: string;
  error?: string | null;
}

const sectionTitleClass = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400';

function buildEntries(
  suggestions: SearchSuggestionResponse | null,
  localRecent: string[],
): SearchSuggestionEntry[] {
  const entries: SearchSuggestionEntry[] = [];
  const seenRecent = new Set<string>();

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
) {
  return buildEntries(suggestions, localRecent);
}

const SearchSuggestionDropdown: React.FC<SearchSuggestionDropdownProps> = ({
  suggestions,
  localRecent,
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

  const entries = buildEntries(suggestions, localRecent);
  let activeSection = '';

  return (
    <div
      id={dropdownId}
      role="listbox"
      className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[120] overflow-hidden rounded-3xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#090909]/95"
    >
      <div className="max-h-[28rem] overflow-y-auto py-2">
        {error ? (
          <div className="px-4 py-6 text-sm text-red-500 dark:text-red-400">Search unavailable — try again later.</div>
        ) : isLoading && entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Searching...</div>
        ) : !isLoading && entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No suggestions yet.</div>
        ) : null}

        {entries.map((entry, index) => {
          const showHeader = activeSection !== entry.section;
          activeSection = entry.section;

          return (
            <React.Fragment key={entry.id}>
              {showHeader ? <div className={sectionTitleClass}>{entry.section}</div> : null}
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
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                    : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/8'
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg dark:bg-white/8">
                    {entry.kind === 'recent' ? '🕘' : entry.kind === 'trending' ? '🔥' : entry.kind === 'tag' ? '🏷️' : '🔎'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{entry.label}</div>
                  {entry.item?.subtitle ? (
                    <div className="truncate text-xs opacity-70">{entry.item.subtitle}</div>
                  ) : null}
                </div>

                {entry.item?.price != null ? (
                  <div className="text-xs font-semibold opacity-80">
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