import React from 'react';
import type { CatalogEntityType } from '@/constants/catalogDomain';
import CollectionCard, { type CollectionCardProps } from './CollectionCard';
import DesignCard from './DesignCard';
import { resolveCatalogEntityCardBranch } from './catalogEntityCardModel';

export type CatalogEntityCardProps = Omit<CollectionCardProps, 'cardKind'> & {
  fallbackEntityType?: CatalogEntityType | null;
};

const CatalogEntityCard: React.FC<CatalogEntityCardProps> = ({
  collection,
  fallbackEntityType,
  ...props
}) => {
  const fallback = fallbackEntityType ?? (collection.isAvailableInStore ? 'COLLECTION' : 'DESIGN');
  const branch = resolveCatalogEntityCardBranch(collection, fallback);

  if (branch === 'collection') {
    return (
      <CollectionCard
        {...props}
        collection={{ ...collection, entityType: 'COLLECTION' }}
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
        collection={{ ...collection, entityType: 'COLLECTION' }}
        cardKind="collection"
      />
    );
  }

  return (
    <DesignCard
      {...props}
      collection={{ ...collection, entityType: 'DESIGN' }}
    />
  );
};

export default React.memo(CatalogEntityCard);
