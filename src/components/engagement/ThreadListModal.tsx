import React, { useEffect, useRef, useState } from 'react';
import { ReactionsApi } from '@/api/ReactionsApi';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Props = { open: boolean; onClose: () => void; contentId: string; contentType: 'COLLECTION' | 'COLLECTION_MEDIA' };

const ThreadListModal: React.FC<Props> = ({ open, onClose, contentId, contentType }) => {
  const [rows, setRows] = useState<Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    onEscape: onClose,
  });

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
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Threads">
        <div className="fixed inset-0 z-layer-overlay bg-black/40" onClick={onClose} />
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="glass-panel neu-modal-surface relative w-full max-w-md p-4 rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Threads</h3>
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
    </OverlayPortal>
  );
};

export default ThreadListModal;
