import React, { useEffect, useMemo, useState } from 'react';
import Masonry from 'react-masonry-css';
import type { CollectionDto } from '../../types/profile';
import CatalogEntityCard from './CatalogEntityCard';
import { useSelector } from 'react-redux';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { resolveCatalogEntityType } from '@/utils/catalogEntity';
import { mapCatalogTargetForLegacyApi } from '@/utils/catalogTarget';
import { useQueryClient } from '@tanstack/react-query';
import { useSavedBatchStatusQuery } from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';

interface CollectionsGridProps {
  collections: CollectionDto[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onCollectionClick?: (id: string) => void;
  isDraft?: boolean;
  isDeleted?: boolean;
  onRetryPublish?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const areSavedMapsEqual = (left: Record<string, boolean>, right: Record<string, boolean>) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const CollectionsGridComponent: React.FC<CollectionsGridProps> = ({
  collections,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onCollectionClick,
  isDraft,
  isDeleted,
  onRetryPublish,
  onDismiss,
}) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const queryClient = useQueryClient();
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const collectionIds = useMemo(
    () => (collections ?? []).map((c) => c.id).filter(Boolean),
    [collections]
  );
  const collectionById = useMemo(
    () => new Map((collections ?? []).map((collection) => [collection.id, collection])),
    [collections],
  );

  const collectionIdsKey = useMemo(
    () => collectionIds.join('|'),
    [collectionIds],
  );

  const savedStatusQuery = useSavedBatchStatusQuery('COLLECTION', collectionIds, {
    enabled: isAuth && collectionIds.length > 0,
  });

  useEffect(() => {
    if (!isAuth || collectionIds.length === 0) {
      setSavedMap((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    if (savedStatusQuery.data) {
      setSavedMap((current) =>
        areSavedMapsEqual(current, savedStatusQuery.data) ? current : savedStatusQuery.data,
      );
    }
  }, [collectionIds.length, collectionIdsKey, isAuth, savedStatusQuery.data]);

  const handleToggleSave = async (collectionId: string) => {
    if (!isAuth) {
      toast.info('Please sign in to save collections.');
      return;
    }
    if (savingIds.has(collectionId)) return;
    try {
      setSavingIds((prev) => new Set(prev).add(collectionId));
      const isSaved = Boolean(savedMap[collectionId]);
      const collection = collectionById.get(collectionId);
      const entityType = resolveCatalogEntityType(
        collection,
        collection?.isAvailableInStore ? 'COLLECTION' : 'DESIGN',
      ) ?? 'DESIGN';
      const savedTarget = mapCatalogTargetForLegacyApi({
        targetType: entityType,
        targetId: collectionId,
        designId: entityType === 'DESIGN' ? collectionId : undefined,
        collectionId,
        legacyCollectionId: entityType === 'DESIGN' ? collectionId : undefined,
      });
      if (isSaved) {
        await apiClient.delete('/saved', { data: savedTarget });
      } else {
        await apiClient.post('/saved', savedTarget);
      }
      setSavedMap((prev) => ({ ...prev, [collectionId]: !isSaved }));
      queryClient.setQueryData<Record<string, boolean>>(
        queryKeys.saved.batch('COLLECTION', collectionIds),
        (current) => ({ ...(current ?? {}), [collectionId]: !isSaved }),
      );
      toast.success(isSaved ? 'Removed from saved.' : 'Saved for later.');
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });
    }
  };
  const breakpointColumns = {
    default: 4,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1,
  };

  if (!collections || collections.length === 0) {
    return <div className="text-center text-gray-500">No designs yet</div>;
  }

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="flex -ml-6 w-auto"
      columnClassName="pl-6 space-y-6 bg-clip-padding"
    >
      {collections.map((collection) => (
        <div key={collection.id} className="w-full">
          <CatalogEntityCard
            collection={collection}
            onClick={() => onCollectionClick?.(collection.id)}
            onEdit={onEdit} 
            onDelete={onDelete}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            isDraft={isDraft}
            isDeleted={isDeleted}
            onRetryPublish={onRetryPublish}
            onDismiss={onDismiss}
            isSaved={savedMap[collection.id] ?? false}
            onToggleSave={handleToggleSave}
            saveBusy={savingIds.has(collection.id)}
          />
        </div>
      ))}
    </Masonry>
  );
};

export default React.memo(CollectionsGridComponent);
