import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type MissingField = 'name' | 'description' | 'tags' | 'logo' | 'banner' | string;

export interface StoreSetupRequiredGateProps {
  open: boolean;
  missingFields: MissingField[];
  tagsSelectedCount?: number;
  onGoBack?: () => void;
  onCompleteSetup?: () => void;
}

const REQUIRED_ORDER: Array<{ key: MissingField; label: string; critical?: boolean }> = [
  { key: 'name', label: 'Store Name' },
  { key: 'description', label: 'Description' },
  { key: 'tags', label: 'Tags' },
  { key: 'logo', label: 'Logo' },
  { key: 'banner', label: 'Banner', critical: true },
];

const StoreSetupRequiredGate: React.FC<StoreSetupRequiredGateProps> = ({
  open,
  missingFields,
  tagsSelectedCount,
  onGoBack,
  onCompleteSetup,
}) => {
  const navigate = useNavigate();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      restoreFocusRef.current = null;
    };
  }, [open]);

  const missing = useMemo(() => new Set((missingFields || []).map((f) => String(f).toLowerCase())), [missingFields]);

  if (!open) return null;

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    navigate(-1);
  };

  const handleCompleteSetup = () => {
    if (onCompleteSetup) {
      onCompleteSetup();
      return;
    }
    navigate('/store/essentials');
  };

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: handleGoBack,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
        {/* Overlay (strong separation; blocks background interaction) */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

        {/* Modal shell (centers; panel height never exceeds viewport) */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-setup-required-title"
            aria-describedby="store-setup-required-desc"
            tabIndex={-1}
            className="relative flex w-full max-w-[640px] max-h-[90vh] flex-col overflow-hidden overscroll-contain rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl outline-none"
          >
            {/* Header (always visible) */}
            <div className="shrink-0 border-b border-white/5 px-6 py-5 text-center">
              <div className="relative mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <div className="absolute inset-0 rounded-full bg-purple-500/25 blur-xl" aria-hidden="true" />
                <span className="relative text-xl" aria-hidden="true">
                  🏪
                </span>
                <div
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black/60 bg-amber-500"
                  aria-hidden="true"
                >
                  <span className="text-[10px]">⚠️</span>
                </div>
              </div>

              <h2
                id="store-setup-required-title"
                className="font-serif text-2xl font-bold tracking-wide text-white md:text-3xl"
              >
                Finish setting up your store
              </h2>
              <p
                id="store-setup-required-desc"
                className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/60"
              >
                Complete these essentials to publish and access your store functionality.
              </p>
            </div>

            {/* Body (only scroll container) */}
            <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar p-4 md:p-6">
              <div className="space-y-3">
              {REQUIRED_ORDER.map((item) => {
                const isMissing = missing.has(String(item.key).toLowerCase());
                const isCritical = Boolean(item.critical);

                const rowBase =
                  'group flex items-center justify-between rounded-xl border bg-white/[0.02] p-3 transition-colors';
                const rowClass = isMissing
                  ? isCritical
                    ? 'border-purple-500/25 bg-purple-500/[0.06] hover:border-purple-500/40'
                    : 'border-white/5 hover:border-purple-500/30'
                  : 'border-white/5 cursor-default';

                return (
                  <div
                    key={String(item.key)}
                    className={`${rowBase} ${rowClass} ${isMissing ? 'cursor-pointer' : ''}`}
                    onClick={isMissing ? handleCompleteSetup : undefined}
                    role={isMissing ? 'button' : undefined}
                    tabIndex={isMissing ? 0 : -1}
                  >
                    <div className="flex items-center gap-4">
                      {isMissing ? (
                        <div
                          className={
                            isCritical
                              ? 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-purple-400/60 text-purple-300'
                              : 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/30 text-white/60 group-hover:border-purple-400/60 group-hover:text-purple-300'
                          }
                        >
                          {isCritical ? (
                            <span className="text-xs" aria-hidden="true">
                              ⚠️
                            </span>
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-transparent group-hover:bg-purple-400" />
                          )}
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-300">
                          <span className="text-sm" aria-hidden="true">
                            ✅
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col">
                        <span className="font-medium text-white">{item.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isMissing ? (
                        <span className="rounded bg-white/5 px-2 py-1 text-xs font-medium text-white/50">
                          Complete
                        </span>
                      ) : item.key === 'tags' ? (
                        <>
                          <span className="rounded border border-amber-900/30 bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-200">
                            {(tagsSelectedCount ?? 0) === 0
                              ? '0 selected'
                              : `${tagsSelectedCount} selected`}
                          </span>
                          <span className="text-white/30 group-hover:text-purple-300" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : isCritical ? (
                        <>
                          <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-200">
                            Required
                          </span>
                          <span className="text-white/30 group-hover:text-purple-300" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : (
                        <span className="text-white/30 group-hover:text-purple-300" aria-hidden="true">
                          →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Footer (always visible) */}
            <div className="shrink-0 border-t border-white/5 bg-black/20 px-6 pb-6 pt-3">
              <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-purple-200/70">
                <span aria-hidden="true">🙈</span>
                Your store won't be visible publicly until published.
              </p>

              <div className="flex w-full flex-col-reverse gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={handleGoBack}
                  data-initial-focus="true"
                  className="flex-1 rounded-lg border border-white/10 px-5 py-2.5 font-medium text-white transition-colors hover:bg-white/5 active:scale-[0.98]"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  className="group flex-[2] rounded-lg bg-gradient-to-r from-purple-700 to-purple-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:from-purple-600 hover:to-purple-500 active:scale-[0.98]"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    Complete Store Setup
                    <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                      →
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  className="text-xs text-white/40 underline underline-offset-4 transition-colors hover:text-purple-300"
                >
                  Learn why this is required
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default StoreSetupRequiredGate;
