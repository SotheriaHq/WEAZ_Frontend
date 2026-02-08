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
import MediaRenderer from '@/components/media/MediaRenderer';
import SearchField from '@/components/SearchField';

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

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      if (!user?.id) return;
      setProductsLoading(true);
      setProductsError(null);
      try {
        const res = await getBrandProductsForOwner(user.id, 200);
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!mounted) return;
        setProducts(items);
      } catch (error: any) {
        if (!mounted) return;
        setProducts([]);
        setProductsError(error?.response?.data?.message ?? 'Failed to load products.');
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

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
        mode: 'existing',
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
    if (product.thumbnail) return product.thumbnail;
    if (Array.isArray(product.images)) {
      const img = product.images.find(Boolean);
      if (img) return img;
    }
    return undefined;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold">Store Collections</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Collection</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select up to {MAX_PRODUCTS} products and publish a store collection.
          </p>
        </div>
        <div className="flex gap-2">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h2>
              <span className="text-xs font-semibold text-gray-500">
                Selected {selectedProductIds.length}/{MAX_PRODUCTS}
              </span>
            </div>

            <SearchField
              placeholder="Search products..."
              value={search}
              onChange={setSearch}
              showFilter={false}
              className="!max-w-none"
            />

            {productsLoading ? (
              <div className="py-10 text-sm text-gray-500">Loading products...</div>
            ) : productsError ? (
              <div className="py-10 text-sm text-red-500">{productsError}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-sm text-gray-500">No products found.</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const image = getProductImage(product);
                  const selected = selectedProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`relative flex gap-4 rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10'
                          : 'border-gray-200 dark:border-white/10 hover:border-purple-300'
                      }`}
                    >
                      <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-white/5 overflow-hidden flex items-center justify-center">
                        {image ? (
                          <MediaRenderer
                            kind="image"
                            src={image}
                            alt={product.name}
                            fit="cover"
                            className="h-full w-full"
                            mediaClassName="h-full w-full object-cover"
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
                          <span className={`text-[10px] px-2 py-1 rounded-full ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {selected ? 'Selected' : 'Select'}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-500">
                          Stock: {typeof product.totalStock === 'number' ? product.totalStock : '—'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Collection Details</h2>

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
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loadingCategories || categories.length === 0}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                {loadingCategories && <option>Loading categories...</option>}
                {!loadingCategories && categories.length === 0 && <option>No categories available</option>}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as CollectionVisibility)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CollectionType)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="EVERYBODY">Everybody</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
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

          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6">
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
    </div>
  );
};

export default StoreCollectionCreate;
