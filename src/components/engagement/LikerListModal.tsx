import React, { useEffect, useState } from 'react';
import { ReactionsApi } from '@/api/ReactionsApi';

type Props = { open: boolean; onClose: () => void; contentId: string; contentType: 'COLLECTION' | 'COLLECTION_MEDIA' };

const LikerListModal: React.FC<Props> = ({ open, onClose, contentId, contentType }) => {
  const [rows, setRows] = useState<Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (contentType === 'COLLECTION') {
          const res = await ReactionsApi.getCollectionReactions(contentId, limit);
          setRows(res.users);
        } else {
          const res = await ReactionsApi.getCollectionMediaReactions(contentId, limit);
          setRows(res.users);
        }
      } finally {
        setLoading(false);
      }
    };
    if (open) void load();
  }, [open, contentId, contentType, limit]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="glass-panel w-full max-w-md p-4 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Likes</h3>
          <button onClick={onClose} className="btn-frost-ghost btn-tight-xs">Close</button>
        </div>
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {rows.map((u) => (
            <li key={u.id} className="text-sm text-gray-800 dark:text-gray-200">
              {u.username || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.id}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end gap-2">
          <button disabled={loading} className="btn-frost-outline btn-tight-xs" onClick={() => setLimit((l) => l + 20)}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LikerListModal;
