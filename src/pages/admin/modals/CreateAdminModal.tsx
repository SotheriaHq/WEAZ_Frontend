import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { adminUsersApi } from '@/api/AdminApi';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateAdminModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', tempPassword: '' });
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.lastName || !form.tempPassword) {
      toast.error('All fields are required');
      return;
    }
    setLoading(true);
    try {
      await adminUsersApi.create(form);
      toast.success(`Admin ${form.email} created`);
      setForm({ email: '', firstName: '', lastName: '', tempPassword: '' });
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ Create Admin User" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
            <input type="text" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
            <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
          <input type="password" value={form.tempPassword} onChange={(e) => set('tempPassword', e.target.value)} required minLength={8}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition">
            {loading ? 'Creating...' : 'Create Admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateAdminModal;
