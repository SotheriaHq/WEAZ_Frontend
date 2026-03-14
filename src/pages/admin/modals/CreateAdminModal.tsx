import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { adminUsersApi } from '@/api/AdminApi';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { email: string; temporaryPassword: string | null }) => void;
}

const CreateAdminModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({ email: '', firstName: '', lastName: '' });
    }
  }, [open]);

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.lastName) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      const response = await adminUsersApi.create(form);
      const payload = (response.data as any)?.data ?? response.data;
      const temporaryPassword = typeof payload?.temporaryPassword === 'string' ? payload.temporaryPassword : null;
      toast.success(`Admin ${form.email} created`);
      onCreated({ email: form.email, temporaryPassword });
      setForm({ email: '', firstName: '', lastName: '' });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Admin User"
      size="sm"
      scope="viewport"
      glassBackdrop={true}
      backdropStyle="light"
      className="border border-white/45 bg-white/72 backdrop-blur-2xl shadow-[0_30px_80px_-28px_rgba(15,23,42,0.55)] dark:border-white/15 dark:bg-slate-900/70"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-600/90 dark:text-slate-300/90">
          A temporary password is generated automatically and sent by email.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            className="w-full rounded-xl border border-white/55 bg-white/65 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white/90 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-violet-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              required
              className="w-full rounded-xl border border-white/55 bg-white/65 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white/90 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-violet-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-200">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              required
              className="w-full rounded-xl border border-white/55 bg-white/65 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white/90 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-violet-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateAdminModal;
