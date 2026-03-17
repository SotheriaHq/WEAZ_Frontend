import React, { useEffect, useMemo, useState } from 'react';
import Masonry from 'react-masonry-css';
import type { CollectionDto } from '../../types/profile';
import CollectionCard from './CollectionCard';
import { useSelector } from 'react-redux';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';

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
}

const CollectionsGrid: React.FC<CollectionsGridProps> = ({ 
  collections, 
  onEdit, 
  onDelete,
  onRestore,
  onPermanentDelete,
  onCollectionClick,
  isDraft,
  isDeleted,
  onRetryPublish,
}) => {
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const collectionIds = useMemo(
    () => (collections ?? []).map((c) => c.id).filter(Boolean),
    [collections]
  );

  const collectionIdsKey = useMemo(
    () => collectionIds.join('|'),
    [collectionIds],
  );

  useEffect(() => {
    let mounted = true;
    const loadSaved = async () => {
      if (!isAuth || collectionIds.length === 0) {
        if (mounted) setSavedMap({});
        return;
      }
      try {
        const res = await apiClient.post('/saved/check/batch', {
          targetType: 'COLLECTION',
          targetIds: collectionIds,
        });
        const items = res.data?.items ?? [];
        if (mounted) {
          const next: Record<string, boolean> = {};
          for (const item of items) {
            if (item?.targetId) next[item.targetId] = Boolean(item.isSaved);
          }
          setSavedMap(next);
        }
      } catch {
        if (mounted) setSavedMap({});
      }
    };
    void loadSaved();
    return () => { mounted = false; };
  }, [collectionIds, collectionIdsKey, isAuth]);

  const handleToggleSave = async (collectionId: string) => {
    if (!isAuth) {
      toast.info('Please sign in to save collections.');
      return;
    }
    if (savingIds.has(collectionId)) return;
    try {
      setSavingIds((prev) => new Set(prev).add(collectionId));
      const isSaved = Boolean(savedMap[collectionId]);
      if (isSaved) {
        await apiClient.delete('/saved', { data: { targetType: 'COLLECTION', targetId: collectionId } });
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION', targetId: collectionId });
      }
      setSavedMap((prev) => ({ ...prev, [collectionId]: !isSaved }));
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
          <CollectionCard 
            collection={collection}
            onClick={() => onCollectionClick?.(collection.id)}
            onEdit={onEdit} 
            onDelete={onDelete}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            isDraft={isDraft}
            isDeleted={isDeleted}
            onRetryPublish={onRetryPublish}
            isSaved={savedMap[collection.id] ?? false}
            onToggleSave={handleToggleSave}
            saveBusy={savingIds.has(collection.id)}
          />
        </div>
      ))}
    </Masonry>
  );
};

export default CollectionsGrid;
