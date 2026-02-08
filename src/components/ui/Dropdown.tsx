import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { OverlayPortal } from './OverlayPortal';
import { useDropdownManagerOptional } from '@/context/DropdownManagerContext';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface DropdownProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  className?: string;
  menuId?: string;
}

interface DropdownContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  placement: Placement;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  placement = 'bottom-end',
  className,
  menuId,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dropdownManager = useDropdownManagerOptional();
  const generatedId = useId();
  const resolvedId = menuId ?? generatedId;
  const managerOpen = dropdownManager ? dropdownManager.openId === resolvedId : undefined;
  const open = controlledOpen ?? managerOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (dropdownManager) {
      dropdownManager.setOpenId(next ? resolvedId : null);
    } else {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
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
      <DropdownContext.Provider value={{ open, setOpen, placement, triggerRef, menuRef, rootRef }}>
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
        ref={(node) => {
          if (ctx) ctx.triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        className={clsx('btn-frost-ghost btn-tight-sm', className)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
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

    const menuRef = ctx?.menuRef;
    const triggerRef = ctx?.triggerRef;

    const [pos, setPos] = useState<{ top: number; left: number; minWidth: number }>({
      top: 0,
      left: 0,
      minWidth: 180,
    });

    useLayoutEffect(() => {
      if (!open) return;
      const triggerEl = triggerRef?.current;
      if (!triggerEl) return;

      const padding = 12;
      const offset = 8;

      const update = () => {
        const rect = triggerEl.getBoundingClientRect();
        const estimatedWidth = Math.max(180, rect.width);
        const menuEl = menuRef?.current;
        const menuW = menuEl?.offsetWidth ?? estimatedWidth;
        const menuH = menuEl?.offsetHeight ?? 280;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        const isBottom = placement.startsWith('bottom');
        const isEnd = placement.endsWith('end');

        const rawLeft = isEnd ? rect.right - menuW : rect.left;
        const left = Math.round(Math.min(Math.max(padding, rawLeft), viewportW - menuW - padding));

        const rawTop = isBottom ? rect.bottom + offset : rect.top - menuH - offset;
        const top = Math.round(Math.min(Math.max(padding, rawTop), viewportH - menuH - padding));

        setPos({ top, left, minWidth: estimatedWidth });
      };

      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [open, placement, menuRef, triggerRef]);

    if (!open) return null;

    return (
      <OverlayPortal>
        <div
          ref={(node) => {
            if (ctx) ctx.menuRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className={clsx('fixed z-layer-dropdown min-w-[180px] glass-menu p-1 animate-slideDown', className)}
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: 'min(60vh, 360px)' }}
          role="menu"
        >
          <div className="flex flex-col divide-y divide-white/10 overflow-y-auto max-h-[inherit]">
            {children}
          </div>
        </div>
      </OverlayPortal>
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
