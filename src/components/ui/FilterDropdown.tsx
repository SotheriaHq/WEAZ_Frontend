import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from './Dropdown';

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
 * Premium styled filter dropdown using the standard Dropdown component
 */
export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  return (
    <Dropdown>
      <DropdownTrigger 
        className={`min-w-[140px] justify-between ${className}`}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {displayLabel}
        </span>
        <span aria-hidden="true" className="ml-2 text-base leading-none opacity-50">⌄</span>
      </DropdownTrigger>
      
      <DropdownMenu className="w-[min(16rem,calc(100vw-1rem))]">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <DropdownItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={isSelected ? 'font-medium' : ''}
              selected={isSelected}
            >
              <div className="flex items-center gap-2">
                {option.icon}
                {option.label}
              </div>
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

export default FilterDropdown;
