/**
 * Collection Naming Constants (Item #18)
 * 
 * Distinguishes between "Designs" (creative lookbooks) and "Store Collections" (e-commerce).
 * 
 * CONTEXT:
 * - DESIGN: Creative content showcasing fashion looks, mood boards, style inspiration
 * - STORE: E-commerce product groupings for purchasing
 * 
 * USAGE:
 * import { getCollectionLabel, CollectionContext } from '@/utils/collectionNaming';
 * 
 * const label = getCollectionLabel(CollectionContext.DESIGN);
 * // Returns "Design" or "Look"
 * 
 * const storeLabel = getCollectionLabel(CollectionContext.STORE);
 * // Returns "Collection" or "Catalog"
 */

export const CollectionContext = {
  /** Creative lookbooks, mood boards, style inspiration */
  DESIGN: 'design',
  /** E-commerce product groupings for purchasing */
  STORE: 'store',
  /** Mixed or unknown context */
  GENERIC: 'generic',
} as const;

export type CollectionContextType = typeof CollectionContext[keyof typeof CollectionContext];

export interface CollectionLabels {
  singular: string;
  plural: string;
  article: string;
  action: {
    create: string;
    edit: string;
    view: string;
    delete: string;
    publish: string;
  };
  owner: {
    singular: string;
    plural: string;
  };
}

const DESIGN_LABELS: CollectionLabels = {
  singular: 'Design',
  plural: 'Designs',
  article: 'a',
  action: {
    create: 'Create Design',
    edit: 'Edit Design',
    view: 'View Design',
    delete: 'Delete Design',
    publish: 'Publish Design',
  },
  owner: {
    singular: 'Designer',
    plural: 'Designers',
  },
};

const STORE_LABELS: CollectionLabels = {
  singular: 'Collection',
  plural: 'Collections',
  article: 'a',
  action: {
    create: 'Create Collection',
    edit: 'Edit Collection',
    view: 'View Collection',
    delete: 'Delete Collection',
    publish: 'Publish Collection',
  },
  owner: {
    singular: 'Brand',
    plural: 'Brands',
  },
};

const GENERIC_LABELS: CollectionLabels = {
  singular: 'Collection',
  plural: 'Collections',
  article: 'a',
  action: {
    create: 'Create',
    edit: 'Edit',
    view: 'View',
    delete: 'Delete',
    publish: 'Publish',
  },
  owner: {
    singular: 'Creator',
    plural: 'Creators',
  },
};

/**
 * Get labels for a specific collection context
 */
export function getCollectionLabels(context: CollectionContextType): CollectionLabels {
  switch (context) {
    case CollectionContext.DESIGN:
      return DESIGN_LABELS;
    case CollectionContext.STORE:
      return STORE_LABELS;
    default:
      return GENERIC_LABELS;
  }
}

/**
 * Get the primary label for a collection based on context
 */
export function getCollectionLabel(context: CollectionContextType, isPlural = false): string {
  const labels = getCollectionLabels(context);
  return isPlural ? labels.plural : labels.singular;
}

/**
 * Determine collection context based on available data
 * 
 * Heuristics:
 * - Has products attached → STORE
 * - isAvailableInStore is true → STORE
 * - Has media but no products → DESIGN
 * - Default → GENERIC
 */
export function inferCollectionContext(collection: {
  isAvailableInStore?: boolean;
  productsCount?: number;
  products?: unknown[];
  mediasCount?: number;
  medias?: unknown[];
}): CollectionContextType {
  // Explicitly marked as store collection
  if (collection.isAvailableInStore === true) {
    return CollectionContext.STORE;
  }

  // Has products
  const productCount = collection.productsCount ?? collection.products?.length ?? 0;
  if (productCount > 0) {
    return CollectionContext.STORE;
  }

  // Has media but no products - likely a design/lookbook
  const mediaCount = collection.mediasCount ?? collection.medias?.length ?? 0;
  if (mediaCount > 0 && productCount === 0) {
    return CollectionContext.DESIGN;
  }

  return CollectionContext.GENERIC;
}

/**
 * Format collection count with proper pluralization
 */
export function formatCollectionCount(
  count: number,
  context: CollectionContextType
): string {
  const labels = getCollectionLabels(context);
  return `${count} ${count === 1 ? labels.singular : labels.plural}`;
}

/**
 * Get empty state message for collections
 */
export function getEmptyStateMessage(context: CollectionContextType): {
  title: string;
  description: string;
  action: string;
} {
  switch (context) {
    case CollectionContext.DESIGN:
      return {
        title: 'No Designs Yet',
        description: 'Create your first design to showcase your creative vision',
        action: 'Create Design',
      };
    case CollectionContext.STORE:
      return {
        title: 'No Collections Yet',
        description: 'Create a collection to organize your products',
        action: 'Create Collection',
      };
    default:
      return {
        title: 'Nothing Here',
        description: 'Get started by creating something new',
        action: 'Create',
      };
  }
}

/**
 * Type guard for collection types
 */
export type CollectionType = 
  | 'STANDARD'
  | 'SEASONAL'
  | 'LIMITED'
  | 'CAPSULE'
  | 'LOOKBOOK'
  | 'EDITORIAL';

export function isStoreCollectionType(type: CollectionType): boolean {
  return ['STANDARD', 'SEASONAL', 'LIMITED', 'CAPSULE'].includes(type);
}

export function isDesignCollectionType(type: CollectionType): boolean {
  return ['LOOKBOOK', 'EDITORIAL'].includes(type);
}

export default {
  CollectionContext,
  getCollectionLabels,
  getCollectionLabel,
  inferCollectionContext,
  formatCollectionCount,
  getEmptyStateMessage,
  isStoreCollectionType,
  isDesignCollectionType,
};
