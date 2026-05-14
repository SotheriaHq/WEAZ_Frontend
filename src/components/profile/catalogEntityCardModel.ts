import type { CatalogEntityType } from '@/constants/catalogDomain';
import { resolveCatalogEntityType } from '@/utils/catalogEntity';

export type CatalogEntityCardBranch = 'design' | 'product' | 'collection' | 'legacy';

export const CATALOG_ENTITY_CARD_COPY: Record<
  CatalogEntityCardBranch,
  {
    badgeLabel: string;
    titleFallback: string;
    saveLabel: string;
    unsaveLabel: string;
    signInSaveMessage: string;
    commentPlaceholder: string;
    viewLabel: string;
    continueLabel: string;
    draftCountLabel: string;
    countSingular: string;
    countPlural: string;
    ownerActionsLabel: string;
    editLabel: string;
    deleteLabel: string;
    primaryActionKind: 'view-design' | 'view-product' | 'view-collection' | 'legacy-view';
  }
> = {
  design: {
    badgeLabel: 'Design',
    titleFallback: 'Untitled design',
    saveLabel: 'Save design',
    unsaveLabel: 'Unsave design',
    signInSaveMessage: 'Please sign in to save designs.',
    commentPlaceholder: 'Comment on this design...',
    viewLabel: 'View design',
    continueLabel: 'Continue Design',
    draftCountLabel: 'media uploaded',
    countSingular: 'media',
    countPlural: 'media',
    ownerActionsLabel: 'Design actions',
    editLabel: 'Edit design',
    deleteLabel: 'Delete design',
    primaryActionKind: 'view-design',
  },
  product: {
    badgeLabel: 'Product',
    titleFallback: 'Untitled product',
    saveLabel: 'Save product',
    unsaveLabel: 'Unsave product',
    signInSaveMessage: 'Please sign in to save products.',
    commentPlaceholder: 'Comment on this product...',
    viewLabel: 'View product',
    continueLabel: 'Continue Product',
    draftCountLabel: 'variants saved',
    countSingular: 'item',
    countPlural: 'items',
    ownerActionsLabel: 'Product actions',
    editLabel: 'Edit product',
    deleteLabel: 'Delete product',
    primaryActionKind: 'view-product',
  },
  collection: {
    badgeLabel: 'Collection',
    titleFallback: 'Untitled collection',
    saveLabel: 'Save collection',
    unsaveLabel: 'Unsave collection',
    signInSaveMessage: 'Please sign in to save collections.',
    commentPlaceholder: 'Comment on this collection...',
    viewLabel: 'View collection',
    continueLabel: 'Continue Collection',
    draftCountLabel: 'items grouped',
    countSingular: 'item',
    countPlural: 'items',
    ownerActionsLabel: 'Collection actions',
    editLabel: 'Edit collection',
    deleteLabel: 'Delete collection',
    primaryActionKind: 'view-collection',
  },
  legacy: {
    badgeLabel: 'Catalog item',
    titleFallback: 'Untitled item',
    saveLabel: 'Save item',
    unsaveLabel: 'Unsave item',
    signInSaveMessage: 'Please sign in to save this item.',
    commentPlaceholder: 'Add a comment...',
    viewLabel: 'View',
    continueLabel: 'Continue',
    draftCountLabel: 'items saved',
    countSingular: 'item',
    countPlural: 'items',
    ownerActionsLabel: 'Catalog item actions',
    editLabel: 'Edit',
    deleteLabel: 'Delete',
    primaryActionKind: 'legacy-view',
  },
};

export const resolveCatalogEntityCardBranch = (
  value: unknown,
  fallback?: CatalogEntityType | null,
): CatalogEntityCardBranch => {
  const entityType = resolveCatalogEntityType(value, fallback);
  if (entityType === 'DESIGN') return 'design';
  if (entityType === 'PRODUCT') return 'product';
  if (entityType === 'COLLECTION') return 'collection';
  return 'legacy';
};

export const getCatalogEntityCardCopy = (branch: CatalogEntityCardBranch) =>
  CATALOG_ENTITY_CARD_COPY[branch] ?? CATALOG_ENTITY_CARD_COPY.legacy;
