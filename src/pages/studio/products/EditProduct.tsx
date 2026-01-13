import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  Copy, 
  Archive, 
  Trash2, 
  Crop, 
  ArrowLeftRight, 
  GripVertical, 
  Plus, 
  CheckCircle, 
  Video, 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  X,
  Loader2,
  Save
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

import { toast } from 'sonner';
import MediaRenderer from '@/components/media/MediaRenderer';
import { productApi, type ProductCreateDto, type Category, type ProductVariant } from '@/api/ProductApi';
import { brandApi } from '@/api/BrandApi';


// =====================
// Types
// =====================

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  price: number;
  compareAtPrice: number;
  costPerItem: number;
  currency: string;
  sku: string;
  weight: number;
  weightUnit: 'kg' | 'lb';
  materials: string;
  careInstructions: string;
  returnsEligible: boolean;
  sustainabilityClaim: boolean;
  trackInventory: boolean;
  allowBackorders: boolean;
  stock: number;
  lowStockThreshold: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isPhysicalProduct: boolean;
  customsRegion: string;
  onSale: boolean;
  mediaIds: string[];
  variants: ProductVariant[];
}

const defaultFormState: FormState = {
  title: '',
  description: '',
  categoryId: '',
  tags: [],
  price: 0,
  compareAtPrice: 0,
  costPerItem: 0,
  currency: 'NGN',
  sku: '',
  weight: 0,
  weightUnit: 'kg',
  materials: '',
  careInstructions: '',
  returnsEligible: true,
  sustainabilityClaim: false,
  trackInventory: true,
  allowBackorders: false,
  stock: 0,
  lowStockThreshold: 5,
  status: 'ACTIVE',
  isPhysicalProduct: true,
  customsRegion: 'NG',
  onSale: false,
  mediaIds: [],
  variants: [],
};

// =====================
// Currency Formatting
// =====================

const formatCurrency = (amount: number, currency = 'NGN'): string => {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₦${amount.toLocaleString()}`;
  }
};

// =====================
// Component
// =====================

const EditProduct: React.FC = () => {
  const navigate = useNavigate();
  const { id: productId } = useParams<{ id: string }>();
  const user = useSelector((state: RootState) => state.user.profile);

  const isEditMode = Boolean(productId);
  const pageTitle = isEditMode ? 'Edit Product' : 'Create Product';

  // State
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [tagInput, setTagInput] = useState('');
  
  // Media state (simplified - using URLs for display)
  const [mediaUrls, setMediaUrls] = useState<Array<{ id: string; url: string; isPrimary?: boolean }>>([]);

  const primaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    Array<{ tempId: string; file: File; previewUrl: string; isPrimary: boolean }>
  >([]);

  const maxMediaCount = 8;
  const canAddMoreMedia = mediaUrls.length < maxMediaCount;

  // Calculate profit margin
  const profitMargin = useMemo(() => {
    if (form.price <= 0 || form.costPerItem <= 0) return { margin: 0, profit: 0 };
    const profit = form.price - form.costPerItem;
    const margin = (profit / form.price) * 100;
    return { margin: Math.round(margin), profit };
  }, [form.price, form.costPerItem]);

  const variantTotalStock = useMemo(() => {
    if (!form.variants.length) return 0;
    return form.variants.reduce((sum, v) => sum + (Number.isFinite(v.stock) ? v.stock : 0), 0);
  }, [form.variants]);

  const variantKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of form.variants) {
      const key = `${(v.color ?? '').trim().toLowerCase()}::${(v.size ?? '').trim().toLowerCase()}`;
      if (key === '::') continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [form.variants]);

  const hasDuplicateVariants = useMemo(() => {
    for (const [, count] of variantKeyCounts) {
      if (count > 1) return true;
    }
    return false;
  }, [variantKeyCounts]);

  // =====================
  // Data Loading
  // =====================

  // Load collections (required by backend as `collectionId`)
  useEffect(() => {
    let mounted = true;
    const loadCollections = async () => {
      try {
        if (!user?.id) return;
        const collections = await brandApi.getCollections(user.id, { visibility: 'all' });
        if (!mounted) return;
        const mapped: Category[] = (collections || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.title || c.name || 'Untitled collection'),
          slug: String(c.id),
        }));
        setCategories(mapped);
      } catch (error) {
        console.error('Failed to load collections', error);
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    };
    void loadCollections();
    return () => { mounted = false; };
  }, [user?.id]);

  // Load product if editing
  useEffect(() => {
    if (!isEditMode || !productId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadProduct = async () => {
      try {
        setLoading(true);
        const product = await productApi.getProduct(productId);
        if (!product || !mounted) return;

        setForm({
          title: product.title || product.name || '',
          description: product.description || '',
          categoryId: (product as any).collectionId || product.categoryId || '',
          tags: product.tags || [],
          price: product.price || 0,
          compareAtPrice: (product as any).salePrice || product.compareAtPrice || 0,
          costPerItem: product.costPerItem || 0,
          currency: (product as any)?.brand?.currency || product.currency || 'NGN',
          sku: product.sku || '',
          weight: product.weight || 0,
          weightUnit: product.weightUnit || 'kg',
          materials: product.materials || '',
          careInstructions: product.careInstructions || '',
          returnsEligible: product.returnsEligible ?? true,
          sustainabilityClaim: product.sustainabilityClaim ?? false,
          trackInventory: product.trackInventory ?? true,
          allowBackorders: product.allowBackorders ?? false,
          stock: product.stock ?? product.totalStock ?? 0,
          lowStockThreshold: product.lowStockThreshold ?? 5,
          status: product.status || 'ACTIVE',
          isPhysicalProduct: product.isPhysicalProduct ?? true,
          customsRegion: product.customsRegion || 'NG',
          onSale: Boolean(((product as any).salePrice ?? product.compareAtPrice) && ((product as any).salePrice ?? product.compareAtPrice) < product.price),
          mediaIds: product.mediaIds || [],
          variants: (product.variants && product.variants.length)
            ? product.variants
            : (() => {
                const sizeStock = (product as any).sizeStock as Record<string, number> | undefined;
                if (!sizeStock) return [];
                return Object.entries(sizeStock).map(([size, stock]) => ({
                  size,
                  stock: typeof stock === 'number' ? stock : 0,
                })) as ProductVariant[];
              })(),
        });

        // Set media for display
        if (product.media?.length) {
          setMediaUrls(product.media.map(m => ({ id: m.id, url: m.url, isPrimary: m.isPrimary })));
        } else if (product.images?.length) {
          setMediaUrls(product.images.map((url, i) => ({ id: `img-${i}`, url, isPrimary: i === 0 })));
        }
      } catch (error) {
        console.error('Failed to load product', error);
        toast.error('Failed to load product');
        navigate('/studio/store');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadProduct();
    return () => { mounted = false; };
  }, [isEditMode, productId, navigate]);

  // =====================
  // Form Handlers
  // =====================

  const updateForm = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const addVariant = useCallback(() => {
    const next: ProductVariant = {
      size: '',
      color: '',
      sku: '',
      price: undefined,
      stock: 0,
    };
    updateForm('variants', [...form.variants, next]);
  }, [form.variants, updateForm]);

  const updateVariant = useCallback(
    (index: number, patch: Partial<ProductVariant>) => {
      const next = form.variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
      updateForm('variants', next);
    },
    [form.variants, updateForm],
  );

  const removeVariant = useCallback(
    (index: number) => {
      const next = form.variants.filter((_, i) => i !== index);
      updateForm('variants', next);
    },
    [form.variants, updateForm],
  );

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      updateForm('tags', [...form.tags, tag]);
      setTagInput('');
    }
  }, [tagInput, form.tags, updateForm]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    updateForm('tags', form.tags.filter(t => t !== tagToRemove));
  }, [form.tags, updateForm]);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  // =====================
  // Save / Submit
  // =====================

  const handleSave = useCallback(async (asDraft = false) => {
    // Validation
    if (!form.title.trim()) {
      toast.error('Please enter a product title');
      return;
    }
    if (!form.categoryId) {
      toast.error('Please select a collection');
      return;
    }
    if (form.price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    if (form.onSale && form.compareAtPrice > 0 && form.compareAtPrice >= form.price) {
      toast.error('Sale price must be less than the price');
      return;
    }
    if (form.variants.length > 0) {
      if (hasDuplicateVariants) {
        toast.error('Please remove duplicate variant options (same size/color)');
        return;
      }
      const invalid = form.variants.find((v) => Number.isNaN(Number(v.stock)) || v.stock < 0);
      if (invalid) {
        toast.error('Variant stock must be 0 or greater');
        return;
      }
    } else {
      if (form.trackInventory && (Number.isNaN(Number(form.stock)) || form.stock < 0)) {
        toast.error('Stock must be 0 or greater');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: ProductCreateDto = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
        tags: form.tags,
        price: form.price,
        compareAtPrice: form.onSale ? form.compareAtPrice : undefined,
        costPerItem: form.costPerItem || undefined,
        currency: form.currency,
        sku: form.sku || undefined,
        weight: form.weight || undefined,
        weightUnit: form.weightUnit,
        materials: form.materials || undefined,
        careInstructions: form.careInstructions || undefined,
        returnsEligible: form.returnsEligible,
        sustainabilityClaim: form.sustainabilityClaim,
        trackInventory: form.trackInventory,
        allowBackorders: form.allowBackorders,
        stock: form.variants.length > 0 ? variantTotalStock : form.stock,
        lowStockThreshold: form.lowStockThreshold,
        status: asDraft ? 'DRAFT' : form.status,
        isPhysicalProduct: form.isPhysicalProduct,
        customsRegion: form.customsRegion || undefined,
        mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
        variants: form.variants.length > 0
          ? form.variants.map((v) => ({
              ...v,
              size: v.size?.trim() || undefined,
              color: v.color?.trim() || undefined,
              sku: v.sku?.trim() || undefined,
              price: typeof v.price === 'number' && v.price > 0 ? v.price : undefined,
              stock: Number.isFinite(v.stock) ? v.stock : 0,
            }))
          : undefined,
      };

      if (isEditMode && productId) {
        await productApi.updateProduct(productId, payload);
        toast.success('Product updated successfully');
      } else {
        const created = await productApi.createProduct(payload);

        // Upload pending media after we have a product id
        if (pendingMediaFiles.length > 0) {
          const uploads = [...pendingMediaFiles];
          // Ensure exactly one primary (fallback to first)
          if (!uploads.some((u) => u.isPrimary) && uploads[0]) {
            uploads[0] = { ...uploads[0], isPrimary: true };
          }

          const uploadedIds: string[] = [];
          for (const u of uploads) {
            const uploaded = await productApi.uploadProductMedia(created.id, u.file, u.isPrimary);
            uploadedIds.push(uploaded.id);
          }

          if (uploadedIds.length > 0) {
            await productApi.updateProduct(created.id, { mediaIds: uploadedIds });
          }
        }

        toast.success(asDraft ? 'Draft saved successfully' : 'Product created successfully');
      }

      setHasChanges(false);
      navigate('/studio/store');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to save product';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [form, hasDuplicateVariants, isEditMode, navigate, pendingMediaFiles, productId, variantTotalStock]);

  const pushMediaPreviews = useCallback(
    (files: File[], { makePrimary }: { makePrimary: boolean }) => {
      if (!files.length) return;

      const remaining = Math.max(0, maxMediaCount - mediaUrls.length);
      const toAdd = files.slice(0, remaining);
      if (toAdd.length === 0) {
        toast.error(`You can upload up to ${maxMediaCount} images`);
        return;
      }

      const now = Date.now();
      const nextPending = toAdd.map((file, idx) => {
        const previewUrl = URL.createObjectURL(file);
        return {
          tempId: `pending-${now}-${idx}-${Math.random().toString(16).slice(2)}`,
          file,
          previewUrl,
          isPrimary: false,
        };
      });

      setPendingMediaFiles((prev) => {
        const merged = [...prev, ...nextPending];
        // Only allow 1 primary across pending+uploaded
        if (makePrimary) {
          const primaryTempId = nextPending[0]?.tempId;
          return merged.map((m) => ({ ...m, isPrimary: m.tempId === primaryTempId }));
        }
        return merged;
      });

      setMediaUrls((prev) => {
        const base = makePrimary
          ? prev.map((m) => ({ ...m, isPrimary: false }))
          : prev;
        const primaryTempId = makePrimary ? nextPending[0]?.tempId : null;
        const mapped = nextPending.map((m) => ({
          id: m.tempId,
          url: m.previewUrl,
          isPrimary: makePrimary ? m.tempId === primaryTempId : false,
        }));
        // If we have no primary at all, set first as primary
        const next = [...base, ...mapped];
        if (!next.some((m) => m.isPrimary) && next[0]) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      });
    },
    [mediaUrls.length],
  );

  const handlePrimaryFilesSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    if (isEditMode && productId) {
      if (!canAddMoreMedia && mediaUrls.length > 0) {
        toast.error(`You can upload up to ${maxMediaCount} images`);
        return;
      }
      try {
        const file = files[0];
        const uploaded = await productApi.uploadProductMedia(productId, file, true);
        updateForm('mediaIds', Array.from(new Set([...(form.mediaIds ?? []), uploaded.id])));
        setMediaUrls((prev) => {
          const next = prev.map((m) => ({ ...m, isPrimary: false }));
          next.unshift({ id: uploaded.id, url: uploaded.url, isPrimary: true });
          return next.slice(0, maxMediaCount);
        });
        toast.success('Primary image uploaded');
      } catch (err) {
        console.error('Primary upload failed', err);
        toast.error('Failed to upload image');
      }
      return;
    }

    pushMediaPreviews(files, { makePrimary: true });
  };

  const handleGalleryFilesSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    if (isEditMode && productId) {
      const remaining = Math.max(0, maxMediaCount - mediaUrls.length);
      const toUpload = files.slice(0, remaining);
      if (toUpload.length === 0) {
        toast.error(`You can upload up to ${maxMediaCount} images`);
        return;
      }
      try {
        const uploadedIds: string[] = [];
        const uploadedItems: Array<{ id: string; url: string }> = [];
        for (const f of toUpload) {
          const uploaded = await productApi.uploadProductMedia(productId, f, false);
          uploadedIds.push(uploaded.id);
          uploadedItems.push(uploaded);
        }
        updateForm('mediaIds', Array.from(new Set([...(form.mediaIds ?? []), ...uploadedIds])));
        setMediaUrls((prev) => [...prev, ...uploadedItems.map((u) => ({ id: u.id, url: u.url, isPrimary: false }))].slice(0, maxMediaCount));
        toast.success('Images uploaded');
      } catch (err) {
        console.error('Gallery upload failed', err);
        toast.error('Failed to upload images');
      }
      return;
    }

    pushMediaPreviews(files, { makePrimary: false });
  };

  const setPrimaryMedia = useCallback(
    async (mediaId: string) => {
      setMediaUrls((prev) => prev.map((m) => ({ ...m, isPrimary: m.id === mediaId })));

      setPendingMediaFiles((prev) =>
        prev.map((p) => ({ ...p, isPrimary: p.tempId === mediaId })),
      );

      // If this is an uploaded media id, update server
      if (isEditMode && productId && !mediaId.startsWith('pending-')) {
        try {
          await productApi.setPrimaryMedia(productId, mediaId);
        } catch (err) {
          console.error('Failed to set primary media', err);
          toast.error('Could not set primary image');
        }
      }
    },
    [isEditMode, productId],
  );

  const handleDuplicate = useCallback(async () => {
    if (!productId) return;
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success('Product duplicated');
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch (error) {
      toast.error('Failed to duplicate product');
    }
  }, [productId, navigate]);

  const handleArchive = useCallback(async () => {
    if (!productId) return;
    try {
      await productApi.archiveProduct(productId);
      toast.success('Product archived');
      navigate('/studio/store');
    } catch (error) {
      toast.error('Failed to archive product');
    }
  }, [productId, navigate]);

  const handleDelete = useCallback(async () => {
    if (!productId) return;
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }
    try {
      await productApi.deleteProduct(productId);
      toast.success('Product deleted');
      navigate('/studio/store');
    } catch (error) {
      toast.error('Failed to delete product');
    }
  }, [productId, navigate]);

  const handleDiscard = useCallback(() => {
    if (hasChanges && !window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
      return;
    }
    navigate(-1);
  }, [hasChanges, navigate]);

  // =====================
  // Loading State
  // =====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  // =====================
  // Render
  // =====================

  return (
    <div className="flex flex-col min-h-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#0f0f0f] text-gray-900 dark:text-[#e5e5e5] font-sans overflow-hidden">
        
      {/* Sticky Header */}
      <header className="sticky top-16 z-40 bg-white/80 dark:bg-[#0f0f0f]/85 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 w-full px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
          {/* Left: Breadcrumbs & Title */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 gap-2">
              <button onClick={() => navigate('/studio/store')} className="hover:text-gray-900 dark:hover:text-white transition-colors flex items-center">
                <ArrowLeft className="w-3 h-3 mr-1" /> Store
              </button>
              <span>/</span>
              <span>{pageTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {form.title || 'New Product'}
              </h1>
              {isEditMode && (
                <div className="relative group">
                  <button 
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.status === 'ACTIVE' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                        : form.status === 'DRAFT'
                        ? 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      form.status === 'ACTIVE' ? 'bg-green-400' : form.status === 'DRAFT' ? 'bg-gray-400' : 'bg-orange-400'
                    }`} />
                    {form.status === 'ACTIVE' ? 'Active' : form.status === 'DRAFT' ? 'Draft' : 'Archived'}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {isEditMode && (
              <>
                <div className="hidden md:flex items-center gap-2 mr-2">
                  <button onClick={handleDuplicate} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={handleArchive} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Archive">
                    <Archive className="w-4 h-4" />
                  </button>
                  <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-8 w-px bg-white/10 hidden md:block" />
              </>
            )}
            <button 
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-sm font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditMode ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
          {/* LEFT COLUMN: Media (30% approx -> 4 cols) */}
          <div className="lg:col-span-4 space-y-6">
              
            {/* Media Gallery */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Media</h3>
                <span className="text-xs text-gray-400">{mediaUrls.length} of {maxMediaCount} used</span>
              </div>

              <input
                ref={primaryFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePrimaryFilesSelected}
              />
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryFilesSelected}
              />

              {/* Main Image */}
              {mediaUrls.length > 0 ? (
                <div className="relative w-full rounded-lg mb-3 group border border-white/5">
                  <MediaRenderer
                    kind="image"
                    src={mediaUrls.find(m => m.isPrimary)?.url || mediaUrls[0]?.url}
                    alt="Main Product"
                    maxHeightClassName="max-h-[60vh]"
                    className="w-full rounded-lg"
                    mediaClassName="rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => primaryFileInputRef.current?.click()}
                      className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                      title="Replace primary"
                    >
                      <Crop className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryFileInputRef.current?.click()}
                      disabled={!canAddMoreMedia}
                      className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                      title="Add more"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white">Primary</div>
                </div>
              ) : (
                <div
                  onClick={() => primaryFileInputRef.current?.click()}
                  className="aspect-square rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all cursor-pointer mb-3"
                >
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="text-sm">Upload Primary Image</span>
                  <span className="text-xs text-gray-600 mt-1">Min 1200x1200px</span>
                </div>
              )}

              {/* Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {mediaUrls.slice(1, 4).map((media, i) => (
                  <button
                    type="button"
                    key={media.id}
                    onClick={() => void setPrimaryMedia(media.id)}
                    className="relative rounded-lg border border-white/5 group cursor-pointer"
                    title="Set as primary"
                  >
                    <MediaRenderer
                      kind="image"
                      src={media.url}
                      alt={`Gallery ${i}`}
                      maxHeightClassName="max-h-24"
                      className="w-full rounded-lg"
                      mediaClassName="rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <GripVertical className="w-4 h-4 text-white/70" />
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => galleryFileInputRef.current?.click()}
                  disabled={!canAddMoreMedia}
                  className="aspect-square rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mb-1" />
                  <span className="text-[10px]">Add</span>
                </button>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h4 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Required Shots</h4>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2">
                      {mediaUrls.length > 0 ? <CheckCircle className="w-3 h-3 text-green-400" /> : <div className="w-3 h-3 border border-gray-500 rounded-full" />}
                      Front View
                    </span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2">
                      {mediaUrls.length > 1 ? <CheckCircle className="w-3 h-3 text-green-400" /> : <div className="w-3 h-3 border border-gray-500 rounded-full" />}
                      Back View
                    </span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 flex items-center gap-2">
                      {mediaUrls.length > 2 ? <CheckCircle className="w-3 h-3 text-green-400" /> : <div className="w-3 h-3 border border-gray-500 rounded-full" />}
                      Detail Shot
                    </span>
                  </li>
                  <li className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-2"><div className="w-3 h-3 border border-gray-500 rounded-full" /> Lifestyle</span>
                    <span className="text-purple-400 cursor-pointer hover:underline">Upload</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Video Section */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Product Video</h3>
              </div>
              <div className="rounded-lg border border-dashed border-white/20 p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-3 text-purple-400">
                  <Video className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-300 font-medium">Add Video</p>
                <p className="text-xs text-gray-500 mt-1">MP4, WebM up to 50MB</p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Details (70% approx -> 8 cols) */}
          <div className="lg:col-span-8 space-y-6">
              
            {/* Basic Info */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-6">Basic Information</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Product Title *</label>
                  <input 
                    type="text" 
                    value={form.title} 
                    onChange={(e) => updateForm('title', e.target.value)}
                    placeholder="Enter product title"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Collection</label>
                    <div className="relative">
                      <select 
                        value={form.categoryId}
                        onChange={(e) => updateForm('categoryId', e.target.value)}
                        disabled={categoriesLoading}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white appearance-none cursor-pointer focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all disabled:opacity-50"
                      >
                        <option value="">Select collection</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-3 pointer-events-none text-gray-400">
                        {categoriesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags</label>
                    <div className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 min-h-[42px] flex flex-wrap gap-2 items-center">
                      {form.tags.map((tag) => (
                        <span key={tag} className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                          {tag} <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => handleRemoveTag(tag)} />
                        </span>
                      ))}
                      <input 
                        type="text" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={handleAddTag}
                        placeholder="Add tag..." 
                        className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-20 flex-1 p-0 focus:ring-0" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                  <div className="bg-black/20 border border-white/10 rounded-lg overflow-hidden">
                    <div className="bg-white/5 border-b border-white/10 px-3 py-2 flex items-center gap-3">
                      <button type="button" className="text-gray-400 hover:text-white"><Bold className="w-3 h-3" /></button>
                      <button type="button" className="text-gray-400 hover:text-white"><Italic className="w-3 h-3" /></button>
                      <button type="button" className="text-gray-400 hover:text-white"><Underline className="w-3 h-3" /></button>
                      <div className="w-px h-4 bg-white/10" />
                      <button type="button" className="text-gray-400 hover:text-white"><List className="w-3 h-3" /></button>
                      <button type="button" className="text-gray-400 hover:text-white"><ListOrdered className="w-3 h-3" /></button>
                      <div className="w-px h-4 bg-white/10" />
                      <button type="button" className="text-gray-400 hover:text-white"><LinkIcon className="w-3 h-3" /></button>
                    </div>
                    <textarea 
                      className="w-full bg-transparent border-none p-4 text-sm text-gray-300 focus:ring-0 h-32 resize-none focus:outline-none" 
                      placeholder="Describe your product..."
                      value={form.description}
                      onChange={(e) => updateForm('description', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-white">Pricing</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">On Sale</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.onSale}
                      onChange={(e) => updateForm('onSale', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Price *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">₦</span>
                    <input 
                      type="number" 
                      value={form.price || ''} 
                      onChange={(e) => updateForm('price', Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Sale Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">₦</span>
                    <input 
                      type="number" 
                      value={form.compareAtPrice || ''} 
                      onChange={(e) => updateForm('compareAtPrice', Number(e.target.value))}
                      placeholder="0"
                      disabled={!form.onSale}
                      className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all disabled:opacity-50" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Cost per Item</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">₦</span>
                    <input 
                      type="number" 
                      value={form.costPerItem || ''} 
                      onChange={(e) => updateForm('costPerItem', Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                    />
                  </div>
                  {profitMargin.margin > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Margin: {profitMargin.margin}% • Profit: {formatCurrency(profitMargin.profit, form.currency)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Variants */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">Variants</h2>
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-purple-400 text-sm hover:text-purple-300 font-medium"
                >
                  + Add Variant
                </button>
              </div>

              {hasDuplicateVariants && (
                <div className="px-6 py-3 text-xs text-orange-300 bg-orange-500/10 border-b border-orange-500/20">
                  Duplicate variants detected (same size/color). Please adjust or remove duplicates.
                </div>
              )}
              
              {form.variants.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-400 text-sm mb-2">No variants yet</p>
                  <p className="text-gray-500 text-xs">Add size, color, or other options for your product</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 font-medium">Color</th>
                        <th className="px-6 py-3 font-medium">Size</th>
                        <th className="px-6 py-3 font-medium">Price</th>
                        <th className="px-6 py-3 font-medium">SKU</th>
                        <th className="px-6 py-3 font-medium">Stock</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {form.variants.map((variant, idx) => (
                        <tr key={variant.id || idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={variant.color ?? ''}
                              onChange={(e) => updateVariant(idx, { color: e.target.value })}
                              placeholder="e.g. Black"
                              className="w-32 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              list="threadly-size-options"
                              value={variant.size ?? ''}
                              onChange={(e) => updateVariant(idx, { size: e.target.value })}
                              placeholder="e.g. M"
                              className="w-28 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-gray-500 text-sm">₦</span>
                              <input
                                type="number"
                                value={typeof variant.price === 'number' ? variant.price : ''}
                                onChange={(e) => updateVariant(idx, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                                placeholder={String(form.price || 0)}
                                className="w-28 bg-black/20 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={variant.sku ?? ''}
                              onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                              placeholder="Optional"
                              className="w-40 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input
                              type="number"
                              value={Number.isFinite(variant.stock) ? variant.stock : 0}
                              min={0}
                              onChange={(e) => updateVariant(idx, { stock: Number(e.target.value) })}
                              className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              className="text-gray-500 hover:text-red-300 transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <datalist id="threadly-size-options">
                    <option value="XS" />
                    <option value="S" />
                    <option value="M" />
                    <option value="L" />
                    <option value="XL" />
                    <option value="XXL" />
                    <option value="One Size" />
                  </datalist>

                  <div className="px-6 py-4 border-t border-white/5 text-xs text-gray-400 flex items-center justify-between">
                    <span>Total variant stock: <span className="text-gray-200">{variantTotalStock}</span></span>
                    <span>Tip: leave price blank to use base price</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inventory & Shipping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inventory */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-medium text-white">Inventory</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">SKU (Stock Keeping Unit)</label>
                    <input 
                      type="text" 
                      value={form.sku}
                      onChange={(e) => updateForm('sku', e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Stock Quantity</label>
                    <input 
                      type="number" 
                      value={form.variants.length > 0 ? variantTotalStock : (form.stock || '')}
                      onChange={(e) => updateForm('stock', Number(e.target.value))}
                      placeholder="0"
                      disabled={form.variants.length > 0}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all disabled:opacity-60" 
                    />
                    {form.variants.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1">Derived from variants. Edit stock per variant above.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <input 
                      type="checkbox" 
                      id="track-qty" 
                      checked={form.trackInventory}
                      onChange={(e) => updateForm('trackInventory', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="track-qty" className="text-sm text-gray-300">Track quantity</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="continue-selling" 
                      checked={form.allowBackorders}
                      onChange={(e) => updateForm('allowBackorders', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="continue-selling" className="text-sm text-gray-300">Continue selling when out of stock</label>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-medium text-white mb-5">Shipping</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="checkbox" 
                      id="physical-product" 
                      checked={form.isPhysicalProduct}
                      onChange={(e) => updateForm('isPhysicalProduct', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="physical-product" className="text-sm text-gray-300">This is a physical product</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Weight</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={form.weight || ''} 
                          onChange={(e) => updateForm('weight', Number(e.target.value))}
                          placeholder="0"
                          className="w-full bg-black/20 border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-xs">{form.weightUnit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Region</label>
                      <select 
                        value={form.customsRegion}
                        onChange={(e) => updateForm('customsRegion', e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all"
                      >
                        <option value="NG">Nigeria</option>
                        <option value="GH">Ghana</option>
                        <option value="KE">Kenya</option>
                        <option value="ZA">South Africa</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-white mb-5">Additional Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Materials</label>
                  <input 
                    type="text" 
                    value={form.materials}
                    onChange={(e) => updateForm('materials', e.target.value)}
                    placeholder="e.g., 100% Organic Cotton"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Care Instructions</label>
                  <input 
                    type="text" 
                    value={form.careInstructions}
                    onChange={(e) => updateForm('careInstructions', e.target.value)}
                    placeholder="e.g., Machine wash cold, tumble dry low"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Returns Eligible</p>
                    <p className="text-xs text-gray-500">Allow customers to return this item within 30 days</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.returnsEligible}
                      onChange={(e) => updateForm('returnsEligible', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Sustainability Claim</p>
                    <p className="text-xs text-gray-500">Display eco-friendly badge on product page</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.sustainabilityClaim}
                      onChange={(e) => updateForm('sustainabilityClaim', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#0f0f0f] py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {hasChanges ? (
              <span className="text-orange-400">Unsaved changes</span>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>All changes saved</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!isEditMode && (
              <button 
                onClick={() => handleSave(true)}
                disabled={saving}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Save as Draft
              </button>
            )}
            <button 
              onClick={handleDiscard}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {hasChanges ? 'Discard Changes' : 'Cancel'}
            </button>
            <button 
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-sm font-medium rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default EditProduct;
