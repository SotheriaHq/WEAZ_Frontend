import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import AccessApi, { type AccessState } from '@/api/AccessApi';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'react-toastify';
import CollectionFlipbook, { type FlipbookMediaItem } from '@/components/collections/CollectionFlipbook';
import CollectionMetaPanel from '@/components/collections/CollectionMetaPanel';
import CollectionCommentsPanel from '@/components/collections/CollectionCommentsPanel';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { Trash2 } from 'lucide-react';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const me = useSelector((s: RootState) => s.user.profile);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setLocked(false);
      setDetail(null);
      try {
        const d = await brandApi.getCollectionDetail(id);
        if (!mounted) return;
        if (d) {
          setDetail(d);
        } else {
          setLocked(true);
        }
      } catch (e) {
        if (mounted) setLocked(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!id) return null;

  const isOwner = useMemo(() => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id), [me?.id, detail?.owner?.id]);

  // Shape media items for flipbook
  const mediaItems: FlipbookMediaItem[] = useMemo(() => {
    const medias = (detail?.medias ?? []) as Array<any>;
    return medias.map((m: any, idx: number) => {
      const file = m?.file; // file may contain s3Url/url
      const rawUrl = (file?.s3Url || file?.url || '') as string;
      const mime = (file?.mimeType || '') as string;
      const type: 'image' | 'video' = mime.startsWith('video') ? 'video' : 'image';
      return { id: m.id, url: rawUrl, type, fileId: file?.id, caption: m.caption ?? null, order: m.orderIndex ?? idx };
    });
  }, [detail?.medias]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeMediaId = mediaItems[activeIndex]?.id;

  const handleDeleteCollection = async () => {
    if (!id) return; if (!confirm('Delete this entire collection? This cannot be undone.')) return;
    try {
      const ok = await brandApi.deleteCollection(id);
      if (ok) {
        toast.success('Collection deleted');
        navigate('/profile');
      } else toast.error('Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleDeleteItem = async () => {
    if (!id || !activeMediaId) return; if (!confirm('Delete this item from the collection?')) return;
    try {
      const ok = await brandApi.deleteCollectionItem(id, activeMediaId);
      if (ok) {
        toast.success('Item deleted');
        const d = await brandApi.getCollectionDetail(id);
        setDetail(d);
        setActiveIndex(0);
      } else toast.error('Failed to delete item');
    } catch { toast.error('Failed to delete item'); }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse h-10 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8 h-[640px] rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
          <div className="col-span-12 md:col-span-4 space-y-4">
            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
            <div className="h-48 rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass-panel border border-white/20 bg-white/10 px-6 py-8 backdrop-blur-xl text-white">
          <h1 className="text-xl font-bold mb-2">This collection is private</h1>
          <p className="text-sm text-white/80 mb-4">Request access from the owner to view and interact.</p>
          {requestState === 'PENDING' ? (
            <div className="text-sm text-white/80">Access request pending approval.</div>
          ) : requestState === 'APPROVED' ? (
            <div className="text-sm text-emerald-300">Access approved. Reloading…</div>
          ) : (
            <FrostedButton
              variant="primary"
              onClick={async () => {
                try {
                  const res = await AccessApi.requestAccess(id);
                  setRequestState(res.state);
                  if (res.state === 'APPROVED') {
                    toast.success('Access approved');
                    // refetch details immediately
                    const d = await brandApi.getCollectionDetail(id);
                    setDetail(d);
                    setLocked(!d);
                  } else {
                    toast.info('Request sent');
                  }
                } catch (e) {
                  toast.error('Unable to request access');
                }
              }}
            >
              Request Access
            </FrostedButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Row */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-xs px-2 py-1 rounded bg-white/70 dark:bg-white/5 border border-white/20">Back</button>
          <h1 className="text-xl font-semibold tracking-tight">{detail?.title || 'Collection'}</h1>
          {isOwner && (
            <button onClick={handleDeleteCollection} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 border border-red-300/50 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/40"><Trash2 className="w-3 h-3"/> Delete</button>
          )}
        </div>
        <div className="text-[11px] text-gray-500">ID: {id}</div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Flipbook */}
        <div className="col-span-12 md:col-span-8">
          <CollectionFlipbook
            items={mediaItems}
            initialIndex={0}
            onFlip={(i) => setActiveIndex(i)}
            height={640}
            className="mb-8"
          />
          {isOwner && mediaItems.length > 0 && (
            <div className="flex justify-end mb-8">
              <button onClick={handleDeleteItem} className="text-xs px-3 py-1.5 rounded border border-red-300/60 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-600/40 dark:text-red-300">Delete Current Item</button>
            </div>
          )}
          <div className="mt-4">
            <CollectionCommentsPanel collectionId={id!} activeMediaId={activeMediaId} />
          </div>
        </div>

        {/* Meta Sidebar */}
        <div className="col-span-12 md:col-span-4 space-y-6">
            <CollectionMetaPanel
              title={detail?.title || 'Collection'}
              description={detail?.description}
              tags={detail?.tags || []}
              owner={{ id: detail?.owner?.id, name: detail?.owner?.brandFullName || detail?.owner?.username, username: detail?.owner?.username, avatarUrl: detail?.owner?.profileImage }}
              stats={{ likes: detail?.totalLikes, comments: detail?._count?.comments, items: detail?._count?.medias, views: detail?._count?.views }}
              price={{ min: detail?.minPrice, max: detail?.maxPrice }}
              availabilityInStore={detail?.isAvailableInStore}
              visibility={detail?.visibility}
              isOwner={isOwner}
              onEdit={() => toast.info('Edit collection coming soon')}
              onDelete={handleDeleteCollection}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>Flipping through this catalog lets visitors appreciate each piece individually. Comments update live.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionView;
