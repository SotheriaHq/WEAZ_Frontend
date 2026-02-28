import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
}

const variantStyles = {
  default:
    'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10',
  danger:
    'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10',
  warning:
    'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10',
  success:
    'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
};

const ProductActionsMenu: React.FC<ProductActionsMenuProps> = ({
  isOpen,
  onClose,
  onAction,
  actions,
  triggerElement,
  position = 'bottom-right',
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

  return createPortal(
    <div className="fixed inset-0 z-[3000] pointer-events-none">
      <div
        ref={menuRef}
        style={menuStyle}
        className="pointer-events-auto fixed w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-xl border border-gray-200 bg-white py-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-700 dark:bg-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.id}>
            {index > 0 && action.variant === 'danger' && (
              <div className="my-2 border-t border-gray-100 dark:border-zinc-700" />
            )}
            <button
              type="button"
              onClick={() => {
                if (!action.disabled) {
                  onAction(action.id);
                  onClose();
                }
              }}
              disabled={action.disabled}
              className={`w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors group flex ${
                variantStyles[action.variant || 'default']
              } ${action.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span className="text-base leading-none">{action.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{action.label}</div>
                {action.description && (
                  <div className="mt-0.5 whitespace-normal text-xs leading-4 text-gray-500 dark:text-gray-400">
                    {action.description}
                  </div>
                )}
              </div>
            </button>
          </React.Fragment>
        ))}
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
