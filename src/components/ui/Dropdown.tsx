import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { OverlayPortal } from './OverlayPortal';
import { useDropdownManagerOptional } from '@/context/DropdownManagerContext';

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export const DROPDOWN_SECTION_TITLE_CLASS =
  'px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]';
export const DROPDOWN_HEADER_CLASS = 'px-3.5 pb-2 pt-3';
export const DROPDOWN_TITLE_CLASS = 'text-sm font-semibold text-[color:var(--text-primary)]';
export const DROPDOWN_META_CLASS = 'mt-0.5 text-[11px] leading-4 text-[color:var(--text-secondary)]';
export const DROPDOWN_DIVIDER_CLASS = 'mx-2 my-1 h-px bg-black/5 dark:bg-white/10';
export const DROPDOWN_SURFACE_CLASS = 'glass-menu overflow-hidden';
export const DROPDOWN_CONTENT_CLASS =
  'flex min-h-0 h-full touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';
export const DROPDOWN_ITEM_BASE_CLASS =
  'group flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-0';
export const DROPDOWN_ITEM_DESCRIPTION_CLASS =
  'mt-0.5 block text-[11px] leading-4 text-[color:var(--text-secondary)]';

interface DropdownProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  className?: string;
  menuId?: string;
  offset?: number;
}

interface DropdownContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  placement: Placement;
  offset: number;
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
  offset,
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
  const resolvedOffset =
    offset ??
    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
      ? 4
      : 8);

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
      <DropdownContext.Provider value={{ open, setOpen, placement, offset: resolvedOffset, triggerRef, menuRef, rootRef }}>
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
        type="button"
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
  maxHeight?: string;
}

export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ children, className, maxHeight }, ref) => {
    const ctx = useContext(DropdownContext);
    const open = ctx?.open ?? false;
    const placement = ctx?.placement ?? 'bottom-end';
    const offset = ctx?.offset ?? 8;

    const menuRef = ctx?.menuRef;
    const triggerRef = ctx?.triggerRef;
    const [isPositioned, setIsPositioned] = useState(false);

    const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; transformOrigin: string }>({
      top: 0,
      left: 0,
      minWidth: 180,
      transformOrigin: 'top right',
    });

    useLayoutEffect(() => {
      if (!open) {
        setIsPositioned(false);
        return;
      }
      const triggerEl = triggerRef?.current;
      const menuEl = menuRef?.current;
      if (!triggerEl) return;

      let rafId = 0;
      let mounted = true;

      const update = () => {
        const rect = triggerEl.getBoundingClientRect();
        const nextMenuEl = menuRef?.current;
        const menuH = nextMenuEl?.offsetHeight ?? 280;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const padding = 8;
        const maxWidth = Math.max(180, viewportW - padding * 2);
        const measuredWidth = nextMenuEl?.offsetWidth ?? rect.width;
        const menuW = Math.min(Math.max(measuredWidth, rect.width, 180), maxWidth);

        const isBottom = placement.startsWith('bottom');
        const isEnd = placement.endsWith('end');

        const rawLeft = isEnd ? rect.right - menuW : rect.left;
        const left = Math.round(Math.min(Math.max(padding, rawLeft), Math.max(padding, viewportW - menuW - padding)));

        const rawTop = isBottom ? rect.bottom + offset : rect.top - menuH - offset;
        const top = Math.round(Math.min(Math.max(padding, rawTop), Math.max(padding, viewportH - menuH - padding)));

        setPos({
          top,
          left,
          minWidth: Math.max(rect.width, 180),
          transformOrigin: `${isBottom ? 'top' : 'bottom'} ${isEnd ? 'right' : 'left'}`,
        });
        if (mounted) {
          setIsPositioned(true);
        }
      };

      setIsPositioned(false);
      update();
      rafId = window.requestAnimationFrame(update);

      const resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              update();
            })
          : null;
      resizeObserver?.observe(triggerEl);
      if (menuEl) {
        resizeObserver?.observe(menuEl);
      }

      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        mounted = false;
        window.cancelAnimationFrame(rafId);
        resizeObserver?.disconnect();
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
          className={clsx('fixed z-layer-dropdown animate-slideDown', DROPDOWN_SURFACE_CLASS, className)}
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: pos.minWidth,
            maxWidth: 'calc(100vw - 1rem)',
            maxHeight: maxHeight ?? 'min(60vh, 24rem)',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
            transformOrigin: pos.transformOrigin,
            visibility: isPositioned ? 'visible' : 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
          role="menu"
          aria-orientation="vertical"
        >
          <div
            className={DROPDOWN_CONTENT_CLASS}
            style={{
              maxHeight: maxHeight ?? 'min(60vh, 24rem)',
              width: '100%',
              boxSizing: 'border-box',
              scrollbarGutter: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
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
  description?: React.ReactNode;
  meta?: React.ReactNode;
  selected?: boolean;
  tone?: 'default' | 'danger' | 'success' | 'warning';
}

const toneClasses: Record<NonNullable<DropdownItemProps['tone']>, string> = {
  default: 'text-[color:var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10',
  danger: 'text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 dark:hover:bg-rose-500/15',
  success: 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
  warning: 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 dark:hover:bg-amber-500/15',
};

export const DropdownItem: React.FC<DropdownItemProps> = ({
  leftIcon,
  rightIcon,
  description,
  meta,
  selected = false,
  tone = 'default',
  className,
  children,
  ...props
}) => (
  <button
    className={clsx(
      DROPDOWN_ITEM_BASE_CLASS,
      selected
        ? 'bg-[color:var(--brand-primary)]/10 text-[color:var(--text-primary)] dark:bg-[color:var(--brand-primary)]/15'
        : toneClasses[tone],
      className,
    )}
    type="button"
    role="menuitem"
    {...props}
  >
    {leftIcon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{leftIcon}</span> : null}
    <span className="min-w-0 flex-1">
      <span className="block min-w-0 break-words font-medium leading-5">{children}</span>
      {description ? <span className={DROPDOWN_ITEM_DESCRIPTION_CLASS}>{description}</span> : null}
    </span>
    {meta ? <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-[color:var(--text-secondary)]">{meta}</span> : null}
    {rightIcon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{rightIcon}</span> : null}
    {selected && !rightIcon ? <span className="mt-0.5 shrink-0 text-[12px] font-semibold" aria-hidden="true">✓</span> : null}
  </button>
);

interface DropdownHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export const DropdownHeader: React.FC<DropdownHeaderProps> = ({ title, description, className }) => (
  <div className={clsx(DROPDOWN_HEADER_CLASS, className)}>
    <div className={DROPDOWN_TITLE_CLASS}>{title}</div>
    {description ? <div className={DROPDOWN_META_CLASS}>{description}</div> : null}
  </div>
);

interface DropdownDividerProps {
  className?: string;
}

export const DropdownDivider: React.FC<DropdownDividerProps> = ({ className }) => (
  <div aria-hidden="true" className={clsx(DROPDOWN_DIVIDER_CLASS, className)} />
);

export default Dropdown;
