import React from 'react';
import { Package, ShoppingBag, Search, Sparkles, Store, Heart, Archive, Trash2, FileEdit } from 'lucide-react';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { useNavigate } from 'react-router-dom';

export type EmptyStateType = 
  | 'no-products'           // Brand has no products yet
  | 'no-collections'        // Brand has no collections yet
  | 'no-results'            // Filters returned nothing
  | 'brand-not-found'       // Brand doesn't exist
  | 'store-setup'           // Brand needs to set up store (owner view)
  | 'store-not-setup'       // Owner store is not configured/live yet
  | 'store-not-open-yet'    // Visitor view: store exists but is not open
  | 'coming-soon'           // Store is being prepared
  | 'empty-cart'            // Cart is empty
  | 'empty-wishlist'        // Wishlist is empty
  | 'no-archived'           // No archived products
  | 'no-deleted'            // No deleted products
  | 'no-drafts';            // No draft products

interface StoreEmptyStateProps {
  type: EmptyStateType;
  brandName?: string;
  isOwner?: boolean;
  onAction?: () => void;
  onClearFilters?: () => void;
}

const EMPTY_STATES: Record<EmptyStateType, {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  description: string;
  actionLabel?: string;
}> = {
  'no-products': {
    icon: <Package size={48} className="text-purple-400" />,
    emoji: '✨',
    title: 'No products yet',
    description: 'This store is just getting started. Check back soon for amazing fashion pieces!',
    actionLabel: 'Explore Other Stores',
  },
  'no-collections': {
    icon: <Package size={48} className="text-purple-400" />,
    emoji: '🧵',
    title: 'No collections yet',
    description: 'This brand hasn\'t published any collections yet. Check back soon!',
    actionLabel: 'Go to Marketplace',
  },
  'no-results': {
    icon: <Search size={48} className="text-gray-400" />,
    emoji: '🔍',
    title: 'No matches found',
    description: 'We couldn\'t find products matching your filters. Try adjusting your search or removing some filters.',
    actionLabel: 'Clear Filters',
  },
  'brand-not-found': {
    icon: <Store size={48} className="text-gray-400" />,
    emoji: '🏪',
    title: 'Store not found',
    description: 'This store doesn\'t exist or may have been removed. Let\'s find you something else!',
    actionLabel: 'Go to Marketplace',
  },
  'store-setup': {
    icon: <Sparkles size={48} className="text-purple-500" />,
    emoji: '🎨',
    title: 'Set up your store',
    description: 'Your store is ready to go! Add your first products and start selling your amazing fashion pieces.',
    actionLabel: 'Add Your First Product',
  },
  'store-not-setup': {
    icon: <Store size={48} className="text-purple-500" />,
    emoji: '✨',
    title: 'Finish your store setup',
    description: 'Complete your store setup to publish your store and start selling.',
    actionLabel: 'Continue store setup',
  },
  'store-not-open-yet': {
    icon: <Store size={48} className="text-purple-500" />,
    emoji: '⏳',
    title: 'Store not open yet',
    description: 'This store is still being set up. Check back soon for new arrivals.',
    actionLabel: undefined,
  },
  'coming-soon': {
    icon: <ShoppingBag size={48} className="text-purple-400" />,
    emoji: '🛍️',
    title: 'Coming soon!',
    description: 'This store is preparing something special. Follow to get notified when they launch!',
    actionLabel: 'Patch Store',
  },
  'empty-cart': {
    icon: <ShoppingBag size={48} className="text-gray-400" />,
    emoji: '🛒',
    title: 'Your cart is empty',
    description: 'Looks like you haven\'t added anything yet. Discover amazing fashion from African designers!',
    actionLabel: 'Start Shopping',
  },
  'empty-wishlist': {
    icon: <Heart size={48} className="text-gray-400" />,
    emoji: '💜',
    title: 'Nothing saved yet',
    description: 'Save items you love by tapping the heart icon. They\'ll be waiting for you here!',
    actionLabel: 'Explore Products',
  },
  'no-archived': {
    icon: <Archive size={48} className="text-amber-400" />,
    emoji: '📁',
    title: 'No archived products',
    description: 'Archived products will appear here. Archive items you want to temporarily hide from your store.',
    actionLabel: undefined,
  },
  'no-deleted': {
    icon: <Trash2 size={48} className="text-red-400" />,
    emoji: '🗑️',
    title: 'Nothing in the trash',
    description: 'Deleted products will appear here for 60 days before permanent removal. You can restore them anytime.',
    actionLabel: undefined,
  },
  'no-drafts': {
    icon: <FileEdit size={48} className="text-blue-400" />,
    emoji: '📝',
    title: 'No draft products',
    description: 'Products saved as drafts will appear here. Start creating and save your progress anytime!',
    actionLabel: 'Create New Product',
  },
};

/**
 * Reusable empty state component for store-related pages
 * Provides consistent messaging and visual design across the store experience
 */
const StoreEmptyState: React.FC<StoreEmptyStateProps> = ({
  type,
  brandName,
  isOwner = false,
  onAction,
  onClearFilters,
}) => {
  const navigate = useNavigate();
  const state = EMPTY_STATES[type];

  // Customize for owner view
  const getContent = () => {
    if (type === 'no-products' && isOwner) {
      return {
        ...EMPTY_STATES['store-setup'],
        title: 'Create your first product',
        description: 'Start with product photos, a clear title, and a price. Your first publish unlocks the store shelf.',
        actionLabel: 'Create Product',
      };
    }
    
    if (brandName) {
      return {
        ...state,
        description: state.description.replace('This store', brandName),
      };
    }
    
    return state;
  };

  const content = getContent();
  const firstTimeGuide = type === 'no-products' && isOwner
    ? [
        'Upload 4 clear images so buyers can see the product from every angle.',
        'Add the basics: title, category, pricing, and a short description.',
        'Save as a draft or publish when you are ready to sell.',
      ]
    : [];

  const handleAction = () => {
    if (onAction) {
      onAction();
      return;
    }

    if (isOwner && (type === 'no-products' || type === 'store-setup')) {
      navigate('/studio/store/products/new');
      return;
    }

    // Default actions
    switch (type) {
      case 'no-results':
        onClearFilters?.();
        break;
      case 'brand-not-found':
        navigate('/market');
        break;
      case 'store-not-setup':
        navigate('/studio/store');
        break;
      case 'no-products':
      case 'coming-soon':
        navigate('/market');
        break;
      default:
        navigate('/market');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in duration-500">
      {/* Icon with emoji badge */}
      <div className="relative mb-6">
        <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center">
          {content.icon}
        </div>
        <span className="absolute -top-1 -right-1 text-3xl">{content.emoji}</span>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
        {content.title}
      </h3>

      {/* Description */}
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">
        {content.description}
      </p>

      {firstTimeGuide.length > 0 ? (
        <div className="mb-8 w-full max-w-md rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50 via-fuchsia-50 to-white p-4 text-left shadow-sm dark:border-purple-500/20 dark:from-purple-500/10 dark:via-fuchsia-500/10 dark:to-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-200">
            <span aria-hidden="true">🧭</span>
            First-time guide
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {firstTimeGuide.map((step, index) => (
              <div key={step} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Action Button */}
      {content.actionLabel && (
        <FrostedButton variant="primary" onClick={handleAction}>
          {content.actionLabel}
        </FrostedButton>
      )}

      {/* Secondary action for no-results */}
      {type === 'no-results' && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
};

export default StoreEmptyState;
