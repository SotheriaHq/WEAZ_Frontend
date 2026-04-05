import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
    <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            relative w-full cursor-pointer rounded-xl border text-left shadow-sm transition-all duration-200
            flex items-center justify-between px-4 py-3
            ${disabled ? 'cursor-not-allowed opacity-60 bg-gray-100 dark:bg-gray-800' : 'bg-white/60 dark:bg-black/40 backdrop-blur-md hover:bg-white/80 dark:hover:bg-white/5'}
            ${error 
              ? 'border-red-500 focus:ring-red-500' 
              : isOpen 
                ? 'border-purple-500 ring-2 ring-purple-500/20' 
                : 'border-gray-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/50'
            }
          `}
        >
          <span className={`block truncate ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.icon && <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">{selectedOption.icon}</span>}
                <span>{selectedOption.label}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <span className="pointer-events-none flex items-center pr-2">
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-white/10 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-100 scrollbar-hide">
            {searchable && (
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-2 py-2 dark:border-white/10 dark:bg-[#0a0a0a]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-purple-400 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-purple-400"
                />
              </div>
            )}
            <div className="p-1">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`
                      relative cursor-pointer select-none rounded-lg ${optionCompact ? 'py-2 pl-2.5 pr-8' : 'py-2.5 pl-3 pr-9'} transition-colors
                      ${isSelected 
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100' 
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    <div className={`flex ${optionAllowWrap ? 'items-start' : 'items-center'}`}>
                      {option.icon && (
                        <span className={`mr-3 mt-0.5 flex-shrink-0 ${isSelected ? 'text-purple-500' : 'text-gray-400'}`}>
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
                            } ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'}`}
                          >
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600 dark:text-purple-400">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
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
