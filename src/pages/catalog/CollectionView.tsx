import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CommentThread from '@/components/comments/CommentThread';
import { brandApi } from '@/api/BrandApi';
import AccessApi from '@/api/AccessApi';
import type { AccessState } from '@/api/AccessApi';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'react-toastify';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-sm text-gray-500">Loading collection…</div>
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{detail?.title || 'Collection'}</h1>
        <p className="text-gray-500">ID: {id}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div className="col-span-full text-sm text-gray-500">Items will appear here.</div>
      </div>

      {id && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Comments</h2>
          <CommentThread targetType="COLLECTION" targetId={id} />
        </section>
      )}
    </div>
  );
};

export default CollectionView;
