import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

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
  menuLayer?: 'dropdown' | 'modal';
}

const normalizeSearchText = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MENU_VIEWPORT_PADDING = 8;
const MENU_GAP = 6;
const MENU_MIN_HEIGHT = 120;
const MENU_MAX_HEIGHT = 320;

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
  menuLayer = 'dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const updateMenuPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const trigger = containerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const triggerWidth = rect.width || trigger.offsetWidth || 220;
    const triggerHeight = rect.height || trigger.offsetHeight || 44;
    const triggerBottom = rect.bottom || rect.top + triggerHeight;

    const availableWidth = Math.max(0, window.innerWidth - MENU_VIEWPORT_PADDING * 2);
    const menuWidth = Math.min(Math.max(triggerWidth, 220), availableWidth);
    const left = Math.min(
      Math.max(MENU_VIEWPORT_PADDING, rect.left),
      Math.max(
        MENU_VIEWPORT_PADDING,
        window.innerWidth - menuWidth - MENU_VIEWPORT_PADDING,
      ),
    );

    const optionRowHeight = optionCompact ? 42 : 50;
    const searchHeight = searchable ? 58 : 0;
    const contentHeight =
      searchHeight +
      (filteredOptions.length > 0 ? filteredOptions.length * optionRowHeight : 48) +
      20;
    const desiredHeight = Math.min(MENU_MAX_HEIGHT, contentHeight);
    const spaceBelow =
      window.innerHeight - triggerBottom - MENU_GAP - MENU_VIEWPORT_PADDING;
    const spaceAbove = rect.top - MENU_GAP - MENU_VIEWPORT_PADDING;
    const safeSpaceBelow = Math.max(0, spaceBelow);
    const safeSpaceAbove = Math.max(0, spaceAbove);
    const placeAbove =
      safeSpaceBelow < Math.min(220, desiredHeight) &&
      safeSpaceAbove > safeSpaceBelow;
    const selectedSpace = placeAbove ? safeSpaceAbove : safeSpaceBelow;
    const viewportMaxHeight = Math.max(
      MENU_MIN_HEIGHT,
      window.innerHeight - MENU_VIEWPORT_PADDING * 2,
    );
    const maxHeight = Math.min(
      MENU_MAX_HEIGHT,
      viewportMaxHeight,
      Math.max(MENU_MIN_HEIGHT, selectedSpace),
    );
    const renderedHeight = Math.min(maxHeight, Math.max(MENU_MIN_HEIGHT, desiredHeight));
    const top = placeAbove
      ? Math.max(MENU_VIEWPORT_PADDING, rect.top - MENU_GAP - renderedHeight)
      : Math.min(
          triggerBottom + MENU_GAP,
          window.innerHeight - MENU_VIEWPORT_PADDING - MENU_MIN_HEIGHT,
        );

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      width: menuWidth,
      minWidth: triggerWidth,
      maxHeight,
      zIndex:
        menuLayer === 'modal'
          ? 'calc(var(--z-modal) + 1)'
          : 'var(--z-dropdown)',
    });
  }, [filteredOptions.length, menuLayer, optionCompact, searchable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen && searchTerm) {
      setSearchTerm('');
    }
  }, [isOpen, searchTerm]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();
  }, [filteredOptions.length, isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleWindowChange = () => updateMenuPosition();
    const handleRouteBoundary = () => setIsOpen(false);
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('orientationchange', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    window.addEventListener('hashchange', handleRouteBoundary);
    window.addEventListener('popstate', handleRouteBoundary);

    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('orientationchange', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      window.removeEventListener('hashchange', handleRouteBoundary);
      window.removeEventListener('popstate', handleRouteBoundary);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  const dropdown =
    isOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className={`${menuLayer === 'modal' ? 'z-layer-modal' : 'z-layer-dropdown'} overflow-hidden rounded-2xl border border-[color:var(--border-default)] glass-menu p-1.5 shadow-2xl animate-slideDown focus-within:border-[color:var(--border-strong)] focus:outline-none`}
          >
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
                      ${
                        isSelected
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
                      <span
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-purple-600 dark:text-purple-400"
                        aria-hidden="true"
                      >
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
          </div>,
          document.body,
        )
      : null;

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
          aria-label={label ?? placeholder}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`
            relative w-full cursor-pointer rounded-2xl border text-left shadow-sm transition-colors duration-200
            flex items-center justify-between px-4 py-3.5 ${selectedAllowWrap ? 'items-start' : 'items-center'}
            ${disabled ? 'cursor-not-allowed opacity-60 bg-[color:var(--surface-muted)]' : 'surface-menu backdrop-blur-xl hover:bg-[color:var(--surface-secondary)]'}
            ${
              error
                ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]'
                : 'border-[color:var(--border-default)] hover:border-[color:var(--border-strong)]'
            }
          `}
        >
          <span className={`flex min-w-0 flex-1 ${selectedAllowWrap ? 'items-start' : 'items-center'} ${!selectedOption ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-primary)]'}`}>
            {selectedOption ? (
              <span className={`flex min-w-0 gap-2 ${selectedAllowWrap ? 'items-start' : 'items-center'}`}>
                {selectedOption.icon && (
                  <span className="flex-shrink-0 text-[color:var(--text-secondary)]">
                    {selectedOption.icon}
                  </span>
                )}
                <span className={selectedAllowWrap ? 'whitespace-normal break-words text-sm leading-5' : 'truncate'}>
                  {selectedOption.label}
                </span>
              </span>
            ) : (
              <span className={selectedAllowWrap ? 'whitespace-normal break-words text-sm leading-5' : 'truncate'}>
                {placeholder}
              </span>
            )}
          </span>
          <span className="pointer-events-none flex items-center pr-2">
            <span
              aria-hidden="true"
              className={`text-base leading-none text-[color:var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            >
              ⌄
            </span>
          </span>
        </button>

        {dropdown}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default UniversalSelect;
