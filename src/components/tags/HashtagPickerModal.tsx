import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TagsApi from '@/api/TagsApi';
import { normalizeHashtagLabel } from '@/utils/creatorMetadata';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

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

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
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

  return (
    <OverlayPortal>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Choose hashtags"
          >
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              type="button"
              aria-label="Close hashtag picker"
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%', opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-900 sm:h-auto sm:max-h-[80vh] sm:w-[560px] sm:max-w-[92vw] sm:rounded-2xl sm:border sm:border-gray-200 sm:dark:border-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10 bg-white dark:bg-zinc-900 z-10">
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

              {/* Search Input */}
              <div className="border-b border-gray-100 px-4 py-3 dark:border-white/10 bg-white dark:bg-zinc-900 z-10">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search hashtags..."
                  enterKeyHint="search"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-theme placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/15 dark:bg-white/5"
                />
              </div>

              {/* Sticky Selected Tags horizontal bar */}
              {selected.length > 0 && (
                <div className="border-b border-gray-100 dark:border-white/10 px-4 py-2.5 bg-gray-50/50 dark:bg-zinc-900/50 z-10">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-theme-secondary">
                    Selected ({selected.length}/{maxTags}) — tap to remove
                  </p>
                  <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-1 scrollbar-none">
                    {selected.map((tag) => (
                      <motion.button
                        key={tag}
                        layoutId={`selected-${tag}`}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => onToggle(tag)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm shadow-purple-500/20 hover:bg-purple-500 transition-colors"
                      >
                        <span>{normalizeHashtagLabel(tag)}</span>
                        <span className="text-[9px] opacity-80" aria-hidden="true">✕</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Grid List */}
              <div className="flex-1 overflow-y-auto px-4 py-3 bg-white dark:bg-zinc-900">
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
                      return (
                        <motion.button
                          key={tag}
                          layout
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => onToggle(tag)}
                          disabled={atCap && !isSelected}
                          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200 border ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md shadow-purple-500/25 font-semibold'
                              : atCap
                                ? 'cursor-not-allowed opacity-40 border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 text-gray-400'
                                : 'tag-badge-outline border-purple-500/20 text-theme-secondary hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-300'
                          }`}
                        >
                          {isSelected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-[10px]"
                            >
                              ✅
                            </motion.span>
                          )}
                          <span className="truncate">{normalizeHashtagLabel(tag)}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {isSearching && searching ? (
                  <p className="mt-3 text-xs text-theme-secondary">Searching...</p>
                ) : null}

                {isSearching && !searching && !queryHasExactMatch ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      if (!atCap) onToggle(normalizedQueryTag);
                    }}
                    disabled={atCap}
                    className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-purple-300 px-3 py-1.5 text-[12px] font-semibold text-purple-600 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-purple-500/40 dark:text-purple-300 dark:hover:bg-purple-500/10"
                  >
                    ➕ Create {normalizeHashtagLabel(normalizedQueryTag)}
                  </motion.button>
                ) : null}

                {isSearching && !searching && visibleTags.length === 0 && queryHasExactMatch ? (
                  <p className="mt-3 text-xs text-theme-secondary">
                    No other hashtags match "{trimmedQuery}".
                  </p>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
