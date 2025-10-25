import React, { useState } from 'react';
import { toast } from 'react-toastify';
import FrostedButton from '@/components/ui/FrostedButton';
import { brandApi } from '../../api/BrandApi';

interface AddCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}

const AddCollectionModal: React.FC<AddCollectionModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a collection title');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await brandApi.createCollection({
        name: title.trim(),
        description: description.trim() || undefined,
        isPublic,
      });

      if (result) {
        toast.success('Collection created successfully!');
        setTitle('');
        setDescription('');
        onClose();
        await onCreate(); // Trigger refetch
      } else {
        toast.error('Failed to create collection');
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('An error occurred while creating the collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Collection</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input 
              className="w-full px-3 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 border-0" 
              placeholder="e.g., Summer Collection 2025"
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea 
              className="w-full px-3 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 border-0 resize-none" 
              placeholder="Describe your collection..."
              rows={3}
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Make this collection public
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <FrostedButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </FrostedButton>
          <FrostedButton variant="primary" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting || !title.trim()}>
            Create Collection
          </FrostedButton>
        </div>
      </div>
    </div>
  );
};

export default AddCollectionModal;
