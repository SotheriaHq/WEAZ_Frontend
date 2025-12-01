import React, { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@/components/ui/Dropdown';

interface SearchFieldProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  showFilter?: boolean; // show the filter dropdown control
  className?: string;
}

const SearchField: React.FC<SearchFieldProps> = ({ placeholder = 'Search...', onSearch, showFilter = true, className }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      <div className="glass-panel px-3 py-2 rounded-xl flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={e => {
            setValue(e.target.value);
            onSearch?.(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none border-0 focus:ring-0 text-sm placeholder:text-gray-500"
        />
        {showFilter && (
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
        )}
      </div>
    </div>
  );
};

export default SearchField;
