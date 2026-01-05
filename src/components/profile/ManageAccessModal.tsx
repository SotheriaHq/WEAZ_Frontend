import React, { useCallback, useEffect, useState } from 'react';
import AccessApi from '@/api/AccessApi';
import FrostedButton from '@/components/ui/FrostedButton';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type Viewer = { id: string; username?: string | null; profileImage?: string | null };
type Row = { id: string; viewer: Viewer };

interface Props {
  open: boolean;
  collectionId: string;
  onClose: () => void;
}

const ManageAccessModal: React.FC<Props> = ({ open, collectionId, onClose }) => {
  const [pending, setPending] = useState<Row[]>([]);
  const [approved, setApproved] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        AccessApi.listRequests(collectionId, undefined, 50),
        AccessApi.listApproved(collectionId, undefined, 50),
      ]);
      setPending(p.items ?? []);
      setApproved(a.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  // Scroll locking
  useEffect(() => {
    if (!open) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [open]);

  const handleApprove = async (userId: string) => {
    setBusy(true);
    try {
      await AccessApi.update(collectionId, userId, 'APPROVED');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    setBusy(true);
    try {
      await AccessApi.revoke(collectionId, userId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Manage access"
            tabIndex={-1}
            className="glass-panel relative flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-white/10 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Manage Access</h2>
                <FrostedButton data-initial-focus="true" variant="ghost" onClick={onClose}>
                  Close
                </FrostedButton>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar px-6 py-5">
              {loading ? (
                <div className="text-white/80">Loading…</div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-white/80">Pending Requests</h3>
                    <div className="space-y-2">
                      {pending.length === 0 && (
                        <div className="text-sm text-white/60">No pending requests</div>
                      )}
                      {pending.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-white/20" />
                            <span className="text-sm text-white">
                              {r.viewer.username || r.viewer.id.slice(0, 6)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <FrostedButton
                              size="sm"
                              variant="primary"
                              onClick={() => void handleApprove(r.viewer.id)}
                              disabled={busy}
                            >
                              Approve
                            </FrostedButton>
                            <FrostedButton
                              size="sm"
                              variant="outline"
                              className="border-red-400/40 text-red-300 hover:border-red-400 hover:text-red-200"
                              onClick={() => void handleRevoke(r.viewer.id)}
                              disabled={busy}
                            >
                              Reject
                            </FrostedButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-white/80">Approved Viewers</h3>
                    <div className="space-y-2">
                      {approved.length === 0 && (
                        <div className="text-sm text-white/60">No approved viewers</div>
                      )}
                      {approved.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-white/20" />
                            <span className="text-sm text-white">
                              {r.viewer.username || r.viewer.id.slice(0, 6)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <FrostedButton
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleRevoke(r.viewer.id)}
                              disabled={busy}
                            >
                              Revoke
                            </FrostedButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="md:col-span-2">
                    <h3 className="mb-2 text-sm font-semibold text-white/80">Invite Link (shareable)</h3>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <FrostedButton
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setInviteBusy(true);
                          try {
                            const res = await AccessApi.createInviteLink(collectionId, 86400);
                            setInviteToken(res.token);
                          } finally {
                            setInviteBusy(false);
                          }
                        }}
                        disabled={inviteBusy}
                      >
                        {inviteBusy ? 'Generating…' : 'Generate Invite Link'}
                      </FrostedButton>
                      {inviteToken && (
                        <input
                          className="w-full flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
                          readOnly
                          value={`${window.location.origin}/collections/invite?token=${inviteToken}`}
                        />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-white/60">
                      Anyone with this link can accept the invite and gain access until it expires.
                    </p>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ManageAccessModal;


