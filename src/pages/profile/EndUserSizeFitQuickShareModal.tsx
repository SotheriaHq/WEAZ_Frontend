import React, { useEffect, useMemo, useState, useRef } from 'react';
import VLoader from '@/components/loaders/VLoader';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import type { SizeFitShareDto, SizeFitSharePolicy, SizeFitSharesPayload } from '@/types/sizeFit';
import SearchApi from '@/api/SearchApi';
import type { SearchItem } from '@/types/search';
import { motion } from 'framer-motion';

interface EndUserSizeFitQuickShareModalProps {
  open: boolean;
  saving: boolean;
  sharePolicy: SizeFitSharePolicy;
  shares: SizeFitSharesPayload | null;
  onClose: () => void;
  onShare: (payload: SizeFitShareDto) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<'share' | 'incoming'>('share');

  // Autocomplete suggestion states
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  // Click outside suggestions dropdown listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced real-time profile search
  useEffect(() => {
    const trimmed = shareTarget.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestionsDropdown(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSuggestLoading(true);
      SearchApi.search({ q: trimmed, type: 'profile', limit: 8 }, controller.signal)
        .then((res) => {
          if (res?.items) {
            setSuggestions(res.items);
            setShowSuggestionsDropdown(res.items.length > 0);
          }
        })
        .catch(() => {})
        .finally(() => {
          setSuggestLoading(false);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [shareTarget]);

  if (!open) return null;

  const handleShare = async () => {
    if (!shareTarget.trim()) return;
    await onShare({
      targetUserIdentifier: shareTarget.trim(),
      canReshare,
      note: shareNote.trim() || undefined,
    });
    setShareTarget('');
    setShareNote('');
    setCanReshare(false);
    setShowSuggestionsDropdown(false);
  };

  const handleSelectSuggestion = (username: string) => {
    setShareTarget(username);
    setShowSuggestionsDropdown(false);
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-2 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close quick share modal"
        />

        <section className="relative z-10 w-full max-w-2xl rounded-3xl neu-modal-surface shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[min(88vh,720px)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center h-9 w-9 rounded-xl neu-modal-inset focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-[color:var(--neu-text-muted)]">✕</span>
          </button>

          <div className="p-5 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 pr-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white grid place-items-center text-base" aria-hidden="true">
                  📤
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

          {/* Premium tabs system with active bottom borders using Framer Motion (no shaking) */}
          <div className="mx-5 mb-4 flex border-b border-gray-100 dark:border-white/10 relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`relative px-4 pb-2 text-xs font-bold transition-colors focus:outline-none ${
                activeTab === 'share'
                  ? 'text-fuchsia-600 dark:text-fuchsia-400'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <span className="relative z-10">Share Settings & Send</span>
              {activeTab === 'share' ? (
                <motion.div
                  layoutId="activeShareTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-fuchsia-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('incoming')}
              className={`relative px-4 pb-2 text-xs font-bold transition-colors focus:outline-none flex items-center gap-1.5 ${
                activeTab === 'incoming'
                  ? 'text-fuchsia-600 dark:text-fuchsia-400'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <span className="relative z-10">Incoming Requests</span>
              {incomingPending.length > 0 ? (
                <span className="relative z-10 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-fuchsia-500 text-[10px] font-black text-white">
                  {incomingPending.length}
                </span>
              ) : null}
              {activeTab === 'incoming' ? (
                <motion.div
                  layoutId="activeShareTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-fuchsia-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4 flex-1 overflow-y-auto scrollbar-hide">
            {activeTab === 'share' ? (
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

                <div className="mt-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div ref={dropdownRef} className="relative">
                      <input
                        value={shareTarget}
                        onChange={(event) => setShareTarget(event.target.value)}
                        className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-1 focus:ring-fuchsia-400/40"
                        placeholder="Username or email"
                      />
                      
                      {/* Real-time search suggestions dropdown */}
                      {showSuggestionsDropdown && suggestions.length > 0 ? (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                          {suggestions.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => handleSelectSuggestion(item.subtitle || item.title)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                              <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/10">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center font-bold text-[10px] text-gray-400">
                                    {item.title.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">
                                  {item.title}
                                </p>
                                {item.subtitle ? (
                                  <p className="text-[10px] text-gray-500 truncate">
                                    @{item.subtitle}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {suggestLoading ? (
                        <div className="absolute right-2 top-2.5">
                          <VLoader size={14} phase="loading" showLabel={false} />
                        </div>
                      ) : null}
                    </div>

                    <input
                      value={shareNote}
                      onChange={(event) => setShareNote(event.target.value)}
                      className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)]"
                      placeholder="Optional note"
                    />
                  </div>

                  {/* Allow re-share toggle comes BEFORE the button */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm text-[color:var(--neu-text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canReshare}
                        onChange={(event) => setCanReshare(event.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                      />
                      Allow this recipient to re-share.
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      disabled={saving || !shareTarget.trim()}
                      className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold px-4.5 py-2 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition"
                    >
                      {saving ? <VLoader size={16} phase="loading" showLabel={false} /> : null}
                      Share fittings
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl neu-modal-inset p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-[color:var(--neu-text-muted)]">
                  Incoming Share Requests
                </p>
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
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void onRespond(String(entry.id), 'APPROVE')}
                            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 py-1 font-medium transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void onRespond(String(entry.id), 'REJECT')}
                            className="rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] px-2 py-1 font-medium transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </OverlayPortal>
  );
};

export default EndUserSizeFitQuickShareModal;
