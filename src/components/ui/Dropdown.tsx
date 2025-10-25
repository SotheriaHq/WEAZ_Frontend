import React, { useContext, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface DropdownProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  className?: string;
}

interface DropdownContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  placement: Placement;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  placement = 'bottom-end',
  className,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className={clsx('relative inline-block', className)}>
      <DropdownContext.Provider value={{ open, setOpen, placement }}>
        {children}
      </DropdownContext.Provider>
    </div>
  );
};

interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const ctx = useContext(DropdownContext);
    const isOpen = ctx?.open ?? false;
    const toggle = () => ctx?.setOpen(!isOpen);
    return (
      <button
        ref={ref}
        className={clsx('btn-frost-ghost btn-tight-sm', className)}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownTrigger.displayName = 'DropdownTrigger';

interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ children, className }, ref) => {
    const ctx = useContext(DropdownContext);
    const open = ctx?.open ?? false;
    const placement = ctx?.placement ?? 'bottom-end';
    if (!open) return null;
    const alignClasses: Record<Placement, string> = {
      'bottom-start': 'top-full left-0 mt-2 origin-top-left',
      'bottom-end': 'top-full right-0 mt-2 origin-top-right',
      'top-start': 'bottom-full left-0 mb-2 origin-bottom-left',
      'top-end': 'bottom-full right-0 mb-2 origin-bottom-right',
    };
    return (
      <div
        ref={ref}
        className={clsx(
          'absolute z-[70] min-w-[180px] glass-menu p-1 animate-slideDown',
          alignClasses[placement],
          className,
        )}
        role="menu"
      >
        <div className="flex flex-col divide-y divide-white/10">
          {children}
        </div>
      </div>
    );
  },
);
DropdownMenu.displayName = 'DropdownMenu';

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ leftIcon, rightIcon, className, children, ...props }) => (
  <button
    className={clsx(
      'w-full flex items-center justify-between gap-3 text-left px-3 py-2 text-sm rounded-md hover:bg-white/20 transition-colors',
      className,
    )}
    role="menuitem"
    {...props}
  >
    <span className="inline-flex items-center gap-2">
      {leftIcon}
      {children}
    </span>
    {rightIcon}
  </button>
);

export default Dropdown;
