import React, { useEffect, useState, useRef } from 'react';
import FileUploader from '../../components/upload/FileUploader';
import MediaPreview from '../../components/upload/MediaPreview';
import { MediaProvider, useMediaStore } from '../../hooks/useMediaStore';
import FrostedButton from '../../components/ui/FrostedButton';
import TextField from '../../components/forms/TextField';
import TextAreaField from '../../components/forms/TextAreaField';
import TagPicker from '@/components/forms/TagPicker';
import SimpleAccordion from '@/components/forms/SimpleAccordion';
import UniversalSelect from '@/components/forms/UniversalSelect';
import TagsApi from '@/api/TagsApi';
import { brandApi } from '@/api/BrandApi';
import { startDraftSession, takeOverDraftSession } from '@/api/collectionUploads';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import useFilePicker from '../../components/upload/useFilePicker';
import { toast } from 'sonner';
import useCollectionUpload from '../../hooks/useCollectionUpload';
import WizardLayout from '../../components/layouts/WizardLayout';
import { useNavigate, useParams } from 'react-router-dom';
import type { MediaItem } from '@/types/media';
import { DraftConflictWarningModal } from '@/components/collections/DraftConflictWarningModal';

// Stable wrapper around SimpleAccordion so it doesn't remount on each render
const Section: React.FC<React.PropsWithChildren<{ title: string; defaultOpen?: boolean }>> = ({ title, defaultOpen = true, children }) => (
  <SimpleAccordion title={title} defaultOpen={defaultOpen}>
    {children}
  </SimpleAccordion>
);

const CreateCollectionInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isAvailableInStore, setIsAvailableInStore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<'MALE' | 'FEMALE' | 'EVERYBODY'>('EVERYBODY');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  
  // Track original items for deletion in edit mode
  const originalItemIds = useRef<Set<string>>(new Set());

  // Draft session conflict state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{
    deviceName?: string;
    deviceType?: 'desktop' | 'tablet' | 'mobile';
    startedAt: Date;
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const { uploadCollection, isUploading, progress, perFileProgress } = useCollectionUpload();
  const { user, fetchCollections } = useBrandProfile();
  const navigate = useNavigate();

  const disabled = isSubmitting || isUploading || readOnly;
  const picker = useFilePicker({ accept: ['image/*', 'video/*'], maxFiles: 20, onFiles: mediaStore.addFiles, disabled: disabled || isEditMode });

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
          if (mapped.length) setCategoryId((prev) => prev || mapped[0].id);
        }
        
        // If edit mode, fetch collection details and start draft session
        if (isEditMode && id) {
            // Start draft session to check for conflicts
            try {
              const session = await startDraftSession(id);
              if (mounted) {
                setSessionToken(session.sessionToken);
                if (session.hasConflict && session.conflictDetails) {
                  setConflictDetails({
                    deviceName: session.conflictDetails.deviceName,
                    deviceType: session.conflictDetails.deviceType,
                    startedAt: new Date(session.conflictDetails.startedAt),
                  });
                  setShowConflictModal(true);
                }
              }
            } catch (e) {
              // If session fails, still load collection data
              console.warn('Failed to start draft session', e);
            }

            const d = await brandApi.getCollectionDetail(id);
            if (mounted && d) {
                setTitle(d.title || '');
                setDescription(d.description || '');
                setMinPrice(d.minPrice ? String(d.minPrice) : '');
                setMaxPrice(d.maxPrice ? String(d.maxPrice) : '');
                setIsAvailableInStore(!!d.isAvailableInStore);
                setSelectedTags(d.tags || []);
                setCategoryId(d.categoryId || '');
                setType(d.type || 'EVERYBODY');
                setVisibility(d.visibility || 'PUBLIC');
                
                // Populate media
                if (d.medias && Array.isArray(d.medias)) {
                    const items: MediaItem[] = await Promise.all(d.medias.map(async (m: any) => {
                        const fileId = m.file?.id || m.fileId;
                        const url = await brandApi.getSignedFileUrl(fileId);
                        originalItemIds.current.add(m.id);
                        return {
                            id: m.id,
                            file: undefined,
                            previewUrl: url || '',
                            kind: m.type === 'VIDEO' ? 'video' : 'image',
                            remoteId: m.id
                        };
                    }));
                    mediaStore.set(items);
                }
            }
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
  }, [id, isEditMode, mediaStore]);

  const isValid = title.trim().length > 0 && files.length > 0 && selectedTags.length > 0;

  const handleDelete = (itemId: string) => {
    mediaStore.remove(itemId);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      const reasons: string[] = [];
      if (title.trim().length === 0) reasons.push('a title');
      if (files.length === 0) reasons.push('at least one file');
      const hasTags = selectedTags.length > 0;
      if (!hasTags) reasons.push('at least one tag');
      toast.error(`Please provide ${reasons.join(', ')}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const finalTags = selectedTags.slice(0, 10);

      if (isEditMode && id) {
          // Update mode
          // 1. Update metadata
          await brandApi.updateCollection(id, {
              name: title, // API expects 'name' but DTO might map it
              description,
              minPrice: parsedMinPrice,
              maxPrice: parsedMaxPrice,
              isAvailableInStore,
              tags: finalTags,
              categoryId,
              type,
              visibility
          } as any);

          // 2. Handle deletions
          const currentIds = new Set(files.map(f => f.id));
          const toDelete = Array.from(originalItemIds.current).filter(oid => !currentIds.has(oid));
          
          if (toDelete.length > 0) {
              await Promise.all(toDelete.map(itemId => brandApi.deleteCollectionItem(id, itemId)));
          }
          
          toast.success('Design updated');
      } else {
          // Create mode
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
          toast.success('Design created');
      }

      if (user?.id) {
        await fetchCollections(user.id);
      }
      
      // Reset and navigate
      if (!isEditMode) {
          setTitle('');
          setDescription('');
          setMinPrice('');
          setMaxPrice('');
          setIsAvailableInStore(false);
          setSelectedTags([]);
          mediaStore.clear();
      }
      navigate('/profile');
    } catch (error) {
      console.error(error);
      toast.error(isEditMode ? 'Failed to update design' : 'Failed to create design');
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
            onAddMore={() => !isEditMode && picker.open()} 
            disabled={disabled} 
            progressById={perFileProgress} 
          />
          {isEditMode && <p className="text-xs text-gray-500 text-center mt-2">Adding new files to existing designs is currently disabled.</p>}
        </>
      )}
    </div>
  );

  const rightContent = (
    <div className="space-y-4 glass-panel p-0">
      <Section title="Basics" defaultOpen>
        <TextField 
          label="Design Title" 
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
          placeholder="Describe the inspiration, materials, and feel of your design."
          rows={4}
          disabled={disabled}
          variant="glass"
        />
        {/* Category */}
        <div className="space-y-1">
          <UniversalSelect
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            placeholder={loadingCategories ? 'Loading...' : 'Select a category'}
            disabled={disabled}
          />
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
            />
          </div>
        </div>
      </Section>

      <Section title="Advanced" defaultOpen={false}>
        {/* Price Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Type and Visibility - Side by Side Dropdowns */}
        <div className="grid grid-cols-2 gap-3">
          {/* Type Dropdown */}
          <div className="space-y-1">
            <UniversalSelect
                label="Type"
                value={type}
                onChange={(v) => setType(v as any)}
                options={[
                    { value: 'EVERYBODY', label: 'Everybody' },
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' }
                ]}
                disabled={disabled}
            />
          </div>

          {/* Visibility Dropdown */}
          <div className="space-y-1">
            <UniversalSelect
                label="Visibility"
                value={visibility}
                onChange={(v) => setVisibility(v as any)}
                options={[
                    { value: 'PUBLIC', label: 'Public' },
                    { value: 'PRIVATE', label: 'Private' }
                ]}
                disabled={disabled}
            />
          </div>
        </div>

        {/* Collaborators - More Prominent */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Collaborators</label>
          <input
            type="text"
            placeholder="Search by username or email"
            disabled={disabled}
            className="threadly-search-input"
          />
        </div>
      </Section>

      <div className="flex gap-3">
        <FrostedButton 
          type="button" 
          variant="outline" 
          size="lg" 
          className="flex-1" 
          disabled={disabled} 
          onClick={async () => {
            if (!isValid) {
              const reasons: string[] = [];
              if (title.trim().length === 0) reasons.push('a title');
              if (files.length === 0) reasons.push('at least one file');
              const hasTags = selectedTags.length > 0;
              if (!hasTags) reasons.push('at least one tag');
              toast.error(`Please provide ${reasons.join(', ')}.`);
              return;
            }

            setIsSubmitting(true);
            try {
              const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
              const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
              const finalTags = selectedTags.slice(0, 10);

              await uploadCollection(
                files,
                title,
                description,
                parsedMinPrice,
                parsedMaxPrice,
                isAvailableInStore,
                finalTags,
                { categoryId, type, visibility },
                undefined,
                false // shouldPublish = false -> Save as Draft
              );
              toast.success('Saved to drafts');
              if (user?.id) {
                await fetchCollections(user.id);
              }
              navigate('/profile?tab=Drafts');
            } catch (error) {
              console.error(error);
              toast.error('Failed to save draft');
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          Save to Draft
        </FrostedButton>
        <FrostedButton 
          type="submit" 
          variant="primary" 
          size="lg" 
          className="flex-1" 
          disabled={disabled} 
          loading={isSubmitting || isUploading}
        >
          {isUploading ? `Uploading... ${progress}%` : (isEditMode ? 'Update Design' : 'Create Design')}
        </FrostedButton>
      </div>
    </div>
  );

  const handleTakeOver = async () => {
    if (!id) return;
    try {
      const newSession = await takeOverDraftSession(id);
      setSessionToken(newSession.sessionToken);
      setReadOnly(false);
      setShowConflictModal(false);
      toast.success('You now have edit access');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to take over session');
    }
  };

  const handleViewReadOnly = () => {
    setReadOnly(true);
    setShowConflictModal(false);
    toast.info('Viewing in read-only mode');
  };

  return (
    <div className="min-h-screen  p-6 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <form onSubmit={handleSubmit}>
        <WizardLayout
          title={isEditMode ? "Edit Design" : "Create a Design"}
          description={isEditMode ? "Update your design details and manage media." : "Upload imagery, craft your story, and publish the design in one seamless flow."}
          left={leftContent}
          right={rightContent}
        />
      </form>

      {showConflictModal && conflictDetails && (
        <DraftConflictWarningModal
          isOpen={showConflictModal}
          collectionTitle={title || 'This design'}
          existingSession={conflictDetails}
          onTakeOver={handleTakeOver}
          onViewReadOnly={handleViewReadOnly}
          onClose={() => {
            setShowConflictModal(false);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
};

const CreateCollectionPage: React.FC = () => (
  <MediaProvider>
    <CreateCollectionInner />
  </MediaProvider>
);

export default CreateCollectionPage;




