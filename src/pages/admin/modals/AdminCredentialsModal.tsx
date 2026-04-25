import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  temporaryPassword: string;
}

const AdminCredentialsModal: React.FC<Props> = ({
  open,
  onClose,
  email,
  temporaryPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✅ Admin Credentials Ready"
      size="sm"
      scope="viewport"
      glassBackdrop={true}
      backdropStyle="light"
      className="border border-emerald-200/70 bg-white/90 shadow-[0_35px_80px_-30px_rgba(16,185,129,0.45)] dark:border-emerald-500/30 dark:bg-slate-900/85"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="text-sm font-semibold">Share this temporary password securely.</p>
          <p className="mt-1 text-xs opacity-90">
            The new admin must set a new password on first sign-in.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Email
          </label>
          <input
            readOnly
            value={email}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Temporary Password
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={showPassword ? temporaryPassword : '••••••••••••••••'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-800 dark:text-emerald-200"
            >
              {showPassword ? 'Hide' : 'Reveal'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(temporaryPassword);
                  toast.success('Temporary password copied');
                } catch {
                  toast.error('Unable to copy password');
                }
              }}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminCredentialsModal;
