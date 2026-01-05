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
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onCancel,
  });

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
          className="relative w-[90%] max-w-sm rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200/70 dark:border-white/10 p-4 outline-none"
        >
          <h2 id="confirm-title" className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h2>
          <p id="confirm-message" className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              className={`px-3 py-1.5 rounded-md text-sm font-semibold text-white ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-black dark:bg-white dark:text-black hover:opacity-90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ConfirmDialog;
