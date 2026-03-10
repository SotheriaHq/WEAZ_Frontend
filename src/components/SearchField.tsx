import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/Dropdown';

interface SearchFieldProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  showFilter?: boolean;
  className?: string;
  isLoading?: boolean;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  ariaLabel?: string;
  onFocus?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  filterItems?: Array<{ label: string; value: string }>;
  onFilterSelect?: (value: string) => void;
  ariaControls?: string;
  ariaActiveDescendant?: string;
  ariaAutocomplete?: 'list' | 'none';
}

const SearchField: React.FC<SearchFieldProps> = ({
  placeholder = 'Search...',
  onSearch,
  value,
  onChange,
  showFilter = false,
  className,
  isLoading = false,
  onSubmit,
  onClear,
  ariaLabel = 'Search',
  onFocus,
  onKeyDown,
  inputRef,
  filterItems,
  onFilterSelect,
  ariaControls,
  ariaActiveDescendant,
  ariaAutocomplete = 'none',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputValue = value ?? internalValue;
  const resolvedInputRef = inputRef ?? fallbackInputRef;
  const hasFilterItems = Boolean(showFilter && filterItems && filterItems.length > 0);

  const containerClassName = useMemo(
    () => `relative z-[80] flex-1 min-w-0 max-w-2xl ${className ?? ''}`,
    [className],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isFocused && resolvedInputRef.current) {
      resolvedInputRef.current.focus();
    }
  }, [isFocused, resolvedInputRef]);

  return (
    <div ref={wrapperRef} className={containerClassName} role="search">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔎</span>
        <input
          ref={resolvedInputRef}
          type="text"
          value={inputValue}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={isFocused}
          aria-controls={ariaControls}
          aria-activedescendant={ariaActiveDescendant}
          aria-autocomplete={ariaAutocomplete}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit?.(inputValue);
            }
            onKeyDown?.(event);
          }}
          onChange={e => {
            const next = e.target.value;
            setInternalValue(next);
            onSearch?.(next);
            onChange?.(next);
          }}
          placeholder={placeholder}
          className={`threadly-search-input pl-10 ${hasFilterItems || isLoading || inputValue ? 'pr-24' : 'pr-10'}`}
        />
        {inputValue ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              setInternalValue('');
              onSearch?.('');
              onChange?.('');
              onClear?.();
            }}
            className="absolute right-14 rounded-full px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
        {isLoading ? (
          <span className="absolute right-10 text-xs text-gray-400" aria-hidden="true">⏳</span>
        ) : null}
        {hasFilterItems ? (
          <div className="absolute right-2">
            <Dropdown placement="bottom-end">
              <DropdownTrigger className="btn-frost-ghost btn-tight-xs aspect-square p-0 min-w-[2rem]">
                <span aria-hidden="true">🎛️</span>
              </DropdownTrigger>
              <DropdownMenu>
                {filterItems?.map((item) => (
                  <DropdownItem key={item.value} onClick={() => onFilterSelect?.(item.value)}>
                    {item.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SearchField;
