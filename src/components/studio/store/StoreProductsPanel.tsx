import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import { productApi } from '@/api/ProductApi';
import { toast } from 'sonner';
import SearchField from '@/components/SearchField';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { unwrapApiResponse } from '@/types/auth';
import type { CollectionDto } from '@/types/profile';
import { useDropdownManager } from '@/context/DropdownManagerContext';
import {
  DeleteProductModal,
  ArchiveProductModal,
  ComingSoonModal,
  BulkDeleteProductsModal,
  ProductActionsMenu,
  getDefaultProductActions,
  RestoreDeletedProductModal,
  PermanentDeleteProductModal,
} from './modals';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageWithFallback from '@/components/ImageWithFallback';
import VLoader from '@/components/loaders/VLoader';
import { Select } from '@/components/ui/Select';
import StoreEmptyState, { type EmptyStateType } from '@/components/designs/StoreEmptyState';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import { PRODUCT_STUDIO_SYNC_EVENT } from '@/utils/productStudioEvents';
import {
  getProductStockState,
  isCustomOrderOnlyProduct,
} from '@/lib/productAvailability';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { buildDesignRoute } from '@/utils/catalogRoutes';

type StudioStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'DELETED';
type OutletView = 'products' | 'collections';
type ProductStatusFilter = 'all' | 'active' | 'draft' | 'featured' | 'archived' | 'deleted';
type ProductSortBy = 'newest' | 'price_asc' | 'price_desc' | 'popular';
type CollectionStatusFilter = 'all' | 'published' | 'draft' | 'archived';
type CollectionSortBy = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'items_desc';

const PRODUCT_STATUS_OPTIONS: Array<{
  value: ProductStatusFilter;
  label: string;
  icon: string;
}> = [
  { value: 'all', label: 'All', icon: '📦' },
  { value: 'active', label: 'Published', icon: '✨' },
  { value: 'draft', label: 'Product Drafts', icon: '📝' },
  { value: 'featured', label: 'Featured', icon: '⭐' },
  { value: 'archived', label: 'Archived', icon: '📁' },
  { value: 'deleted', label: 'Deleted', icon: '🗑️' },
];

const PRODUCT_SORT_OPTIONS: Array<{
  value: ProductSortBy;
  label: string;
}> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'price_asc', label: 'Price low-high' },
  { value: 'price_desc', label: 'Price high-low' },
];

const PRODUCT_STATUS_FILTER_VALUES = new Set<ProductStatusFilter>(
  PRODUCT_STATUS_OPTIONS.map((option) => option.value),
);
const COLLECTION_STATUS_FILTER_VALUES = new Set<CollectionStatusFilter>([
  'all',
  'published',
  'draft',
  'archived',
]);
const STOCK_FILTER_VALUES = new Set(['all', 'in_stock', 'low_stock', 'out_of_stock']);

interface BackendProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  totalStock: number;
  isActive: boolean;
  isFeatured?: boolean;
  customAvailable?: boolean;
  customOrderEnabled?: boolean;
  isCustomOrderOnly?: boolean;
  canBagWhenOutOfStock?: boolean;
  thumbnail?: string | null;
  images?: string[];
  media?: Array<{ id: string; url: string; type: string; isPrimary?: boolean }>;
  mediaIds?: string[];
  collectionId?: string;
  collection?: { id: string; title: string };
  archivedAt?: string | null;
  archiveExpiresAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string | null;
}

interface ProductsResponse {
  items: BackendProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

interface CollectionOption {
  id: string;
  name: string;
  description?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  deletedAt?: string | null;
  deleteExpiresAt?: string | null;
  isAvailableInStore?: boolean;
  isSystemGenerated?: boolean;
  coverImage?: string;
  coverFileId?: string;
  previewImages?: Array<{ url?: string | null; fileId?: string | null }>;
  itemCount?: number;
  updatedAt?: string;
  createdAt?: string;
}

interface CollectionGalleryImage {
  id: string;
  src: string | null;
  fileId: string | null;
  alt: string;
  productName?: string;
  productId?: string;
}

interface StoreProductsPanelProps {
  layoutMode?: boolean;
  onToggleLayoutMode?: () => void;
  draftCollections?: any[];
  draftCollectionsLoading?: boolean;
}

const resolveProductStatus = (product: BackendProduct): StudioStatus => {
  if (product.deletedAt) return 'DELETED';
  if (product.archivedAt) return 'ARCHIVED';

  const rawStatus = String((product as any).status || '').toUpperCase();
  if (rawStatus === 'ARCHIVED') return 'ARCHIVED';
  if (rawStatus === 'ACTIVE' || rawStatus === 'PUBLISHED') return 'ACTIVE';
  if (rawStatus === 'DRAFT') return 'DRAFT';

  return product.isActive ? 'ACTIVE' : 'DRAFT';
};

const hasRenderableProductMedia = (product: BackendProduct | null | undefined): boolean => {
  if (!product) return false;
  if (typeof product.thumbnail === 'string' && product.thumbnail.trim().length > 0) return true;
  if (Array.isArray(product.images) && product.images.some((value) => String(value || '').trim().length > 0)) {
    return true;
  }
  if (Array.isArray(product.media)) {
    return product.media.some(
      (entry) =>
        Boolean(String(entry?.url || '').trim()) ||
        Boolean(String(entry?.id || '').trim()),
    );
  }
  return false;
};

const isSystemStoreCollection = (collection: Pick<CollectionOption, 'name' | 'description' | 'isSystemGenerated'>): boolean => {
  if (collection.isSystemGenerated) return true;
  const normalizedName = String(collection.name || '').trim().toLowerCase();
  const normalizedDescription = String(collection.description || '').trim().toLowerCase();
  return (
    normalizedName === 'store products' &&
    (normalizedDescription === '' || normalizedDescription === 'system bucket for standalone products.')
  );
};

const isGhostUntitledDraft = (collection: CollectionOption): boolean => {
  const status = String(collection.status || '').toUpperCase();
  if (status !== 'DRAFT') return false;

  const normalizedName = String(collection.name || '').trim().toLowerCase();
  const normalizedDescription = String(collection.description || '').trim();
  const itemCount = typeof collection.itemCount === 'number' ? collection.itemCount : 0;

  return normalizedName === 'untitled collection' && normalizedDescription.length === 0 && itemCount === 0;
};

const isRemoteMediaValue = (value: string): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return (
    normalized.startsWith('http') ||
    normalized.startsWith('/') ||
    normalized.startsWith('data:') ||
    normalized.includes('://') ||
    normalized.includes('?')
  );
};

const toRenderableMediaSource = (
  value: string | null | undefined,
): { src: string | null; fileId: string | null } => {
  if (!value || String(value).trim().length === 0) {
    return { src: null, fileId: null };
  }
  return isRemoteMediaValue(value)
    ? { src: value, fileId: null }
    : { src: null, fileId: value };
};

const getCollectionPreviewSources = (
  collection: Pick<CollectionOption, 'id' | 'name' | 'coverImage' | 'coverFileId' | 'previewImages'>,
): Array<{ src: string | null; fileId: string | null; alt: string; productName?: string }> => {
  const seen = new Set<string>();
  const out: Array<{ src: string | null; fileId: string | null; alt: string; productName?: string }> = [];

  const pushSource = (src: string | null | undefined, fileId: string | null | undefined, productName?: string) => {
    const normalizedSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;
    const normalizedFileId =
      typeof fileId === 'string' && fileId.trim().length > 0 ? fileId.trim() : null;
    if (!normalizedSrc && !normalizedFileId) return;
    const key = `${normalizedSrc ?? ''}|${normalizedFileId ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      src: normalizedSrc,
      fileId: normalizedFileId,
      alt: productName || `${collection.name} image ${out.length + 1}`,
      productName,
    });
  };

  (collection.previewImages ?? []).forEach((image) => {
    const url = typeof image?.url === 'string' ? image.url : null;
    const fileId = typeof image?.fileId === 'string' ? image.fileId : null;
    const productName = typeof (image as any)?.productName === 'string' ? (image as any).productName : undefined;
    if (url || fileId) {
      pushSource(url, fileId, productName);
      return;
    }
    if (typeof image?.url === 'string') {
      const renderable = toRenderableMediaSource(image.url);
      pushSource(renderable.src, renderable.fileId, productName);
    }
  });

  if (out.length === 0) {
    pushSource(collection.coverImage ?? null, collection.coverFileId ?? null);
  }

  return out;
};

const StoreProductsPanel: React.FC<StoreProductsPanelProps> = ({
  layoutMode = false,
  onToggleLayoutMode,
  draftCollections = [],
  draftCollectionsLoading = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);
  const dropdownManager = useDropdownManager();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';

  const [filterStatus, setFilterStatus] = useState<ProductStatusFilter>('all');
  const [filterCollection, setFilterCollection] = useState<'all' | string>('all');
  const [filterStock, setFilterStock] = useState('all');
  const [productSortBy, setProductSortBy] = useState<ProductSortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [cursorByPage, setCursorByPage] = useState<Record<number, string | null | undefined>>({});

  // Modal state
  const [deleteModalProduct, setDeleteModalProduct] = useState<BackendProduct | null>(null);
  const [archiveModalProduct, setArchiveModalProduct] = useState<BackendProduct | null>(null);
  const [archiveMode, setArchiveMode] = useState<'archive' | 'unarchive'>('archive');
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; feature?: string; description?: string }>({ open: false });
  const [bulkConfirmAction, setBulkConfirmAction] = useState<
    'delete' | 'permanent-delete' | 'archive' | 'unpublish' | null
  >(null);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [restoreModalProduct, setRestoreModalProduct] = useState<BackendProduct | null>(null);
  const [permanentDeleteProduct, setPermanentDeleteProduct] = useState<BackendProduct | null>(null);
  const [draftReminderProduct, setDraftReminderProduct] = useState<BackendProduct | null>(null);
  
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listMinHeight, setListMinHeight] = useState<number | undefined>(undefined);
  const createdProductHydrationAttemptsRef = useRef(0);
  const galleryTouchRef = useRef({ startX: 0, startY: 0 });
  const productMenuTriggerRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});

  // Expandable search (emoji pattern reused from CatalogShopTab)
  const [searchCollapsed, setSearchCollapsed] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [collectionSearchCollapsed, setCollectionSearchCollapsed] = useState(true);
  const collectionSearchContainerRef = useRef<HTMLDivElement>(null);

  // Collapsible/expandable command groups
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const filtersMenuRef = useRef<HTMLDivElement>(null);
  const [outletView, setOutletView] = useState<OutletView>(
    new URLSearchParams(location.search).get('view') === 'collections' ? 'collections' : 'products',
  );
  const quickCollectionsRef = useRef<HTMLDivElement | null>(null);

  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<CollectionStatusFilter>('all');
  const [collectionSortBy, setCollectionSortBy] = useState<CollectionSortBy>('newest');
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionLimit, setCollectionLimit] = useState(12);
  const [collectionBusyId, setCollectionBusyId] = useState<string | null>(null);
  const [collectionConfirm, setCollectionConfirm] = useState<{
    mode: 'archive' | 'unarchive' | 'delete';
    collection: CollectionOption;
  } | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeCollectionProducts, setActiveCollectionProducts] = useState<BackendProduct[]>([]);
  const [activeCollectionProductsLoading, setActiveCollectionProductsLoading] = useState(false);
  const [activeCollectionProductsPage, setActiveCollectionProductsPage] = useState(1);
  const [activeCollectionProductsLimit, setActiveCollectionProductsLimit] = useState(8);
  const [activeCollectionProductsTotal, setActiveCollectionProductsTotal] = useState(0);
  const [deleteAllCollectionsConfirmOpen, setDeleteAllCollectionsConfirmOpen] = useState(false);
  const [deletingAllCollections, setDeletingAllCollections] = useState(false);
  const [collectionGalleryOpen, setCollectionGalleryOpen] = useState(false);
  const [collectionGalleryLoading, setCollectionGalleryLoading] = useState(false);
  const [collectionGalleryImages, setCollectionGalleryImages] = useState<CollectionGalleryImage[]>([]);
  const [collectionGalleryIndex, setCollectionGalleryIndex] = useState(0);
  const [collectionGallerySourceName, setCollectionGallerySourceName] = useState('');
  const [hoveredCollectionId, setHoveredCollectionId] = useState<string | null>(null);
  const [hoverPreviewFrame, setHoverPreviewFrame] = useState<Record<string, number>>({});
  const [inlineProduct, setInlineProduct] = useState<StoreProduct | null>(null);
  const recentCreatedProductId = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('createdProductId');
    const normalized = String(raw ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }, [location.search]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const showBulkActions = selectedProducts.length > 0;
  const isDeletedTab = filterStatus === 'deleted';
  const selectedBulkDeleteProducts = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return selectedProducts.map((id) => {
      const product = byId.get(id);
      return {
        id,
        name: product?.name || 'Product',
        thumbnail: product?.thumbnail ?? null,
        images: Array.isArray(product?.images) ? product.images : [],
      };
    });
  }, [products, selectedProducts]);

  const filteredProducts = useMemo(() => {
    let items = products;

    if (filterStatus !== 'all') {
      if (filterStatus === 'archived') {
        items = items.filter((p) => resolveProductStatus(p) === 'ARCHIVED');
      } else if (filterStatus === 'deleted') {
        items = items.filter((p) => resolveProductStatus(p) === 'DELETED');
      } else if (filterStatus === 'active') {
        items = items.filter((p) => resolveProductStatus(p) === 'ACTIVE');
      } else if (filterStatus === 'draft') {
        items = items.filter((p) => resolveProductStatus(p) === 'DRAFT');
      } else if (filterStatus === 'featured') {
        items = items.filter((p) => p.isFeatured === true);
      }
    }

    if (filterCollection !== 'all') {
      items = items.filter((p) => p.collectionId === filterCollection);
    }

    if (filterStock === 'in_stock') items = items.filter((p) => (p.totalStock ?? 0) > 0);
    if (filterStock === 'out_of_stock') items = items.filter((p) => (p.totalStock ?? 0) === 0);
    if (filterStock === 'low_stock') items = items.filter((p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 5);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (p) => (p.name || '').toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
      );
    }

    return items;
  }, [filterCollection, filterStatus, filterStock, products, searchQuery]);

  const storeDraftCollections = useMemo(() => {
    return (Array.isArray(draftCollections) ? draftCollections : []).filter(
      (draft: any) => {
        const status = String(draft?.status || '').toUpperCase();
        const domain = String(draft?.domain || '').toUpperCase();
        return (
          status === 'DRAFT' &&
          (draft?.isAvailableInStore === true || domain === 'STORE')
        );
      },
    );
  }, [draftCollections]);

  const showDraftCollectionsInProductArea =
    !loading &&
    filterStatus === 'draft' &&
    filteredProducts.length === 0 &&
    storeDraftCollections.length > 0;
  const primaryProductActionLabel = products.length === 0 ? 'Create Product' : 'Add Product';

  const visibleCollections = useMemo(
    () => collections.filter((collection) => !isSystemStoreCollection(collection)),
    [collections],
  );

  const previewCollections = useMemo(
    () =>
      visibleCollections.filter((collection) => {
        const status = String(collection.status || '').toUpperCase();
        return (
          collection.isAvailableInStore !== false &&
          status === 'PUBLISHED' &&
          !collection.deletedAt
        );
      }),
    [visibleCollections],
  );

  const quickAccessCollections = useMemo(
    () => previewCollections,
    [previewCollections],
  );

  // Only duplicate collections for infinite scroll when there are enough to
  // overflow the visible viewport (each card is ~264px with gap). With 4 or
  // fewer the duplicates are fully visible and look like a bug.
  const CAROUSEL_OVERFLOW_THRESHOLD = 4;
  const quickAccessCarouselItems = useMemo(
    () =>
      quickAccessCollections.length > CAROUSEL_OVERFLOW_THRESHOLD
        ? [...quickAccessCollections, ...quickAccessCollections]
        : quickAccessCollections,
    [quickAccessCollections],
  );

  const previewSourcesByCollectionId = useMemo(() => {
    const map = new Map<string, Array<{ src: string | null; fileId: string | null; alt: string; productName?: string }>>();
    visibleCollections.forEach((collection) => {
      map.set(collection.id, getCollectionPreviewSources(collection));
    });
    return map;
  }, [visibleCollections]);

  const managedCollections = useMemo(() => {
    let items = [...visibleCollections];
    const q = collectionSearch.trim().toLowerCase();

    if (q) {
      items = items.filter((collection) => {
        const name = (collection.name || '').toLowerCase();
        const description = (collection.description || '').toLowerCase();
        return name.includes(q) || description.includes(q) || collection.id.toLowerCase().includes(q);
      });
    }

    if (collectionStatusFilter !== 'all') {
      items = items.filter((collection) => {
        const status = String(collection.status || '').toUpperCase();
        if (collectionStatusFilter === 'published') return status === 'PUBLISHED';
        if (collectionStatusFilter === 'draft') return status === 'DRAFT';
        if (collectionStatusFilter === 'archived') return status === 'ARCHIVED';
        return true;
      });
    } else {
      items = items.filter((collection) => !isGhostUntitledDraft(collection));
    }

    items.sort((a, b) => {
      if (collectionSortBy === 'title_asc') return a.name.localeCompare(b.name);
      if (collectionSortBy === 'title_desc') return b.name.localeCompare(a.name);
      if (collectionSortBy === 'items_desc') return (b.itemCount ?? 0) - (a.itemCount ?? 0);

      const aDate = new Date(collectionSortBy === 'oldest' ? a.createdAt || 0 : a.updatedAt || a.createdAt || 0).getTime();
      const bDate = new Date(collectionSortBy === 'oldest' ? b.createdAt || 0 : b.updatedAt || b.createdAt || 0).getTime();
      return collectionSortBy === 'oldest' ? aDate - bDate : bDate - aDate;
    });

    return items;
  }, [collectionSearch, collectionSortBy, collectionStatusFilter, visibleCollections]);

  const managedCollectionsTotal = managedCollections.length;
  const managedCollectionsPages = Math.max(1, Math.ceil(managedCollectionsTotal / collectionLimit));
  const pagedManagedCollections = useMemo(() => {
    const start = (collectionPage - 1) * collectionLimit;
    return managedCollections.slice(start, start + collectionLimit);
  }, [collectionLimit, collectionPage, managedCollections]);
  const activeCollection = useMemo(
    () => visibleCollections.find((collection) => collection.id === activeCollectionId) ?? null,
    [activeCollectionId, visibleCollections],
  );
  const activeCollectionProductsPages = Math.max(
    1,
    Math.ceil(activeCollectionProductsTotal / activeCollectionProductsLimit),
  );
  const collectionConfirmBusy = Boolean(
    collectionConfirm && collectionBusyId === collectionConfirm.collection.id,
  );
  const selectedCollectionGalleryImage = collectionGalleryImages[collectionGalleryIndex] ?? null;

  useEffect(() => {
    setCursorByPage({});
    setPage(1);
  }, [filterCollection, filterStatus, filterStock, limit, productSortBy, searchQuery, user?.id]);

  useEffect(() => {
    setCollectionPage(1);
  }, [collectionLimit, collectionSearch, collectionSortBy, collectionStatusFilter]);

  useEffect(() => {
    if (collectionPage > managedCollectionsPages) {
      setCollectionPage(managedCollectionsPages);
    }
  }, [collectionPage, managedCollectionsPages]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isCollectionsRoute =
      params.get('view') === 'collections' || Boolean(params.get('collectionId'));
    setOutletView(isCollectionsRoute ? 'collections' : 'products');

    if (!isCollectionsRoute) {
      setActiveCollectionId(null);
      return;
    }

    const routeCollectionId = params.get('collectionId');
    if (routeCollectionId) {
      setActiveCollectionId(routeCollectionId);
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productStatus = params.get('productStatus');
    const stock = params.get('stock');
    const query = params.get('q');
    const collectionStatus = params.get('collectionStatus');

    if (productStatus && PRODUCT_STATUS_FILTER_VALUES.has(productStatus as ProductStatusFilter)) {
      setFilterStatus(productStatus as ProductStatusFilter);
    } else if (!productStatus) {
      setFilterStatus('all');
    }

    if (stock && STOCK_FILTER_VALUES.has(stock)) {
      setFilterStock(stock);
    } else if (!stock) {
      setFilterStock('all');
    }

    if (typeof query === 'string' && query !== searchQuery) {
      setSearchQuery(query);
    }
    if (!query && searchQuery) {
      setSearchQuery('');
    }

    if (
      collectionStatus &&
      COLLECTION_STATUS_FILTER_VALUES.has(collectionStatus as CollectionStatusFilter)
    ) {
      setCollectionStatusFilter(collectionStatus as CollectionStatusFilter);
    } else if (!collectionStatus) {
      setCollectionStatusFilter('all');
    }
  }, [location.search, searchQuery]);

  useEffect(() => {
    if (outletView !== 'products') return;
    if (!quickCollectionsRef.current) return;
    // Only auto-scroll when there are enough items to overflow the viewport.
    // Below the threshold collections are shown as a static row.
    if (quickAccessCollections.length <= CAROUSEL_OVERFLOW_THRESHOLD) return;

    const scroller = quickCollectionsRef.current;
    let raf = 0;
    let lastTick = performance.now();
    const speed = 0.03;

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      lastTick = now;
      scroller.scrollLeft += elapsed * speed;

      if (scroller.scrollLeft >= scroller.scrollWidth / 2) {
        scroller.scrollLeft = 0;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [outletView, quickAccessCollections.length]);

  useEffect(() => {
    setActiveCollectionProductsPage(1);
  }, [activeCollectionId]);

  useEffect(() => {
    if (activeCollectionId) return;
    setCollectionGalleryOpen(false);
  }, [activeCollectionId]);

  useEffect(() => {
    if (!hoveredCollectionId) return;
    const previewSources = previewSourcesByCollectionId.get(hoveredCollectionId) ?? [];
    if (previewSources.length <= 1) return;

    const timer = window.setInterval(() => {
      setHoverPreviewFrame((prev) => {
        const current = prev[hoveredCollectionId] ?? 0;
        return {
          ...prev,
          [hoveredCollectionId]: (current + 1) % previewSources.length,
        };
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [hoveredCollectionId, previewSourcesByCollectionId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user?.id) {
        setCollections([]);
        setCollectionsLoading(false);
        return;
      }

      try {
        setCollectionsLoading(true);
        const collectionsRes = await brandApi.getCollections(user.id, {
          visibility: 'all',
          scope: 'store',
        });
        if (!mounted) return;
        const mappedCollections: CollectionOption[] = (collectionsRes || [])
          .map((c: CollectionDto) => ({
            id: String(c.id),
            name: String(c.title || c.name || 'Untitled collection'),
            description: typeof c.description === 'string' ? c.description : '',
            status: c.status,
            deletedAt: c.deletedAt ?? null,
            deleteExpiresAt: c.deleteExpiresAt ?? null,
            isAvailableInStore: c.isAvailableInStore,
            isSystemGenerated: c.isSystemGenerated === true,
            coverImage: typeof c.coverImage === 'string' && c.coverImage.length > 0 ? c.coverImage : undefined,
            coverFileId: typeof c.coverFileId === 'string' ? c.coverFileId : undefined,
            previewImages: Array.isArray((c as any).previewImages)
              ? ((c as any).previewImages as Array<{ url?: string | null; fileId?: string | null }>)
              : undefined,
            itemCount: typeof c.itemCount === 'number' ? c.itemCount : c.postsCount,
            updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : undefined,
            createdAt: typeof c.createdAt === 'string' ? c.createdAt : undefined,
          }));
        setCollections(mappedCollections.filter((collection) => !isSystemStoreCollection(collection)));
      } catch (e) {
        if (!mounted) return;
        setCollections([]);
      } finally {
        if (mounted) setCollectionsLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!Array.isArray(draftCollections) || draftCollections.length === 0) return;

    setCollections((prev) => {
      const byId = new Map(prev.map((collection) => [collection.id, collection]));
      draftCollections.forEach((draft: any) => {
        if (!draft?.id) return;
        const draftDomain = typeof draft?.domain === 'string' ? draft.domain.toUpperCase() : '';
        const isStoreDraft = draftDomain === 'STORE' || draft?.isAvailableInStore === true;
        if (!isStoreDraft) return;
        const draftId = String(draft.id);
        if (byId.has(draftId)) return;

        byId.set(draftId, {
          id: draftId,
          name: String(draft.title || draft.name || 'Untitled collection'),
          description: typeof draft.description === 'string' ? draft.description : '',
          status: 'DRAFT',
          isAvailableInStore: false,
          isSystemGenerated: draft?.isSystemGenerated === true,
          coverImage: typeof draft.coverImage === 'string' && draft.coverImage.length > 0 ? draft.coverImage : undefined,
          coverFileId: typeof draft.coverFileId === 'string' ? draft.coverFileId : undefined,
          previewImages: Array.isArray(draft?.previewImages)
            ? (draft.previewImages as Array<{ url?: string | null; fileId?: string | null }>)
            : undefined,
          itemCount:
            typeof draft.itemCount === 'number'
              ? draft.itemCount
              : typeof draft.postsCount === 'number'
                ? draft.postsCount
                : 0,
          createdAt: typeof draft.createdAt === 'string' ? draft.createdAt : undefined,
          updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : undefined,
        });
      });

      return Array.from(byId.values()).filter((collection) => !isSystemStoreCollection(collection));
    });
  }, [draftCollections]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (outletView !== 'products') {
        if (mounted) setLoading(false);
        return;
      }

      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const cursor = page > 1 ? cursorByPage[page] : undefined;

        const productsRes = await apiClient.get<Partial<ProductsResponse>>(`/brands/${user.id}/products`, {
          params: {
            page,
            limit,
            sortBy: productSortBy,
            cursor: cursor ?? undefined,
            search: searchQuery.trim() ? searchQuery.trim() : undefined,
            collectionId: filterCollection !== 'all' ? filterCollection : undefined,
            isActive:
              filterStatus === 'active'
                ? true
                : filterStatus === 'draft'
                  ? false
                  : undefined,
            isFeatured: filterStatus === 'featured' ? true : undefined,
            includeDeleted: filterStatus === 'deleted' ? true : undefined,
            onlyDeleted: filterStatus === 'deleted' ? true : undefined,
          },
        });

        if (!mounted) return;

        const productsPayload = unwrapApiResponse<Partial<ProductsResponse>>(productsRes.data);
        const items = Array.isArray(productsPayload?.items)
          ? (productsPayload.items as BackendProduct[])
          : [];
        setProducts(items);
        setTotal(typeof productsPayload?.total === 'number' ? productsPayload.total : items.length);

        const nextCursor = productsPayload?.nextCursor;
        if (typeof nextCursor === 'string' && nextCursor.length > 0) {
          setCursorByPage((prev) => ({ ...prev, [page + 1]: nextCursor }));
        }
      } catch (e) {
        const message = (e as any)?.response?.data?.message ?? 'Failed to load products';
        toast.error(typeof message === 'string' ? message : 'Failed to load products');
        if (!mounted) return;
        setProducts([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [filterCollection, filterStatus, limit, outletView, page, productSortBy, searchQuery, user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user?.id || !activeCollectionId || outletView !== 'collections') {
        if (mounted) {
          setActiveCollectionProducts([]);
          setActiveCollectionProductsTotal(0);
        }
        return;
      }

      try {
        setActiveCollectionProductsLoading(true);
        const response = await apiClient.get<Partial<ProductsResponse>>(
          `/brands/${user.id}/products`,
          {
            params: {
              page: activeCollectionProductsPage,
              limit: activeCollectionProductsLimit,
              sortBy: 'newest',
              collectionId: activeCollectionId,
              includeDeleted: false,
            },
          },
        );

        if (!mounted) return;
        const payload = unwrapApiResponse<Partial<ProductsResponse>>(response.data);
        const items = Array.isArray(payload?.items) ? (payload.items as BackendProduct[]) : [];
        setActiveCollectionProducts(items);
        setActiveCollectionProductsTotal(
          typeof payload?.total === 'number' ? payload.total : items.length,
        );
      } catch {
        if (!mounted) return;
        setActiveCollectionProducts([]);
        setActiveCollectionProductsTotal(0);
        toast.error('Failed to load products for this collection.');
      } finally {
        if (mounted) setActiveCollectionProductsLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [
    activeCollectionId,
    activeCollectionProductsLimit,
    activeCollectionProductsPage,
    outletView,
    user?.id,
  ]);

  useEffect(() => {
    if (outletView !== 'products') return;
    if (!listRef.current) return;
    const height = listRef.current.getBoundingClientRect().height;
    if (height > 0) setListMinHeight(height);
  }, [filteredProducts.length, loading, outletView]);

  // Click-outside handler for expandable search (matches CatalogShopTab pattern)
  useEffect(() => {
    if (searchCollapsed) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        if (!searchQuery.trim()) {
          setSearchCollapsed(true);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchCollapsed, searchQuery]);

  useEffect(() => {
    if (collectionSearchCollapsed) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        collectionSearchContainerRef.current &&
        !collectionSearchContainerRef.current.contains(e.target as Node)
      ) {
        if (!collectionSearch.trim()) {
          setCollectionSearchCollapsed(true);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collectionSearch, collectionSearchCollapsed]);

  useEffect(() => {
    if (!showFiltersMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(e.target as Node)) {
        setShowFiltersMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFiltersMenu]);

  useEffect(() => {
    if (!dropdownManager.openId?.startsWith('collection-menu-')) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.collection-menu-host')) return;
      dropdownManager.setOpenId(null);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dropdownManager.setOpenId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownManager, dropdownManager.openId]);

  useEffect(() => {
    if (!collectionGalleryOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCollectionGalleryOpen(false);
        return;
      }
      if (collectionGalleryImages.length <= 1) return;

      if (e.key === 'ArrowRight') {
        setCollectionGalleryIndex((prev) => (prev + 1) % collectionGalleryImages.length);
      }
      if (e.key === 'ArrowLeft') {
        setCollectionGalleryIndex((prev) =>
          prev === 0 ? collectionGalleryImages.length - 1 : prev - 1,
        );
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [collectionGalleryImages.length, collectionGalleryOpen]);

  useEffect(() => {
    if (collectionGalleryIndex < collectionGalleryImages.length) return;
    setCollectionGalleryIndex(0);
  }, [collectionGalleryImages.length, collectionGalleryIndex]);

  useEffect(() => {
    if (outletView !== 'products') return;
    if (typeof window === 'undefined') return;
    if (loading || products.length === 0) return;

    const draft = products.find((p) => resolveProductStatus(p) === 'DRAFT');
    if (!draft) return;

    const key = `draft-reminder:${draft.id}`;
    const lastRaw = localStorage.getItem(key);
    const lastShown = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();
    const intervalMs = 48 * 60 * 60 * 1000;

    if (!lastShown || now - lastShown >= intervalMs) {
      setDraftReminderProduct(draft);
    }
  }, [loading, outletView, products]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const cursor = page > 1 ? cursorByPage[page] : undefined;
    const productsRes = await apiClient.get<Partial<ProductsResponse>>(`/brands/${user.id}/products`, {
      params: {
        page,
        limit,
        sortBy: productSortBy,
        cursor: cursor ?? undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
        collectionId: filterCollection !== 'all' ? filterCollection : undefined,
        isActive:
          filterStatus === 'active'
            ? true
            : filterStatus === 'draft'
              ? false
              : undefined,
        isFeatured: filterStatus === 'featured' ? true : undefined,
        includeDeleted: filterStatus === 'deleted' ? true : undefined,
        onlyDeleted: filterStatus === 'deleted' ? true : undefined,
      },
    });

    const productsPayload = unwrapApiResponse<Partial<ProductsResponse>>(productsRes.data);
    const items = Array.isArray(productsPayload?.items)
      ? (productsPayload.items as BackendProduct[])
      : [];
    setProducts(items);
    setTotal(typeof productsPayload?.total === 'number' ? productsPayload.total : items.length);

    const nextCursor = productsPayload?.nextCursor;
    if (typeof nextCursor === 'string' && nextCursor.length > 0) {
      setCursorByPage((prev) => ({ ...prev, [page + 1]: nextCursor }));
    }
  }, [
    cursorByPage,
    filterCollection,
    filterStatus,
    limit,
    page,
    productSortBy,
    searchQuery,
    user?.id,
  ]);

  useEffect(() => {
    if (outletView !== 'products') return;
    if (typeof window === 'undefined') return;

    const handleProductSync = () => {
      void refresh();
    };

    window.addEventListener(
      PRODUCT_STUDIO_SYNC_EVENT,
      handleProductSync as EventListener,
    );
    return () => {
      window.removeEventListener(
        PRODUCT_STUDIO_SYNC_EVENT,
        handleProductSync as EventListener,
      );
    };
  }, [outletView, refresh]);

  useEffect(() => {
    if (outletView !== 'products' || !recentCreatedProductId) {
      createdProductHydrationAttemptsRef.current = 0;
      return;
    }

    const createdProduct =
      products.find((product) => product.id === recentCreatedProductId) ?? null;

    const clearCreatedProductQuery = () => {
      const params = new URLSearchParams(location.search);
      if (!params.has('createdProductId')) return;
      params.delete('createdProductId');
      const next = params.toString();
      navigate(next ? `/studio/store?${next}` : '/studio/store', { replace: true });
    };

    if (hasRenderableProductMedia(createdProduct)) {
      createdProductHydrationAttemptsRef.current = 0;
      clearCreatedProductQuery();
      return;
    }

    if (createdProductHydrationAttemptsRef.current >= 12) {
      clearCreatedProductQuery();
      return;
    }

    const timer = window.setTimeout(() => {
      createdProductHydrationAttemptsRef.current += 1;
      void refresh().catch(() => undefined);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [location.search, navigate, outletView, products, recentCreatedProductId, refresh]);

  const handleDuplicate = async (productId: string) => {
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success('Product duplicated');
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch (e) {
      const message = (e as any)?.response?.data?.message ?? 'Failed to duplicate product';
      toast.error(typeof message === 'string' ? message : 'Failed to duplicate product');
    }
  };

  // Handle product action from menu
  const handleProductAction = async (actionId: string, product: BackendProduct) => {
    switch (actionId) {
      case 'duplicate':
        await handleDuplicate(product.id);
        break;
        
      case 'archive':
        setArchiveMode('archive');
        setArchiveModalProduct(product);
        break;
        
      case 'unarchive':
        setArchiveMode('unarchive');
        setArchiveModalProduct(product);
        break;
        
      case 'delete':
        setDeleteModalProduct(product);
        break;
      case 'restore':
        setRestoreModalProduct(product);
        break;
      case 'edit':
        navigate(`/studio/store/products/${product.id}/edit?includeDeleted=true`);
        break;
      case 'permanent-delete':
        setPermanentDeleteProduct(product);
        break;
    }
  };

  // Show coming soon for bulk operations
  const handleBulkAction = (action: string) => {
    const normalized = action.toLowerCase();
    if (
      normalized === 'delete' ||
      normalized === 'permanent-delete' ||
      normalized === 'archive' ||
      normalized === 'unpublish'
    ) {
      setBulkConfirmAction(normalized as 'delete' | 'permanent-delete' | 'archive' | 'unpublish');
      return;
    }
    setComingSoonModal({
      open: true,
      feature: `Bulk ${action}`,
      description: `We're working on powerful bulk ${action.toLowerCase()} tools to help you manage multiple products at once.`,
    });
  };

  const handleConfirmBulkAction = async () => {
    if (selectedProducts.length === 0) {
      setBulkConfirmAction(null);
      return;
    }

    if (!bulkConfirmAction) return;
    if (bulkConfirmAction === 'delete' || bulkConfirmAction === 'permanent-delete') return;

    setBulkActionBusy(true);
    try {
      const plural = (count: number) => (count === 1 ? '' : 's');
      if (bulkConfirmAction === 'archive') {
        const result = await productApi.bulkArchiveProducts(selectedProducts);
        const { archivedCount, failedCount, failures, requestedCount } = result;

        if (archivedCount > 0) {
          toast.success(
            `Archived ${archivedCount} product${plural(archivedCount)}.`,
          );
        }
        if (failedCount > 0) {
          const firstFailure = failures[0];
          const suffix = failedCount > 1 ? ` (+${failedCount - 1} more)` : '';
          toast.error(
            firstFailure?.message
              ? `${firstFailure.message}${suffix}`
              : `${failedCount} product${plural(failedCount)} could not be archived`,
          );
        }
        if (archivedCount === 0 && failedCount === 0) {
          toast.error(
            `No products were archived from ${requestedCount} selected item${plural(requestedCount)}.`,
          );
        }
      } else {
        const result = await productApi.bulkUnpublishProducts(selectedProducts);
        const { unpublishedCount, failedCount, failures, requestedCount } =
          result;

        if (unpublishedCount > 0) {
          toast.success(
            `Unpublished ${unpublishedCount} product${plural(unpublishedCount)}.`,
          );
        }
        if (failedCount > 0) {
          const firstFailure = failures[0];
          const suffix = failedCount > 1 ? ` (+${failedCount - 1} more)` : '';
          toast.error(
            firstFailure?.message
              ? `${firstFailure.message}${suffix}`
              : `${failedCount} product${plural(failedCount)} could not be unpublished`,
          );
        }
        if (unpublishedCount === 0 && failedCount === 0) {
          toast.error(
            `No products were unpublished from ${requestedCount} selected item${plural(requestedCount)}.`,
          );
        }
      }

      setSelectedProducts([]);
      await refresh();
    } catch (error: any) {
      const defaultMessage =
        bulkConfirmAction === 'archive'
          ? 'Failed to archive selected products.'
          : 'Failed to unpublish selected products.';
      const message = error?.response?.data?.message || defaultMessage;
      toast.error(typeof message === 'string' ? message : defaultMessage);
    } finally {
      setBulkActionBusy(false);
      setBulkConfirmAction(null);
    }
  };

  const handleConfirmBulkDeleteWithTypedFlow = async (productIds: string[]) => {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      toast.error(
        bulkConfirmAction === 'permanent-delete'
          ? 'No products selected for permanent delete.'
          : 'No deletable products selected.',
      );
      return;
    }

    setBulkActionBusy(true);
    try {
      const plural = (count: number) => (count === 1 ? '' : 's');

      if (bulkConfirmAction === 'permanent-delete') {
        const results = await Promise.allSettled(
          productIds.map((productId) => productApi.permanentlyDeleteProduct(productId)),
        );

        const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
        const failedEntries = results
          .map((result, index) => ({ result, productId: productIds[index] }))
          .filter((entry) => entry.result.status === 'rejected');
        const failedCount = failedEntries.length;

        if (deletedCount > 0) {
          toast.success(
            `Permanently deleted ${deletedCount} product${plural(deletedCount)}.`,
          );
        }
        if (failedCount > 0) {
          const firstError = (failedEntries[0].result as PromiseRejectedResult).reason;
          const apiMessage =
            firstError?.response?.data?.message ||
            firstError?.message ||
            `${failedCount} product${plural(failedCount)} could not be permanently deleted`;
          const suffix = failedCount > 1 ? ` (+${failedCount - 1} more)` : '';
          toast.error(`${apiMessage}${suffix}`);
        }
        if (deletedCount === 0 && failedCount === 0) {
          toast.error(
            `No products were permanently deleted from ${productIds.length} selected item${plural(productIds.length)}.`,
          );
        }

        const failedIds = failedEntries.map((entry) => entry.productId);
        setSelectedProducts(failedIds);
        await refresh();
        setBulkConfirmAction(null);
        return;
      }

      const result = await productApi.bulkDeleteProducts(productIds);
      const { deletedCount, failedCount, failures, requestedCount } = result;

      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} product${plural(deletedCount)}.`);
      }
      if (failedCount > 0) {
        const firstFailure = failures[0];
        const suffix = failedCount > 1 ? ` (+${failedCount - 1} more)` : '';
        toast.error(
          firstFailure?.message
            ? `${firstFailure.message}${suffix}`
            : `${failedCount} product${plural(failedCount)} could not be deleted`,
        );
      }
      if (deletedCount === 0 && failedCount === 0) {
        toast.error(
          `No products were deleted from ${requestedCount} selected item${plural(requestedCount)}.`,
        );
      }

      const failedIds = failures.map((failure) => failure.productId);
      setSelectedProducts(failedIds);
      await refresh();
      setBulkConfirmAction(null);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        (bulkConfirmAction === 'permanent-delete'
          ? 'Failed to permanently delete selected products.'
          : 'Failed to delete selected products.');
      toast.error(
        typeof message === 'string'
          ? message
          : bulkConfirmAction === 'permanent-delete'
            ? 'Failed to permanently delete selected products.'
            : 'Failed to delete selected products.',
      );
      throw error;
    } finally {
      setBulkActionBusy(false);
    }
  };

  const openCollectionEditor = (collection: CollectionOption) => {
    navigate(`/studio/store/collections/new?collectionId=${collection.id}&mode=edit`);
  };

  const openCollectionWorkspace = (collectionId?: string) => {
    if (collectionId) {
      setActiveCollectionId(collectionId);
    }

    const params = new URLSearchParams(location.search);
    params.set('view', 'collections');
    if (collectionId) params.set('collectionId', collectionId);
    else params.delete('collectionId');
    navigate(`/studio/store?${params.toString()}`);
  };

  const handleOpenCollectionView = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    const params = new URLSearchParams(location.search);
    params.set('view', 'collections');
    params.set('collectionId', collectionId);
    navigate(`/studio/store?${params.toString()}`, { replace: true });
  };

  const navigateToStudioProductDetails = async (productId: string) => {
    try {
      const res = await productApi.getProduct(productId);
      const data = (res as any)?.data ?? res;
      // Map backend product to StoreProduct shape for InlineProductDetail
      const mapped: StoreProduct = {
        id: data.id,
        collectionId: data.collectionId || '',
        brandId: data.brandId || user?.id || '',
        name: data.name || data.title || '',
        description: data.description || '',
        price: data.price ?? 0,
        salePrice: data.salePrice ?? null,
        effectivePrice: data.effectivePrice ?? data.salePrice ?? data.price ?? 0,
        isOnSale: Boolean(data.isOnSale),
        discountPercent: data.discountPercent ?? null,
        thumbnail: data.thumbnail || null,
        images: data.images || [],
        media: data.media || [],
        mediaIds: data.mediaIds || [],
        sizes: data.sizes || [],
        sizingMode: data.sizingMode,
        customMeasurementKeys: data.customMeasurementKeys || [],
        customAvailable:
          data.customAvailable ?? data.customOrderEnabled ?? false,
        customOrderEnabled:
          data.customOrderEnabled ?? data.customAvailable ?? false,
        isCustomOrderOnly: data.isCustomOrderOnly ?? false,
        canBagWhenOutOfStock: data.canBagWhenOutOfStock ?? false,
        sizeAvailability: data.sizeAvailability || [],
        colors: data.colors || [],
        variants: data.variants || [],
        totalStock: data.totalStock ?? 0,
        isLowStock: Boolean(data.isLowStock),
        isOutOfStock: Boolean(data.isOutOfStock),
        isFeatured: Boolean(data.isFeatured),
        isActive: data.isActive,
        archivedAt: data.archivedAt ?? null,
        deletedAt: data.deletedAt ?? null,
        publishAt: data.publishAt ?? null,
        threadsCount: data.threadsCount ?? 0,
        viewsCount: data.viewsCount ?? 0,
        brand: {
          id: data.brand?.id || user?.id || '',
          name: data.brand?.name || user?.firstName || '',
          logo: data.brand?.logo || '',
          currency: data.brand?.currency || 'NGN',
        },
      };
      setInlineProduct(mapped);
    } catch {
      toast.error('Failed to load product details.');
    }
  };

  const handleCloseActiveCollectionView = () => {
    setActiveCollectionId(null);
    const params = new URLSearchParams(location.search);
    params.set('view', 'collections');
    params.delete('collectionId');
    navigate(`/studio/store?${params.toString()}`, { replace: true });
  };


  const handleArchiveCollection = async (collection: CollectionOption) => {
    setCollectionBusyId(collection.id);
    try {
      const ok = await brandApi.archiveCollection(collection.id, { scope: 'store' });
      if (!ok) {
        toast.error('Unable to archive collection.');
        return;
      }
      setCollections((prev) =>
        prev.map((item) =>
          item.id === collection.id ? { ...item, status: 'ARCHIVED', isAvailableInStore: false } : item,
        ),
      );
      toast.success('Collection archived.');
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Unable to archive collection.';
      toast.error(typeof message === 'string' ? message : 'Unable to archive collection.');
    } finally {
      setCollectionBusyId(null);
    }
  };

  const handleUnarchiveCollection = async (collection: CollectionOption) => {
    setCollectionBusyId(collection.id);
    try {
      const ok = await brandApi.unarchiveCollection(collection.id, { scope: 'store' });
      if (!ok) {
        toast.error('Unable to unarchive collection.');
        return;
      }
      setCollections((prev) =>
        prev.map((item) =>
          item.id === collection.id ? { ...item, status: item.status === 'ARCHIVED' ? 'DRAFT' : item.status } : item,
        ),
      );
      toast.success('Collection restored.');
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Unable to unarchive collection.';
      toast.error(typeof message === 'string' ? message : 'Unable to unarchive collection.');
    } finally {
      setCollectionBusyId(null);
    }
  };

  const handleDeleteCollection = async (collection: CollectionOption) => {
    setCollectionBusyId(collection.id);
    try {
      const ok = await brandApi.deleteCollection(collection.id, { scope: 'store' });
      if (!ok) {
        toast.error('Unable to delete collection.');
        return;
      }
      setCollections((prev) => prev.filter((item) => item.id !== collection.id));
      toast.success('Collection deleted. Products are unchanged.');
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Unable to delete collection.';
      toast.error(typeof message === 'string' ? message : 'Unable to delete collection.');
    } finally {
      setCollectionBusyId(null);
    }
  };

  const handleDuplicateCollection = async (collection: CollectionOption) => {
    setCollectionBusyId(collection.id);
    try {
      const duplicated = await brandApi.duplicateCollection(collection.id, {
        scope: 'store',
      });
      if (!duplicated) {
        toast.error('Unable to duplicate collection.');
        return;
      }

      const mapped: CollectionOption = {
        id: String(duplicated.id),
        name: String(duplicated.title || duplicated.name || 'Untitled collection'),
        description: typeof duplicated.description === 'string' ? duplicated.description : '',
        status: duplicated.status,
        isAvailableInStore: duplicated.isAvailableInStore,
        isSystemGenerated: duplicated.isSystemGenerated === true,
        coverImage: typeof duplicated.coverImage === 'string' ? duplicated.coverImage : undefined,
        coverFileId: typeof duplicated.coverFileId === 'string' ? duplicated.coverFileId : undefined,
        previewImages: Array.isArray((duplicated as any)?.previewImages)
          ? (((duplicated as any).previewImages as Array<{ url?: string | null; fileId?: string | null }>).slice(0, 8))
          : undefined,
        itemCount:
          typeof duplicated.itemCount === 'number'
            ? duplicated.itemCount
            : typeof duplicated.postsCount === 'number'
              ? duplicated.postsCount
              : collection.itemCount ?? 0,
        updatedAt: typeof duplicated.updatedAt === 'string' ? duplicated.updatedAt : undefined,
        createdAt: typeof duplicated.createdAt === 'string' ? duplicated.createdAt : undefined,
      };

      if (isSystemStoreCollection(mapped)) {
        toast.success('Collection duplicated.');
        return;
      }
      setCollections((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)]);
      toast.success('Collection duplicated.');
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Unable to duplicate collection.';
      toast.error(typeof message === 'string' ? message : 'Unable to duplicate collection.');
    } finally {
      setCollectionBusyId(null);
    }
  };

  const handleConfirmCollectionAction = async () => {
    if (!collectionConfirm) return;

    const { mode, collection } = collectionConfirm;
    try {
      if (mode === 'archive') {
        await handleArchiveCollection(collection);
      } else if (mode === 'unarchive') {
        await handleUnarchiveCollection(collection);
      } else {
        await handleDeleteCollection(collection);
        if (activeCollectionId === collection.id) {
          setActiveCollectionId(null);
        }
      }
    } finally {
      setCollectionConfirm(null);
    }
  };

  const handleDeleteAllCollections = async () => {
    if (visibleCollections.length === 0 || deletingAllCollections) return;

    setDeletingAllCollections(true);
    try {
      const targets = [...visibleCollections];
      const results = await Promise.allSettled(
        targets.map(async (collection) => ({
          id: collection.id,
          ok: await brandApi.deleteCollection(collection.id, { scope: 'store' }),
        })),
      );

      const deletedIds = new Set<string>();
      let failedCount = 0;
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          deletedIds.add(result.value.id);
        } else {
          failedCount += 1;
        }
      });

      setCollections((prev) => prev.filter((collection) => !deletedIds.has(collection.id)));
      if (activeCollectionId && deletedIds.has(activeCollectionId)) {
        handleCloseActiveCollectionView();
      }

      if (deletedIds.size > 0) {
        toast.success(
          failedCount > 0
            ? `${deletedIds.size} collection(s) deleted, ${failedCount} failed.`
            : `Deleted ${deletedIds.size} collection(s).`,
        );
      } else {
        toast.error('No collections were deleted.');
      }
    } catch {
      toast.error('Failed to delete collections.');
    } finally {
      setDeletingAllCollections(false);
      setDeleteAllCollectionsConfirmOpen(false);
    }
  };

  const mapProductToGalleryImages = (product: BackendProduct): CollectionGalleryImage[] => {
    const seen = new Set<string>();
    const images: CollectionGalleryImage[] = [];

    const pushCandidate = (src: string | null | undefined, fileId: string | null | undefined) => {
      const normalizedSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;
      const normalizedFileId =
        typeof fileId === 'string' && fileId.trim().length > 0 ? fileId.trim() : null;
      if (!normalizedSrc && !normalizedFileId) return;

      const key = `${normalizedSrc ?? ''}|${normalizedFileId ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);

      images.push({
        id: `${product.id}-${images.length}`,
        src: normalizedSrc,
        fileId: normalizedFileId,
        alt: `${product.name || 'Collection image'} image ${images.length + 1}`,
        productId: product.id,
        productName: product.name,
      });
    };

    const thumbnailSource = toRenderableMediaSource(product.thumbnail ?? null);
    pushCandidate(thumbnailSource.src, thumbnailSource.fileId);

    (product.images ?? []).forEach((imageUrl) => {
      const imageSource = toRenderableMediaSource(imageUrl);
      pushCandidate(imageSource.src, imageSource.fileId);
    });

    (product.media ?? []).forEach((media) => {
      const mediaType = String(media.type || '').toLowerCase();
      if (mediaType.includes('video')) return;
      pushCandidate(media.url, media.id);
    });

    return images;
  };

  const handleOpenCollectionGallery = async (collection: CollectionOption) => {
    if (!user?.id) return;

    setCollectionGalleryOpen(true);
    setCollectionGalleryLoading(true);
    setCollectionGalleryImages([]);
    setCollectionGalleryIndex(0);
    setCollectionGallerySourceName(collection.name);

    try {
      const limitPerPage = 50;
      const maxPages = 20;
      const allProducts: BackendProduct[] = [];
      let currentPage = 1;
      let shouldContinue = true;

      while (shouldContinue && currentPage <= maxPages) {
        const response = await apiClient.get<Partial<ProductsResponse>>(
          `/brands/${user.id}/products`,
          {
            params: {
              page: currentPage,
              limit: limitPerPage,
              sortBy: 'newest',
              collectionId: collection.id,
              includeDeleted: false,
            },
          },
        );

        const payload = unwrapApiResponse<Partial<ProductsResponse>>(response.data);
        const pageItems = Array.isArray(payload?.items) ? (payload.items as BackendProduct[]) : [];
        allProducts.push(...pageItems);

        const totalPagesFromPayload =
          typeof payload?.totalPages === 'number' && payload.totalPages > 0
            ? payload.totalPages
            : 1;

        const hasNextPageFromPayload =
          typeof payload?.hasNextPage === 'boolean'
            ? payload.hasNextPage
            : currentPage < totalPagesFromPayload;

        shouldContinue = hasNextPageFromPayload && pageItems.length > 0;
        currentPage += 1;
      }

      const flattenedImages = allProducts.flatMap((product) => mapProductToGalleryImages(product));
      const dedupedImages: CollectionGalleryImage[] = [];
      const imageKeys = new Set<string>();

      flattenedImages.forEach((image) => {
        const key = `${image.src ?? ''}|${image.fileId ?? ''}`;
        if (imageKeys.has(key)) return;
        imageKeys.add(key);
        dedupedImages.push({ ...image, id: `${image.productId ?? 'collection'}-${dedupedImages.length}` });
      });

      if (dedupedImages.length === 0 && (collection.coverImage || collection.coverFileId)) {
        dedupedImages.push({
          id: `${collection.id}-cover`,
          src: collection.coverImage ?? null,
          fileId: collection.coverFileId ?? null,
          alt: `${collection.name} cover image`,
          productName: collection.name,
        });
      }

      setCollectionGalleryImages(dedupedImages);
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Unable to load collection gallery.';
      toast.error(typeof message === 'string' ? message : 'Unable to load collection gallery.');
      setCollectionGalleryOpen(false);
    } finally {
      setCollectionGalleryLoading(false);
    }
  };

  const handleNextCollectionGalleryImage = () => {
    if (collectionGalleryImages.length <= 1) return;
    setCollectionGalleryIndex((prev) => (prev + 1) % collectionGalleryImages.length);
  };

  const handlePrevCollectionGalleryImage = () => {
    if (collectionGalleryImages.length <= 1) return;
    setCollectionGalleryIndex((prev) =>
      prev === 0 ? collectionGalleryImages.length - 1 : prev - 1,
    );
  };

  return (
    <div className={isEmbeddedMobile ? 'space-y-3' : 'space-y-4 sm:space-y-6'}>
      {outletView === 'products' && !inlineProduct && (
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-lg overflow-hidden sm:rounded-2xl">
        <div className="space-y-3 p-3 sm:p-4 lg:p-6 lg:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">Collections Quick Access</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                Slow carousel preview with cover images always visible.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/studio/store/collections/new')}
                className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20 sm:px-3 sm:text-sm"
              >
                Create collection
              </button>
              <button
                type="button"
                onClick={() => navigate('/studio/store?view=collections')}
                className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20 sm:px-3 sm:text-sm"
              >
                Manage collections
              </button>
            </div>
          </div>

          {collectionsLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-28 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10 sm:h-36 lg:h-44" />
              ))}
            </div>
          ) : quickAccessCollections.length > 0 ? (
            <div
              ref={quickCollectionsRef}
              className="overflow-x-hidden rounded-xl border border-gray-200/80 bg-gray-50/60 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex min-w-max gap-2 p-2 sm:gap-3 sm:p-3">
                {quickAccessCarouselItems.map((collection, idx) => (
                    (() => {
                      const previewSources = previewSourcesByCollectionId.get(collection.id) ?? getCollectionPreviewSources(collection);
                      const previewFrame = hoverPreviewFrame[collection.id] ?? 0;
                      const activePreview =
                        previewSources.length > 0
                          ? previewSources[previewFrame % previewSources.length]
                          : {
                              src: collection.coverImage ?? null,
                              fileId: collection.coverFileId ?? null,
                              alt: collection.name,
                              productName: undefined as string | undefined,
                            };

                      return (
                    <button
                      key={`${collection.id}-${idx}`}
                      type="button"
                      onClick={() => openCollectionWorkspace(collection.id)}
                      onMouseEnter={() => setHoveredCollectionId(collection.id)}
                      onMouseLeave={() => {
                        setHoveredCollectionId((prev) => (prev === collection.id ? null : prev));
                        setHoverPreviewFrame((prev) => ({ ...prev, [collection.id]: 0 }));
                      }}
                      className="group relative h-28 w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-gray-100 text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-white/10 dark:bg-zinc-900/80 sm:h-36 sm:w-52 lg:h-44 lg:w-64"
                    >
                      {/* Opacity-based crossfade stack — fills entire card */}
                      {previewSources.length > 0 ? (
                        <>
                          {previewSources.map((preview, pIdx) => (
                            <div
                              key={`${preview.src ?? preview.fileId ?? pIdx}`}
                              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                                pIdx === previewFrame ? 'opacity-100 z-10' : 'opacity-0 z-0'
                              }`}
                            >
                              <ImageWithFallback
                                src={preview.src}
                                fileId={preview.fileId}
                                alt={preview.alt}
                                fit="cover"
                                rounded="none"
                                containerClassName="h-full w-full"
                                className="h-full w-full"
                                fallbackName={collection.name}
                              />
                            </div>
                          ))}
                          {/* Product name badge - Top Left to avoid bottom text overlap */}
                          {previewSources.length > 1 && activePreview.productName && (
                            <div className="absolute left-2 top-2 z-30 max-w-[calc(100%-3rem)] sm:left-2.5 sm:top-2.5">
                              <span className="inline-block max-w-full truncate rounded-full border border-white/20 bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-md transition-opacity duration-300 dark:border-white/10 dark:bg-black/30 sm:px-2.5">
                                {activePreview.productName}
                              </span>
                            </div>
                          )}
                          {/* Dot indicators - Top Right */}
                          {previewSources.length > 1 && (
                            <div className="absolute top-3.5 right-2.5 z-30 flex items-center gap-1">
                              {previewSources.map((_, dotIdx) => (
                                <div
                                  key={dotIdx}
                                  className={`w-1 h-1 rounded-full transition-all duration-200 shadow-sm ${
                                    dotIdx === previewFrame ? 'bg-white scale-125' : 'bg-white/40'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <ImageWithFallback
                          src={activePreview.src}
                          fileId={activePreview.fileId}
                          alt={activePreview.alt}
                          fit="cover"
                          rounded="none"
                          containerClassName="h-full w-full relative z-10"
                          className="h-full w-full"
                          fallbackName={collection.name}
                        />
                      )}

                      {/* Frosted Glass Text Component - Bottom Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/20 bg-white/60 p-2 backdrop-blur-md transition-transform duration-300 dark:border-white/10 dark:bg-black/60 sm:p-3">
                        <p className="line-clamp-1 text-xs font-bold text-gray-900 drop-shadow-sm dark:text-white sm:text-sm">
                          {collection.name}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-300 sm:text-xs">
                          {collection.itemCount ?? 0} items
                        </p>
                      </div>
                    </button>
                      );
                    })()
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300/80 bg-gray-50/70 p-5 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No collections yet</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Create a collection to see quick access previews here.</p>
              <button
                type="button"
                onClick={() => navigate('/studio/store/collections/new')}
                className="mt-3 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
              >
                Create collection
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ═══ UNIFIED COMMAND CENTER ═══ */}
      {outletView === 'products' && !inlineProduct && (
      <div className="mb-4 overflow-hidden rounded-xl border border-gray-200/80 bg-white/95 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#111118]/95 sm:mb-6 sm:rounded-2xl lg:overflow-visible">

        {/* Header Row */}
        <div className="relative p-3 pb-3 sm:p-4 lg:p-5 lg:pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white sm:text-xl lg:text-2xl">Your Catalog</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Manage catalog, collections, and drafts in one place.</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Expandable emoji search */}
              <div
                ref={searchContainerRef}
                className={`transition-all duration-300 ease-out ${searchCollapsed ? 'w-9 sm:w-11' : 'w-full sm:flex-1 sm:min-w-[220px] sm:max-w-[320px]'}`}
              >
                {searchCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setSearchCollapsed(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-700 shadow-sm transition-all hover:scale-105 hover:bg-purple-50 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 sm:h-11 sm:w-11"
                    aria-label="Open search"
                  >
                    <span className="text-base">🔎</span>
                  </button>
                ) : (
                  <SearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search products..."
                    showFilter={false}
                    className="!max-w-none w-full shadow-sm border-gray-200 dark:border-white/10 animate-in fade-in slide-in-from-left-2 duration-200"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/studio/store/products/new')}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-purple-500/40 active:scale-95 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                aria-label={primaryProductActionLabel}
                title={primaryProductActionLabel}
              >
                <span aria-hidden="true">➕</span>
                <span className="hidden min-[380px]:inline">{primaryProductActionLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersMenu((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all sm:h-11 sm:w-11 lg:hidden ${
                  showFiltersMenu
                    ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300'
                    : 'border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-white/10'
                }`}
                aria-label={showFiltersMenu ? 'Hide filters menu' : 'Show filters menu'}
                title={showFiltersMenu ? 'Hide filters menu' : 'Show filters menu'}
              >
                ☰
              </button>
            </div>
          </div>

          {showFiltersMenu && (
            <div
              ref={filtersMenuRef}
              className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-50 max-h-[min(70vh,26rem)] overflow-y-auto rounded-xl border border-gray-200/90 bg-white/98 p-2.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#12121a]/98 sm:absolute sm:inset-x-auto sm:right-4 sm:top-[64px] sm:w-[min(92vw,520px)] sm:p-3 lg:hidden"
            >
              <div className="mb-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {(
                  [
                    { value: 'all', label: 'All', icon: '📦' },
                    { value: 'active', label: 'Published', icon: '✨' },
                    { value: 'draft', label: 'Product Drafts', icon: '📝' },
                    { value: 'featured', label: 'Featured', icon: '⭐' },
                    { value: 'archived', label: 'Archived', icon: '📁' },
                    { value: 'deleted', label: 'Deleted', icon: '🗑️' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterStatus(opt.value)}
                    className={`flex min-h-8 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-200 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${
                      filterStatus === opt.value
                        ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-md shadow-purple-500/30'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/10'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="max-w-[7rem] truncate">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                <FilterDropdown
                  value={filterCollection}
                  onChange={setFilterCollection}
                  disabled={collectionsLoading}
                  options={[
                    { value: 'all', label: 'All Collections' },
                    ...visibleCollections.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <FilterDropdown
                  value={filterStock}
                  onChange={setFilterStock}
                  options={[
                    { value: 'all', label: 'All Stock' },
                    { value: 'in_stock', label: 'In Stock' },
                    { value: 'low_stock', label: 'Low Stock' },
                    { value: 'out_of_stock', label: 'Out of Stock' },
                  ]}
                />
                <FilterDropdown
                  value={productSortBy}
                  onChange={(value) => setProductSortBy(value as ProductSortBy)}
                  options={PRODUCT_SORT_OPTIONS}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop status filter buttons */}
        <div className="hidden border-t border-gray-200/80 bg-white/92 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#111118]/95 lg:sticky lg:top-24 lg:z-20 lg:block">
          <div className="flex flex-wrap items-center gap-2">
            {PRODUCT_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterStatus(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all ${
                  filterStatus === opt.value
                    ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                    : 'border border-gray-200/80 bg-white/85 text-gray-600 hover:border-purple-200 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-purple-500/30 dark:hover:text-white'
                }`}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-5 pb-4 pt-4">
          <button
            type="button"
            onClick={() => setShowQuickActions((v) => !v)}
            className={`flex-shrink-0 h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm ${
              showQuickActions
                ? 'text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10'
                : 'text-gray-700 dark:text-gray-200'
            }`}
            aria-label={showQuickActions ? 'Hide quick actions' : 'Show quick actions'}
          >
            <span className="text-sm">⚡</span>
          </button>
          <div
            className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
              showQuickActions ? 'max-w-[calc(100vw-7rem)] opacity-100 sm:max-w-[800px]' : 'max-w-0 opacity-0'
            }`}
          >
            <button
              type="button"
              onClick={() => navigate('/studio/store/collections/new')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors whitespace-nowrap"
            >
              📦 Add Collection
            </button>
            <button
              type="button"
              onClick={() => navigate(buildDesignRoute({ mode: 'create' }))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors whitespace-nowrap"
            >
              🎨 Create Look
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              📥 Import
            </button>
            {onToggleLayoutMode && (
              <button
                type="button"
                onClick={onToggleLayoutMode}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  layoutMode
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                🎯 {layoutMode ? 'Exit Layout' : 'Layout Mode'}
              </button>
            )}
          </div>

          {/* ─── Draft Collections: inline scroll-out ─── */}
          {(storeDraftCollections.length > 0 || draftCollectionsLoading) && (
            <>
              <div className="h-5 w-px bg-gray-200 dark:bg-white/10 mx-1" />
              <button
                type="button"
                onClick={() => setShowDrafts((v) => !v)}
                className={`flex-shrink-0 h-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-amber-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-2.5 shadow-sm ${
                  showDrafts
                    ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
                aria-label={showDrafts ? 'Hide draft collections' : 'Show draft collections'}
              >
                <span className="text-sm">📝</span>
                <span className="text-[10px] font-bold tabular-nums">{storeDraftCollections.length}</span>
              </button>
              <div
                className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                  showDrafts ? 'max-w-[calc(100vw-7rem)] opacity-100 sm:max-w-[600px]' : 'max-w-0 opacity-0'
                }`}
              >
                {draftCollectionsLoading ? (
                  <div className="h-9 w-32 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />
                ) : (
                  storeDraftCollections.map((draft: any) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => navigate(`/studio/store/collections/new?collectionId=${draft.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                    >
                      📝 {draft.title?.trim() || 'Untitled Draft'}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

      </div>
      )}

      {outletView === 'collections' && !inlineProduct && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-lg overflow-hidden">
          <div className="border-b border-gray-200/80 dark:border-white/10 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <button
                type="button"
                onClick={() => navigate('/studio/store')}
                className="rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                Store
              </button>
              <span>/</span>
              {activeCollection ? (
                <button
                  type="button"
                  onClick={handleCloseActiveCollectionView}
                  className="rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  Collections
                </button>
              ) : (
                <span className="text-gray-900 dark:text-white">Collections</span>
              )}
              {activeCollection && (
                <>
                  <span>/</span>
                  <span className="text-gray-900 dark:text-white truncate max-w-[200px]">
                    {activeCollection.name}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {activeCollection ? activeCollection.name : 'Collections Management'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeCollection
                    ? 'Products in this collection. Open gallery to browse all collection images.'
                    : 'Edit, archive, unarchive, and view each collection in this store layout.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeCollection ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleOpenCollectionGallery(activeCollection)}
                      disabled={collectionGalleryLoading}
                      className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 disabled:opacity-50 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300"
                    >
                      {collectionGalleryLoading ? 'Opening gallery...' : 'Open gallery'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openCollectionEditor(activeCollection);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                      Edit collection
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseActiveCollectionView}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                    >
                      Back to collections
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteAllCollectionsConfirmOpen(true)}
                      disabled={visibleCollections.length === 0 || deletingAllCollections}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      {deletingAllCollections ? 'Deleting...' : 'Delete all'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/studio/store/collections/new')}
                      className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                    >
                      New collection
                    </button>
                  </>
                )}
              </div>
            </div>

            {!activeCollection && (
              <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-4">
                <div
                  ref={collectionSearchContainerRef}
                  className={`transition-all duration-300 ease-out ${collectionSearchCollapsed ? 'w-11' : 'w-full'}`}
                >
                  {collectionSearchCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setCollectionSearchCollapsed(false)}
                      className="h-11 w-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                      aria-label="Open collection search"
                    >
                      <span className="text-base">🔎</span>
                    </button>
                  ) : (
                    <SearchField
                      value={collectionSearch}
                      onChange={setCollectionSearch}
                      placeholder="Search collections..."
                      showFilter={false}
                      className="!max-w-none w-full shadow-sm border-gray-200 dark:border-white/10 animate-in fade-in slide-in-from-left-2 duration-200"
                    />
                  )}
                </div>
                <FilterDropdown
                  value={collectionStatusFilter}
                  onChange={(value) => setCollectionStatusFilter(value as CollectionStatusFilter)}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'published', label: 'Published' },
                    { value: 'draft', label: 'Draft' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
                <FilterDropdown
                  value={collectionSortBy}
                  onChange={(value) => setCollectionSortBy(value as CollectionSortBy)}
                  options={[
                    { value: 'newest', label: 'Newest' },
                    { value: 'oldest', label: 'Oldest' },
                    { value: 'title_asc', label: 'Title A-Z' },
                    { value: 'title_desc', label: 'Title Z-A' },
                    { value: 'items_desc', label: 'Most items' },
                  ]}
                />
                <FilterDropdown
                  value={String(collectionLimit)}
                  onChange={(value) => setCollectionLimit(Number(value))}
                  options={[
                    { value: '6', label: '6 per page' },
                    { value: '12', label: '12 per page' },
                    { value: '24', label: '24 per page' },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {!activeCollection ? (
              managedCollectionsTotal === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300/80 bg-gray-50/70 p-6 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  No collections match your current filters.
                </div>
              ) : (
                <div className={isEmbeddedMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                  {pagedManagedCollections.map((collection) => {
                    const status = String(collection.status || 'PUBLISHED').toUpperCase();
                    const isArchived = status === 'ARCHIVED';
                    const previewSources =
                      previewSourcesByCollectionId.get(collection.id) ??
                      getCollectionPreviewSources(collection);
                    const previewFrame = hoverPreviewFrame[collection.id] ?? 0;
                    const activePreview =
                      previewSources.length > 0
                        ? previewSources[previewFrame % previewSources.length]
                        : {
                            src: collection.coverImage ?? null,
                            fileId: collection.coverFileId ?? null,
                            alt: collection.name,
                            productName: undefined as string | undefined,
                          };

                    const collectionMenuId = `collection-menu-${collection.id}`;
                    const isMenuOpen = dropdownManager.openId === collectionMenuId;

                    return (
                      <article
                        key={collection.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          handleOpenCollectionView(collection.id);
                        }}
                        onMouseEnter={() => setHoveredCollectionId(collection.id)}
                        onMouseLeave={() => {
                          setHoveredCollectionId((prev) => (prev === collection.id ? null : prev));
                          setHoverPreviewFrame((prev) => ({ ...prev, [collection.id]: 0 }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenCollectionView(collection.id);
                          }
                        }}
                        className="group overflow-hidden rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-white/10 dark:bg-zinc-900/70"
                      >
                        <div className="relative h-64 w-full bg-gray-100 dark:bg-white/5">
                          {/* Opacity-based crossfade stack — fills entire card */}
                          {previewSources.length > 0 ? (
                            <>
                              {previewSources.map((preview, pIdx) => (
                                <div
                                  key={`${preview.src ?? preview.fileId ?? pIdx}`}
                                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                                    pIdx === previewFrame ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                  }`}
                                >
                                  <ImageWithFallback
                                    src={preview.src}
                                    fileId={preview.fileId}
                                    alt={preview.alt}
                                    fit="cover"
                                    rounded="none"
                                    containerClassName="h-full w-full"
                                    className="h-full w-full"
                                    fallbackName={collection.name}
                                  />
                                </div>
                              ))}
                              {/* Product name badge - Top Left to avoid bottom text overlap */}
                              {previewSources.length > 1 && activePreview.productName && (
                                <div className="absolute top-3 left-3 z-30 max-w-[calc(100%-4rem)]">
                                  <span className="inline-block rounded-full bg-white/20 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 px-3 py-1 text-xs font-medium text-white truncate shadow-sm transition-opacity duration-300">
                                    {activePreview.productName}
                                  </span>
                                </div>
                              )}
                              {/* Dot indicators - Top Right, beside menu */}
                              {previewSources.length > 1 && (
                                <div className="absolute top-4 right-14 z-30 flex items-center gap-1.5">
                                  {previewSources.map((_, dotIdx) => (
                                    <div
                                      key={dotIdx}
                                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200 shadow-sm ${
                                        dotIdx === previewFrame ? 'bg-white scale-125' : 'bg-white/40'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <ImageWithFallback
                              src={activePreview.src}
                              fileId={activePreview.fileId}
                              alt={activePreview.alt}
                              fit="cover"
                              rounded="none"
                              containerClassName="h-full w-full relative z-10"
                              className="h-full w-full"
                              fallbackName={collection.name}
                            />
                          )}

                          {/* Menu host — Top Right */}
                          <div
                            className={`collection-menu-host absolute right-3 top-3 z-40 transition-opacity ${
                              isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                dropdownManager.setOpenId(isMenuOpen ? null : collectionMenuId);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 text-white transition hover:bg-white/30 dark:hover:bg-black/50"
                              aria-label="Collection actions"
                            >
                              <span className="text-base font-bold pb-1">...</span>
                            </button>
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    dropdownManager.setOpenId(null);
                                    void handleOpenCollectionGallery(collection);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  Gallery
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    dropdownManager.setOpenId(null);
                                    void handleDuplicateCollection(collection);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    dropdownManager.setOpenId(null);
                                    openCollectionEditor(collection);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    dropdownManager.setOpenId(null);
                                    setCollectionConfirm({
                                      mode: isArchived ? 'unarchive' : 'archive',
                                      collection,
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  {isArchived ? 'Unarchive' : 'Archive'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    dropdownManager.setOpenId(null);
                                    setCollectionConfirm({ mode: 'delete', collection });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Frosted Glass Text Component - Bottom Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 z-30 space-y-2 p-4 bg-white/60 dark:bg-black/60 backdrop-blur-md border-t border-white/20 dark:border-white/10 transition-transform duration-300">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white drop-shadow-sm">
                                  {collection.name}
                                </p>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                                  {collection.itemCount ?? 0} items
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-md ${
                                  status === 'ARCHIVED'
                                    ? 'bg-gray-500/20 text-gray-800 border-gray-400/30 dark:bg-white/20 dark:text-gray-200 dark:border-white/20'
                                    : status === 'DRAFT'
                                      ? 'bg-amber-400/20 text-amber-900 border-amber-400/30 dark:bg-amber-500/30 dark:text-amber-200 dark:border-amber-400/20'
                                      : 'bg-emerald-400/20 text-emerald-900 border-emerald-400/30 dark:bg-emerald-500/30 dark:text-emerald-200 dark:border-emerald-400/20'
                                }`}
                              >
                                {status}
                              </span>
                            </div>

                            <p className="line-clamp-2 text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                              {collection.description?.trim() || 'No description yet.'}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : activeCollectionProductsLoading ? (
              <div className={isEmbeddedMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-64 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
                ))}
              </div>
            ) : activeCollectionProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300/80 bg-gray-50/70 p-6 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                No products currently linked to this collection.
              </div>
            ) : (
              <div className={isEmbeddedMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}>
                {activeCollectionProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigateToStudioProductDetails(product.id)}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-zinc-900/70"
                  >
                    <div className="aspect-[4/5] bg-gray-100 dark:bg-white/5">
                      <ImageWithFallback
                        src={product.thumbnail || product.images?.[0] || product.media?.[0]?.url || null}
                        fileId={product.media?.find((media) => media.isPrimary)?.id || null}
                        alt={product.name}
                        fit="cover"
                        rounded="none"
                        containerClassName="h-full w-full"
                        className="h-full w-full"
                        fallbackName={product.name}
                      />
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Stock: {product.totalStock ?? 0}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        NGN {product.price.toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200/80 dark:border-white/10 p-4">
            {!activeCollection ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
                <div>
                  Showing {managedCollectionsTotal === 0 ? 0 : (collectionPage - 1) * collectionLimit + 1}-
                  {Math.min(collectionPage * collectionLimit, managedCollectionsTotal)} of {managedCollectionsTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectionPage((prev) => Math.max(1, prev - 1))}
                    disabled={collectionPage === 1}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                  >
                    Prev
                  </button>
                  <span className="text-xs">
                    Page {collectionPage} / {managedCollectionsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCollectionPage((prev) => Math.min(managedCollectionsPages, prev + 1))
                    }
                    disabled={collectionPage === managedCollectionsPages}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span>Items per page:</span>
                  <Select
                    variant="compact"
                    value={activeCollectionProductsLimit}
                    onChange={(e) => setActiveCollectionProductsLimit(Number(e.target.value))}
                    fullWidth={false}
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                  </Select>
                </div>
                <div>
                  Showing {activeCollectionProductsTotal === 0 ? 0 : (activeCollectionProductsPage - 1) * activeCollectionProductsLimit + 1}-
                  {Math.min(activeCollectionProductsPage * activeCollectionProductsLimit, activeCollectionProductsTotal)} of {activeCollectionProductsTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCollectionProductsPage((prev) => Math.max(1, prev - 1))}
                    disabled={activeCollectionProductsPage === 1 || activeCollectionProductsLoading}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                  >
                    Prev
                  </button>
                  <span className="text-xs">
                    Page {activeCollectionProductsPage} / {activeCollectionProductsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCollectionProductsPage((prev) =>
                        Math.min(activeCollectionProductsPages, prev + 1),
                      )
                    }
                    disabled={
                      activeCollectionProductsPage === activeCollectionProductsPages ||
                      activeCollectionProductsLoading
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline Product Detail View */}
      {inlineProduct && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-lg p-4 sm:p-6">
          <InlineProductDetail
            product={inlineProduct}
            onBack={() => setInlineProduct(null)}
            brandName={inlineProduct.brand?.name}
          />
        </div>
      )}

      {/* Products - with CSS containment for smooth tab transitions */}
      {outletView === 'products' && !inlineProduct && (
      <div className="rounded-xl border border-gray-200 bg-white/90 shadow-lg dark:border-white/10 dark:bg-white/5 sm:rounded-2xl">
        {/* Inline filter dropdowns */}
        <div className="hidden lg:flex items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <FilterDropdown
            value={filterCollection}
            onChange={setFilterCollection}
            disabled={collectionsLoading}
            options={[
              { value: 'all', label: 'All Collections' },
              ...visibleCollections.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <FilterDropdown
            value={filterStock}
            onChange={setFilterStock}
            options={[
              { value: 'all', label: 'All Stock' },
              { value: 'in_stock', label: 'In Stock' },
              { value: 'low_stock', label: 'Low Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
            ]}
          />
          <FilterDropdown
            value={productSortBy}
            onChange={(value) => setProductSortBy(value as ProductSortBy)}
            options={PRODUCT_SORT_OPTIONS}
          />
        </div>
        <div className="p-2.5 sm:p-4 lg:p-6">
          <div
            ref={listRef}
            style={{
              minHeight: listMinHeight || 'auto',
              contain: 'layout style',
              willChange: 'contents',
            }}
            className={`transition-opacity duration-300 ease-out ${loading ? 'opacity-50' : 'opacity-100'}`}
          >
            <div className="grid grid-cols-2 gap-2 transition-all duration-300 min-[520px]:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const collectionLabel =
                product.collection?.title ||
                collections.find((c) => c.id === product.collectionId)?.name ||
                '—';
              
              // Determine status for badge
              const productStatus = resolveProductStatus(product);

              return (
                <div
                  key={product.id}
                  className={[
                    'group relative aspect-[5/6] overflow-hidden rounded-xl shadow-sm transition-all duration-300 ease-out',
                    selectedProducts.includes(product.id)
                      ? 'ring-2 ring-purple-500 border-purple-300 dark:border-purple-500/30'
                      : 'hover:shadow-xl hover:shadow-black/[0.08] dark:hover:shadow-black/30',
                    layoutMode ? 'cursor-move' : 'cursor-pointer',
                    dropdownManager.openId === ('product-menu-' + product.id) ? 'z-50' : 'z-10'
                  ].join(' ')}
                  onClick={() => {
                    if (layoutMode) return;
                    navigateToStudioProductDetails(product.id);
                  }}
                >
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(product.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-2 top-2 z-20 h-4 w-4 rounded border-gray-300 bg-white/90 text-purple-600 focus:ring-purple-500/30 dark:border-zinc-600 dark:bg-zinc-800/90 cursor-pointer"
                  />
                  
                  {/* Actions menu button (replaces star) */}
                  <div className="absolute right-2 top-2 z-20">
                    <button
                      type="button"
                      ref={(el) => {
                        productMenuTriggerRefs.current[product.id] = el;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const menuId = `product-menu-${product.id}`;
                        dropdownManager.setOpenId(
                          dropdownManager.openId === menuId ? null : menuId,
                        );
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm shadow-sm transition-all duration-200 ${
                        dropdownManager.openId === `product-menu-${product.id}`
                          ? 'text-white bg-purple-600/80'
                          : 'text-white hover:bg-black/60'
                      }`}
                      title="Actions"
                    >
                      <span className="text-lg font-bold">⋯</span>
                    </button>
                    
                    {/* Featured indicator (small badge) */}
                    {product.isFeatured && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-md" title="Featured product">
                        <span className="text-xs">⭐</span>
                      </div>
                    )}
                  </div>

                  {/* Actions dropdown menu — rendered as card overlay */}
                  {dropdownManager.openId === `product-menu-${product.id}` && (
                    <ProductActionsMenu
                      isOpen={true}
                      onClose={() => dropdownManager.setOpenId(null)}
                      onAction={(actionId) => handleProductAction(actionId, product)}
                      actions={getDefaultProductActions(product)}
                      triggerElement={
                        productMenuTriggerRefs.current[product.id] ?? null
                      }
                      renderInline
                    />
                  )}

                  {/* Quick action icons - always visible */}
                  {!product.deletedAt && (
                    <div className="absolute bottom-[5.25rem] right-2 z-30 flex items-center gap-1 sm:bottom-[5.75rem] sm:gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProductAction('edit', product);
                        }}
                        title="Edit product"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-purple-600 sm:h-8 sm:w-8"
                      >
                        <span className="text-sm">✏️</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProductAction('delete', product);
                        }}
                        title="Delete product"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:bg-red-500 sm:h-8 sm:w-8"
                      >
                        <span className="text-sm">🗑️</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Layout mode drag handle */}
                  {layoutMode && (
                    <div className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 text-gray-500 dark:text-zinc-400 shadow-lg">
                      <span className="text-base">⠿</span>
                    </div>
                  )}

                  {/* Full-bleed Image Container */}
                  <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-800/50">
                    {(() => {
                      const primaryMedia = product.media?.find((m) => m.isPrimary) ?? product.media?.[0];
                      const fallbackValue = product.thumbnail || product.images?.[0] || null;
                      const primarySource = toRenderableMediaSource(primaryMedia?.url ?? null);
                      const fallbackSource = toRenderableMediaSource(fallbackValue);
                      const mediaIdCandidates = [
                        typeof primaryMedia?.id === 'string' ? primaryMedia.id : null,
                        ...(Array.isArray(product.mediaIds)
                          ? product.mediaIds.filter((id): id is string => typeof id === 'string')
                          : []),
                      ];
                      const fallbackFileId = mediaIdCandidates.find(
                        (candidate) => candidate && !isRemoteMediaValue(candidate),
                      ) ?? null;
                      const resolvedSrc = primarySource.src ?? fallbackSource.src;
                      const resolvedFileId =
                        primarySource.fileId ?? fallbackSource.fileId ?? fallbackFileId;

                      return resolvedSrc || resolvedFileId ? (
                        <ImageWithFallback
                          src={resolvedSrc}
                          fileId={resolvedFileId ?? undefined}
                          alt={product.name}
                          fit="cover"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          containerClassName="h-full w-full"
                          rounded="none"
                        />
                      ) : null;
                    })()}
                    
                    {/* Fallback for missing images */}
                    {!product.thumbnail && !product.images?.[0] && (!product.media || product.media.length === 0) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl mb-2">📦</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
                      </div>
                    )}
                  </div>

                  {/* Gradient overlay for readability */}
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-[1]" />

                  {/* Status badge inside image area */}
                  <div className="absolute bottom-[5.25rem] left-2 z-10 sm:bottom-[5.75rem]">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-lg ${
                      productStatus === 'DELETED'
                        ? 'bg-rose-500/90 text-white'
                        : productStatus === 'ARCHIVED'
                          ? 'bg-gray-500/90 text-white'
                          : productStatus === 'DRAFT' 
                            ? 'bg-amber-500/90 text-white' 
                            : 'bg-emerald-500/90 text-white'
                    }`}>
                      {productStatus === 'DELETED'
                        ? '🗑️ Deleted'
                        : productStatus === 'ARCHIVED'
                          ? '📦 Archived'
                          : productStatus === 'DRAFT'
                            ? '📝 Draft'
                            : '✅ Published'}
                    </span>
                  </div>

                  {/* Frosted Glass Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-black/35 p-1.5 backdrop-blur-xl sm:p-2">
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      {/* Name and Collection */}
                      <h3 className="line-clamp-1 text-xs font-semibold text-white drop-shadow-sm sm:text-sm">{product.name}</h3>
                      <p className="line-clamp-1 text-[10px] text-white/60 sm:text-[11px]">{collectionLabel}</p>
                      
                      {/* Price Section */}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-white drop-shadow-sm sm:text-sm">
                          ₦{product.price.toLocaleString()}
                        </span>
                        {typeof product.salePrice === 'number' && product.salePrice > 0 && (
                          <span className="truncate text-[10px] font-medium text-rose-300 sm:text-xs">
                            🏷️ ₦{product.salePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      {/* Stock info row */}
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={`min-w-0 truncate text-[10px] font-medium cursor-help ${
                            getProductStockState(product) === 'CUSTOM_ORDER_ONLY'
                              ? 'text-violet-300'
                              : getProductStockState(product) === 'OUT_OF_STOCK'
                                ? 'text-rose-300'
                                : getProductStockState(product) === 'LOW_STOCK'
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                          }`}
                          title={
                            isCustomOrderOnlyProduct(product)
                              ? 'Out of stock, but customers can still bag it while you restock.'
                              : (product.totalStock ?? 0) === 0
                                ? 'This product is out of stock and cannot be purchased'
                                : (product.totalStock ?? 0) <= 5
                                  ? 'Low stock warning: Consider restocking soon'
                                  : 'Stock is healthy'
                          }
                        >
                          {isCustomOrderOnlyProduct(product)
                            ? '✂️ Custom order only'
                            : (product.totalStock ?? 0) === 0
                              ? '🔴 Out of stock'
                              : (product.totalStock ?? 0) <= 5
                                ? `🟡 ${product.totalStock} in stock`
                                : `🟢 ${product.totalStock} in stock`}
                        </span>
                        
                        {/* Creation time */}
                        {product.createdAt && (
                          <span 
                            className="hidden shrink-0 text-[10px] text-white/50 min-[420px]:inline"
                            title={new Date(product.createdAt).toLocaleString()}
                          >
                            {(() => {
                              const created = new Date(product.createdAt);
                              const now = new Date();
                              const diffMs = now.getTime() - created.getTime();
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              const diffMins = Math.floor(diffMs / (1000 * 60));
                              
                              if (diffMins < 60) return `${diffMins}m ago`;
                              if (diffHours < 24) return `${diffHours}h ago`;
                              if (diffDays < 7) return `${diffDays}d ago`;
                              if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
                              return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            })()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {showDraftCollectionsInProductArea && (
              <div className="col-span-full rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 text-left dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Collection drafts found
                  </p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                    {storeDraftCollections.length}
                  </span>
                </div>
                <p className="mb-3 text-xs text-amber-700/90 dark:text-amber-200/80">
                  The Draft filter above is for product drafts. These are collection drafts.
                </p>
                <div className="flex flex-wrap gap-2">
                  {storeDraftCollections.map((draft: any) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => navigate(`/studio/store/collections/new?collectionId=${draft.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-white dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                    >
                      📝 {draft.title?.trim() || 'Untitled Draft'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Filter empty — products exist but none match the filter */}
            {!loading && filteredProducts.length === 0 && products.length > 0 && !showDraftCollectionsInProductArea && (
              <div className="col-span-full py-16 text-center text-gray-500 dark:text-gray-400">
                No products match this filter.
              </div>
            )}
            {/* Absolute empty — no products at all. Rendered here so it sits inside
                the same card container rather than creating a second orphan box. */}
            {!loading && products.length === 0 && !showDraftCollectionsInProductArea && (() => {
              const getEmptyStateType = (): EmptyStateType => {
                switch (filterStatus) {
                  case 'archived': return 'no-archived';
                  case 'deleted': return 'no-deleted';
                  case 'draft': return 'no-drafts';
                  default: return 'no-products';
                }
              };
              return (
                <div className="col-span-full">
                  <StoreEmptyState
                    type={getEmptyStateType()}
                    isOwner={true}
                    onAction={filterStatus === 'draft' ? () => navigate('/studio/store/products/new') : undefined}
                  />
                </div>
              );
            })()}
            </div>
          </div>
        </div>

        {/* Pagination — only shown when there is at least one product */}
        {products.length > 0 && (
        <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Items per page:</span>
              <Select
                variant="compact"
                value={limit}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setPage(1);
                  setLimit(Number.isFinite(next) ? next : 25);
                }}
                fullWidth={false}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Select>
            </div>

            <div className="text-gray-500 dark:text-gray-400 text-sm">
              Showing{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)}
              </span>{' '}
              of <span className="text-gray-900 dark:text-white font-semibold">{total}</span> products
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((pnum) => {
                  if (totalPages <= 5) return true;
                  return Math.abs(pnum - page) <= 2;
                })
                .slice(0, 5)
                .map((pnum) => (
                  <button
                    type="button"
                    key={pnum}
                    onClick={() => setPage(pnum)}
                    disabled={loading}
                    className={
                      pnum === page
                        ? 'p-2 px-4 bg-purple-600 text-white rounded-lg font-semibold shadow-md shadow-purple-500/20'
                        : 'p-2 px-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all'
                    }
                  >
                    {pnum}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {outletView === 'products' && showBulkActions && (
        <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-2xl">
          <span>{selectedProducts.length} selected</span>
          <div className="h-5 w-px bg-white/30" />
          {!isDeletedTab && (
            <button
              type="button"
              onClick={() => handleBulkAction('Edit')}
              disabled={bulkActionBusy}
              className="hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {'\u270F\uFE0F'} Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => handleBulkAction(isDeletedTab ? 'Permanent-Delete' : 'Delete')}
            disabled={bulkActionBusy}
            className="hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {'\uD83D\uDDD1\uFE0F'} {isDeletedTab ? 'Permanent Delete' : 'Delete'}
          </button>
          {!isDeletedTab && (
            <>
              <button
                type="button"
                onClick={() => handleBulkAction('Archive')}
                disabled={bulkActionBusy}
                className="hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {'\uD83D\uDCE6'} Archive
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('Unpublish')}
                disabled={bulkActionBusy}
                className="hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {'\uD83D\uDCE5'} Unpublish
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelectedProducts([])}
            disabled={bulkActionBusy}
            className="ml-2 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {'\u2716'} Clear
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <BulkDeleteProductsModal
        isOpen={bulkConfirmAction === 'delete' || bulkConfirmAction === 'permanent-delete'}
        mode={bulkConfirmAction === 'permanent-delete' ? 'permanent-delete' : 'delete'}
        products={selectedBulkDeleteProducts}
        isProcessing={bulkActionBusy}
        onConfirmDelete={handleConfirmBulkDeleteWithTypedFlow}
        onClose={() => setBulkConfirmAction(null)}
      />

      <ConfirmDialog
        open={bulkConfirmAction === 'archive' || bulkConfirmAction === 'unpublish'}
        title={
          bulkConfirmAction === 'archive'
            ? 'Archive selected products?'
            : 'Unpublish selected products?'
        }
        message={
          `You selected ${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'}. ${
            bulkConfirmAction === 'archive'
              ? 'This will archive them and hide them from your store.'
              : 'This will move them to draft and remove them from public store listings.'
          }`
        }
        confirmText={
          bulkActionBusy
            ? bulkConfirmAction === 'archive'
              ? 'Archiving...'
              : 'Unpublishing...'
            : bulkConfirmAction === 'archive'
              ? 'Archive Selected'
              : 'Unpublish Selected'
        }
        isLoading={bulkActionBusy}
        onConfirm={() => void handleConfirmBulkAction()}
        onCancel={() => setBulkConfirmAction(null)}
      />

      <ConfirmDialog
        open={Boolean(collectionConfirm)}
        title={
          collectionConfirm?.mode === 'archive'
            ? 'Archive this collection?'
            : collectionConfirm?.mode === 'unarchive'
              ? 'Restore this collection?'
              : 'Delete this collection?'
        }
        message={
          collectionConfirm?.mode === 'archive'
            ? 'This collection will be hidden from your main view but can be restored later at any time.'
            : collectionConfirm?.mode === 'unarchive'
              ? 'This collection will be moved back to Drafts and become fully editable again.'
              : 'This action is permanent and cannot be undone. All associated data will be lost.'
        }
        confirmText={
          collectionConfirmBusy
            ? 'Processing...'
            : collectionConfirm?.mode === 'unarchive'
              ? 'Restore'
              : collectionConfirm?.mode === 'archive'
                ? 'Archive'
                : 'Delete'
        }
        isDestructive={collectionConfirm?.mode === 'delete'}
        isLoading={collectionConfirmBusy}
        onConfirm={() => void handleConfirmCollectionAction()}
        onCancel={() => setCollectionConfirm(null)}
      />
      <ConfirmDialog
        open={deleteAllCollectionsConfirmOpen}
        title="Delete all collections?"
        message="This will permanently delete all your store collections and remove their product links. Products themselves will remain in your store."
        confirmText={deletingAllCollections ? 'Deleting...' : 'Delete All Collections'}
        isDestructive
        isLoading={deletingAllCollections}
        onConfirm={() => void handleDeleteAllCollections()}
        onCancel={() => setDeleteAllCollectionsConfirmOpen(false)}
      />


      {collectionGalleryOpen && (() => {
        const onTouchStart = (e: React.TouchEvent) => {
          galleryTouchRef.current.startX = e.touches[0].clientX;
          galleryTouchRef.current.startY = e.touches[0].clientY;
        };

        const onTouchEnd = (e: React.TouchEvent) => {
          const deltaX = e.changedTouches[0].clientX - galleryTouchRef.current.startX;
          const deltaY = e.changedTouches[0].clientY - galleryTouchRef.current.startY;
          const minSwipe = 50;
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipe) {
            if (deltaX < 0) handleNextCollectionGalleryImage();
            else handlePrevCollectionGalleryImage();
          }
        };

        return (
          <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-0">
            <button
              type="button"
              className="absolute inset-0 bg-black/90"
              onClick={() => setCollectionGalleryOpen(false)}
              aria-label="Close collection gallery"
            />
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-transparent max-h-screen">
              {/* ─── Header ─── */}
              <div className="hidden">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {collectionGallerySourceName || 'Collection gallery'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {collectionGalleryLoading
                      ? 'Loading images...'
                      : `${collectionGalleryImages.length} image(s)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedCollectionGalleryImage && collectionGalleryImages.length > 1 && (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gray-300 tabular-nums">
                      {collectionGalleryIndex + 1} / {collectionGalleryImages.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCollectionGalleryOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-300 transition hover:bg-white/20 hover:text-white"
                    aria-label="Close gallery"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* ─── Main image area ─── */}
              <div
                className="relative flex flex-1 items-center justify-center overflow-hidden"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <button
                  type="button"
                  onClick={() => setCollectionGalleryOpen(false)}
                  className="absolute right-4 top-4 z-20 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/65"
                  aria-label="Close gallery"
                >
                  Close
                </button>
                {selectedCollectionGalleryImage && collectionGalleryImages.length > 1 && (
                  <span className="absolute left-4 top-4 z-20 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white tabular-nums">
                    {collectionGalleryIndex + 1}/{collectionGalleryImages.length}
                  </span>
                )}
                {collectionGalleryLoading ? (
                  <div className="flex h-[50vh] w-full items-center justify-center">
                    <VLoader size={42} phase="loading" showLabel={false} />
                  </div>
                ) : !selectedCollectionGalleryImage ? (
                  <div className="flex h-[40vh] w-full items-center justify-center">
                    <p className="text-sm text-gray-500">No images to display.</p>
                  </div>
                ) : (
                  <>
                    {/* Prev/Next navigation overlays */}
                    {collectionGalleryImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevCollectionGalleryImage}
                          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white sm:left-5 sm:h-11 sm:w-11"
                          aria-label="Previous image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleNextCollectionGalleryImage}
                          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white sm:right-5 sm:h-11 sm:w-11"
                          aria-label="Next image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      </>
                    )}

                    {/* The image — rendered at natural aspect ratio, no cropping, no background */}
                    <div
                      key={selectedCollectionGalleryImage.id}
                      className="flex h-full w-full items-center justify-center animate-in fade-in duration-300"
                    >
                      <ImageWithFallback
                        src={selectedCollectionGalleryImage.src}
                        fileId={selectedCollectionGalleryImage.fileId}
                        alt={selectedCollectionGalleryImage.alt}
                        fit="contain"
                        rounded="none"
                        containerClassName="h-full w-full flex items-center justify-center"
                        className="h-auto max-h-screen w-auto max-w-screen object-contain"
                        fallbackName={selectedCollectionGalleryImage.productName || collectionGallerySourceName || 'Collection'}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ─── Product name caption ─── */}
              {selectedCollectionGalleryImage && (
                <div className="hidden">
                  <p className="truncate text-xs text-gray-400">
                    {selectedCollectionGalleryImage.productName || 'Collection image'}
                  </p>
                </div>
              )}

              {/* ─── Thumbnail strip ─── */}
              {collectionGalleryImages.length > 1 && (
                <div className="hidden">
                  {/* Mobile dot indicators */}
                  <div className="flex items-center justify-center gap-1.5 sm:hidden mb-2">
                    {collectionGalleryImages.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCollectionGalleryIndex(index)}
                        className={`h-1.5 rounded-full transition-all ${
                          index === collectionGalleryIndex
                            ? 'w-4 bg-purple-400'
                            : 'w-1.5 bg-white/25 hover:bg-white/40'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                  {/* Desktop thumbnail row */}
                  <div className="hidden sm:flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-white/10">
                    {collectionGalleryImages.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setCollectionGalleryIndex(index)}
                        className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                          index === collectionGalleryIndex
                            ? 'border-purple-500 ring-1 ring-purple-500/40 opacity-100'
                            : 'border-transparent opacity-60 hover:opacity-90'
                        }`}
                        aria-label={`Open image ${index + 1}`}
                      >
                        <ImageWithFallback
                          src={image.src}
                          fileId={image.fileId}
                          alt={image.alt}
                          fit="cover"
                          rounded="none"
                          containerClassName="h-14 w-14"
                          className="h-14 w-14 object-cover"
                          fallbackName={image.productName || collectionGallerySourceName || 'Collection'}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <DeleteProductModal
        isOpen={!!deleteModalProduct}
        onClose={() => setDeleteModalProduct(null)}
        onDeleted={(deletedProductId) => {
          setProducts((prev) => prev.filter((product) => product.id !== deletedProductId));
          setSelectedProducts((prev) => prev.filter((id) => id !== deletedProductId));
          setInlineProduct((prev) => (prev?.id === deletedProductId ? null : prev));
          toast.success('Product deleted');
          void refresh();
        }}
        product={deleteModalProduct}
      />

      <ArchiveProductModal
        isOpen={!!archiveModalProduct}
        onClose={() => setArchiveModalProduct(null)}
        onArchived={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={archiveModalProduct}
        mode={archiveMode}
      />

      <RestoreDeletedProductModal
        isOpen={!!restoreModalProduct}
        onClose={() => setRestoreModalProduct(null)}
        onRestored={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={restoreModalProduct}
      />

      <PermanentDeleteProductModal
        isOpen={!!permanentDeleteProduct}
        onClose={() => setPermanentDeleteProduct(null)}
        onDeleted={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={permanentDeleteProduct}
      />

      <ComingSoonModal
        isOpen={comingSoonModal.open}
        onClose={() => setComingSoonModal({ open: false })}
        feature={comingSoonModal.feature}
        description={comingSoonModal.description}
      />

      {draftReminderProduct && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
              }
              setDraftReminderProduct(null);
            }}
          />
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-white/10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Continue your draft?</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                You have a saved draft that will be removed after 90 days.
              </p>
            </div>
            <div className="p-6 space-y-2">
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {draftReminderProduct.name || 'Untitled Draft'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Saved as draft
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-800/30 flex gap-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
                  }
                  setDraftReminderProduct(null);
                }}
                className="flex-1 px-4 py-3 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
                  }
                  setDraftReminderProduct(null);
                  navigate(`/studio/store/products/${draftReminderProduct.id}/edit`);
                }}
                className="flex-1 px-4 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
              >
                ✏️ Continue Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductsPanel;
