import React, { useState } from 'react';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { useBrandProfile } from '@/hooks/UseBrandHook';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

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

  const panelRef = React.useRef<HTMLDivElement | null>(null);

  if (!open) return null;

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
    initialFocusSelector: '[data-initial-focus="true"]',
  });

  React.useEffect(() => {
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
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal" aria-hidden={false}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

        <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Create a store"
            tabIndex={-1}
            className="w-full max-w-[480px] max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl outline-none dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold">Create a Store</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Create a store to sell your products and manage listings.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                <input
                  data-initial-focus="true"
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                  placeholder="Store name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                />
                <textarea
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                  placeholder="Short description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={isSaving}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                  placeholder="Website (optional)"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border px-4 py-2"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-white"
                  disabled={isSaving}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CreateStoreModal;
