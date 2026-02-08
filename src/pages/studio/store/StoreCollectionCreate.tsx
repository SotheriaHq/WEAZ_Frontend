import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { getBrandProductsForOwner, type Product as StoreProduct } from '@/api/StoreApi';
import {
  addProductsToCollection,
  finalizeStoreCollection,
  initializeStoreCollection,
  type CollectionType,
  type CollectionVisibility,
} from '@/api/storeCollections';
import ImageWithFallback from '@/components/ImageWithFallback';
import SearchField from '@/components/SearchField';
import Select from '@/components/ui/Select';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

const MAX_PRODUCTS = 5;
const MAX_TAGS = 20;
const TAG_CHAR_LIMIT = 50;

const StoreCollectionCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((state: RootState) => state.user.profile);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('PUBLIC');
  const [type, setType] = useState<CollectionType>('EVERYBODY');
  const [categoryId, setCategoryId] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creationMode, setCreationMode] = useState<'existing' | 'new'>('existing');

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<StoreProduct | null>(null);

  const preselectProductId = searchParams.get('productId');

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await brandApi.getCategories();
        if (!mounted) return;
        const mapped = cats.map((c) => ({ id: c.id, name: c.name }));
        setCategories(mapped);
        if (mapped.length) {
          setCategoryId((prev) => prev || mapped[0].id);
        }
      } catch (error) {
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
    if (!preselectProductId || products.length === 0) return;
    setSelectedProductIds((prev) => {
      if (prev.includes(preselectProductId)) return prev;
      if (prev.length >= MAX_PRODUCTS) return prev;
      return [...prev, preselectProductId];
    });
  }, [preselectProductId, products.length]);

  const normalizedTags = useMemo(() => {
    const seen = new Set<string>();
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.slice(0, TAG_CHAR_LIMIT))
      .filter((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return tags.slice(0, MAX_TAGS);
  }, [tagsInput]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
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

  const handleSubmit = async (action: 'publish' | 'draft') => {
    if (!title.trim()) {
      toast.error('Please enter a collection title.');
      return;
    }

    if (selectedProductIds.length > MAX_PRODUCTS) {
      toast.error(`Collections can contain a maximum of ${MAX_PRODUCTS} products.`);
      return;
    }

    if (action === 'publish') {
      if (!categoryId) {
        toast.error('Please select a category to publish.');
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
    }

    setSubmitting(true);
    try {
      const init = await initializeStoreCollection({
        mode: creationMode === 'new' ? 'new-individual' : 'existing',
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        categoryId: categoryId || undefined,
        type,
        tags: normalizedTags,
        isAvailableInStore: true,
      });

      if (selectedProductIds.length > 0) {
        await addProductsToCollection(init.sessionId, selectedProductIds);
      }

      await finalizeStoreCollection(init.sessionId, {
        action,
        collectionMetadata: {
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
          type,
          categoryId: categoryId || undefined,
          tags: normalizedTags,
          isAvailableInStore: true,
        },
      });

      toast.success(action === 'publish' ? 'Collection published.' : 'Draft saved.');
      navigate('/studio/store');
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
          (action === 'publish'
            ? 'Failed to publish collection.'
            : 'Failed to save draft.')
      );
    } finally {
      setSubmitting(false);
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
    const isLikelyFileId = (value?: string | null) =>
      Boolean(value) &&
      !value!.includes('://') &&
      !value!.startsWith('http') &&
      !value!.startsWith('/') &&
      !value!.includes('/');

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

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-purple-100/60 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-purple-400/20 via-fuchsia-300/10 to-transparent blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-300/20 via-purple-300/10 to-transparent blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold">Store Collections</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Collection</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select up to {MAX_PRODUCTS} products and publish a store collection.
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
                  <div className="text-xs text-gray-500 mt-1">Select from store, drafts, or archived items.</div>
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
                <div className="text-xs text-gray-500 mt-1">Add new items, then return to finish this collection.</div>
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
                  Create new products first, then refresh this list to add them to the collection.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/studio/store/products/new?returnTo=/studio/store/collections/new&returnContext=collection')}
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
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-sm text-gray-500">No products found.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const image = getProductImageSource(product);
                  const selected = selectedProductIds.includes(product.id);
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
                      className={`relative flex gap-4 rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-purple-500/80 bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-500/20 dark:via-white/5 dark:to-pink-500/10 ring-2 ring-purple-400/50 shadow-lg shadow-purple-500/15'
                          : 'border-gray-200 dark:border-white/10 hover:border-purple-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="h-16 w-16 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 overflow-hidden flex items-center justify-center">
                        {image.src || image.fileId ? (
                          <ImageWithFallback
                            src={image.src}
                            fileId={image.fileId}
                            alt={product.name}
                            fit="cover"
                            className="h-full w-full object-cover"
                            containerClassName="h-full w-full"
                            rounded="md"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(product.price)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewProduct(product);
                              }}
                              className="text-[10px] px-2 py-1 rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-purple-300"
                            >
                              View
                            </button>
                            <span
                              className={`text-[10px] px-2 py-1 rounded-full border ${
                                selected
                                  ? 'border-purple-500 bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-sm'
                                  : 'border-gray-200 bg-gray-100 text-gray-500'
                              }`}
                            >
                              {selected ? 'Selected' : 'Select'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500">
                          Stock: {typeof product.totalStock === 'number' ? product.totalStock : '—'}
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
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tags</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. spring, limited, drop"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                {normalizedTags.length}/{MAX_TAGS} tags (comma-separated)
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Selected Products</h3>
            {selectedProducts.length === 0 ? (
              <p className="text-xs text-gray-500">No products selected yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span className="line-clamp-1">{product.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-purple-300"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={submitting}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('publish')}
          disabled={submitting}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-60"
        >
          Publish
        </button>
      </div>

      {previewProduct && (
        <OverlayPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setPreviewProduct(null)}
              aria-label="Close product preview"
            />
            <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Product Details</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{previewProduct.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProduct(null)}
                  className="rounded-full border border-gray-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-purple-300"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 flex items-center justify-center">
                  {(() => {
                    const image = getProductImageSource(previewProduct);
                    return image.src || image.fileId ? (
                      <ImageWithFallback
                        src={image.src}
                        fileId={image.fileId}
                        alt={previewProduct.name}
                        fit="contain"
                        className="max-h-[360px] w-auto"
                        containerClassName="w-full flex justify-center"
                        rounded="xl"
                      />
                    ) : (
                      <div className="text-sm text-gray-400">No image</div>
                    );
                  })()}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">{previewProduct.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatCurrency(previewProduct.price)}
                    </div>
                  </div>
                  {previewProduct.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {previewProduct.description}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Stock</div>
                      <div className="font-semibold">{previewProduct.totalStock ?? '—'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Status</div>
                      <div className="font-semibold">{previewProduct.isActive ? 'Active' : 'Draft'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Sizes</div>
                      <div className="font-semibold">
                        {previewProduct.sizes?.length ? previewProduct.sizes.join(', ') : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">Colors</div>
                      <div className="font-semibold">
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
