import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Share2, X } from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import type { SizeFitSharePolicy, SizeFitSharesPayload } from '@/types/sizeFit';

interface EndUserSizeFitQuickShareModalProps {
  open: boolean;
  saving: boolean;
  sharePolicy: SizeFitSharePolicy;
  shares: SizeFitSharesPayload | null;
  onClose: () => void;
  onShare: (payload: { targetUserId: string; canReshare?: boolean; note?: string }) => Promise<void>;
  onRespond: (shareId: string, decision: 'APPROVE' | 'REJECT' | 'REVOKE') => Promise<void>;
}

export const EndUserSizeFitQuickShareModal: React.FC<EndUserSizeFitQuickShareModalProps> = ({
  open,
  saving,
  sharePolicy,
  shares,
  onClose,
  onShare,
  onRespond,
}) => {
  const [shareTarget, setShareTarget] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [canReshare, setCanReshare] = useState(false);

  const incomingPending = useMemo(
    () => (Array.isArray(shares?.incoming) ? shares.incoming : []),
    [shares],
  );

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleShare = async () => {
    if (!shareTarget.trim()) return;
    await onShare({
      targetUserId: shareTarget.trim(),
      canReshare,
      note: shareNote.trim() || undefined,
    });
    setShareTarget('');
    setShareNote('');
    setCanReshare(false);
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close quick share modal"
        />

        <section className="relative z-10 w-full max-w-3xl rounded-3xl neu-modal-surface shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center h-9 w-9 rounded-xl neu-modal-inset focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[color:var(--neu-text-muted)]" aria-hidden="true" />
          </button>

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 pr-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white grid place-items-center">
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[color:var(--neu-text)]">Quick Share</h2>
                  <p className="text-xs text-[color:var(--neu-text-muted)]">
                    Share your size/fits profile fast. Requests are handled here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4 max-h-[calc(100vh-9rem)] overflow-y-auto scrollbar-hide">
            <div className="rounded-2xl neu-modal-inset p-4">
              <p className="text-xs uppercase tracking-wide font-semibold text-[color:var(--neu-text-muted)]">
                Share Rule
              </p>
              <p className="mt-1 text-sm text-[color:var(--neu-text)]">
                {sharePolicy === 'OWNER_ONLY'
                  ? 'Only you can share directly.'
                  : sharePolicy === 'REQUIRE_PERMISSION'
                    ? 'Re-shares require your approval.'
                    : 'People can re-share according to your policy.'}
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                <input
                  value={shareTarget}
                  onChange={(event) => setShareTarget(event.target.value)}
                  className="rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                  placeholder="Target user id"
                />
                <input
                  value={shareNote}
                  onChange={(event) => setShareNote(event.target.value)}
                  className="rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                  placeholder="Optional note"
                />
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={saving || !shareTarget.trim()}
                  className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Share
                </button>
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-sm text-[color:var(--neu-text)]">
                <input
                  type="checkbox"
                  checked={canReshare}
                  onChange={(event) => setCanReshare(event.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                Allow this recipient to re-share.
              </label>
            </div>

            <div className="rounded-2xl neu-modal-inset p-4">
              <p className="text-sm font-semibold text-[color:var(--neu-text)]">Incoming Share Requests</p>
              {incomingPending.length === 0 ? (
                <p className="text-xs text-[color:var(--neu-text-muted)] mt-2">No pending requests.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {incomingPending.map((entry: any) => (
                    <div
                      key={String(entry.id)}
                      className="rounded-lg neu-modal-inset p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[color:var(--neu-text)] truncate">
                          {(entry.viewer?.username as string) || String(entry.viewerId || 'Unknown user')}
                        </p>
                        <p className="text-[11px] text-[color:var(--neu-text-muted)]">
                          {(entry.note as string) || 'Requested access to re-share your fittings'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void onRespond(String(entry.id), 'APPROVE')}
                          className="rounded-md bg-emerald-600 text-white text-[11px] px-2 py-1"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRespond(String(entry.id), 'REJECT')}
                          className="rounded-md bg-rose-600 text-white text-[11px] px-2 py-1"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </OverlayPortal>
  );
};
