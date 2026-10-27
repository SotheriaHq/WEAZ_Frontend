import React, { useRef } from 'react';
import { OverlayPortal } from './OverlayPortal';
import Button from '@/components/ui/Button';
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
    : 'bg-[color:var(--wiez-action-brand-subtle,rgba(147,51,234,0.1))] ring-1 ring-[color:var(--wiez-border-subtle)]';

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          style={{ backgroundColor: 'var(--wiez-surface-overlay, rgba(0,0,0,0.7))' }}
          onClick={onCancel}
          aria-hidden
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          tabIndex={-1}
          className={`
            relative w-[90%] max-w-md overflow-hidden rounded-[28px]
            bg-[color:var(--wiez-surface-modal)] text-[color:var(--wiez-text-primary)]
            shadow-2xl ring-1 ring-[color:var(--wiez-border-subtle)]
            outline-none
            ${isDestructive ? 'shadow-red-500/10 dark:shadow-red-500/20' : ''}
          `}
        >
          {/* Header with icon */}
          <div className="flex flex-col items-center pt-8 pb-2 px-6">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accentBg} mb-4`}>
              <span className="text-2xl">{iconEmoji}</span>
            </div>
            <h2 id="confirm-title" className="text-lg font-bold text-[color:var(--wiez-text-primary)] text-center">
              {title}
            </h2>
            <p id="confirm-message" className="mt-2 text-sm text-[color:var(--wiez-text-secondary)] text-center max-w-xs leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-[color:var(--wiez-border-subtle)] bg-[color:var(--wiez-surface-subtle)] px-6 py-4 mt-4">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3 text-sm font-semibold"
            >
              {cancelText}
            </Button>
            <Button
              variant={isDestructive ? 'danger' : 'primary'}
              onClick={onConfirm}
              autoFocus
              loading={isLoading}
              disabled={isLoading}
              className="flex-1 py-3 text-sm font-semibold"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ConfirmDialog;
