import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DropdownDivider, DropdownItem } from '@/components/ui/Dropdown';

export interface ProductAction {
  id: string;
  label: string;
  emoji: string;
  description?: string;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
}

interface ProductActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (actionId: string) => void;
  actions: ProductAction[];
  triggerElement?: HTMLElement | null;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Render inline within the parent container instead of a portal */
  renderInline?: boolean;
}

const ProductActionsMenu: React.FC<ProductActionsMenuProps> = ({
  isOpen,
  onClose,
  onAction,
  actions,
  triggerElement,
  position = 'bottom-right',
  renderInline = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    top: -9999,
    left: -9999,
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = triggerElement;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const menuWidth = menuRect.width || 320;
      const menuHeight = menuRect.height || 260;
      const offset = 8;
      const margin = 8;

      let left = triggerRect.right - menuWidth;
      let top = triggerRect.bottom + offset;

      if (position === 'bottom-left') {
        left = triggerRect.left;
        top = triggerRect.bottom + offset;
      } else if (position === 'top-right') {
        left = triggerRect.right - menuWidth;
        top = triggerRect.top - menuHeight - offset;
      } else if (position === 'top-left') {
        left = triggerRect.left;
        top = triggerRect.top - menuHeight - offset;
      }

      if (left + menuWidth > window.innerWidth - margin) {
        left = window.innerWidth - menuWidth - margin;
      }
      if (left < margin) {
        left = margin;
      }

      if (top + menuHeight > window.innerHeight - margin) {
        top = triggerRect.top - menuHeight - offset;
      }
      if (top < margin) {
        top = margin;
      }

      setMenuStyle({
        top,
        left,
        visibility: 'visible',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, position, triggerElement]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        (!triggerElement ||
          !triggerElement.contains(event.target as Node))
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerElement]);

  if (!isOpen) return null;

  const menuContent = (
    <React.Fragment>
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {index > 0 && action.variant === 'danger' ? <DropdownDivider /> : null}
          <DropdownItem
            disabled={action.disabled}
            tone={action.variant || 'default'}
            onClick={() => {
              if (!action.disabled) {
                onAction(action.id);
                onClose();
              }
            }}
            leftIcon={<span className={`${renderInline ? 'text-sm' : 'text-base'} leading-none`} aria-hidden="true">{action.emoji}</span>}
            description={action.description}
            className={renderInline ? 'px-3 py-2' : 'px-4 py-2.5'}
          >
            {action.label}
          </DropdownItem>
        </React.Fragment>
      ))}
    </React.Fragment>
  );

  // Inline mode: render as a dropdown within the card, near the trigger
  if (renderInline) {
    return (
      <div
        ref={menuRef}
        className="absolute right-2 top-11 z-40 w-[min(18rem,calc(100%-1rem))] glass-menu overflow-hidden py-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {menuContent}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-layer-dropdown pointer-events-none">
      <div
        ref={menuRef}
        style={menuStyle}
        className="pointer-events-auto fixed w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] glass-menu overflow-hidden py-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {menuContent}
      </div>
    </div>,
    document.body,
  );
};

export const getDefaultProductActions = (product: {
  isFeatured?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
}): ProductAction[] => {
  const isArchived = !!product.archivedAt;
  const isDeleted = !!product.deletedAt;

  if (isDeleted) {
    return [
      {
        id: 'edit',
        label: 'Edit Product',
        emoji: '✏️',
        description: 'Update details while deleted',
        variant: 'default',
      },
      {
        id: 'restore',
        label: 'Restore Product',
        emoji: '↩️',
        description: 'Bring back as draft',
        variant: 'success',
      },
      {
        id: 'permanent-delete',
        label: 'Delete Permanently',
        emoji: '🗑️',
        description: 'Remove forever',
        variant: 'danger',
      },
    ];
  }

  return [
    {
      id: 'feature',
      label: product.isFeatured ? 'Remove from Featured' : 'Add to Featured',
      emoji: product.isFeatured ? '⭐' : '☆',
      description: product.isFeatured
        ? 'Currently featured'
        : 'Show in featured section',
      variant: product.isFeatured ? 'success' : 'default',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      emoji: '📋',
      description: 'Create a copy of this product',
    },
    ...(isArchived
      ? [
          {
            id: 'unarchive',
            label: 'Restore from Archive',
            emoji: '↩️',
            description: 'Make visible again',
            variant: 'success' as const,
          },
        ]
      : [
          {
            id: 'archive',
            label: 'Archive',
            emoji: '📦',
            description: 'Hide from store (60-day auto-delete)',
            variant: 'warning' as const,
          },
        ]),
  ];
};

export default ProductActionsMenu;
