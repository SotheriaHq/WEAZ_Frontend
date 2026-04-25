import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const handleGoBack = useCallback(() => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    navigate(-1);
  }, [onGoBack, navigate]);

  const handleCompleteSetup = useCallback(() => {
    if (onCompleteSetup) {
      onCompleteSetup();
      return;
    }
    navigate('/studio/store/essentials');
  }, [onCompleteSetup, navigate]);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: handleGoBack,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
        {/* Overlay backdrop: strong separation, blocks background interaction */}
        {/* Overlay backdrop: strong separation, adapts to theme */}
        <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md" aria-hidden="true" />

        {/* Modal shell: centered, viewport-aware, content-driven height */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-setup-required-title"
            aria-describedby="store-setup-required-desc"
            tabIndex={-1}
            className="relative flex w-full max-w-[580px] max-h-[85vh] flex-col rounded-2xl border border-gray-100 dark:border-white/15 bg-white/95 dark:bg-[#1a1a1a]/95 shadow-2xl backdrop-blur-xl outline-none"
          >
            {/* Header: compact, content-driven, theme-aware */}
            <div className="shrink-0 border-b border-gray-100 dark:border-white/10 px-5 py-4 text-center">
              <div className="relative mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-white/10">
                <div className="absolute inset-0 rounded-full bg-purple-500/25 blur-xl" aria-hidden="true" />
                <span className="relative text-xl" aria-hidden="true">
                  🏪
                </span>
                <div
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white dark:border-black/60 bg-amber-500"
                  aria-hidden="true"
                >
                  <span className="text-[10px]">⚠️</span>
                </div>
              </div>

              {/* Close Button (X) - Top Right */}
              <button
                type="button"
                onClick={handleGoBack}
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close modal"
              >
                <span className="text-xl" aria-hidden="true">
                  ×
                </span>
              </button>

              <h2
                id="store-setup-required-title"
                className="font-serif text-xl font-bold tracking-wide text-gray-900 dark:text-white sm:text-2xl"
              >
                Finish setting up your store
              </h2>
              <p
                id="store-setup-required-desc"
                className="mx-auto mt-1.5 max-w-sm text-sm leading-snug text-gray-500 dark:text-white/70"
              >
                Complete these essentials to publish and access your store functionality.
              </p>
            </div>

            {/* Body: content-driven, scrolls only when viewport constrained */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              
              {/* Compact Visibility Warning */}
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-center text-xs text-orange-800 dark:bg-purple-900/20 dark:text-purple-200">
                <span className="text-sm">🙈</span>
                <span>Your store won't be visible publicly until published.</span>
              </div>

              <div className="space-y-2">
              {REQUIRED_ORDER.map((item) => {
                const isMissing = missing.has(String(item.key).toLowerCase());
                const isCritical = Boolean(item.critical);

                const rowBase =
                  'group flex items-center justify-between rounded-lg border px-3 py-2 transition-colors';
                const rowClass = isMissing
                  ? isCritical
                    ? 'border-purple-200 bg-purple-50 hover:border-purple-300 dark:border-purple-500/25 dark:bg-purple-500/[0.06] dark:hover:border-purple-500/40'
                    : 'border-gray-100 bg-gray-50/30 hover:border-purple-300/50 dark:border-white/5 dark:bg-white/5 dark:hover:border-purple-500/30'
                  : 'border-transparent bg-transparent opacity-60 cursor-default';

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
                              ? 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-purple-500 text-purple-600 dark:border-purple-400/60 dark:text-purple-300'
                              : 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 text-gray-400 dark:border-white/30 dark:text-white/60 group-hover:border-purple-400/60 group-hover:text-purple-500 dark:group-hover:text-purple-300'
                          }
                        >
                          {isCritical ? (
                            <span className="text-xs" aria-hidden="true">
                              ⚠️
                            </span>
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-transparent group-hover:bg-purple-500 dark:group-hover:bg-purple-400" />
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
                        <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isMissing ? (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-white/5 dark:text-white/50">
                          Complete
                        </span>
                      ) : item.key === 'tags' ? (
                        <>
                          <span className="rounded border border-amber-900/30 bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-200">
                            {(tagsSelectedCount ?? 0) === 0
                              ? '0 selected'
                              : `${tagsSelectedCount} selected`}
                          </span>
                          <span className="text-gray-300 group-hover:text-purple-500 dark:text-white/30 dark:group-hover:text-purple-300" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : isCritical ? (
                        <>
                          <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-200">
                            Required
                          </span>
                          <span className="text-gray-300 group-hover:text-purple-500 dark:text-white/30 dark:group-hover:text-purple-300" aria-hidden="true">
                            →
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-300 group-hover:text-purple-500 dark:text-white/30 dark:group-hover:text-purple-300" aria-hidden="true">
                          →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Footer: Single Primary Action */}
            <div className="shrink-0 border-t border-gray-100 dark:border-white/10 bg-gray-50/30 dark:bg-black/30 px-5 py-4">
              <button
                type="button"
                onClick={handleCompleteSetup}
                className="group w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-2.5 font-bold text-white shadow-lg shadow-purple-900/20 transition-all hover:from-purple-500 hover:to-purple-400 active:scale-[0.98]"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  Complete Store Setup
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default StoreSetupRequiredGate;
