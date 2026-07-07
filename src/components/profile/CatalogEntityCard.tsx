import React from 'react';
import type { CatalogEntityType } from '@/constants/catalogDomain';
import CollectionCard, { type CollectionCardProps } from './CollectionCard';
import DesignCard from './DesignCard';
import { resolveCatalogEntityCardBranch } from './catalogEntityCardModel';

export type CatalogEntityCardProps = Omit<CollectionCardProps, 'cardKind'> & {
  fallbackEntityType?: CatalogEntityType | null;
  compact?: boolean;
};

const CatalogEntityCard: React.FC<CatalogEntityCardProps> = ({
  collection,
  fallbackEntityType,
  compact,
  ...props
}) => {
  const fallback = fallbackEntityType ?? (collection.isAvailableInStore ? 'COLLECTION' : 'DESIGN');
  const branch = resolveCatalogEntityCardBranch(collection, fallback);

  if (branch === 'collection') {
    return (
      <CollectionCard
        {...props}
        collection={collection}
        compact={compact}
        cardKind="collection"
      />
    );
  }

  if (branch === 'product') {
    // Product rows should normally render through StoreProductCard/ProductCard. If a legacy
    // product-shaped row reaches this collection-backed surface, preserve the compatible
    // collection rendering instead of guessing a product payload shape.
    return (
      <CollectionCard
        {...props}
        collection={collection}
        compact={compact}
        cardKind="collection"
      />
    );
  }

  return (
    <DesignCard
      {...props}
      collection={collection}
      compact={compact}
    />
  );
};

export default React.memo(CatalogEntityCard);
