import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
    <Dropdown open={undefined} onOpenChange={undefined}>
      <DropdownTrigger 
        className={`min-w-[140px] justify-between ${className}`}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {displayLabel}
        </span>
        <ChevronDown className="w-4 h-4 opacity-50 ml-2" />
      </DropdownTrigger>
      
      <DropdownMenu>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <DropdownItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={isSelected ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium' : ''}
              rightIcon={isSelected ? <Check className="w-4 h-4 text-purple-500" /> : undefined}
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
