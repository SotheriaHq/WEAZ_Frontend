import React, { useEffect, useState } from 'react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

interface EndUserQuickEditModalProps {
  open: boolean;
  initialValues: {
    firstName: string;
    lastName: string;
    address: string;
  };
  saving?: boolean;
  onClose: () => void;
  onSave: (values: { firstName: string; lastName: string; address: string }) => Promise<void>;
}

export const EndUserQuickEditModal: React.FC<EndUserQuickEditModalProps> = ({
  open,
  initialValues,
  saving = false,
  onClose,
  onSave,
}) => {
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [address, setAddress] = useState(initialValues.address);

  useEffect(() => {
    if (!open) return;
    setFirstName(initialValues.firstName);
    setLastName(initialValues.lastName);
    setAddress(initialValues.address);
  }, [open, initialValues]);

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

  if (!open) return null;

  const canSubmit = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <OverlayPortal>
      <>
        <div className="fixed inset-0 z-layer-overlay bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || saving) return;
              void onSave({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                address: address.trim(),
              });
            }}
            className="w-full max-w-md rounded-2xl neu-modal-surface shadow-xl p-5"
          >
            <h3 className="text-base font-semibold text-[color:var(--neu-text)]">Quick Profile Edit</h3>
            <p className="mt-1 text-xs neu-text-muted">
              Update your basic profile details without leaving this page.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                  required
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                  required
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium neu-text-muted mb-1">Location</span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="City, State, Country"
                  className="w-full rounded-lg neu-modal-inset px-3 py-2 text-sm text-[color:var(--neu-text)] focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg neu-modal-inset px-3 py-2 text-xs font-medium text-[color:var(--neu-text)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </>
    </OverlayPortal>
  );
};
