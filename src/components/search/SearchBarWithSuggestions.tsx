import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchField from '@/components/SearchField';
import useDebounce from '@/hooks/useDebounce';
import useSearchSuggestions from '@/hooks/useSearchSuggestions';
import { getRecentSearches, storeRecentSearch } from '@/lib/searchHistory';
import { buildSearchHref } from '@/lib/searchRouting';
import SearchSuggestionDropdown, {
  flattenSuggestionEntries,
  type SearchSuggestionEntry,
} from './SearchSuggestionDropdown';

const globalShortcutSubscribers: Array<() => void> = [];
let removeGlobalShortcutListener: (() => void) | null = null;

function subscribeGlobalSearchShortcut(callback: () => void) {
  globalShortcutSubscribers.push(callback);

  if (!removeGlobalShortcutListener) {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const latest = globalShortcutSubscribers[globalShortcutSubscribers.length - 1];
        latest?.();
      }
    };

    document.addEventListener('keydown', listener);
    removeGlobalShortcutListener = () => {
      document.removeEventListener('keydown', listener);
      removeGlobalShortcutListener = null;
    };
  }

  return () => {
    const index = globalShortcutSubscribers.lastIndexOf(callback);
    if (index >= 0) {
      globalShortcutSubscribers.splice(index, 1);
    }

    if (globalShortcutSubscribers.length === 0) {
      removeGlobalShortcutListener?.();
    }
  };
}

interface SearchBarWithSuggestionsProps {
  placeholder?: string;
  className?: string;
  brandId?: string;
  initialValue?: string;
  showShortcutHint?: boolean;
  enableGlobalShortcut?: boolean;
  onValueChange?: (value: string) => void;
  onSubmitQuery?: (query: string) => void;
  onNavigate?: (href: string) => void;
}

const SearchBarWithSuggestions: React.FC<SearchBarWithSuggestionsProps> = ({
  placeholder = 'Search products, brands, styles...',
  className,
  brandId,
  initialValue = '',
  enableGlobalShortcut = true,
  onValueChange,
  onSubmitQuery,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [localRecent, setLocalRecent] = useState<string[]>(() => getRecentSearches());
  const dropdownId = useId().replace(/:/g, '-');
  const debouncedValue = useDebounce(value, 180);
  const { suggestions, isLoading } = useSearchSuggestions(debouncedValue, {
    enabled: open && (debouncedValue.trim().length === 0 || debouncedValue.trim().length >= 1),
    brandId,
  });

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    if (!enableGlobalShortcut) {
      return;
    }

    return subscribeGlobalSearchShortcut(() => {
      inputRef.current?.focus();
      setOpen(true);
    });
  }, [enableGlobalShortcut]);

  const entries = useMemo(
    () => flattenSuggestionEntries(suggestions, localRecent),
    [localRecent, suggestions],
  );

  useEffect(() => {
    if (activeIndex >= entries.length) {
      setActiveIndex(-1);
    }
  }, [activeIndex, entries.length]);

  const activeDescendantId =
    activeIndex >= 0 ? `${dropdownId}-option-${activeIndex}` : undefined;

  const runSearch = (query: string) => {
    const next = query.trim();
    if (!next) {
      return;
    }
    storeRecentSearch(next);
    setLocalRecent(getRecentSearches());
    setOpen(false);
    setActiveIndex(-1);
    if (onSubmitQuery) {
      onSubmitQuery(next);
      return;
    }
    navigate(buildSearchHref(next));
  };

  const handleSelect = (entry: SearchSuggestionEntry) => {
    if (entry.kind === 'recent' || entry.kind === 'trending') {
      setValue(entry.query || entry.label);
      runSearch(entry.query || entry.label);
      return;
    }

    if (entry.query) {
      storeRecentSearch(entry.query);
      setLocalRecent(getRecentSearches());
    }
    setOpen(false);
    setActiveIndex(-1);
    if (onNavigate) {
      onNavigate(entry.href);
      return;
    }
    navigate(entry.href);
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className || ''}`}>
      <SearchField
        inputRef={inputRef}
        value={value}
        onChange={(next) => {
          setValue(next);
          onValueChange?.(next);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onSearch={(next) => {
          setValue(next);
        }}
        onFocus={() => setOpen(true)}
        onSubmit={() => runSearch(value)}
        onClear={() => {
          setValue('');
          setOpen(true);
          inputRef.current?.focus();
        }}
        isLoading={isLoading}
        placeholder={placeholder}
        showFilter={false}
        ariaLabel="Global search"
        ariaAutocomplete="list"
        ariaControls={dropdownId}
        ariaActiveDescendant={activeDescendantId}
        className="!max-w-none"
        onKeyDown={(event) => {
          if (!open || entries.length === 0) {
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % entries.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? entries.length - 1 : current - 1));
          } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            handleSelect(entries[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
      />

      <SearchSuggestionDropdown
        dropdownId={dropdownId}
        suggestions={suggestions}
        localRecent={localRecent}
        activeIndex={activeIndex}
        open={open}
        isLoading={isLoading}
        onSelect={handleSelect}
      />

      <div className="sr-only" aria-live="polite">
        {open ? `${entries.length} suggestions available` : ''}
      </div>
    </div>
  );
};

export default SearchBarWithSuggestions;