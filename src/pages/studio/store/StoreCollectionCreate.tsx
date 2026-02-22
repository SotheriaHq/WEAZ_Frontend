import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { apiClient } from '@/api/httpClient';
import { getBrandProductsForOwner, type Product as StoreProduct } from '@/api/StoreApi';
import { unwrapApiResponse } from '@/types/auth';
import {
  addProductsToCollection,
  finalizeStoreCollection,
  initializeStoreCollection,
  removeProductsFromCollection,
  reorderCollectionProducts,
  type CollectionType,
  type CollectionVisibility,
} from '@/api/storeCollections';
import ImageWithFallback from '@/components/ImageWithFallback';
import SearchField from '@/components/SearchField';
import Select from '@/components/ui/Select';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import Tag from '@/components/ui/Tag';
import { getTagColor } from '@/utils/tagColors';

const MAX_PRODUCTS = 5;
const MAX_TAGS = 20;
const TAG_CHAR_LIMIT = 50;
type CategoryTypeOption = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  types: CategoryTypeOption[];
};

const normalizeLinkedProduct = (raw: any): StoreProduct | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  return {
    id,
    collectionId: typeof raw.collectionId === 'string' ? raw.collectionId : '',
    brandId: typeof raw.brandId === 'string' ? raw.brandId : '',
    name: typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name : 'Untitled product',
    description: typeof raw.description === 'string' ? raw.description : '',
    price: typeof raw.price === 'number' ? raw.price : 0,
    salePrice: typeof raw.salePrice === 'number' ? raw.salePrice : undefined,
    saleStartAt: typeof raw.saleStartAt === 'string' ? raw.saleStartAt : undefined,
    saleEndAt: typeof raw.saleEndAt === 'string' ? raw.saleEndAt : undefined,
    sizes: Array.isArray(raw.sizes) ? raw.sizes.filter((v: unknown) => typeof v === 'string') : [],
    sizeStock: raw.sizeStock && typeof raw.sizeStock === 'object' ? raw.sizeStock : undefined,
    colors: Array.isArray(raw.colors) ? raw.colors.filter((v: unknown) => typeof v === 'string') : [],
    colorImages: raw.colorImages && typeof raw.colorImages === 'object' ? raw.colorImages : undefined,
    images: Array.isArray(raw.images) ? raw.images.filter((v: unknown) => typeof v === 'string') : [],
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : undefined,
    totalStock: typeof raw.totalStock === 'number' ? raw.totalStock : 0,
    lowStockThreshold: typeof raw.lowStockThreshold === 'number' ? raw.lowStockThreshold : 5,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((v: unknown) => typeof v === 'string') : [],
    gender:
      raw.gender === 'MALE' || raw.gender === 'FEMALE' || raw.gender === 'EVERYBODY'
        ? raw.gender
        : 'EVERYBODY',
    isActive: raw.isActive !== false,
    isFeatured: Boolean(raw.isFeatured),
    viewsCount: typeof raw.viewsCount === 'number' ? raw.viewsCount : 0,
    threadsCount: typeof raw.threadsCount === 'number' ? raw.threadsCount : 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    collection: raw.collection,
    brand: raw.brand,
  };
};

const StoreCollectionCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((state: RootState) => state.user.profile);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('PUBLIC');
  const [type, setType] = useState<CollectionType>('EVERYBODY');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTypeId, setCategoryTypeId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creationMode, setCreationMode] = useState<'existing' | 'new'>('existing');

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [primaryProductId, setPrimaryProductId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState<'draft' | 'publish' | null>(null);
  const [previewProduct, setPreviewProduct] = useState<StoreProduct | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  const preselectProductId = searchParams.get('productId');
  const prefillCollectionId = searchParams.get('collectionId');
  const returnMode = searchParams.get('mode');
  const [collectionSessionId, setCollectionSessionId] = useState<string | null>(null);
  const [sessionDraftProductIds, setSessionDraftProductIds] = useState<string[]>([]);
  const [existingCollectionStatus, setExistingCollectionStatus] = useState<
    'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
  >(null);
  const [existingLinkedProductIds, setExistingLinkedProductIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await brandApi.getCategories(true);
        if (!mounted) return;
        const mapped = cats.map((c) => ({
          id: c.id,
          name: c.name,
          types: Array.isArray(c.types)
            ? c.types.map((t) => ({ id: t.id, name: t.name }))
            : [],
        }));
        setCategories(mapped);
        if (mapped.length) {
          setCategoryId((prev) => prev || mapped[0].id);
          setCategoryTypeId((prev) => {
            if (
              prev &&
              mapped.some((category) =>
                category.types.some((categoryType) => categoryType.id === prev),
              )
            ) {
              return prev;
            }
            return mapped[0].types[0]?.id ?? '';
          });
        }
      } catch {
        if (mounted) setCategories([]);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    };
    void loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!prefillCollectionId) return;
    setCollectionSessionId((prev) => prev ?? prefillCollectionId);
  }, [prefillCollectionId]);

  useEffect(() => {
    let mounted = true;
    const loadDraftDetails = async () => {
      if (!collectionSessionId) return;
      let detail: any = null;
      try {
        detail = await brandApi.getCollectionDetail(collectionSessionId, {
          scope: 'store',
        });
      } catch (error: any) {
        if (!mounted) return;
        toast.error(error?.response?.data?.message ?? 'Unable to load draft collection.');
        return;
      }
      if (!mounted || !detail) return;
      setExistingCollectionStatus(
        detail.status === 'DRAFT' || detail.status === 'PUBLISHED' || detail.status === 'ARCHIVED'
          ? detail.status
          : null,
      );

      const links = Array.isArray(detail.products) ? detail.products : [];
      const primaryLink = links.find((link: any) => Boolean(link?.isPrimary));
      const linkedIds = links
        .map((link: any) => String(link?.product?.id || link?.productId || link?.id || ''))
        .filter(Boolean);
      const linkedProducts = links
        .map((link: any) => normalizeLinkedProduct(link?.product))
        .filter(Boolean) as StoreProduct[];
      setExistingLinkedProductIds(linkedIds);
      const draftIds = linkedProducts
        .filter((product) => product.isActive === false)
        .map((product) => String(product.id || ''))
        .filter(Boolean);

      if (linkedProducts.length > 0) {
        setProducts((prev) => {
          const merged = new Map(prev.map((product) => [product.id, product]));
          linkedProducts.forEach((product) => {
            if (!merged.has(product.id)) {
              merged.set(product.id, product);
            }
          });
          return Array.from(merged.values());
        });
      }

      if (linkedIds.length > 0) {
        setSelectedProductIds((prev) => Array.from(new Set([...prev, ...linkedIds])));
        const nextPrimaryId =
          primaryLink?.product?.id ||
          primaryLink?.productId ||
          null;
        if (nextPrimaryId) {
          setPrimaryProductId((prev) => prev ?? String(nextPrimaryId));
        }
      }
      if (draftIds.length > 0) {
        setSessionDraftProductIds((prev) => Array.from(new Set([...prev, ...draftIds])));
        setCreationMode('new');
      }

      if (!preselectProductId) {
        if (!title && detail.title) setTitle(detail.title);
        if (!description && detail.description) setDescription(detail.description);
        if (!categoryId && detail.categoryId) setCategoryId(detail.categoryId);
        if (!categoryTypeId && detail.categoryTypeId) setCategoryTypeId(detail.categoryTypeId);
        if (detail.visibility) setVisibility(detail.visibility);
        if (detail.type) setType(detail.type);
        if (Array.isArray(detail.tags) && tags.length === 0) {
          setTags(detail.tags.filter((tag: any) => typeof tag === 'string'));
        }
      }
    };

    void loadDraftDetails();
    return () => {
      mounted = false;
    };
  }, [collectionSessionId, preselectProductId, title, description, categoryId, categoryTypeId, tags.length]);

  const loadProducts = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await getBrandProductsForOwner(user.id, 200);
      const items = Array.isArray((res as any)?.items)
        ? (res as any).items
        : Array.isArray((res as any)?.data?.items)
          ? (res as any).data.items
          : Array.isArray((res as any)?.data)
            ? (res as any).data
            : [];
      setProducts(items);
    } catch (error: any) {
      setProducts([]);
      setProductsError(error?.response?.data?.message ?? 'Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!preselectProductId) return;
    void loadProducts();
    setSessionDraftProductIds((prev) =>
      prev.includes(preselectProductId) ? prev : [...prev, preselectProductId]
    );
    setSelectedProductIds((prev) => {
      if (prev.includes(preselectProductId)) return prev;
      if (prev.length >= MAX_PRODUCTS) return prev;
      return [...prev, preselectProductId];
    });
    setCreationMode('new');
  }, [preselectProductId, loadProducts]);

  useEffect(() => {
    if (returnMode === 'new') {
      setCreationMode('new');
    }
  }, [returnMode]);

  useEffect(() => {
    if (!categoryId) {
      setCategoryTypeId('');
      return;
    }
    const selectedCategory = categories.find((category) => category.id === categoryId);
    if (!selectedCategory) {
      setCategoryTypeId('');
      return;
    }
    if (
      categoryTypeId &&
      selectedCategory.types.some((categoryType) => categoryType.id === categoryTypeId)
    ) {
      return;
    }
    setCategoryTypeId(selectedCategory.types[0]?.id ?? '');
  }, [categories, categoryId, categoryTypeId]);

  const normalizedTags = useMemo(() => {
    const seen = new Set<string>();
    const cleaned = tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.slice(0, TAG_CHAR_LIMIT))
      .filter((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return cleaned.slice(0, MAX_TAGS);
  }, [tags]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );
  const categoryTypeOptions = selectedCategory?.types ?? [];

  const handleAddTag = useCallback(() => {
    const raw = tagInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/#/g, '').trim().slice(0, TAG_CHAR_LIMIT);
    if (!cleaned) return;
    setTags((prev) => {
      if (prev.length >= MAX_TAGS) {
        toast.error(`You can add up to ${MAX_TAGS} tags.`);
        return prev;
      }
      if (prev.some((t) => t.toLowerCase() === cleaned.toLowerCase())) return prev;
      return [...prev, cleaned];
    });
    setTagInput('');
  }, [tagInput]);

  const handleTagKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, search]);

  const sessionProducts = useMemo(
    () => products.filter((p) => sessionDraftProductIds.includes(p.id)),
    [products, sessionDraftProductIds]
  );

  const visibleProducts = useMemo(() => {
    if (creationMode === 'new') {
      return sessionProducts;
    }
    return filteredProducts.filter(
      (p) => p.isActive !== false && !sessionDraftProductIds.includes(p.id)
    );
  }, [creationMode, filteredProducts, sessionDraftProductIds, sessionProducts]);

  const displayedProducts = useMemo(() => {
    const selectedSet = new Set(selectedProductIds);
    const linkedSet = new Set(existingLinkedProductIds);
    return [...visibleProducts].sort((a, b) => {
      const aSelected = selectedSet.has(a.id);
      const bSelected = selectedSet.has(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const aLinked = linkedSet.has(a.id);
      const bLinked = linkedSet.has(b.id);
      if (aLinked !== bLinked) return aLinked ? -1 : 1;
      return 0;
    });
  }, [existingLinkedProductIds, selectedProductIds, visibleProducts]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const orderedSelectedProductIds = useMemo(() => {
    if (!primaryProductId || !selectedProductIds.includes(primaryProductId)) {
      return selectedProductIds;
    }
    return [primaryProductId, ...selectedProductIds.filter((id) => id !== primaryProductId)];
  }, [primaryProductId, selectedProductIds]);

  const hasPrimarySelection = Boolean(
    primaryProductId && selectedProductIds.includes(primaryProductId),
  );

  const isExistingCollectionEditMode = useMemo(
    () => Boolean(prefillCollectionId && existingCollectionStatus && existingCollectionStatus !== 'DRAFT'),
    [existingCollectionStatus, prefillCollectionId],
  );

  const hasAnyMedia = useMemo(
    () =>
      selectedProducts.some((p) => {
        const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
        return Boolean(p.thumbnail) || images.length > 0;
      }),
    [selectedProducts]
  );

  const toggleProduct = useCallback(
    (productId: string) => {
      setSelectedProductIds((prev) => {
        if (prev.includes(productId)) {
          return prev.filter((id) => id !== productId);
        }
        if (prev.length >= MAX_PRODUCTS) {
          toast.error(`Collections can contain a maximum of ${MAX_PRODUCTS} products.`);
          return prev;
        }
        return [...prev, productId];
      });
    },
    []
  );

  const handleSetPrimary = useCallback(
    (productId: string) => {
      if (!selectedProductIds.includes(productId)) {
        toast.error('Select this product first before setting it as primary.');
        return;
      }
      setPrimaryProductId(productId);
    },
    [selectedProductIds],
  );

  useEffect(() => {
    if (selectedProductIds.length === 0 || !primaryProductId || !selectedProductIds.includes(primaryProductId)) {
      if (primaryProductId !== null) setPrimaryProductId(null);
    }
  }, [primaryProductId, selectedProductIds]);

  const ensureCollectionSession = async () => {
    if (collectionSessionId) return collectionSessionId;
    const init = await initializeStoreCollection({
      mode: creationMode === 'new' ? 'new-individual' : 'existing',
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      visibility,
      categoryId: categoryId || undefined,
      categoryTypeId: categoryTypeId || undefined,
      type,
      tags: normalizedTags,
      isAvailableInStore: true,
    });
    setCollectionSessionId(init.sessionId);
    return init.sessionId;
  };

  const openCollectionProductEditor = async (productId?: string) => {
    try {
      const sessionId = await ensureCollectionSession();
      const mode = creationMode === 'new' ? 'new' : 'existing';
      const returnPath = `/studio/store/collections/new?collectionId=${sessionId}&mode=${mode}`;
      const basePath = productId
        ? `/studio/store/products/${productId}/edit`
        : '/studio/store/products/new';
      navigate(
        `${basePath}?returnTo=${encodeURIComponent(returnPath)}&returnContext=collection&collectionId=${sessionId}`,
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to start product flow for this collection.');
    }
  };

  const handleSubmit = async (action: 'publish' | 'draft') => {
    if (!title.trim()) {
      toast.error('Please enter a collection title.');
      return;
    }

    if (selectedProductIds.length > MAX_PRODUCTS) {
      toast.error(`Collections can contain a maximum of ${MAX_PRODUCTS} products.`);
      return;
    }

    if (selectedProductIds.length > 0 && !hasPrimarySelection) {
      toast.error('Please choose a primary product before continuing.');
      return;
    }

    if (action === 'publish') {
      if (!categoryId) {
        toast.error('Please select a category to publish.');
        return;
      }
      if (!categoryTypeId) {
        toast.error('Please select a category type to publish.');
        return;
      }
      if (normalizedTags.length === 0) {
        toast.error('Please add at least one tag to publish.');
        return;
      }
      if (selectedProductIds.length === 0) {
        toast.error('Select at least one product to publish.');
        return;
      }
      if (!hasAnyMedia) {
        toast.error('At least one selected product needs an image to publish.');
        return;
      }
      if (selectedProducts.some((product) => product.isActive === false)) {
        toast.error('One or more selected products are still drafts. Edit and publish those products first.');
        return;
      }
    }

    setSubmitting(true);
    setSubmitAction(action);
    try {
      const sessionId = await ensureCollectionSession();
      const metadataPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        type,
        categoryId: categoryId || undefined,
        categoryTypeId: categoryTypeId || undefined,
        tags: normalizedTags,
        isAvailableInStore: true,
      };

      if (isExistingCollectionEditMode) {
        const updatedResponse = await apiClient.patch(
          `/collections/${sessionId}`,
          metadataPayload,
          { params: { scope: 'store' } },
        );
        const updated = unwrapApiResponse<any>(updatedResponse.data);
        if (!updated) {
          toast.error('Failed to update collection metadata.');
          return;
        }

        const previousIds = existingLinkedProductIds;
        const nextIds = orderedSelectedProductIds;
        const previousSet = new Set(previousIds);
        const nextSet = new Set(nextIds);

        const toRemove = previousIds.filter((productId) => !nextSet.has(productId));
        const toAdd = nextIds.filter((productId) => !previousSet.has(productId));

        if (toRemove.length > 0) {
          await removeProductsFromCollection(sessionId, toRemove);
        }
        if (toAdd.length > 0) {
          await addProductsToCollection(sessionId, toAdd);
        }
        if (nextIds.length > 0) {
          await reorderCollectionProducts(
            sessionId,
            nextIds.map((productId, orderIndex) => ({ productId, orderIndex })),
          );
        }

        setExistingLinkedProductIds(nextIds);
        toast.success('Collection updated.');
        navigate('/studio/store?view=collections');
        return;
      }

      if (orderedSelectedProductIds.length > 0) {
        await addProductsToCollection(sessionId, orderedSelectedProductIds);
      }

      await finalizeStoreCollection(sessionId, {
        action,
        collectionMetadata: metadataPayload,
      });

      toast.success(action === 'publish' ? 'Collection published.' : 'Draft saved.');
      navigate('/studio/store?view=collections');
    } catch (error: any) {
      const rawMessage = error?.response?.data?.message;
      if (rawMessage && typeof rawMessage === 'object') {
        const code = rawMessage?.code;
        const message = rawMessage?.message;
        if (code === 'COLLECTION_MAX_MEMBERSHIP') {
          toast.error('One or more products already belong to 3 collections.');
          setSubmitting(false);
          return;
        }
        if (typeof message === 'string' && message.length) {
          toast.error(message);
          setSubmitting(false);
          return;
        }
      }
      toast.error(
        error?.response?.data?.message ??
          (isExistingCollectionEditMode
            ? 'Failed to update collection.'
            : action === 'publish'
            ? 'Failed to publish collection.'
            : 'Failed to save draft.')
      );
    } finally {
      setSubmitting(false);
      setSubmitAction(null);
    }
  };

  const formatCurrency = (price?: number | null) => {
    if (!price && price !== 0) return '—';
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
    } catch {
      return `₦${price}`;
    }
  };

  const isLikelyFileId = (value?: string | null) =>
    Boolean(value) &&
    !value!.includes('://') &&
    !value!.startsWith('http') &&
    !value!.startsWith('/') &&
    !value!.includes('/');

  const getProductImage = (product: StoreProduct) => {
    const cover =
      typeof (product as any)?.coverImage === 'string'
        ? ((product as any).coverImage as string)
        : typeof (product as any)?.coverUrl === 'string'
          ? ((product as any).coverUrl as string)
          : null;
    if (cover) return cover;
    if (product.thumbnail) return product.thumbnail;
    if (Array.isArray(product.images)) {
      const img = product.images.find(Boolean);
      if (img) return img;
    }
    return undefined;
  };

  const getProductImageSource = (product: StoreProduct) => {
    const media = (product as any)?.media as
      | Array<{ id?: string; url?: string; type?: string; isPrimary?: boolean }>
      | undefined;
    const primaryMedia = media?.find((m) => m.isPrimary) ?? media?.[0];
    const fallbackImage = getProductImage(product);
    const image = primaryMedia?.url ?? fallbackImage ?? null;

    const mediaIds = Array.isArray((product as any)?.mediaIds) ? ((product as any).mediaIds as string[]) : [];

    const primaryId =
      typeof primaryMedia?.id === 'string' && isLikelyFileId(primaryMedia.id)
        ? primaryMedia.id
        : null;
    const fallbackId = mediaIds.find((id) => isLikelyFileId(id)) ?? null;
    const resolvedFileId = primaryId ?? fallbackId ?? null;

    if (!image) {
      return {
        src: null,
        fileId: resolvedFileId,
      };
    }

    const isRemote =
      image.startsWith('http') ||
      image.startsWith('/') ||
      image.startsWith('data:') ||
      image.includes('://') ||
      image.includes('?');

    return {
      src: isRemote ? image : null,
      fileId: resolvedFileId ?? (!isRemote && isLikelyFileId(image) ? image : null),
    };
  };

  const getProductPreviewSources = useCallback((product: StoreProduct) => {
    const media = (product as any)?.media as
      | Array<{ id?: string; url?: string; isPrimary?: boolean }>
      | undefined;
    const mediaIds = Array.isArray((product as any)?.mediaIds) ? ((product as any).mediaIds as string[]) : [];
    const cover =
      typeof (product as any)?.coverImage === 'string'
        ? ((product as any).coverImage as string)
        : typeof (product as any)?.coverUrl === 'string'
          ? ((product as any).coverUrl as string)
          : null;
    const imageValues = [cover, product.thumbnail, ...(Array.isArray(product.images) ? product.images : [])]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const entries: Array<{ src: string | null; fileId: string | null; key: string }> = [];
    const seen = new Set<string>();
    const pushEntry = (src: string | null, fileId: string | null, keyPrefix: string) => {
      if (!src && !fileId) return;
      const dedupeKey = `${src ?? ''}|${fileId ?? ''}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      entries.push({ src, fileId, key: `${keyPrefix}-${dedupeKey}` });
    };

    const orderedMedia = Array.isArray(media)
      ? [...media].sort((a, b) => Number(Boolean(b?.isPrimary)) - Number(Boolean(a?.isPrimary)))
      : [];

    orderedMedia.forEach((item, index) => {
      const rawUrl = typeof item?.url === 'string' ? item.url : null;
      const mediaId = typeof item?.id === 'string' && isLikelyFileId(item.id) ? item.id : null;
      if (rawUrl) {
        const isRemote =
          rawUrl.startsWith('http') ||
          rawUrl.startsWith('/') ||
          rawUrl.startsWith('data:') ||
          rawUrl.includes('://') ||
          rawUrl.includes('?');
        pushEntry(isRemote ? rawUrl : null, mediaId ?? (!isRemote && isLikelyFileId(rawUrl) ? rawUrl : null), `media-${index}`);
        return;
      }
      pushEntry(null, mediaId, `media-${index}`);
    });

    imageValues.forEach((value, index) => {
      const isRemote =
        value.startsWith('http') ||
        value.startsWith('/') ||
        value.startsWith('data:') ||
        value.includes('://') ||
        value.includes('?');
      pushEntry(isRemote ? value : null, !isRemote && isLikelyFileId(value) ? value : null, `fallback-${index}`);
    });

    mediaIds.forEach((id, index) => {
      if (!isLikelyFileId(id)) return;
      pushEntry(null, id, `media-id-${index}`);
    });

    return entries;
  }, []);

  const previewImages = useMemo(
    () => (previewProduct ? getProductPreviewSources(previewProduct) : []),
    [getProductPreviewSources, previewProduct],
  );

  useEffect(() => {
    setPreviewImageIndex(0);
  }, [previewProduct?.id]);

  useEffect(() => {
    if (previewImageIndex < previewImages.length) return;
    setPreviewImageIndex(0);
  }, [previewImageIndex, previewImages.length]);

  const activePreviewImage = previewImages[previewImageIndex] ?? null;

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400" aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Studio
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate('/studio/store')}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Store
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigate('/studio/store?view=collections')}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Manage Collections
        </button>
        <span>/</span>
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {isExistingCollectionEditMode ? 'Edit Collection' : 'New Collection'}
        </span>
      </nav>

      <div className="relative overflow-hidden rounded-3xl border border-purple-100/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-purple-400/20 via-fuchsia-300/10 to-transparent blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-300/20 via-purple-300/10 to-transparent blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold">Store Collections</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isExistingCollectionEditMode ? 'Edit Collection' : 'Create Collection'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isExistingCollectionEditMode
              ? `Update metadata, product membership, and primary product order for this collection.`
              : `Select up to ${MAX_PRODUCTS} products and publish a store collection.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-purple-100/70 dark:border-white/10 bg-gradient-to-br from-white/90 via-purple-50/40 to-white/90 dark:from-white/5 dark:via-white/5 dark:to-white/5 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">How would you like to build this collection?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Start with existing products or create new items before publishing.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreationMode('existing')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  creationMode === 'existing'
                    ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10'
                    : 'border-gray-200 dark:border-white/10 hover:border-purple-300'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white">From Existing Products</div>
                  <div className="text-xs text-gray-500 mt-1">Select from your existing store products.</div>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('new')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  creationMode === 'new'
                    ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10'
                    : 'border-gray-200 dark:border-white/10 hover:border-purple-300'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Create New Products</div>
                <div className="text-xs text-gray-500 mt-1">Create products and add them directly into this collection.</div>
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400" />
            <div className="flex items-center justify-between mb-4 relative">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h2>
              <span className="text-xs font-semibold text-gray-500">
                Selected {selectedProductIds.length}/{MAX_PRODUCTS}
              </span>
            </div>
            {isExistingCollectionEditMode && existingLinkedProductIds.length > 0 && (
              <div className="mb-4 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                {existingLinkedProductIds.length} product(s) are already linked to this collection. They are pinned first and marked below.
              </div>
            )}
            {selectedProductIds.length > 0 && !hasPrimarySelection && (
              <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
                Choose one selected product as the primary product before you can save or publish.
              </div>
            )}

            {creationMode === 'existing' ? (
              <SearchField
                placeholder="Search products..."
                value={search}
                onChange={setSearch}
                showFilter={false}
                className="!max-w-none"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Add products directly to this collection. Product-level draft save is disabled in this flow.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openCollectionProductEditor()}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                  >
                    Create a Product
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.info('Bulk upload is coming soon.');
                    }}
                    className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                  >
                    Bulk Upload (Soon)
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadProducts()}
                    className="rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
                  >
                    Refresh Products
                  </button>
                </div>
              </div>
            )}

            {creationMode === 'existing' && (
              <>
            {productsLoading ? (
              <div className="py-10 text-sm text-gray-500">Loading products...</div>
            ) : productsError ? (
              <div className="py-10 text-sm text-red-500">{productsError}</div>
            ) : visibleProducts.length === 0 ? (
              <div className="py-10 text-sm text-gray-500">No products found.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedProducts.map((product) => {
                  const image = getProductImageSource(product);
                  const selected = selectedProductIds.includes(product.id);
                  const isPrimary = primaryProductId === product.id;
                  const isSession = sessionDraftProductIds.includes(product.id);
                  const isLinked = existingLinkedProductIds.includes(product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleProduct(product.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`relative flex gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-300 cursor-pointer group ${
                        selected
                          ? 'border-transparent bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-purple-600/30 dark:via-fuchsia-600/20 dark:to-pink-600/20 ring-2 ring-purple-500/60 shadow-xl shadow-purple-500/20 scale-[1.02]'
                          : 'border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.01] hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-pink-50/50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20'
                      }`}
                    >
                      <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/10 border border-gray-200/70 dark:border-white/10">
                        {image.src || image.fileId ? (
                          <ImageWithFallback
                            src={image.src}
                            fileId={image.fileId}
                            alt={product.name}
                            fit="cover"
                            className="w-full h-full object-cover"
                            containerClassName="w-full h-full"
                            rounded="lg"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-gray-400">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(product.price)}
                            </div>
                            {isPrimary && (
                              <div className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                Primary cover
                              </div>
                            )}
                            {isLinked && (
                              <div className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Already in collection
                              </div>
                            )}
                            {isSession && (
                              <div className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                New • Collection Flow
                              </div>
                            )}
                            <div className="mt-1 text-[11px] text-gray-500">
                              Stock: {typeof product.totalStock === 'number' ? product.totalStock : '—'}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProduct(product.id);
                              }}
                              className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 ${
                                selected
                                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-sm'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {selected ? 'Selected' : 'Select'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetPrimary(product.id);
                              }}
                              disabled={!selected}
                              className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 ${
                                isPrimary
                                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                                  : selected
                                    ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {isPrimary ? 'Primary' : 'Set Primary'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImageIndex(0);
                                setPreviewProduct(product);
                              }}
                              className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openCollectionProductEditor(product.id);
                              }}
                              className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}

            {creationMode === 'new' && (
              <>
                {sessionProducts.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-6 text-sm text-gray-600 dark:text-gray-300">
                    No new products added yet. Use "Create a Product" to add items to this collection.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sessionProducts.map((product) => {
                      const image = getProductImageSource(product);
                      const selected = selectedProductIds.includes(product.id);
                      const isPrimary = primaryProductId === product.id;
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProduct(product.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleProduct(product.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={`relative flex gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-300 cursor-pointer group ${
                            selected
                              ? 'border-transparent bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-purple-600/30 dark:via-fuchsia-600/20 dark:to-pink-600/20 ring-2 ring-purple-500/60 shadow-xl shadow-purple-500/20 scale-[1.02]'
                              : 'border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.01] hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-pink-50/50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20'
                          }`}
                        >
                          <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/10 border border-gray-200/70 dark:border-white/10">
                            {image.src || image.fileId ? (
                              <ImageWithFallback
                                src={image.src}
                                fileId={image.fileId}
                                alt={product.name}
                                fit="cover"
                                className="w-full h-full object-cover"
                                containerClassName="w-full h-full"
                                rounded="lg"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-gray-400">No image</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                                  {product.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatCurrency(product.price)}
                                </div>
                                {isPrimary && (
                                  <div className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                    Primary cover
                                  </div>
                                )}
                                <div className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                  New • Collection Flow
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500">
                                  Stock: {typeof product.totalStock === 'number' ? product.totalStock : '—'}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProduct(product.id);
                                  }}
                                  className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 ${
                                    selected
                                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-sm'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                  }`}
                                >
                                  {selected ? 'Selected' : 'Select'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetPrimary(product.id);
                                  }}
                                  disabled={!selected}
                                  className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 ${
                                    isPrimary
                                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                                      : selected
                                        ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-sm'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {isPrimary ? 'Primary' : 'Set Primary'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImageIndex(0);
                                    setPreviewProduct(product);
                                  }}
                                  className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openCollectionProductEditor(product.id);
                                  }}
                                  className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-purple-100/70 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 space-y-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white relative">Collection Details</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Holiday Drop"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <Select
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loadingCategories || categories.length === 0}
                variant="default"
              >
                {loadingCategories && <option>Loading categories...</option>}
                {!loadingCategories && categories.length === 0 && <option>No categories available</option>}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Select
                label="Category Type"
                value={categoryTypeId}
                onChange={(e) => setCategoryTypeId(e.target.value)}
                disabled={loadingCategories || categoryTypeOptions.length === 0}
                variant="default"
              >
                {loadingCategories && <option>Loading category types...</option>}
                {!loadingCategories && categoryTypeOptions.length === 0 && (
                  <option>No category types available</option>
                )}
                {categoryTypeOptions.map((categoryType) => (
                  <option key={categoryType.id} value={categoryType.id}>
                    {categoryType.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select
                  label="Visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as CollectionVisibility)}
                  variant="default"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </Select>
              </div>
              <div>
                <Select
                  label="Type"
                  value={type}
                  onChange={(e) => setType(e.target.value as CollectionType)}
                  variant="default"
                >
                  <option value="EVERYBODY">Everybody</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </div>
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
              {normalizedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizedTags.map((tag, index) => (
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
              <p className="mt-1 text-[11px] text-gray-500">
                {normalizedTags.length}/{MAX_TAGS} tags. Press Enter or click Add.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Selected Products</h3>
            {selectedProducts.length > 0 && !hasPrimarySelection && (
              <p className="mb-3 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Primary product is required.
              </p>
            )}
            {selectedProducts.length === 0 ? (
              <p className="text-xs text-gray-500">No products selected yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedProducts.map((product) => {
                  const isDraft = product.isActive === false || sessionDraftProductIds.includes(product.id);
                  const isPrimary = primaryProductId === product.id;
                  return (
                  <div key={product.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-1 flex items-center gap-2">
                      {product.name}
                      {isPrimary && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Primary
                        </span>
                      )}
                      {isDraft && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Draft
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(product.id)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        {isPrimary ? 'Primary' : 'Set Primary'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openCollectionProductEditor(product.id)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            if (isExistingCollectionEditMode) {
              navigate('/studio/store?view=collections');
              return;
            }
            navigate(-1);
          }}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-purple-300"
        >
          {isExistingCollectionEditMode ? 'Discard changes' : 'Back'}
        </button>
        {isExistingCollectionEditMode ? (
          <button
            type="button"
            onClick={() => handleSubmit('publish')}
            disabled={submitting}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
            )}
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={submitting}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting && submitAction === 'draft' && (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-500/40 border-t-gray-700 animate-spin" />
              )}
              {submitting && submitAction === 'draft' ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('publish')}
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting && submitAction === 'publish' && (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              )}
              {submitting && submitAction === 'publish' ? 'Publishing...' : 'Publish'}
            </button>
          </>
        )}
      </div>

      {previewProduct && (
        <OverlayPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 animate-in fade-in duration-200">
            <button
              type="button"
              className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-black/70 to-pink-900/60 backdrop-blur-md transition-opacity duration-200"
              onClick={() => setPreviewProduct(null)}
              aria-label="Close product preview"
            />
            <div className="relative w-full max-w-3xl rounded-3xl border border-white/20 bg-gradient-to-br from-white/95 via-white/90 to-purple-50/90 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-purple-950/90 shadow-2xl shadow-purple-500/20 overflow-hidden backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
              {/* Decorative gradient orbs */}
              <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br from-purple-400/30 via-fuchsia-400/20 to-transparent blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-tr from-pink-400/30 via-purple-400/20 to-transparent blur-3xl" />
              
              {/* Header with gradient accent */}
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
                <div className="flex items-center justify-between px-6 py-5 border-b border-purple-200/30 dark:border-white/10">
                  <div>
                    <div className="text-base font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">Product Details</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{previewProduct.name}</div>
                    {previewImages.length > 0 && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {previewImages.length} image{previewImages.length === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewProduct(null)}
                    className="rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800 dark:hover:to-pink-800 hover:text-purple-700 dark:hover:text-white transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Close
                  </button>
                </div>
              </div>
              
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                {/* Image Container with enhanced styling */}
                <div className="rounded-2xl bg-gradient-to-br from-gray-100/80 via-white to-purple-50/50 dark:from-white/10 dark:via-white/5 dark:to-purple-900/20 p-4 border border-purple-200/40 dark:border-white/10 shadow-inner">
                  <div className="flex items-center justify-center min-h-[260px]">
                    {activePreviewImage ? (
                      <ImageWithFallback
                        src={activePreviewImage.src}
                        fileId={activePreviewImage.fileId}
                        alt={previewProduct.name}
                        fit="contain"
                        className="max-h-[360px] w-auto rounded-xl shadow-lg"
                        containerClassName="w-full flex justify-center"
                        rounded="xl"
                      />
                    ) : (
                      <div className="text-sm text-gray-400">No image</div>
                    )}
                  </div>
                  {previewImages.length > 1 && (
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {previewImages.map((image, index) => {
                        const isActive = previewImageIndex === index;
                        return (
                          <button
                            key={image.key}
                            type="button"
                            onClick={() => setPreviewImageIndex(index)}
                            className={`h-14 rounded-lg border-2 overflow-hidden transition-all ${
                              isActive
                                ? 'border-purple-500 shadow-md shadow-purple-500/20'
                                : 'border-gray-200/80 dark:border-white/10 hover:border-purple-300'
                            }`}
                          >
                            <ImageWithFallback
                              src={image.src}
                              fileId={image.fileId}
                              alt={`${previewProduct.name} ${index + 1}`}
                              fit="cover"
                              className="h-full w-full object-cover"
                              containerClassName="h-full w-full"
                              rounded="none"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Details Section */}
                <div className="space-y-5">
                  <div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 dark:from-white dark:via-purple-200 dark:to-white bg-clip-text text-transparent">{previewProduct.name}</div>
                    <div className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mt-1">
                      {formatCurrency(previewProduct.price)}
                    </div>
                  </div>
                  {previewProduct.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-gray-200/50 dark:border-white/10">
                      {previewProduct.description}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border border-indigo-200/50 dark:border-indigo-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-semibold">Stock</div>
                      <div className="font-bold text-indigo-900 dark:text-indigo-100 text-base mt-0.5">{previewProduct.totalStock ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border border-emerald-200/50 dark:border-emerald-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-semibold">Status</div>
                      <div className={`font-bold text-base mt-0.5 ${previewProduct.isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                        {previewProduct.isActive ? 'Active' : 'Draft'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/30 border border-purple-200/50 dark:border-purple-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-purple-500 dark:text-purple-400 font-semibold">Sizes</div>
                      <div className="font-bold text-purple-900 dark:text-purple-100 text-base mt-0.5">
                        {previewProduct.sizes?.length ? previewProduct.sizes.join(', ') : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/30 dark:to-rose-900/30 border border-pink-200/50 dark:border-pink-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-pink-500 dark:text-pink-400 font-semibold">Colors</div>
                      <div className="font-bold text-pink-900 dark:text-pink-100 text-base mt-0.5">
                        {previewProduct.colors?.length ? previewProduct.colors.join(', ') : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </div>
  );
};

export default StoreCollectionCreate;
