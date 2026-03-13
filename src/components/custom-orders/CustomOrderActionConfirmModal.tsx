import React from 'react';
import Modal from '@/components/ui/Modal';

interface CustomOrderActionConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

const confirmButtonClassName = {
  default: 'bg-slate-900 text-white dark:bg-white dark:text-black',
  danger: 'bg-rose-500 text-white',
};

const CustomOrderActionConfirmModal: React.FC<CustomOrderActionConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  tone = 'default',
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={title} size="sm">
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmButtonClassName[tone]}`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomOrderActionConfirmModal;