import React from 'react';

interface EmptyStateType {
  type: 'products' | 'collections' | 'reviews' | 'generic';
  isOwner?: boolean;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  onAction?: () => void;
}

const EMPTY_STATES = {
  products: {
    emoji: '📦',
    ownerTitle: 'Add Your First Product',
    ownerDescription: 'Your store is ready! Start adding products to showcase your amazing items.',
    visitorTitle: 'No Products Yet',
    visitorDescription: 'This store is still setting up. Check back soon for new arrivals!',
    ownerCta: 'Add Product',
    ownerCtaHref: '/studio/products/new',
  },
  collections: {
    emoji: '🗂️',
    ownerTitle: 'Create Your First Collection',
    ownerDescription: 'Organize your products into collections to help customers browse.',
    visitorTitle: 'No Collections',
    visitorDescription: 'Collections coming soon...',
    ownerCta: 'Create Collection',
    ownerCtaHref: '/studio/collections/new',
  },
  reviews: {
    emoji: '⭐',
    ownerTitle: 'No Reviews Yet',
    ownerDescription: 'Reviews will appear here once customers start sharing their experiences.',
    visitorTitle: 'No Reviews Yet',
    visitorDescription: 'Be the first to review a product from this store!',
    ownerCta: undefined,
    ownerCtaHref: undefined,
  },
  generic: {
    emoji: '🛍️',
    ownerTitle: 'Nothing Here Yet',
    ownerDescription: 'Get started by adding content to your store.',
    visitorTitle: 'Coming Soon',
    visitorDescription: 'Check back later for updates.',
    ownerCta: undefined,
    ownerCtaHref: undefined,
  },
};

/**
 * Store Empty State Component
 * Displays contextual empty states for products, collections, reviews, etc.
 */
const StoreEmptyState: React.FC<EmptyStateType> = ({
  type,
  isOwner = false,
  title,
  description,
  ctaText,
  ctaHref,
  onAction,
}) => {
  const config = EMPTY_STATES[type];
  const displayTitle = title || (isOwner ? config.ownerTitle : config.visitorTitle);
  const displayDescription = description || (isOwner ? config.ownerDescription : config.visitorDescription);
  const displayCtaText = ctaText || (isOwner ? config.ownerCta : undefined);
  const displayCtaHref = ctaHref || (isOwner ? config.ownerCtaHref : undefined);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-6xl mb-4">{config.emoji}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {displayTitle}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
        {displayDescription}
      </p>
      {displayCtaText && (displayCtaHref || onAction) && (
        displayCtaHref ? (
          <a
            href={displayCtaHref}
            className="px-6 py-3 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            {displayCtaText}
          </a>
        ) : (
          <button
            onClick={onAction}
            className="px-6 py-3 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            {displayCtaText}
          </button>
        )
      )}
    </div>
  );
};

export default StoreEmptyState;
