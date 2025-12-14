import React, { useState } from 'react';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { useBrandProfile } from '@/hooks/UseBrandHook';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CreateStoreModal: React.FC<Props> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user, fetchBrandProfile } = useBrandProfile() as any;

  if (!open) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please provide a store name');
      return;
    }
    setIsSaving(true);
    try {
      const res = await brandApi.createStore({ name: name.trim(), description: description.trim(), website: website.trim(), ownerId: user?.id });
      if (res) {
        toast.success('Store created');
        // Refresh brand profile if possible
        if (user?.id && typeof fetchBrandProfile === 'function') {
          try { await fetchBrandProfile(user.id); } catch {}
        }
        onClose();
      } else {
        toast.error('Failed to create store');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to create store');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-[480px] z-10 shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Create a Store</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Create a store to sell your products and manage listings.</p>
        <div className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-lg border focus:outline-none"
            placeholder="Store name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
          />
          <textarea
            className="w-full px-3 py-2 rounded-lg border focus:outline-none"
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={isSaving}
          />
          <input
            className="w-full px-3 py-2 rounded-lg border focus:outline-none"
            placeholder="Website (optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border" disabled={isSaving}>Cancel</button>
          <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-purple-600 text-white" disabled={isSaving}>Create</button>
        </div>
      </div>
    </div>
  );
};

export default CreateStoreModal;
