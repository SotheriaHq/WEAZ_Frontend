import React, { useRef } from 'react';
import { OverlayPortal } from './OverlayPortal';
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

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          tabIndex={-1}
          className="relative w-[90%] max-w-sm rounded-2xl neu-modal-surface shadow-xl p-4 outline-none"
        >
          <h2 id="confirm-title" className="text-base font-semibold text-[color:var(--neu-text)] mb-2">
            {title}
          </h2>
          <p id="confirm-message" className="text-sm neu-text-muted mb-4">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-md text-sm font-medium neu-modal-inset text-[color:var(--neu-text)] disabled:opacity-60"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-70 ${
                isDestructive
                  ? 'bg-[color:var(--status-danger,#dc2626)] hover:bg-[color:var(--status-danger-strong,#b91c1c)]'
                  : 'bg-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary-strong)]'
              }`}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ConfirmDialog;
