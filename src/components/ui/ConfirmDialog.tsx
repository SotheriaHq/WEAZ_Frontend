import React, { useRef } from 'react';
import { OverlayPortal } from './OverlayPortal';
import VLoader from '@/components/loaders/VLoader';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onCancel,
  });

  if (!open) return null;

  const iconEmoji = isDestructive ? '⚠️' : 'ℹ️';
  const accentBg = isDestructive
    ? 'bg-red-50 dark:bg-red-500/10 ring-1 ring-red-200/60 dark:ring-red-500/20'
    : 'bg-purple-50 dark:bg-purple-500/10 ring-1 ring-purple-200/60 dark:ring-purple-500/20';

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onCancel} aria-hidden />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          tabIndex={-1}
          className={`
            relative w-[90%] max-w-md overflow-hidden rounded-3xl
            bg-white dark:bg-zinc-900
            shadow-2xl ring-1 ring-black/5 dark:ring-white/10
            outline-none
            ${isDestructive ? 'shadow-red-500/10 dark:shadow-red-500/20' : ''}
          `}
        >
          {/* Header with icon */}
          <div className="flex flex-col items-center pt-8 pb-2 px-6">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accentBg} mb-4`}>
              <span className="text-2xl">{iconEmoji}</span>
            </div>
            <h2 id="confirm-title" className="text-lg font-bold text-gray-900 dark:text-white text-center">
              {title}
            </h2>
            <p id="confirm-message" className="mt-2 text-sm text-gray-500 dark:text-zinc-400 text-center max-w-xs leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] px-6 py-4 mt-4">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              disabled={isLoading}
              className={`
                flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white
                transition-all active:scale-[0.98]
                disabled:opacity-50 disabled:shadow-none
                ${isDestructive
                  ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/25'
                  : 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/25'
                }
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <VLoader size={16} progress={64} phase="loading" showLabel={false} />
                  Processing...
                </span>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ConfirmDialog;
