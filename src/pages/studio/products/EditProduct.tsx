import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus, 
  CheckCircle, 
  Video, 
  X,
  Loader2
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

import { toast } from 'sonner';
import MediaRenderer from '@/components/media/MediaRenderer';
import { productApi, type ProductCreateDto, type Category, type ProductVariant } from '@/api/ProductApi';
import { brandApi } from '@/api/BrandApi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Tag from '@/components/ui/Tag';
import { useConfirm } from '@/components/ui/useConfirm';
import { DiscardChangesModal } from '@/components/studio/store/modals';
import { normalizePrimary, reorderItems, setPrimary, validateMedia } from './mediaUtils';
import { getTagColor } from '@/utils/tagColors';
import { PriceChangePreviewModal } from '@/components/collections/PriceChangePreviewModal';
import { getProductPriceChangePreview } from '@/api/StoreApi';

function toSkuToken(input: string): string {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-');
  return cleaned.replace(/^-+/, '').replace(/-+$/, '');
}

function brandInitialsFromProfile(profile: any): string {
  const raw =
    String(profile?.brandFullName || profile?.brandName || profile?.username || '').trim();
  if (!raw) return 'BR';
  const parts = raw
    .split(/\s+/)
    .map((p: string) => p.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  const initials = parts.map((p: string) => p[0] ?? '').join('');
  return toSkuToken(initials).slice(0, 4) || 'BR';
}

function randomSkuSuffix(length = 5): string {
  // Base36, uppercase, stable enough for UX (not a security token)
  let out = '';
  while (out.length < length) {
    out += Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      .toString(36)
      .toUpperCase();
  }
  return out.slice(0, length);
}

function buildBaseSku(opts: { brandInitials: string; title?: string }): string {
  const prefix = toSkuToken(opts.brandInitials || 'BR');
  const titleToken = opts.title ? toSkuToken(opts.title).replace(/-/g, '') : '';
  const shortTitle = titleToken ? titleToken.slice(0, 4) : 'PRD';
  return `${prefix}-${shortTitle}-${randomSkuSuffix(5)}`;
}

function buildVariantSku(
  baseSku: string,
  variant: { size?: string; color?: string },
  index: number,
): string {
  const color = variant.color ? toSkuToken(variant.color).slice(0, 6) : '';
  const size = variant.size ? toSkuToken(variant.size).slice(0, 6) : '';
  const tokens = [color, size].filter(Boolean);
  const tail = tokens.length ? tokens.join('-') : `V${index + 1}`;
  return `${toSkuToken(baseSku)}-${tail}`;
}


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
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);

  const isEditMode = Boolean(productId);
  const pageTitle = isEditMode ? 'Edit Product' : 'Create Product';
  const includeDeleted = useMemo(
    () => new URLSearchParams(location.search).get('includeDeleted') === 'true',
    [location.search],
  );

  const shippingRegionOptions = useMemo(() => {
    // Return all supported shipping regions without filtering
    return [
      { value: 'NG', label: 'Nigeria' },
      { value: 'GH', label: 'Ghana' },
      { value: 'KE', label: 'Kenya' },
      { value: 'ZA', label: 'South Africa' },
      { value: 'RW', label: 'Rwanda' },
      { value: 'EG', label: 'Egypt' },
      { value: 'GB', label: 'United Kingdom' },
      { value: 'US', label: 'United States' },
      { value: 'INTL', label: 'International' },
    ];
  }, []);

  // State
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const { confirm, ConfirmDialog: ConfirmModal } = useConfirm();
  
  // Media state (simplified - using URLs for display)
  const [mediaUrls, setMediaUrls] = useState<Array<{ id: string; url: string; isPrimary?: boolean }>>([]);

  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    Array<{ tempId: string; file: File; previewUrl: string; isPrimary: boolean }>
  >([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Price change preview state
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [showPricePreview, setShowPricePreview] = useState(false);
  const [pricePreviewData, setPricePreviewData] = useState<{
    affectedCollections: Array<{ collectionId: string; collectionName: string; isDraft: boolean; oldPriceRange: { min: number; max: number }; newPriceRange: { min: number; max: number } }>;
    productName: string;
    oldPrice: number;
    newPrice: number;
  } | null>(null);
  const [pendingSaveDraft, setPendingSaveDraft] = useState(false);

  const maxMediaCount = 4;
  const canAddMoreMedia = mediaUrls.length < maxMediaCount;
  const hasPrimaryMedia = useMemo(() => mediaUrls.some((m) => m.isPrimary), [mediaUrls]);

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

  // Load collections (optional for products; standalone products are allowed)
  useEffect(() => {
    let mounted = true;
    const loadCollections = async () => {
      try {
        if (!user?.id) {
          if (mounted) {
            setCategories([]);
            setCategoriesLoading(false);
          }
          return;
        }
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
        const product = await productApi.getProduct(productId, includeDeleted ? { includeDeleted: true } : undefined);
        if (!product || !mounted) return;

        // Track original price for change detection
        setOriginalPrice(product.price || 0);

        setForm({
          title: product.title || product.name || '',
          description: product.description || '',
          categoryId: (product as any).collectionId || (product as any).collectionIds?.[0] || '',
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

        // Set media for display - resolve signed URLs
        if (product.media?.length) {
          const mediaWithSignedUrls = await Promise.all(
            product.media.map(async (m) => {
              let signedUrl = m.url;
              // Check if URL needs signing (S3 reference without query params)
              if (m.id && m.url && !m.url.includes('?') && (m.url.includes('s3') || !m.url.startsWith('http'))) {
                try {
                  const signed = await brandApi.getSignedFileUrl(m.id);
                  if (signed) signedUrl = signed;
                } catch (e) {
                  console.warn('Failed to sign URL for media', m.id, e);
                }
              }
              return { id: m.id, url: signedUrl, isPrimary: m.isPrimary };
            })
          );
          setMediaUrls(normalizePrimary(mediaWithSignedUrls));
        } else if (product.images?.length) {
          const mapped = product.images.map((url, i) => ({
            id: `img-${i}`,
            url,
            isPrimary: product.thumbnail ? url === product.thumbnail : i === 0,
          }));
          setMediaUrls(normalizePrimary(mapped));
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
    const raw = tagInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/#/g, '').trim();
    if (!cleaned) return;
    if (!form.tags.includes(cleaned)) {
      updateForm('tags', [...form.tags, cleaned]);
    }
    setTagInput('');
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
    const hasDraftContent = Boolean(
      form.title.trim() ||
        form.description.trim() ||
        form.categoryId ||
        form.tags.length > 0 ||
        form.price > 0 ||
        form.compareAtPrice > 0 ||
        form.costPerItem > 0 ||
        form.sku.trim() ||
        form.materials.trim() ||
        form.careInstructions.trim() ||
        form.stock > 0 ||
        form.variants.length > 0 ||
        mediaUrls.length > 0 ||
        pendingMediaFiles.length > 0
    );

    if (asDraft) {
      if (!hasDraftContent) {
        toast.error('Add at least one detail to save a draft');
        return;
      }
      if (form.variants.length > 0) {
        const invalid = form.variants.find((v) => Number.isNaN(Number(v.stock)) || v.stock < 0);
        if (invalid) {
          toast.error('Variant stock must be 0 or greater');
          return;
        }
      } else if (form.trackInventory && (Number.isNaN(Number(form.stock)) || form.stock < 0)) {
        toast.error('Stock must be 0 or greater');
        return;
      }
    } else {
      // Validation for published products
      if (!form.title.trim()) {
        toast.error('Please enter a product title');
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
    }

    const mediaValidation = validateMedia(mediaUrls, maxMediaCount);
    if (!mediaValidation.ok) {
      toast.error(mediaValidation.error || 'Please review your media selection');
      return;
    }

    // Check if price changed in edit mode - show preview before saving
    if (isEditMode && productId && originalPrice !== null && form.price !== originalPrice && !showPricePreview) {
      try {
        const preview = await getProductPriceChangePreview(productId, form.price);
        if (preview.affectedCollections.length > 0) {
          setPricePreviewData({
            affectedCollections: preview.affectedCollections,
            productName: form.title || 'This product',
            oldPrice: originalPrice,
            newPrice: form.price,
          });
          setPendingSaveDraft(asDraft);
          setShowPricePreview(true);
          return; // Wait for user confirmation
        }
      } catch (e) {
        // If preview fails, proceed with save anyway
        console.warn('Failed to load price change preview', e);
      }
    }

    setSaving(true);
    try {
      const ensuredSku = form.sku?.trim() || buildBaseSku({ brandInitials: brandInitialsFromProfile(user), title: form.title });

      const payload: ProductCreateDto = {
        title: asDraft ? (form.title.trim() || 'Untitled Draft') : form.title.trim(),
        description: form.description.trim() || undefined,
        collectionId: form.categoryId || undefined,
        tags: form.tags,
        price: asDraft ? (form.price > 0 ? form.price : 0) : form.price,
        compareAtPrice: form.onSale && form.compareAtPrice > 0 ? form.compareAtPrice : undefined,
        costPerItem: form.costPerItem || undefined,
        currency: form.currency,
        sku: ensuredSku,
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
          ? form.variants.map((v, idx) => ({
              ...v,
              size: v.size?.trim() || undefined,
              color: v.color?.trim() || undefined,
              sku: (v.sku?.trim() || buildVariantSku(ensuredSku, v, idx)).trim() || undefined,
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
          const pendingById = new Map(pendingMediaFiles.map((p) => [p.tempId, p]));
          const orderedPending = mediaUrls
            .map((m) => pendingById.get(m.id))
            .filter(Boolean) as Array<{ tempId: string; file: File; previewUrl: string; isPrimary: boolean }>;
          const uploads = normalizePrimary(orderedPending);

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
  }, [form, hasDuplicateVariants, isEditMode, maxMediaCount, mediaUrls, navigate, pendingMediaFiles, productId, variantTotalStock, originalPrice, showPricePreview]);

  const handlePriceChangeConfirm = useCallback(async () => {
    setShowPricePreview(false);
    // Continue with save
    setSaving(true);
    try {
      const ensuredSku = form.sku?.trim() || buildBaseSku({ brandInitials: brandInitialsFromProfile(user), title: form.title });

      const payload: ProductCreateDto = {
        title: pendingSaveDraft ? (form.title.trim() || 'Untitled Draft') : form.title.trim(),
        description: form.description.trim() || undefined,
        collectionId: form.categoryId || undefined,
        tags: form.tags,
        price: pendingSaveDraft ? (form.price > 0 ? form.price : 0) : form.price,
        compareAtPrice: form.onSale && form.compareAtPrice > 0 ? form.compareAtPrice : undefined,
        costPerItem: form.costPerItem || undefined,
        currency: form.currency,
        sku: ensuredSku,
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
        status: pendingSaveDraft ? 'DRAFT' : form.status,
        isPhysicalProduct: form.isPhysicalProduct,
        customsRegion: form.customsRegion || undefined,
        mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
        variants: form.variants.length > 0
          ? form.variants.map((v, idx) => ({
              ...v,
              size: v.size?.trim() || undefined,
              color: v.color?.trim() || undefined,
              sku: (v.sku?.trim() || buildVariantSku(ensuredSku, v, idx)).trim() || undefined,
              price: typeof v.price === 'number' && v.price > 0 ? v.price : undefined,
              stock: Number.isFinite(v.stock) ? v.stock : 0,
            }))
          : undefined,
      };

      await productApi.updateProduct(productId!, payload);
      toast.success('Product updated successfully');
      setOriginalPrice(form.price); // Update tracked price
      setHasChanges(false);
      navigate('/studio/store');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to save product';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [form, user, pendingSaveDraft, variantTotalStock, productId, navigate]);

  // Auto-generate SKU (product + variants). Users shouldn't type SKUs manually.
  useEffect(() => {
    if (!user) return;
    if (!form.title.trim()) return;
    if (form.sku && form.sku.trim()) return;
    const nextSku = buildBaseSku({ brandInitials: brandInitialsFromProfile(user), title: form.title });
    setForm((prev) => ({ ...prev, sku: nextSku }));
  }, [user, form.title, form.sku]);

  useEffect(() => {
    if (!form.variants.length) return;
    const baseSku = form.sku?.trim();
    if (!baseSku) return;

    const nextVariants = form.variants.map((v, idx) => {
      if (v.sku && String(v.sku).trim()) return v;
      return { ...v, sku: buildVariantSku(baseSku, v, idx) };
    });

    // Avoid setState loops
    const changed = nextVariants.some((v, idx) => (v.sku ?? '') !== (form.variants[idx]?.sku ?? ''));
    if (changed) {
      setForm((prev) => ({ ...prev, variants: nextVariants }));
    }
  }, [form.sku, form.variants]);

  const normalizePending = useCallback(
    (items: Array<{ tempId: string; file: File; previewUrl: string; isPrimary: boolean }>) => {
      const normalized = normalizePrimary(items.map((item) => ({ ...item, id: item.tempId })));
      return normalized.map(({ id, ...rest }) => rest);
    },
    [],
  );

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
        if (makePrimary && nextPending[0]) {
          return normalizePending(merged.map((m) => ({ ...m, isPrimary: m.tempId === nextPending[0].tempId })));
        }
        return normalizePending(merged);
      });

      setMediaUrls((prev) => {
        const mapped = nextPending.map((m) => ({
          id: m.tempId,
          url: m.previewUrl,
          isPrimary: false,
        }));
        const next = [...prev, ...mapped];
        if (makePrimary && mapped[0]) {
          return normalizePrimary(setPrimary(next, mapped[0].id));
        }
        return normalizePrimary(next);
      });
    },
    [mediaUrls.length, normalizePending],
  );

  const handleMediaFilesSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;

    if (!canAddMoreMedia) {
      toast.error(`You can upload up to ${maxMediaCount} images`);
      return;
    }

    if (isEditMode && productId) {
      const uploadQueue = files.slice(0, maxMediaCount - mediaUrls.length);
      const shouldMakePrimary = !hasPrimaryMedia && uploadQueue.length > 0;

      for (const [index, file] of uploadQueue.entries()) {
        try {
          const makePrimary = shouldMakePrimary && index === 0;
          const uploaded = await productApi.uploadProductMedia(productId, file, makePrimary);
          setMediaUrls((prev) => {
            const next = [...prev, { id: uploaded.id, url: uploaded.url, isPrimary: makePrimary }];
            const normalized = normalizePrimary(next);
            updateForm(
              'mediaIds',
              normalized.map((m) => m.id).filter((id) => !id.startsWith('pending-')),
            );
            return normalized;
          });
          toast.success(makePrimary ? 'Cover image uploaded' : 'Image uploaded');
        } catch (err) {
          console.error('Upload failed', err);
          toast.error('Failed to upload image');
        }
      }
      return;
    }

    const makePrimary = !hasPrimaryMedia;
    pushMediaPreviews(files, { makePrimary });
  };

  const handleSetCover = useCallback(
    async (mediaId: string) => {
      if (!mediaId) return;
      setMediaUrls((prev) => normalizePrimary(setPrimary(prev, mediaId)));
      setPendingMediaFiles((prev) => normalizePending(prev.map((p) => ({ ...p, isPrimary: p.tempId === mediaId }))));

      if (isEditMode && productId && !mediaId.startsWith('pending-')) {
        try {
          await productApi.setPrimaryMedia(productId, mediaId);
          toast.success('Cover image updated');
        } catch (error) {
          toast.error('Failed to update cover image');
        }
      }
    },
    [isEditMode, normalizePending, productId],
  );

  const handleDeleteMedia = useCallback(
    async (mediaId: string) => {
      const target = mediaUrls.find((m) => m.id === mediaId);
      if (!target) return;

      const nextMedia = normalizePrimary(mediaUrls.filter((m) => m.id !== mediaId));
      setMediaUrls(nextMedia);
      setPendingMediaFiles((prev) => prev.filter((p) => p.tempId !== mediaId));

      if (isEditMode && productId && !mediaId.startsWith('pending-')) {
        try {
          await productApi.deleteProductMedia(productId, mediaId);
          const orderedIds = nextMedia.map((m) => m.id).filter((id) => !id.startsWith('pending-'));
          updateForm('mediaIds', orderedIds);
          if (target.isPrimary && orderedIds[0]) {
            await productApi.setPrimaryMedia(productId, orderedIds[0]);
          }
          toast.success('Image deleted');
        } catch (error) {
          toast.error('Failed to delete image');
          setMediaUrls((prev) => normalizePrimary([...prev, target]));
        }
      }
    },
    [isEditMode, mediaUrls, productId, updateForm],
  );

  const handleReorderMedia = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const nextMedia = reorderItems(mediaUrls, fromIndex, toIndex);
      setMediaUrls(nextMedia);

      setPendingMediaFiles((prev) => {
        if (!prev.length) return prev;
        const byId = new Map(prev.map((p) => [p.tempId, p]));
        return nextMedia.map((m) => byId.get(m.id)).filter(Boolean) as typeof prev;
      });

      const orderedIds = nextMedia.map((m) => m.id).filter((id) => !id.startsWith('pending-'));
      if (isEditMode && productId && orderedIds.length > 0) {
        try {
          await productApi.reorderProductMedia(productId, orderedIds);
          updateForm('mediaIds', orderedIds);
        } catch (error) {
          toast.error('Failed to reorder images');
        }
      }
    },
    [isEditMode, mediaUrls, productId, updateForm],
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
    const approved = await confirm({
      title: 'Delete product?',
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!approved) return;
    try {
      await productApi.deleteProduct(productId);
      toast.success('Product deleted');
      navigate('/studio/store');
    } catch (error) {
      toast.error('Failed to delete product');
    }
  }, [confirm, productId, navigate]);

  const handleDiscard = useCallback(() => {
    if (hasChanges) {
      setShowDiscardPrompt(true);
      return;
    }
    navigate(-1);
  }, [hasChanges, navigate]);

  // =====================
  // Loading State
  // =====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
    <div className="flex flex-col min-h-full bg-transparent text-gray-900 dark:text-[#e5e5e5] font-sans">

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 gap-2">
              <button onClick={() => navigate('/studio/store')} className="hover:text-gray-900 dark:hover:text-white transition-colors flex items-center">
                <ArrowLeft className="w-3 h-3 mr-1" /> Products
              </button>
              <span>/</span>
              <span>{pageTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {pageTitle}
              </h1>
              {isEditMode && form.title && (
                <span className="text-sm text-gray-500">• {form.title}</span>
              )}
              {isEditMode && (
                <div className="relative group">
                  <button 
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.status === 'ACTIVE' 
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                        : form.status === 'DRAFT'
                        ? 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      form.status === 'ACTIVE' ? 'bg-green-500' : form.status === 'DRAFT' ? 'bg-gray-400' : 'bg-orange-500'
                    }`} />
                    {form.status === 'ACTIVE' ? 'Active' : form.status === 'DRAFT' ? 'Draft' : 'Archived'}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>


          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Action buttons removed - duplicate/archive/delete should be done from Store page */}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
          {/* LEFT COLUMN: Media (42% approx -> 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
              
            {/* Media Gallery */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Media</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">{mediaUrls.length} of {maxMediaCount} used</span>
              </div>

              <input
                ref={mediaFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                data-testid="product-media-input"
                onChange={handleMediaFilesSelected}
              />

              {/* Carousel for media (shows one at a time with navigation) */}
              {mediaUrls.length > 0 ? (
                <div className="relative">
                  {/* Main carousel view */}
                  <div className="relative rounded-xl bg-gray-100/40 dark:bg-white/5 aspect-[4/5] overflow-hidden">
                    {mediaUrls[carouselIndex] && (
                      <>
                        <MediaRenderer
                          kind="image"
                          src={mediaUrls[carouselIndex].url}
                          alt="Product"
                          fit="contain"
                          maxHeightClassName="max-h-full"
                          maxWidthClassName="max-w-full"
                          className="w-full h-full"
                          mediaClassName="w-full h-full object-contain"
                        />

                        {mediaUrls[carouselIndex].isPrimary && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-semibold text-white">
                            Cover
                          </div>
                        )}

                        {/* Action buttons - Set cover + Delete only */}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 px-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
                          {!mediaUrls[carouselIndex].isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetCover(mediaUrls[carouselIndex].id)}
                              className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-sm font-medium flex items-center gap-1.5"
                              title="Set this image as the product cover"
                            >
                              <span>⭐</span>
                              <span>Set Cover</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteMedia(mediaUrls[carouselIndex].id);
                              setCarouselIndex(Math.max(0, carouselIndex - 1));
                            }}
                            className="p-2 rounded-lg bg-red-500/80 backdrop-blur-sm hover:bg-red-600 text-white"
                            title="Delete this image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}

                    {/* Navigation arrows */}
                    {mediaUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                          disabled={carouselIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselIndex(Math.min(mediaUrls.length - 1, carouselIndex + 1))}
                          disabled={carouselIndex === mediaUrls.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          aria-label="Next image"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Dot indicators + add button */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {mediaUrls.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCarouselIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          idx === carouselIndex 
                            ? 'bg-purple-600 scale-110' 
                            : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                    {canAddMoreMedia && (
                      <button
                        type="button"
                        onClick={() => mediaFileInputRef.current?.click()}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                        aria-label="Add more images"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty state - Add first image */
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  className="aspect-[4/5] rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-purple-400/60 hover:bg-purple-50 dark:hover:bg-white/5 transition-all"
                >
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Add images</span>
                  <span className="text-xs text-gray-400 mt-1">Up to 4 images</span>
                </button>
              )}

              {!hasPrimaryMedia && mediaUrls.length > 0 && (
                <p className="mt-3 text-xs text-orange-500">Select a cover image before saving.</p>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                <p className="text-xs text-gray-500">Up to 4 images • Full preview • Cover required when images exist</p>
              </div>
            </div>

            {/* Video Section */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Product Video</h3>
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-white/20 p-6 flex flex-col items-center justify-center text-center hover:bg-purple-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-white/10 flex items-center justify-center mb-3 text-purple-500">
                  <Video className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Add Video</p>
                <p className="text-xs text-gray-500 mt-1">MP4, WebM up to 50MB</p>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Details (58% approx -> 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
              
            {/* Basic Info */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
              
              <div className="space-y-5">
                <Input
                  label="Product Title"
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  placeholder="Enter product title"
                  data-testid="product-title-input"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Select
                    label="Collection (optional)"
                    value={form.categoryId}
                    onChange={(e) => updateForm('categoryId', e.target.value)}
                    disabled={categoriesLoading}
                  >
                    <option value="">No collection (standalone)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] text-gray-500 mt-1">
                      {categoriesLoading
                        ? 'Loading collections…'
                        : categories.length
                          ? 'Choose a collection or keep this product standalone.'
                          : 'No collections yet. This product can stay standalone.'}
                    </p>
                    {!categoriesLoading && categories.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const suffix = productId ? `?productId=${encodeURIComponent(productId)}` : '';
                          navigate(`/studio/store/collections/new${suffix}`);
                        }}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Create collection
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Tags</label>
                    <div className="bg-white dark:bg-zinc-900/60 border border-gray-300/80 dark:border-zinc-700/60 rounded-xl px-3 py-2 min-h-[46px] flex items-center gap-2 shadow-sm">
                      <input 
                        type="text" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag..." 
                        className="bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 w-24 flex-1 p-0 focus:ring-0" 
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition"
                      >
                        Add
                      </button>
                    </div>
                    {form.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.tags.map((tag, index) => (
                          <Tag
                            key={tag}
                            label={tag}
                            color={getTagColor(tag, index)}
                            size="xs"
                            rightIcon={<X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />}
                            className="gap-1"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">Add one tag at a time. Use Enter or the Add button.</p>
                  </div>
                </div>

                <Textarea
                  label="Description"
                  rows={5}
                  placeholder="Describe your product..."
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pricing</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">On Sale</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.onSale}
                      onChange={(e) => updateForm('onSale', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input
                  label="Price"
                  required
                  type="number"
                  value={form.price || ''}
                  onChange={(e) => updateForm('price', Number(e.target.value))}
                  placeholder="0"
                  startIcon={<span className="text-gray-400 dark:text-zinc-500 text-sm">₦</span>}
                  data-testid="product-price-input"
                />
                <Input
                  label="Sale Price"
                  type="number"
                  value={form.compareAtPrice || ''}
                  onChange={(e) => updateForm('compareAtPrice', Number(e.target.value))}
                  placeholder="0"
                  disabled={!form.onSale}
                  startIcon={<span className="text-gray-400 dark:text-zinc-500 text-sm">₦</span>}
                />
                <div>
                  <Input
                    label="Cost per Item"
                    type="number"
                    value={form.costPerItem || ''}
                    onChange={(e) => updateForm('costPerItem', Number(e.target.value))}
                    placeholder="0"
                    startIcon={<span className="text-gray-400 dark:text-zinc-500 text-sm">₦</span>}
                  />
                  {profitMargin.margin > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Margin: {profitMargin.margin}% • Profit: {formatCurrency(profitMargin.profit, form.currency)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Variants */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Variants</h2>
                <button
                  type="button"
                  onClick={addVariant}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition"
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
                <div className="overflow-x-auto scrollbar-threadly" style={{ scrollbarGutter: 'stable both-edges' }}>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-3 font-medium">Color</th>
                        <th className="px-6 py-3 font-medium">Size</th>
                        <th className="px-6 py-3 font-medium">Price</th>
                        <th className="px-6 py-3 font-medium">SKU</th>
                        <th className="px-6 py-3 font-medium">Stock</th>
                        <th className="px-6 py-3 font-medium text-right w-24 sticky right-0 bg-gray-50 dark:bg-white/5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/70 dark:divide-white/5">
                      {form.variants.map((variant, idx) => (
                        <tr key={variant.id || idx} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3">
                            <Input
                              type="text"
                              value={variant.color ?? ''}
                              onChange={(e) => updateVariant(idx, { color: e.target.value })}
                              placeholder="e.g. Black"
                              inputSize="sm"
                              fullWidth={false}
                              className="w-32"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <Input
                              type="text"
                              list="threadly-size-options"
                              value={variant.size ?? ''}
                              onChange={(e) => updateVariant(idx, { size: e.target.value })}
                              placeholder="e.g. M"
                              inputSize="sm"
                              fullWidth={false}
                              className="w-28"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <Input
                              type="number"
                              value={typeof variant.price === 'number' ? variant.price : ''}
                              onChange={(e) => updateVariant(idx, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                              placeholder={String(form.price || 0)}
                              startIcon={<span className="text-gray-400 dark:text-zinc-500 text-sm">₦</span>}
                              inputSize="sm"
                              fullWidth={false}
                              className="w-28"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <Input
                              type="text"
                              value={variant.sku ?? ''}
                              onChange={() => {}}
                              placeholder="Auto-generated"
                              disabled
                              inputSize="sm"
                              fullWidth={false}
                              className="w-40"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <Input
                              type="number"
                              value={Number.isFinite(variant.stock) ? variant.stock : 0}
                              min={0}
                              onChange={(e) => updateVariant(idx, { stock: Number(e.target.value) })}
                              inputSize="sm"
                              fullWidth={false}
                              className="w-20"
                            />
                          </td>
                          <td className="px-6 py-3 text-right sticky right-0 bg-gray-50/60 dark:bg-black/20">
                            <button
                              type="button"
                              onClick={() => removeVariant(idx)}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
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

                  <div className="px-6 py-4 border-t border-gray-200/70 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span>Total variant stock: <span className="text-gray-900 dark:text-gray-200">{variantTotalStock}</span></span>
                    <span>Tip: leave price blank to use base price</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inventory & Shipping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inventory */}
              <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Inventory</h2>
                </div>
                <div className="space-y-4">
                  <Input
                    label="SKU (Stock Keeping Unit)"
                    type="text"
                    value={form.sku}
                    onChange={() => {}}
                    placeholder="Auto-generated"
                    disabled
                    helperText="A unique code to track inventory and sales (e.g., SHIRT-BLK-M)."
                  />
                  <div>
                    <Input
                      label="Stock Quantity"
                      type="number"
                      value={form.variants.length > 0 ? variantTotalStock : (form.stock || '')}
                      onChange={(e) => updateForm('stock', Number(e.target.value))}
                      placeholder="0"
                      disabled={form.variants.length > 0}
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
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="track-qty" className="text-sm text-gray-700 dark:text-gray-300">Track quantity</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="continue-selling" 
                      checked={form.allowBackorders}
                      onChange={(e) => updateForm('allowBackorders', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="continue-selling" className="text-sm text-gray-700 dark:text-gray-300">Continue selling when out of stock</label>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-5">Shipping</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="checkbox" 
                      id="physical-product" 
                      checked={form.isPhysicalProduct}
                      onChange={(e) => updateForm('isPhysicalProduct', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500" 
                    />
                    <label htmlFor="physical-product" className="text-sm text-gray-700 dark:text-gray-300">This is a physical product</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="relative">
                        <Input
                          label="Weight"
                          type="number"
                          value={form.weight || ''}
                          onChange={(e) => updateForm('weight', Number(e.target.value))}
                          placeholder="0"
                          endIcon={<span className="text-gray-400 dark:text-zinc-500 text-xs">{form.weightUnit}</span>}
                        />
                      </div>
                    </div>
                    <div>
                      <Select
                        label="Region"
                        value={form.customsRegion}
                        onChange={(e) => updateForm('customsRegion', e.target.value)}
                      >
                        {shippingRegionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-5">Additional Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Materials"
                  type="text"
                  value={form.materials}
                  onChange={(e) => updateForm('materials', e.target.value)}
                  placeholder="e.g., 100% Organic Cotton"
                />
                <Input
                  label="Care Instructions"
                  type="text"
                  value={form.careInstructions}
                  onChange={(e) => updateForm('careInstructions', e.target.value)}
                  placeholder="e.g., Machine wash cold, tumble dry low"
                />
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200/70 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Returns Eligible</p>
                    <p className="text-xs text-gray-500">Allow customers to return this item within 30 days</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.returnsEligible}
                      onChange={(e) => updateForm('returnsEligible', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Sustainability Claim</p>
                    <p className="text-xs text-gray-500">Display eco-friendly badge on product page</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.sustainabilityClaim}
                      onChange={(e) => updateForm('sustainabilityClaim', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 dark:border-white/10 bg-transparent py-6 px-6">
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
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Save as Draft
              </button>
            )}
            <button 
              onClick={handleDiscard}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              {hasChanges ? 'Discard Changes' : 'Cancel'}
            </button>
            <button 
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-sm font-semibold rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </footer>

      {ConfirmModal}

      {/* Price Change Preview Modal */}
      {showPricePreview && pricePreviewData && (
        <PriceChangePreviewModal
          isOpen={showPricePreview}
          productName={pricePreviewData.productName}
          oldPrice={pricePreviewData.oldPrice}
          newPrice={pricePreviewData.newPrice}
          affectedCollections={pricePreviewData.affectedCollections}
          onConfirm={handlePriceChangeConfirm}
          onClose={() => setShowPricePreview(false)}
          loading={saving}
        />
      )}

      {/* Discard Changes Modal - Premium styled */}
      <DiscardChangesModal
        isOpen={showDiscardPrompt}
        onClose={() => setShowDiscardPrompt(false)}
        onDiscard={() => {
          setHasChanges(false);
          navigate(-1);
        }}
        title="Discard Changes?"
        message={!isEditMode 
          ? "You have unsaved changes. Would you like to save this as a draft before leaving?"
          : "You have unsaved changes. Are you sure you want to discard them? This action cannot be undone."
        }
      />
    </div>
  );
};

export default EditProduct;
