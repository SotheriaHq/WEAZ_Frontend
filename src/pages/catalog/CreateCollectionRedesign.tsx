import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  FiArrowLeft, FiTrash2, FiStar, FiMove, FiMaximize2,
  FiChevronDown, FiChevronUp, FiInfo, FiSearch, FiX, FiFile,
  FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiPlus
} from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi';

// Context & Hooks
import TextField from '../../components/forms/TextField';
import UniversalSelect from '@/components/forms/UniversalSelect';
import MediaUploadZone from '../../components/upload/MediaUploadZone';
import ThumbnailStrip from '../../components/upload/ThumbnailStrip';
import MediaRenderer from '../../components/media/MediaRenderer';
import useFilePicker from '../../components/upload/useFilePicker';
import { PrePublishConfirmModal } from '@/components/modals';
import TagsApi from '@/api/TagsApi';
import { brandApi } from '@/api/BrandApi';
import type { MediaItem } from '@/types/media';
import { MediaProvider, useMediaStore } from '../../hooks/useMediaStore';
import useCollectionUpload from '../../hooks/useCollectionUpload';
import { useBrandProfile } from '../../hooks/UseBrandHook';
// ============================================================================

const CreateCollectionInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [isAvailableInStore, setIsAvailableInStore] = useState(false);
  const [isMadeToOrder, setIsMadeToOrder] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<'MALE' | 'FEMALE' | 'EVERYBODY'>('EVERYBODY');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    pricing: false,
    targeting: false,
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [showSaveDraftConfirm, setShowSaveDraftConfirm] = useState(false);
  const tagStylePalette = useMemo(
    () => [
      'bg-white/30 border border-white/40 text-purple-900 dark:text-white backdrop-blur-md shadow-sm',
      'bg-gradient-to-r from-purple-500/60 to-blue-500/50 text-white shadow-md',
      'bg-gradient-to-r from-amber-400/70 to-pink-500/70 text-white shadow-md',
      'bg-white/20 text-white border border-white/30 backdrop-blur',
      'bg-gradient-to-r from-emerald-400/70 to-teal-500/70 text-white shadow-md',
      'bg-gradient-to-r from-indigo-500/70 to-cyan-500/70 text-white shadow-md',
    ],
    []
  );

  // Track original items for deletion in edit mode
  const originalItemIds = useRef<Set<string>>(new Set());

  const { uploadCollection, isUploading, progress, perFileProgress, cancelUploads } = useCollectionUpload();
  const { user, fetchCollections } = useBrandProfile();

  const disabled = isSubmitting || isUploading;
  const picker = useFilePicker({
    accept: ['image/*', 'video/*'],
    maxFiles: 20,
    onFiles: mediaStore.addFiles,
    disabled: disabled || isEditMode,
  });

  // Load initial data
  // Load initial data (tags, categories, and collection when editing)
  // Note: do not include `mediaStore` (unstable) or setters in deps to avoid rerunning
  // this effect and spamming APIs; run only on mount or when edit id changes.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const s = await TagsApi.getSuggestions(80);
        if (mounted) setTagSuggestions(s);

        const cats = await brandApi.getCategories();
        if (mounted && Array.isArray(cats)) {
          const mapped = cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
          setCategories(mapped);
          if (mapped.length) setCategoryId((prev) => prev || mapped[0].id);
        }

        if (isEditMode && id) {
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

            if (d.medias && Array.isArray(d.medias)) {
              const items: MediaItem[] = await Promise.all(
                d.medias.map(async (m: any) => {
                  const fileId = m.file?.id || m.fileId;
                  const url = await brandApi.getSignedFileUrl(fileId);
                  originalItemIds.current.add(m.id);
                  return {
                    id: m.id,
                    file: undefined,
                    previewUrl: url || '',
                    kind: m.type === 'VIDEO' ? 'video' : 'image',
                    remoteId: m.id,
                  };
                })
              );
              // set media items into the global media store
              mediaStore.set(items);
            }
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, isEditMode, mediaStore]);

  // Keep selected/cover indices in range when files change
  useEffect(() => {
    if (!files.length) {
      setSelectedIndex(0);
      setCoverIndex(0);
      return;
    }

    if (selectedIndex >= files.length) {
      setSelectedIndex(Math.max(0, files.length - 1));
    }
    if (coverIndex >= files.length) {
      setCoverIndex(Math.max(0, files.length - 1));
    }
  }, [files.length, selectedIndex, coverIndex]);

  // Validation
  const isValid = title.trim().length > 0 && files.length > 0 && selectedTags.length > 0;

  const resolveMediaWithUrl = useCallback((item?: MediaItem | null) => {
    if (!item) return null;
    let url = item.previewUrl;
    if (!url && item.file) {
      url = URL.createObjectURL(item.file);
    }
    return url ? { ...item, url } : null;
  }, []);

  // Get current selected file for main preview
  const selectedFile = useMemo(() => {
    if (files.length === 0) return null;
    return resolveMediaWithUrl(files[selectedIndex]);
  }, [files, selectedIndex, resolveMediaWithUrl]);

  // Get cover image URL for modal
  const coverImageUrl = useMemo(() => {
    if (files.length === 0) return undefined;
    const item = files[coverIndex];
    if (!item) return undefined;
    const withUrl = resolveMediaWithUrl(item);
    return withUrl?.url;
  }, [files, coverIndex, resolveMediaWithUrl]);

  const fullscreenFile = useMemo(() => {
    if (fullscreenIndex === null) return null;
    return resolveMediaWithUrl(files[fullscreenIndex]);
  }, [files, fullscreenIndex, resolveMediaWithUrl]);

  // Filter tag suggestions based on search
  const filteredSuggestions = useMemo(() => {
    const search = tagSearch.toLowerCase().trim();
    if (!search) return tagSuggestions.filter((t) => !selectedTags.includes(t)).slice(0, 12);
    return tagSuggestions
      .filter((t) => t.toLowerCase().includes(search) && !selectedTags.includes(t))
      .slice(0, 12);
  }, [tagSearch, tagSuggestions, selectedTags]);

  // Get category name for summary
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Handlers
  const handleDelete = (itemId: string) => {
    mediaStore.remove(itemId);
  };

  const handleSetCover = (index: number) => {
    setCoverIndex(index);
    toast.success('Cover image updated');
  };

  const goToMediaIndex = useCallback(
    (nextIndex: number) => {
      if (!files.length) return;
      const bounded = Math.min(Math.max(nextIndex, 0), files.length - 1);
      setSelectedIndex(bounded);
      setFullscreenIndex(bounded);
      setFullscreenZoom(1);
    },
    [files.length]
  );

  const openFullscreen = useCallback(() => {
    goToMediaIndex(selectedIndex);
    setIsFullscreen(true);
  }, [goToMediaIndex, selectedIndex]);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setFullscreenIndex(null);
    setFullscreenZoom(1);
  }, []);

  const handleFullscreenPrev = useCallback(() => {
    goToMediaIndex((fullscreenIndex ?? selectedIndex) - 1);
  }, [fullscreenIndex, goToMediaIndex, selectedIndex]);

  const handleFullscreenNext = useCallback(() => {
    goToMediaIndex((fullscreenIndex ?? selectedIndex) + 1);
  }, [fullscreenIndex, goToMediaIndex, selectedIndex]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFullscreen();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleFullscreenNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleFullscreenPrev();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeFullscreen, handleFullscreenNext, handleFullscreenPrev, isFullscreen]);

  useEffect(() => {
    if (isFullscreen && (fullscreenIndex === null || !files[fullscreenIndex])) {
      closeFullscreen();
    }
  }, [closeFullscreen, files, fullscreenIndex, isFullscreen]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addTag = (tag: string) => {
    if (selectedTags.length >= 10) {
      toast.error('Maximum 10 tags allowed');
      return;
    }
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setTagSearch('');
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagSearch.trim()) {
      e.preventDefault();
      addTag(tagSearch.trim().toLowerCase().replace(/\s+/g, '-'));
    }
  };

  const handleSaveDraft = async () => {
    // Drafts require only media selection; auto-fill other fields for backend validation
    if (files.length === 0) {
      toast.error('Please upload at least one file to save');
      return;
    }
    setShowSaveDraftConfirm(true);
  };

  const executeSaveDraft = async () => {
    // Guard: prevent double submission
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const draftTitle = title.trim() || 'Untitled Draft';
      const finalTags = (selectedTags.length ? selectedTags : ['draft']).slice(0, 10);

      await uploadCollection(
        files,
        draftTitle,
        description,
        parsedMinPrice,
        parsedMaxPrice,
        isAvailableInStore,
        finalTags,
        { categoryId, type, visibility },
        undefined,
        false // shouldPublish = false
      );

      setLastSaved(new Date());

      if (user?.id) {
        await fetchCollections(user.id);
      }

      toast.success('Draft saved successfully!');
      // Navigate to profile with Drafts visibility filter selected
      navigate('/profile?tab=Collections&visibility=Drafts');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save draft');
    } finally {
      setIsSubmitting(false);
      setShowSaveDraftConfirm(false);
    }
  };

  const handlePublishClick = () => {
    if (!isValid) {
      const reasons: string[] = [];
      if (title.trim().length === 0) reasons.push('a title');
      if (files.length === 0) reasons.push('at least one file');
      if (selectedTags.length === 0) reasons.push('at least one tag');
      toast.error(`Please provide ${reasons.join(', ')}.`);
      return;
    }
    setShowPublishModal(true);
  };

  const handlePublishConfirm = async () => {
    setIsSubmitting(true);
    // Close modal immediately so user can keep browsing and see inline progress
    setShowPublishModal(false);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const finalTags = selectedTags.slice(0, 10);

      const extractCollectionId = (res: any): string | undefined => {
        if (!res || typeof res !== 'object') return undefined;
        if (typeof (res as any).collectionId === 'string') return (res as any).collectionId;
        if (typeof (res as any).id === 'string') return (res as any).id;
        if ((res as any).data && typeof (res as any).data === 'object' && typeof (res as any).data.id === 'string') return (res as any).data.id;
        return undefined;
      };

      const coverLocalId = files[coverIndex]?.id;

      if (isEditMode && id) {
        await brandApi.updateCollection(id, {
          name: title,
          description,
          minPrice: parsedMinPrice,
          maxPrice: parsedMaxPrice,
          isAvailableInStore,
          tags: finalTags,
          categoryId,
          type,
          visibility,
          coverMediaId: files[coverIndex]?.remoteId || coverLocalId,
        } as any);

        const currentIds = new Set(files.map((f) => f.id));
        const toDelete = Array.from(originalItemIds.current).filter((oid) => !currentIds.has(oid));
        if (toDelete.length > 0) {
          await Promise.all(toDelete.map((itemId) => brandApi.deleteCollectionItem(id, itemId)));
        }

        toast.success('Collection updated');
      } else {
        const response = await uploadCollection(
          files,
          title,
          description,
          parsedMinPrice,
          parsedMaxPrice,
          isAvailableInStore,
          finalTags,
          { categoryId, type, visibility }
        );
        const newCollectionId = extractCollectionId(response);
        const fileIdMap = (response as any)?.fileIdMap as Record<string, string> | undefined;
        const completions = (response as any)?.completions as Array<{ fileId: string }> | undefined;
        const coverRemoteId = coverLocalId
          ? fileIdMap?.[coverLocalId] || completions?.[coverIndex]?.fileId || coverLocalId
          : undefined;

        if (newCollectionId && coverRemoteId) {
          await brandApi.updateCollection(newCollectionId, { coverMediaId: coverRemoteId } as any);
        }
        toast.success('Collection published');

        // Navigate back to profile/catalog with a publishing badge so the user is not blocked on this page
        navigate(`/profile?tab=Collections`, {
          state: {
            publishingCollectionId: newCollectionId,
            publishingTitle: title,
            publishingStartedAt: Date.now(),
          },
        });
      }

      if (user?.id) {
        await fetchCollections(user.id);
      }
      setShowPublishModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('cancelled')) {
        toast.info('Publish cancelled');
        setShowPublishModal(false);
        return;
      }
      console.error(error);
      toast.error(isEditMode ? 'Failed to update collection' : 'Failed to publish collection');
      throw error; // Re-throw so modal can handle state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalCloseRequest = () => {
    setShowPublishModal(false);
    setShowCancelPrompt(true);
  };

  const handleCancelPromptChoice = (action: 'return' | 'cancel') => {
    setShowCancelPrompt(false);
    if (action === 'cancel') {
      navigate('/profile');
    }
  };

  // Build summary for modal
  const collectionSummary = {
    title,
    description,
    category: selectedCategory?.name,
    priceRange: { min: minPrice ? parseFloat(minPrice) : undefined, max: maxPrice ? parseFloat(maxPrice) : undefined },
    visibility,
    type,
    tags: selectedTags,
    mediaCount: files.filter((f) => f.kind === 'image').length,
    videoCount: files.filter((f) => f.kind === 'video').length,
    coverImageUrl,
    isAvailableInStore,
    isMadeToOrder,
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)] transition-colors duration-300">
      {/* CreateStoreModal removed as per request */}
      {/* Save Draft Confirmation */}
      {showSaveDraftConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSaveDraftConfirm(false)} />
          <div className="relative z-10 w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Save as Draft?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Your media will be uploaded and saved as a draft. You can continue editing later.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => setShowSaveDraftConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
                onClick={executeSaveDraft}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
          >
            <FiArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <HiOutlineSparkles className="w-5 h-5 text-purple-500" />
            <h1 className="text-lg sm:text-xl font-semibold">
              {isEditMode ? 'Edit Collection' : 'Create Collection'}
            </h1>
          </div>

          <div className="w-9" aria-hidden="true" />
        </div>
        {/* Upload Progress Banner */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 rounded-2xl glass-panel-dark border border-purple-500/30"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                <span className="text-white font-medium">Uploading files... {progress}%</span>
                <button
                  type="button"
                  onClick={() => {
                    cancelUploads();
                    toast.info('Upload cancelled');
                  }}
                  className="ml-auto px-3 py-1 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
              <div className="h-2 w-full rounded-full bg-purple-900/40">
                <div
                  className="h-2 rounded-full bg-purple-500 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-6 items-start mb-8">
          {/* Media Section */}
          <section className="h-full">
            {files.length === 0 ? (
              <MediaUploadZone
                onFilesUpload={mediaStore.addFiles}
                picker={picker}
                disabled={disabled}
                maxFiles={20}
              />
            ) : (
              <div className="space-y-4 h-full">
                {/* Main Preview - NO background; media defines layout */}
                <div className="relative rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm">
                  <div
                    className="relative w-full flex justify-center"
                  >
                    <AnimatePresence mode="wait">
                      {selectedFile && (
                        <motion.div
                          key={selectedFile.id || selectedFile.url}
                          className="w-fit max-w-full"
                          initial={{ opacity: 0.6, scale: 0.99 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.99 }}
                          transition={{ duration: 0.25 }}
                        >
                          <MediaRenderer
                            kind={selectedFile.kind === 'video' ? 'video' : 'image'}
                            src={selectedFile.url}
                            alt={selectedFile.file?.name || 'Preview'}
                            maxHeightClassName="max-h-[620px]"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Floating Action Bar */}
                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center justify-center gap-2">
                        <ActionButton
                          icon={<FiTrash2 className="w-4 h-4" />}
                          label="Delete"
                          onClick={() => selectedFile?.id && handleDelete(selectedFile.id)}
                          disabled={disabled}
                        />
                        <ActionButton
                          icon={<FiStar className={`w-4 h-4 ${coverIndex === selectedIndex ? 'fill-purple-400 text-purple-400' : ''}`} />}
                          label={coverIndex === selectedIndex ? 'Cover' : 'Set as Cover'}
                          onClick={() => handleSetCover(selectedIndex)}
                          disabled={disabled}
                          active={coverIndex === selectedIndex}
                        />
                        <ActionButton
                          icon={<FiMove className="w-4 h-4" />}
                          label="Reorder"
                          onClick={() => {}}
                          disabled
                        />
                        <ActionButton
                          icon={<FiMaximize2 className="w-4 h-4" />}
                          label="Fullscreen"
                          onClick={openFullscreen}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thumbnail Strip */}
                <ThumbnailStrip
                  items={files}
                  selectedIndex={selectedIndex}
                  coverIndex={coverIndex}
                  onSelect={setSelectedIndex}
                  onDelete={handleDelete}
                  onSetCover={handleSetCover}
                  onAddMore={!isEditMode ? picker.open : undefined}
                  disabled={disabled}
                  progressById={perFileProgress}
                />

                {/* Hidden file input */}
                <input
                  ref={picker.inputRef}
                  type="file"
                  multiple
                  onChange={picker.handlers.onInputChange}
                  className="hidden"
                  accept="image/*,video/*"
                  disabled={disabled}
                />

                {/* Image info */}
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile?.kind === 'video' ? 'Video' : 'Image'} {selectedIndex + 1} of {files.length}
                  {selectedFile?.file?.name && ` • ${selectedFile.file.name}`}
                  {selectedFile?.file?.size && ` • ${(selectedFile.file.size / (1024 * 1024)).toFixed(1)} MB`}
                </p>
              </div>
            )}
          </section>

          {/* Collection Details */}
          <div className="h-full">
            <FormSection
              title="Collection Details"
              icon="📝"
              isOpen={expandedSections.details}
              onToggle={() => toggleSection('details')}
              className="h-full flex flex-col"
            >
              <div className="space-y-4">
                <TextField
                  label="Collection Title"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="e.g., Summer Breeze '24"
                  disabled={disabled}
                  variant="glass"
                  required
                />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Tell Your Story
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Inspired by the warm coastal breeze of Lagos..."
                    rows={4}
                    disabled={disabled}
                    className="w-full px-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                  />
                  <p className="text-right text-xs text-gray-600 dark:text-gray-400">
                    {description.length} / 500 characters
                  </p>
                </div>

                <UniversalSelect
                  label="Category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder={loadingCategories ? 'Loading...' : 'Select a category'}
                  disabled={disabled}
                />

                {/* Tags Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    🏷️ Tags (up to 10)
                  </label>
                  
                  <div className="p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    {/* Selected tags */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedTags.map((tag, idx) => (
                          <motion.span
                            key={tag}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${tagStylePalette[idx % tagStylePalette.length]}`}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-1 hover:text-purple-200 transition-colors"
                            >
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          </motion.span>
                        ))}
                      </div>
                    )}

                    {/* Search input */}
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        onKeyDown={handleTagInputKeyDown}
                        placeholder="Search or create a tag..."
                        disabled={disabled || selectedTags.length >= 10}
                        className="w-full pl-10 pr-12 py-2.5 rounded-xl glass-light bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                      <button
                        type="button"
                        onClick={() => tagSearch.trim() && addTag(tagSearch.trim().toLowerCase().replace(/\s+/g, '-'))}
                        disabled={disabled || selectedTags.length >= 10 || !tagSearch.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:shadow-none"
                        aria-label="Add tag"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add
                      </button>
                    </div>

                    {/* Popular tags */}
                    {filteredSuggestions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Popular Tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {filteredSuggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => addTag(tag)}
                              disabled={disabled}
                              className="tag-badge-outline px-3 py-1.5 rounded-full text-sm font-medium"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </FormSection>
          </div>
        </div>

        {/* Form Sections */}
        <div className="space-y-4">
          {/* Pricing & Availability */}
          <FormSection
            title="Pricing & Availability"
            icon="💰"
            isOpen={expandedSections.pricing}
            onToggle={() => toggleSection('pricing')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Price Range</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="15,000"
                      disabled={disabled}
                      className="w-full pl-8 pr-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-gray-600 dark:text-gray-400">Minimum Price</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="45,000"
                      disabled={disabled}
                      className="w-full pl-8 pr-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-gray-600 dark:text-gray-400">Maximum Price</span>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="mt-8 p-3 rounded-xl bg-blue-50 border border-blue-200 text-gray-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-100 flex items-start gap-2">
                <FiInfo className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Setting a price range helps buyers know what to expect. Leave empty if prices vary significantly.
                </p>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 mt-4">
                <label className="flex items-start gap-3 p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:border-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAvailableInStore}
                    onChange={(e) => setIsAvailableInStore(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 mt-0.5 rounded border-gray-400 dark:border-gray-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-transparent"
                  />
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">Available in Physical Store</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Show "Visit Store" option on collection</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:border-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={isMadeToOrder}
                    onChange={(e) => setIsMadeToOrder(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 mt-0.5 rounded border-gray-400 dark:border-gray-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-transparent"
                  />
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">Made to Order</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Show "Custom Order" badge on collection</p>
                  </div>
                </label>
              </div>
            </div>
          </FormSection>

          {/* Targeting & Visibility */}
          <FormSection
            title="Targeting & Visibility"
            icon="🎯"
            isOpen={expandedSections.targeting}
            onToggle={() => toggleSection('targeting')}
          >
            <div className="space-y-6">
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Target Audience</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {(['EVERYBODY', 'MALE', 'FEMALE'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      disabled={disabled}
                      className={`
                        flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all
                        ${type === option
                          ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-200 dark:hover:border-white/20'
                        }
                      `}
                    >
                      {option === 'EVERYBODY' ? 'Everybody' : option === 'MALE' ? 'Men' : 'Women'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Who Can See This?</label>
                <div className="space-y-3">
                  {([
                    { value: 'PUBLIC', emoji: '🌍', label: 'Public', desc: 'Everyone can see this collection' },
                    { value: 'PRIVATE', emoji: '🔒', label: 'Private', desc: 'Only you and collaborators can see' },
                  ] as const).map((option) => (
                    <label
                      key={option.value}
                      className={`
                        flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${visibility === option.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-200 dark:border-white/10 glass-light hover:border-purple-200 dark:hover:border-white/20'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={visibility === option.value}
                        onChange={() => setVisibility(option.value)}
                        disabled={disabled}
                        className="sr-only"
                      />
                      <span className="text-2xl">{option.emoji}</span>
                      <div>
                        <span className={`font-medium ${visibility === option.value ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
                          {option.label}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>
        </div>
      </main>

      {/* Actions Footer - Integrated into flow */}
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 pb-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {lastSaved
              ? `Collection saved locally • Last edit: ${formatTimeAgo(lastSaved)}`
              : 'Unsaved changes'}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={disabled}
              className="flex-1 sm:flex-none py-3 px-6 rounded-xl glass-light border border-gray-200/70 dark:border-white/15 text-gray-900 dark:text-white font-medium hover:bg-white/40 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiFile className="w-4 h-4" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={disabled}
              className="hidden"
            >
              Hidden duplicate
            </button>
            <button
              type="button"
              onClick={handlePublishClick}
              disabled={disabled}
              className="flex-1 sm:flex-none py-3 px-6 rounded-xl gradient-primary text-white font-medium shadow-lg shadow-purple-500/25 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <HiOutlineSparkles className="w-5 h-5" />
              {isEditMode ? 'Update Collection' : 'Publish Collection'}
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Publish Modal */}
      {/* Pre-Publish Modal */}
      <PrePublishConfirmModal
        isOpen={showPublishModal}
        onClose={handleModalCloseRequest}
        onConfirm={handlePublishConfirm}
        onEdit={() => setShowPublishModal(false)}
        summary={collectionSummary}
      />

      {/* Cancel/Exit prompt */}
      <AnimatePresence>
        {showCancelPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-md rounded-2xl glass-panel-dark border border-white/10 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-200 font-semibold">?</div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">What would you like to do?</p>
                  <p className="text-sm text-white/70">Return to editing or cancel the entire process.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleCancelPromptChoice('return')}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white font-medium hover:border-purple-300/40"
                >
                  Return to creation
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelPromptChoice('cancel')}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-400"
                >
                  Cancel entire process
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && fullscreenFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeFullscreen}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="relative w-full h-full max-w-6xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                    onClick={handleFullscreenPrev}
                    disabled={(fullscreenIndex ?? selectedIndex) <= 0}
                    aria-label="Previous media"
                  >
                    <FiChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                    onClick={handleFullscreenNext}
                    disabled={(fullscreenIndex ?? selectedIndex) >= files.length - 1}
                    aria-label="Next media"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1 disabled:opacity-50"
                    onClick={() => setFullscreenZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                    disabled={fullscreenZoom <= 1}
                  >
                    <FiZoomOut className="w-4 h-4" />
                    <span>Zoom out</span>
                  </button>
                  <button
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
                    onClick={() => setFullscreenZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  >
                    <FiZoomIn className="w-4 h-4" />
                    <span>Zoom in</span>
                  </button>
                  <button
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm"
                    onClick={() => setFullscreenZoom(1)}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="relative flex-1 min-h-[320px] flex items-center justify-center overflow-auto rounded-2xl border border-white/10">
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
                  onClick={handleFullscreenPrev}
                  disabled={(fullscreenIndex ?? selectedIndex) <= 0}
                  aria-label="Previous"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>

                <div style={{ transform: `scale(${fullscreenZoom})`, transition: 'transform 0.2s ease' }}>
                  <MediaRenderer
                    kind={fullscreenFile.kind === 'video' ? 'video' : 'image'}
                    src={fullscreenFile.url}
                    alt="Fullscreen preview"
                    maxHeightClassName="max-h-[80vh]"
                    className="rounded-none"
                  />
                </div>

      {/* Draft Preview (read-only) */}
      <AnimatePresence>
        {showDraftPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowDraftPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl glass-panel-dark border border-white/10 p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">Draft snapshot</p>
                  <h3 className="text-xl font-semibold text-white">{title || 'Untitled collection'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDraftPreview(false)}
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Close draft preview"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {selectedFile?.url && (
                <div className="w-full rounded-xl">
                  <MediaRenderer
                    kind={selectedFile.kind === 'video' ? 'video' : 'image'}
                    src={selectedFile.url}
                    alt="Draft cover"
                    maxHeightClassName="max-h-[420px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/90 text-sm">
                <div className="space-y-2">
                  <p><span className="text-white/60">Description:</span> {description || '—'}</p>
                  <p><span className="text-white/60">Category:</span> {selectedCategory?.name || '—'}</p>
                  <p><span className="text-white/60">Audience:</span> {type}</p>
                </div>
                <div className="space-y-2">
                  <p><span className="text-white/60">Visibility:</span> {visibility}</p>
                  <p><span className="text-white/60">Price Range:</span> {minPrice || maxPrice ? `${minPrice || '—'} - ${maxPrice || '—'}` : '—'}</p>
                  <p><span className="text-white/60">Tags:</span> {selectedTags.length ? selectedTags.join(', ') : '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-white/70 text-sm mb-2">Media</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {files.map((file) => {
                    const withUrl = resolveMediaWithUrl(file);
                    if (!withUrl) return null;
                    return (
                      <div key={withUrl.id} className="rounded-xl flex items-center justify-center">
                        <MediaRenderer
                          kind={withUrl.kind === 'video' ? 'video' : 'image'}
                          src={withUrl.url}
                          alt=""
                          maxHeightClassName="max-h-32"
                          maxWidthClassName="max-w-[240px]"
                        />
                      </div>
                    );
                  })}
                  {files.length === 0 && (
                    <div className="text-white/60 text-sm">No media yet</div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
                  onClick={handleFullscreenNext}
                  disabled={(fullscreenIndex ?? selectedIndex) >= files.length - 1}
                  aria-label="Next"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center text-sm text-white/70">
                {files.length > 0 && (
                  <span>
                    Image {(fullscreenIndex ?? selectedIndex) + 1} of {files.length}
                    {fullscreenFile.file?.name ? ` • ${fullscreenFile.file.name}` : ''}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * FormSection - Collapsible card for form sections
 */
const FormSection: React.FC<{
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, isOpen, onToggle, children, className }) => (
  <div className={`rounded-2xl glass-panel border border-gray-200 dark:border-white/10 overflow-hidden bg-white/80 dark:bg-gray-900/60 backdrop-blur ${className ?? ''}`}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-lg">
          {icon}
        </span>
        <span className="text-lg font-semibold text-gray-900 dark:text-white">{title}</span>
      </div>
      {isOpen ? (
        <FiChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      ) : (
        <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      )}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4 flex-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/**
 * ActionButton - Button for the floating action bar
 */
const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}> = ({ icon, label, onClick, disabled, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10
      text-gray-900 dark:text-white text-sm font-medium transition-all
      ${active ? 'bg-purple-500/20 border-purple-500/50' : 'hover:bg-white/10'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

/**
 * formatTimeAgo - Format date as relative time
 */
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// ============================================================================
// WRAPPER WITH PROVIDER
// ============================================================================

const CreateCollectionPage: React.FC = () => (
  <MediaProvider>
    <CreateCollectionInner />
  </MediaProvider>
);

export default CreateCollectionPage;
