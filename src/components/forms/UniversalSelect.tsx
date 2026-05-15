import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface UniversalSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface UniversalSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: UniversalSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  optionCompact?: boolean;
  optionAllowWrap?: boolean;
  selectedAllowWrap?: boolean;
}

const normalizeSearchText = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const UniversalSelect: React.FC<UniversalSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  error,
  searchable = false,
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No matching options',
  optionCompact = false,
  optionAllowWrap = false,
  selectedAllowWrap = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const query = normalizeSearchText(searchTerm);
    if (!query) return options;

    const queryTokens = query.split(' ');

    return options.filter((option) => {
      const haystack = normalizeSearchText(
        `${option.label} ${option.description ?? ''} ${option.value}`,
      );
      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [options, searchable, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen && searchTerm) {
      setSearchTerm('');
    }
  }, [isOpen, searchTerm]);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative space-y-2 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[color:var(--text-secondary)]">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`
            relative w-full cursor-pointer rounded-2xl border text-left shadow-sm transition-colors duration-200
            flex items-center justify-between px-4 py-3.5 ${selectedAllowWrap ? 'items-start' : 'items-center'}
            ${disabled ? 'cursor-not-allowed opacity-60 bg-[color:var(--surface-muted)]' : 'surface-menu backdrop-blur-xl hover:bg-[color:var(--surface-secondary)]'}
            ${error 
              ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]' 
              : 'border-[color:var(--border-default)] hover:border-[color:var(--border-strong)]'
            }
          `}
        >
          <span className={`flex min-w-0 flex-1 ${selectedAllowWrap ? 'items-start' : 'items-center'} ${!selectedOption ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-primary)]'}`}>
            {selectedOption ? (
              <span className={`flex min-w-0 gap-2 ${selectedAllowWrap ? 'items-start' : 'items-center'}`}>
                {selectedOption.icon && <span className="flex-shrink-0 text-[color:var(--text-secondary)]">{selectedOption.icon}</span>}
                <span className={selectedAllowWrap ? 'whitespace-normal break-words text-sm leading-5' : 'truncate'}>{selectedOption.label}</span>
              </span>
            ) : (
              <span className={selectedAllowWrap ? 'whitespace-normal break-words text-sm leading-5' : 'truncate'}>{placeholder}</span>
            )}
          </span>
          <span className="pointer-events-none flex items-center pr-2">
            <span aria-hidden="true" className={`text-base leading-none text-[color:var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1.5 w-full max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-[color:var(--border-default)] glass-menu p-1.5 shadow-2xl animate-slideDown focus-within:border-[color:var(--border-strong)] focus:outline-none">
            {searchable && (
              <div className="sticky top-0 z-10 rounded-xl bg-[color:var(--surface-primary)] px-2 py-2 backdrop-blur-xl">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl bg-[color:var(--surface-secondary)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-shadow placeholder:text-[color:var(--text-secondary)] focus:ring-2 focus:ring-[color:rgba(var(--brand-primary-rgb),0.18)]"
                />
              </div>
            )}
            <div
              role="listbox"
              aria-label={label ?? placeholder}
              className="max-h-56 space-y-1 overflow-y-auto overscroll-contain p-1 pr-1.5 scrollbar-threadly"
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                      className={`
                      relative cursor-pointer select-none rounded-xl ${optionCompact ? 'py-2 pl-2.5 pr-8' : 'py-2.5 pl-3 pr-9'} transition-colors
                      ${isSelected 
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100' 
                        : 'text-[color:var(--text-primary)] surface-interactive-hover'
                      }
                    `}
                  >
                    <div className={`flex ${optionAllowWrap ? 'items-start' : 'items-center'}`}>
                      {option.icon && (
                        <span className={`mr-3 mt-0.5 flex-shrink-0 ${isSelected ? 'text-purple-500' : 'text-[color:var(--text-secondary)]'}`}>
                          {option.icon}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span
                          className={`block ${
                            optionAllowWrap
                              ? 'text-sm leading-5 whitespace-normal break-words'
                              : 'truncate'
                          } ${isSelected ? 'font-semibold' : 'font-normal'}`}
                        >
                          {option.label}
                        </span>
                        {option.description && (
                          <span
                            className={`block ${
                              optionAllowWrap
                                ? 'text-[11px] leading-4 whitespace-normal break-words'
                                : 'truncate text-xs'
                            } ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-[color:var(--text-secondary)]'}`}
                          >
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600 dark:text-purple-400" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-3 text-sm text-[color:var(--text-secondary)]">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default UniversalSelect;
