import React, { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@/components/ui/Dropdown';

interface SearchFieldProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  showFilter?: boolean; // show the filter dropdown control
  className?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({ placeholder = 'Search...', onSearch, value, onChange, showFilter = true, className }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputValue = value ?? internalValue;

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
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  return (
    <div ref={wrapperRef} className={`relative z-[80] flex-1 min-w-0 max-w-2xl ${className ?? ''}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={e => {
            const next = e.target.value;
            setInternalValue(next);
            onSearch?.(next);
            onChange?.(next);
          }}
          placeholder={placeholder}
          className={`threadly-search-input pl-10 ${showFilter ? 'pr-10' : ''}`}
        />
        {showFilter && (
          <div className="absolute right-2">
            <Dropdown placement="bottom-end">
              <DropdownTrigger className="btn-frost-ghost btn-tight-xs aspect-square p-0 min-w-[2rem]">
                <SlidersHorizontal className="w-4 h-4" />
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem>Brands</DropdownItem>
                <DropdownItem>Collections</DropdownItem>
                <DropdownItem>People</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchField;
