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

        <section className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/40 dark:border-white/10 bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95 shadow-2xl overflow-hidden">
          <header className="p-5 border-b border-gray-200/70 dark:border-white/10 bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white grid place-items-center">
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Share</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Share your size/fits profile fast. Requests are handled here.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-500" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="p-5 space-y-4 max-h-[calc(100vh-11rem)] overflow-y-auto scrollbar-hide">
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                Share Rule
              </p>
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
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
                  className="rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder="Target user id"
                />
                <input
                  value={shareNote}
                  onChange={(event) => setShareNote(event.target.value)}
                  className="rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/85 dark:bg-black/20 px-3 py-2 text-sm text-gray-900 dark:text-white"
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

              <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={canReshare}
                  onChange={(event) => setCanReshare(event.target.checked)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                Allow this recipient to re-share.
              </label>
            </div>

            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Incoming Share Requests</p>
              {incomingPending.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No pending requests.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {incomingPending.map((entry: any) => (
                    <div
                      key={String(entry.id)}
                      className="rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-black/20 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {(entry.viewer?.username as string) || String(entry.viewerId || 'Unknown user')}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
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
