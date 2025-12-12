import React from 'react';
import Masonry from 'react-masonry-css';
import type { CollectionDto } from '../../types/profile';
import CollectionCard from './CollectionCard';

interface CollectionsGridProps {
  collections: CollectionDto[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCollectionClick?: (id: string) => void;
  isDraft?: boolean;
  onRetryPublish?: (id: string) => void;
}

const CollectionsGrid: React.FC<CollectionsGridProps> = ({ 
  collections, 
  onEdit, 
  onDelete,
  onCollectionClick,
  isDraft,
  onRetryPublish,
}) => {
  const breakpointColumns = {
    default: 4,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1,
  };

  if (!collections || collections.length === 0) {
    return <div className="text-center text-gray-500">No collections yet</div>;
  }

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="flex -ml-6 w-auto"
      columnClassName="pl-6 space-y-6 bg-clip-padding"
    >
      {collections.map((collection) => (
        <div key={collection.id} className="w-full">
          <CollectionCard 
            collection={collection}
            onClick={() => onCollectionClick?.(collection.id)}
            onEdit={onEdit} 
            onDelete={onDelete}
            isDraft={isDraft}
            onRetryPublish={onRetryPublish}
          />
        </div>
      ))}
    </Masonry>
  );
};

export default CollectionsGrid;
