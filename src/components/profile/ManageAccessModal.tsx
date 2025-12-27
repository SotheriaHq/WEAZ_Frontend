import React, { useCallback, useEffect, useState } from 'react';
import AccessApi from '@/api/AccessApi';
import FrostedButton from '@/components/ui/FrostedButton';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Manage Access</h2>
          <FrostedButton variant="ghost" onClick={onClose}>Close</FrostedButton>
        </div>

        {loading ? (
          <div className="text-white/80">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-semibold text-white/80 mb-2">Pending Requests</h3>
              <div className="space-y-2">
                {pending.length === 0 && (
                  <div className="text-white/60 text-sm">No pending requests</div>
                )}
                {pending.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-white/20" />
                      <span className="text-white text-sm">{r.viewer.username || r.viewer.id.slice(0, 6)}</span>
                    </div>
                    <div className="flex gap-2">
                      <FrostedButton size="sm" variant="primary" onClick={() => void handleApprove(r.viewer.id)} disabled={busy}>Approve</FrostedButton>
                      <FrostedButton size="sm" variant="outline" className="text-red-300 hover:text-red-200 border-red-400/40 hover:border-red-400" onClick={() => void handleRevoke(r.viewer.id)} disabled={busy}>Reject</FrostedButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-white/80 mb-2">Approved Viewers</h3>
              <div className="space-y-2">
                {approved.length === 0 && (
                  <div className="text-white/60 text-sm">No approved viewers</div>
                )}
                {approved.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-white/20" />
                      <span className="text-white text-sm">{r.viewer.username || r.viewer.id.slice(0, 6)}</span>
                    </div>
                    <div className="flex gap-2">
                      <FrostedButton size="sm" variant="ghost" onClick={() => void handleRevoke(r.viewer.id)} disabled={busy}>Revoke</FrostedButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="md:col-span-2">
              <h3 className="text-sm font-semibold text-white/80 mb-2">Invite Link (shareable)</h3>
              <div className="flex items-center gap-2">
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
                    className="flex-1 rounded-md bg-white/10 border border-white/20 px-2 py-1 text-xs text-white"
                    readOnly
                    value={`${window.location.origin}/collections/invite?token=${inviteToken}`}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-white/60">Anyone with this link can accept the invite and gain access until it expires.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAccessModal;


