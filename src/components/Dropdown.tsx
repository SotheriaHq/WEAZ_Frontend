import React, { useId, useState } from 'react';
import { useDropdownManagerOptional } from '@/context/DropdownManagerContext';
import {
  Dropdown as CompactDropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/Dropdown';

type DropdownOption = { label: string; onClick: () => void };

interface DropdownProps {
  buttonLabel: React.ReactNode;
  options: DropdownOption[];
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  hideCaret?: boolean; // when true, do not render the caret icon
  buttonClassName?: string; // extra classes for the button (e.g., to remove focus borders)
}

const Dropdown: React.FC<DropdownProps> = ({ buttonLabel, options, variant = 'primary', className = '', hideCaret = false, buttonClassName = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownId = useId();
  const dropdownManager = useDropdownManagerOptional();
  const open = dropdownManager ? dropdownManager.openId === dropdownId : isOpen;

  const toggle = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (dropdownManager) {
      dropdownManager.setOpenId(open ? null : dropdownId);
    } else {
      setIsOpen((s) => !s);
    }
  };

  const handleOption = (fn: () => void) => {
    try {
      fn();
    } finally {
      if (dropdownManager) {
        dropdownManager.setOpenId(null);
      } else {
        setIsOpen(false);
      }
    }
  };

  return (
    <CompactDropdown
      open={open}
      onOpenChange={(next) => {
        if (dropdownManager) {
          dropdownManager.setOpenId(next ? dropdownId : null);
        } else {
          setIsOpen(next);
        }
      }}
      placement="bottom-end"
      menuId={dropdownId}
      className={className}
      offset={4}
    >
      <DropdownTrigger
        className={[
          variant === 'primary'
            ? 'btn-frost-primary btn-tight-sm'
            : variant === 'secondary'
              ? 'btn-frost-outline btn-tight-sm'
              : variant === 'outline'
                ? 'btn-frost-outline btn-tight-sm'
                : 'btn-frost-ghost btn-tight-sm',
          buttonClassName,
        ].filter(Boolean).join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          toggle(event);
        }}
      >
        {buttonLabel}
        {!hideCaret ? <span aria-hidden="true" className="ml-2 text-base leading-none">⌄</span> : null}
      </DropdownTrigger>

      {open ? (
        <DropdownMenu className="w-[min(16rem,calc(100vw-1rem))]">
          {options.map((opt, idx) => (
            <DropdownItem
              key={`${idx}-${typeof opt.label === 'string' ? opt.label : 'option'}`}
              onClick={() => handleOption(opt.onClick)}
            >
              {opt.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      ) : null}
    </CompactDropdown>
  );
};

export default Dropdown;
