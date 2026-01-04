import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  Check,
  ChevronRight,
  AlertTriangle,
  EyeOff,
} from 'lucide-react';

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

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const goBackButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;

    // Focus the first meaningful interactive element on open.
    // Prefer the explicit "Go Back" action.
    const focusTimer = window.setTimeout(() => {
      if (goBackButtonRef.current) {
        goBackButtonRef.current.focus();
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      focusables[0]?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleGoBack();
        return;
      }

      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? focusables.indexOf(active) : -1;

      if (e.shiftKey) {
        const prevIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
        e.preventDefault();
        focusables[prevIndex]?.focus();
      } else {
        const nextIndex = currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
        e.preventDefault();
        focusables[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Overlay (blocks background + intercepts scroll) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Modal shell (centers, controls max size) */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          className="relative flex w-full max-w-[640px] flex-col overflow-hidden overscroll-contain rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-white/5 px-6 py-5 text-center">
            <div className="relative mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-purple-400">
              <div
                className="absolute inset-0 rounded-full bg-purple-500/25 blur-xl"
                aria-hidden="true"
              />
              <Store className="relative h-6 w-6" />
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black/60 bg-amber-500">
                <AlertTriangle className="h-2.5 w-2.5 text-black" />
              </div>
            </div>

            <h2 className="font-serif text-2xl font-bold tracking-wide text-white md:text-3xl">
              Finish setting up your store
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/60">
              Complete these essentials to publish and access your store functionality.
            </p>
          </div>

          {/* Body (no scrolling; fits content) */}
          <div className="p-4 md:p-6">
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
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-transparent group-hover:bg-purple-400" />
                          )}
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-300">
                          <Check className="h-4 w-4" />
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
                          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-purple-300" />
                        </>
                      ) : isCritical ? (
                        <>
                          <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-200">
                            Required
                          </span>
                          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-purple-300" />
                        </>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-purple-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-black/20 px-6 pb-6 pt-3">
            <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-purple-200/70">
              <EyeOff className="h-4 w-4" />
              Your store won't be visible publicly until published.
            </p>

            <div className="flex w-full flex-col-reverse gap-3 md:flex-row">
              <button
                type="button"
                onClick={handleGoBack}
                ref={goBackButtonRef}
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
                  <span className="transition-transform group-hover:translate-x-1">→</span>
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
  );
};

export default StoreSetupRequiredGate;
