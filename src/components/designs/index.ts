/**
 * Design Components Index
 * 
 * All e-commerce design/collection related components for the Threadly platform.
 * These components follow the unified design system with:
 * - Gradient blur backdrop for overlays
 * - Glassmorphism effects
 * - Dark mode support
 * - Framer Motion animations
 * - Nigerian Naira (NGN) currency formatting
 */

// Drawers
export { default as CartDrawer } from './CartDrawer';
export { default as WishlistDrawer } from './WishlistDrawer';

// Modals
export { default as ProductDetailModal } from './ProductDetailModal';
export { default as DesignViewModal } from './DesignViewModal';
export { default as CollectionViewModal } from './CollectionViewModal';

// Cards
export { default as StoreProductCard } from './StoreProductCard';
export { default as DesignCard } from './DesignCard';

// Reviews
export { default as ProductReviews } from './ProductReviews';

// Skeletons & Loading
export { default as ProductCardSkeleton } from './ProductCardSkeleton';
export { default as DesignSkeleton } from './DesignSkeleton';

// Empty States
export { default as StoreEmptyState } from './StoreEmptyState';

// Panels
export { default as FilterPanel } from './FilterPanel';
export { default as DesignCommentsPanel } from './DesignCommentsPanel';

// Type exports
export type { ProductDetailData } from './ProductDetailModal';
export type { ProductReview, ReviewsSummary, ReviewUser } from './ProductReviews';
export type { EmptyStateType } from './StoreEmptyState';
