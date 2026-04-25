import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import FrostedButton from '@/components/ui/FrostedButton';
import { brandApi } from '../../api/BrandApi';
import { useCollectionUpload } from '@/hooks/useCollectionUpload';
import { Select } from '@/components/ui/Select';
import type { MediaItem } from '@/types/media';

interface AddCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}

const AddCollectionModal: React.FC<AddCollectionModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const cooldownNotice = 'If a viewer is rejected they must wait 72 hours before re-requesting access.';
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<'MALE' | 'FEMALE' | 'EVERYBODY'>('EVERYBODY');
  const [tagsInput, setTagsInput] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { uploadCollection, isUploading, progress } = useCollectionUpload();

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoadingCategories(true);
      const cats = await brandApi.getCategories(true);
      setCategories(cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name })));
      if (cats.length) setCategoryId((prev) => prev || cats[0].id);
      setLoadingCategories(false);
    })();
  }, [isOpen]);

  // Scroll Locking
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a design title');
      return;
    }

    setIsSubmitting(true);
    let mediaItems: MediaItem[] = [];
    try {
      if (!files.length) {
        toast.error('Please select at least one file');
        setIsSubmitting(false);
        return;
      }
      mediaItems = files.map((file, index) => {
        const kind = file.type.startsWith('video') ? 'video' : 'image';
        const previewUrl = URL.createObjectURL(file);
        const id = `${file.name}-${file.lastModified}-${index}`;
        return { id, file, previewUrl, kind };
      });
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const finalized = await uploadCollection(
        mediaItems,
        title.trim(),
        description.trim() || undefined,
        undefined,
        undefined,
        false,
        tags,
        { visibility: isPublic ? 'PUBLIC' : 'PRIVATE', categoryId, type },
      );
      if (finalized) {
        toast.success('Design published');
        setTitle('');
        setDescription('');
        setTagsInput('');
        setFiles([]);
        onClose();
        await onCreate();
      }
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('An error occurred while creating the design');
    } finally {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-panel neu-modal-surface w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Design</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input 
              className="w-full px-3 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 border-0" 
              placeholder="e.g., Summer Lookbook 2025"
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
              placeholder="Describe your design..."
              rows={3}
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 border-0"
              placeholder="e.g., summer, lookbook, runway"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Separate tags with commas.
            </p>
          </div>

          {/* Type and Visibility - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Type Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as 'MALE' | 'FEMALE' | 'EVERYBODY')}
                disabled={isSubmitting}
              >
                <option value="EVERYBODY">Everybody</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </div>

            {/* Visibility Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visibility
              </label>
              <Select
                value={isPublic ? 'public' : 'private'}
                onChange={(e) => setIsPublic(e.target.value === 'public')}
                disabled={isSubmitting}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Select>
            </div>
          </div>
          {!isPublic && (
            <p className="text-xs text-white/70">{cooldownNotice}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category <span className="text-red-500">*</span></label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isSubmitting || loadingCategories || categories.length === 0}
            >
              {loadingCategories && (
                <option value="" disabled>
                  Loading categories…
                </option>
              )}
              {!loadingCategories && categories.length === 0 && (
                <option value="" disabled>
                  No categories available
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Collaborators Search Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collaborators
            </label>
            <input
              type="text"
              className="threadly-search-input"
              placeholder="Search by username or email"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Media Files <span className="text-red-500">*</span></label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => {
                const next = Array.from(e.target.files ?? []);
                if (next.length > 20) {
                  toast.error('Maximum 20 files allowed');
                  setFiles(next.slice(0, 20));
                  return;
                }
                setFiles(next);
              }}
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
            Create Design
          </FrostedButton>
        </div>
      </div>
    </div>
  );
};

export default AddCollectionModal;

