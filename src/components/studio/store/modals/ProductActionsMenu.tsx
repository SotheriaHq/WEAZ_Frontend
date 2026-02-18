import React, { useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT ACTIONS MENU
// Dropdown menu for product card actions: Feature, Duplicate, Archive, Delete
// Uses emoji instead of icons per design requirements
// ═══════════════════════════════════════════════════════════════════════════════

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
  triggerRef?: React.RefObject<HTMLElement>;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const variantStyles = {
  default: 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10',
  danger: 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10',
  warning: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10',
  success: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
};

const ProductActionsMenu: React.FC<ProductActionsMenuProps> = ({
  isOpen,
  onClose,
  onAction,
  actions,
  triggerRef,
  position = 'bottom-right',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        (!triggerRef?.current || !triggerRef.current.contains(event.target as Node))
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const positionStyles = {
    'bottom-right': 'top-full right-0 mt-2',
    'bottom-left': 'top-full left-0 mt-2',
    'top-right': 'bottom-full right-0 mb-2',
    'top-left': 'bottom-full left-0 mb-2',
  };

  return (
    <div
      ref={menuRef}
      className={`absolute ${positionStyles[position]} z-50 w-72 max-w-[calc(100vw-2rem)] py-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 animate-in fade-in zoom-in-95 duration-150`}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {/* Add divider before danger actions */}
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
            className={`
              group
              w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
              ${variantStyles[action.variant || 'default']}
              ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-lg flex-shrink-0">{action.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{action.label}</div>
              {action.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-4 whitespace-normal">
                  {action.description}
                </div>
              )}
            </div>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT PRODUCT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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
      description: product.isFeatured ? 'Currently featured' : 'Show in featured section',
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
    // Note: Edit and Delete removed from menu - they're always visible as buttons on the card
  ];
};

export default ProductActionsMenu;
