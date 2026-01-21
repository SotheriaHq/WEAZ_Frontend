import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { OverlayPortal } from './OverlayPortal';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FilterDropdownProps {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Premium styled filter dropdown matching profile dropdown design
 * With clean styling, icons, and smooth transitions
 */
export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  // Calculate position when opening
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (option: FilterOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center justify-between gap-2
          px-3 py-2 min-w-[120px]
          text-sm font-medium
          bg-white dark:bg-zinc-900/80
          border border-gray-200 dark:border-white/10
          rounded-lg shadow-sm
          text-gray-700 dark:text-gray-200
          hover:border-purple-300 dark:hover:border-purple-500/50
          focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-purple-500/20 border-purple-500' : ''}
          ${className}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {displayLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <OverlayPortal>
          <div
            ref={menuRef}
            className="fixed z-50 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              top: position.top,
              left: position.left,
              minWidth: position.width,
            }}
            role="listbox"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`
                    w-full flex items-center justify-between gap-3
                    px-3 py-2.5 text-sm text-left
                    transition-colors duration-150
                    ${isSelected 
                      ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                    }
                  `}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-purple-500" />}
                </button>
              );
            })}
          </div>
        </OverlayPortal>
      )}
    </>
  );
};

export default FilterDropdown;
