import React, { useEffect, useMemo, useState } from 'react';
import FileUploader from '../../components/upload/FileUploader';
import MediaPreview from '../../components/upload/MediaPreview';
import { MediaProvider, useMediaStore } from '../../hooks/useMediaStore';
import FrostedButton from '../../components/ui/FrostedButton';
import TextField from '../../components/forms/TextField';
import TextAreaField from '../../components/forms/TextAreaField';
import TagPicker from '@/components/forms/TagPicker';
import TagsApi from '@/api/TagsApi';
import { brandApi } from '@/api/BrandApi';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import useFilePicker from '../../components/upload/useFilePicker';
import { toast } from 'react-toastify';
import useCollectionUpload from '../../hooks/useCollectionUpload';
import WizardLayout from '../../components/layouts/WizardLayout';
import { useNavigate } from 'react-router-dom';

const CreateCollectionInner: React.FC = () => {
  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isAvailableInStore, setIsAvailableInStore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<'MALE' | 'FEMALE' | 'EVERYBODY'>('EVERYBODY');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  const { uploadCollection, isUploading, progress, perFileProgress } = useCollectionUpload();
  const { user, fetchCollections } = useBrandProfile();
  const navigate = useNavigate();

  const disabled = isSubmitting || isUploading;
  const picker = useFilePicker({ accept: ['image/*', 'video/*'], maxFiles: 20, onFiles: mediaStore.addFiles, disabled });

  const parsedTags = useMemo(
    () =>
      tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 10),
    [tags],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await TagsApi.getSuggestions(80);
        if (!mounted) return;
        setTagSuggestions(s);
        // Load categories for creation options
        const cats = await brandApi.getCategories();
        if (mounted && Array.isArray(cats)) {
          const mapped = cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
          setCategories(mapped);
          if (!categoryId && mapped.length) setCategoryId(mapped[0].id);
        }
      } finally {
        if (mounted) {
          setLoadingCategories(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep parsed text in sync (for users who prefer typing)
  useEffect(() => {
    const typed = parsedTags;
    if (typed.length && typed.join(',') !== selectedTags.join(',')) {
      setSelectedTags(typed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  const isValid = title.trim().length > 0 && files.length > 0 && (selectedTags.length > 0 || parsedTags.length > 0);

  const handleDelete = (id: string) => {
    mediaStore.remove(id);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      // Validation requires title, at least one file, and at least one tag (selected or typed)
      const reasons: string[] = [];
      if (title.trim().length === 0) reasons.push('a title');
      if (files.length === 0) reasons.push('at least one file');
      const hasTags = selectedTags.length > 0 || parsedTags.length > 0;
      if (!hasTags) reasons.push('at least one tag');
      toast.error(`Please provide ${reasons.join(', ')}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      
      const finalTags = (selectedTags.length ? selectedTags : parsedTags).slice(0, 10);
      if (finalTags.length === 0) {
        toast.error('Add at least one tag.');
        return;
      }

      await uploadCollection(
        files,
        title,
        description,
        parsedMinPrice,
        parsedMaxPrice,
        isAvailableInStore,
        finalTags,
        { categoryId, type, visibility },
      );
      if (user?.id) {
        await fetchCollections(user.id);
      }
      toast.success('Collection created');
      setTitle('');
      setDescription('');
      setMinPrice('');
      setMaxPrice('');
      setIsAvailableInStore(false);
      setTags('');
      setSelectedTags([]);
      mediaStore.clear();
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const leftContent = (
  <div className="space-y-4 glass-panel p-4">
      {isUploading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
          Uploading files... {progress}%
          <div className="mt-2 h-2 w-full rounded-full bg-blue-100 dark:bg-blue-900/40">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all dark:bg-blue-400"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <FileUploader
          onFilesUpload={mediaStore.addFiles}
          picker={picker}
          variant="large"
          accept={['image/*', 'video/*']}
          disabled={disabled}
        />
      ) : (
        <>
          {/* Hidden file input - must be present when MediaPreview is shown so picker.open() works */}
          <input
            ref={picker.inputRef}
            type="file"
            multiple
            onChange={picker.handlers.onInputChange}
            className="hidden"
            accept={['image/*', 'video/*'].join(',')}
            disabled={disabled}
          />
          <MediaPreview 
            items={files} 
            onDeleteItem={handleDelete} 
            onAddMore={() => picker.open()} 
            disabled={disabled} 
            progressById={perFileProgress} 
          />
        </>
      )}
    </div>
  );

  const Section: React.FC<React.PropsWithChildren<{ title: string; defaultOpen?: boolean }>> = ({ title, defaultOpen = true, children }) => (
    <details className="group rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur-md open:pb-3" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-gray-800 dark:text-white">
        <span>{title}</span>
        <span className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );

  const PillGroup: React.FC<{ options: { key: string; label: string; title?: string }[]; value: string; onChange: (v: string) => void }>
    = ({ options, value, onChange }) => (
      <div className="inline-flex rounded-full border border-slate-300 dark:border-white/20 bg-white/60 dark:bg-white/5 p-1 backdrop-blur-md shadow-sm" role="tablist" aria-label="Options">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            title={opt.title ?? opt.label}
            aria-pressed={value === opt.key}
            onClick={() => onChange(opt.key)}
            className={`min-w-[64px] px-3 py-2 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${
              value === opt.key ? 'bg-black/10 text-gray-900 dark:bg-white/20 dark:text-white' : 'text-gray-700 dark:text-white/80'
            }`}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );

  const rightContent = (
    <div className="space-y-4 glass-panel p-4">
      <Section title="Basics" defaultOpen>
        <TextField 
          label="Collection Title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="e.g., Summer Breeze '24" 
          disabled={disabled} 
          variant="glass"
          inputClassName="border-0 focus:ring-0"
        />
        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the inspiration, materials, and feel of your collection."
          rows={4}
          disabled={disabled}
          variant="glass"
        />
        {/* Category */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <select
            className="w-full rounded-md bg-white/70 dark:bg-white/5 backdrop-blur-sm text-gray-900 dark:text-white border border-slate-300 dark:border-white/20 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300/60 dark:focus:ring-white/30"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={disabled}
          >
            {!categories.length && (
              <option value="" disabled className="bg-white text-gray-700">
                {loadingCategories ? 'Loading categories…' : 'No categories available'}
              </option>
            )}
            {!categoryId && categories.length > 0 && (
              <option value="" className="bg-white text-gray-700">Select a category</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {/* Tags */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
          <div>
            <TagPicker
              suggestions={tagSuggestions}
              value={selectedTags}
              onChange={setSelectedTags}
              allowCustom
              max={10}
              horizontal
            />
          </div>
          <TextField
            label="Or type tags (optional, comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., summer, linen, resort"
            disabled={disabled}
            variant="glass"
            inputClassName="border-0 focus:ring-0"
          />
        </div>
      </Section>

      <Section title="Advanced" defaultOpen={false}>
        {/* Price Range */}
        <div className="grid grid-cols-2 gap-3">
          <TextField 
            label="Min Price (₦)" 
            type="number"
            value={minPrice} 
            onChange={(e) => setMinPrice(e.target.value)} 
            placeholder="15,000" 
            disabled={disabled} 
            variant="glass"
            inputClassName="border-0 focus:ring-0"
          />
          <TextField 
            label="Max Price (₦)" 
            type="number"
            value={maxPrice} 
            onChange={(e) => setMaxPrice(e.target.value)} 
            placeholder="45,000" 
            disabled={disabled} 
            variant="glass"
            inputClassName="border-0 focus:ring-0"
          />
        </div>

        {/* Available in Store Toggle */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <input
            type="checkbox"
            id="availableInStore"
            checked={isAvailableInStore}
            onChange={(e) => setIsAvailableInStore(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <label htmlFor="availableInStore" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Available in physical store
          </label>
        </div>

        {/* Type */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <PillGroup
            options={[
              { key: 'MALE', label: 'Male', title: 'Primarily menswear' },
              { key: 'FEMALE', label: 'Female', title: 'Primarily womenswear' },
              { key: 'EVERYBODY', label: 'Everybody', title: 'Unisex / inclusive' },
            ]}
            value={type}
            onChange={(v) => setType(v as any)}
          />
        </div>

        {/* Visibility */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label>
          <PillGroup
            options={[
              { key: 'PUBLIC', label: 'Public', title: 'Visible to everyone' },
              { key: 'PRIVATE', label: 'Private', title: 'Restricted access' },
            ]}
            value={visibility}
            onChange={(v) => setVisibility(v as any)}
          />
        </div>

        <TextField label="Collaborators" placeholder="Search by username or email" disabled={disabled} variant="glass" inputClassName="border-0 focus:ring-0" />
      </Section>

      <FrostedButton 
        type="submit" 
        variant="primary" 
        size="lg" 
        className="w-full" 
        disabled={disabled} 
        loading={isSubmitting || isUploading}
      >
        {isUploading ? `Uploading... ${progress}%` : 'Create Collection'}
      </FrostedButton>
    </div>
  );

  return (
    <div className="min-h-screen  p-6 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <form onSubmit={handleSubmit}>
        <WizardLayout
          title="Create a Collection"
          description="Upload imagery, craft your story, and publish the collection in one seamless flow."
          left={leftContent}
          right={rightContent}
        />
      </form>
    </div>
  );
};

const CreateCollectionPage: React.FC = () => (
  <MediaProvider>
    <CreateCollectionInner />
  </MediaProvider>
);

export default CreateCollectionPage;




