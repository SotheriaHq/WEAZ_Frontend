import { useEffect, useMemo, useRef, useState } from 'react';
import TagsApi from '@/api/TagsApi';
import { normalizeHashtagLabel } from '@/utils/creatorMetadata';

interface HashtagPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Currently selected tags (raw names, no #). */
  selected: string[];
  /** Toggle a tag on/off. Parent owns the state; cap is enforced here for adds. */
  onToggle: (tag: string) => void;
  maxTags: number;
  /** Extra context suggestions (e.g. derived from selected style filters) shown first. */
  extraSuggestions?: string[];
}

const CATALOG_LIMIT = 200;
const SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Light hashtag picker: full approved tag catalog + backend search + tap-to-select.
 * Bottom sheet on phones, centered dialog on tablet/desktop. Chips render at
 * least two per row on small screens.
 */
export default function HashtagPickerModal({
  open,
  onClose,
  selected,
  onToggle,
  maxTags,
  extraSuggestions = [],
}: HashtagPickerModalProps) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeqRef = useRef(0);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const atCap = selected.length >= maxTags;

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setCatalogLoading(true);
    TagsApi.getSuggestions(CATALOG_LIMIT)
      .then((names) => {
        if (mounted) setCatalog(names);
      })
      .catch(() => {
        if (mounted) setCatalog([]);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!isSearching) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      TagsApi.search(trimmedQuery, SEARCH_LIMIT)
        .then((results) => {
          if (searchSeqRef.current !== seq) return;
          setSearchResults(results.map((item) => item.name));
        })
        .catch(() => {
          if (searchSeqRef.current !== seq) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (searchSeqRef.current !== seq) return;
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, isSearching, trimmedQuery]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const selectedSet = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected],
  );

  const visibleTags = useMemo(() => {
    if (isSearching) {
      const q = trimmedQuery.toLowerCase();
      const localMatches = [...extraSuggestions, ...catalog].filter((tag) =>
        tag.toLowerCase().includes(q),
      );
      return Array.from(new Set([...searchResults, ...localMatches]));
    }
    return Array.from(new Set([...extraSuggestions, ...catalog]));
  }, [isSearching, trimmedQuery, searchResults, extraSuggestions, catalog]);

  const normalizedQueryTag = trimmedQuery
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/\s+/g, '-');
  const queryHasExactMatch =
    !normalizedQueryTag ||
    visibleTags.some((tag) => tag.toLowerCase() === normalizedQueryTag) ||
    selectedSet.has(normalizedQueryTag);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose hashtags"
    >
      <button
        type="button"
        aria-label="Close hashtag picker"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 sm:max-h-[80vh] sm:w-[560px] sm:max-w-[92vw] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <div>
            <p className="text-sm font-semibold text-theme">Hashtags</p>
            <p className="text-[11px] text-theme-secondary">
              {selected.length}/{maxTags} selected
              {atCap ? ' — remove one to add more' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-purple-600 px-4 text-xs font-semibold text-white transition hover:bg-purple-500"
          >
            Done
          </button>
        </div>

        <div className="border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hashtags..."
            enterKeyHint="search"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-theme placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/15 dark:bg-white/5"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {selected.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
                Selected — tap to remove
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {selected.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggle(tag)}
                    className="inline-flex min-h-9 items-center justify-between gap-1 truncate rounded-full bg-purple-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-purple-500 sm:justify-start"
                  >
                    <span className="truncate">{normalizeHashtagLabel(tag)}</span>
                    <span aria-hidden="true">✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
            {isSearching ? 'Matching hashtags' : 'All hashtags'}
          </p>

          {catalogLoading && !isSearching ? (
            <p className="py-4 text-center text-xs text-theme-secondary">
              Loading hashtags...
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {visibleTags.map((tag) => {
                const isSelected = selectedSet.has(tag.toLowerCase());
                if (isSelected) return null;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggle(tag)}
                    disabled={atCap}
                    className={`tag-badge-outline inline-flex min-h-9 items-center justify-center truncate rounded-full px-3 py-1.5 text-[12px] font-medium ${
                      atCap ? 'cursor-not-allowed opacity-40' : ''
                    }`}
                  >
                    <span className="truncate">{normalizeHashtagLabel(tag)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {isSearching && searching ? (
            <p className="mt-3 text-xs text-theme-secondary">Searching...</p>
          ) : null}

          {isSearching && !searching && !queryHasExactMatch ? (
            <button
              type="button"
              onClick={() => {
                if (!atCap) onToggle(normalizedQueryTag);
              }}
              disabled={atCap}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-purple-300 px-3 py-1.5 text-[12px] font-semibold text-purple-600 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-purple-500/40 dark:text-purple-300 dark:hover:bg-purple-500/10"
            >
              ➕ Create {normalizeHashtagLabel(normalizedQueryTag)}
            </button>
          ) : null}

          {isSearching && !searching && visibleTags.length === 0 && queryHasExactMatch ? (
            <p className="mt-3 text-xs text-theme-secondary">
              No other hashtags match "{trimmedQuery}".
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
