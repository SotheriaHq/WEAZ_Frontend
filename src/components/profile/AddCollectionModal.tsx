import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import FrostedButton from '@/components/ui/FrostedButton';
import { brandApi } from '../../api/BrandApi';
import { useCollectionUpload } from '@/components/upload/useCollectionUpload';

interface AddCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}

const AddCollectionModal: React.FC<AddCollectionModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<'MALE' | 'FEMALE' | 'EVERYBODY'>('EVERYBODY');
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { uploadCollection, isUploading, progress } = useCollectionUpload();

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoadingCategories(true);
      const cats = await brandApi.getCategories();
      setCategories(cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })));
      if (cats.length && !categoryId) setCategoryId(cats[0].id);
      setLoadingCategories(false);
    })();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a collection title');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!files.length) {
        toast.error('Please select at least one file');
        setIsSubmitting(false);
        return;
      }
      const finalized = await uploadCollection(
        files,
        title.trim(),
        description.trim() || undefined,
        { visibility: isPublic ? 'PUBLIC' : 'PRIVATE', categoryId, type },
      );
      if (finalized) {
        toast.success('Collection published');
        setTitle('');
        setDescription('');
        setFiles([]);
        onClose();
        await onCreate();
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visibility</label>
            <div className="inline-flex rounded-full border border-white/20 bg-white/5 p-1 backdrop-blur-sm">
              {[
                { key: true, label: 'Public' },
                { key: false, label: 'Private' },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  type="button"
                  onClick={() => setIsPublic(opt.key)}
                  className={`px-3 py-1 text-xs rounded-full ${isPublic === opt.key ? 'bg-white/20 text-white' : 'text-white/80'}`}
                  disabled={isSubmitting}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category <span className="text-red-500">*</span></label>
            <select
              className="w-full px-3 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 border border-white/20"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isSubmitting || loadingCategories || categories.length === 0}
            >
              {loadingCategories && (
                <option value="" className="bg-slate-900 text-white" disabled>
                  Loading categories…
                </option>
              )}
              {!loadingCategories && categories.length === 0 && (
                <option value="" className="bg-slate-900 text-white" disabled>
                  No categories available
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(['MALE','FEMALE','EVERYBODY'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1 rounded-md border ${type === t ? 'bg-white/20 text-white border-white/40' : 'border-white/20 text-white/80'}`}
                  disabled={isSubmitting}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media Files <span className="text-red-500">*</span></label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              disabled={isSubmitting || isUploading}
              className="block w-full text-sm text-white/90 file:mr-3 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1 file:text-white hover:file:bg-white/20"
            />
            {isUploading && (
              <div className="mt-2 text-xs text-white/80">Uploading… {progress}%</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <FrostedButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </FrostedButton>
          <FrostedButton variant="primary" onClick={handleSubmit} loading={isSubmitting || isUploading} disabled={isSubmitting || isUploading || loadingCategories || !title.trim() || !categoryId || !type || files.length === 0}>
            Create Collection
          </FrostedButton>
        </div>
      </div>
    </div>
  );
};

export default AddCollectionModal;

