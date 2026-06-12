import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { X } from "lucide-react";
import VLoader from "@/components/loaders/VLoader";
import type { RootState } from "@/store";
import { brandApi } from "@/api/BrandApi";
import { apiClient } from "@/api/httpClient";
import { productApi } from "@/api/ProductApi";
import {
  getBrandProductsForOwner,
  type Product as StoreProduct,
} from "@/api/StoreApi";
import { unwrapApiResponse } from "@/types/auth";
import {
  addProductsToCollection,
  finalizeStoreCollection,
  initializeStoreCollection,
  removeProductsFromCollection,
  reorderCollectionProducts,
  type CollectionType,
  type CollectionVisibility,
} from "@/api/storeCollections";
import ImageWithFallback from "@/components/ImageWithFallback";
import SearchField from "@/components/SearchField";
import Select from "@/components/ui/Select";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import Tag from "@/components/ui/Tag";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { getTagColor } from "@/utils/tagColors";
import {
  getCollectionProductQueueItems,
  removeCollectionProductQueueItem,
  subscribeToCollectionProductQueue,
  type CollectionProductQueueItem,
} from "@/utils/collectionProductQueue";
import FilterSelector, {
  type FilterSelection,
} from "@/components/categories/FilterSelector";
import {
  CREATOR_AUDIENCE_OPTIONS,
  CREATOR_METADATA_HELP,
  mapCreatorMetadataError,
  normalizeHashtagLabel,
} from "@/utils/creatorMetadata";

const MAX_PRODUCTS = 5;
const MAX_TAGS = 20;
const TAG_CHAR_LIMIT = 50;
type CollectionProductStatus = "uploading" | "processing" | "ready" | "failed";
type CollectionProductType = "draft" | "existing";
type CollectionProductEntry = {
  id: string;
  type: CollectionProductType;
  status: CollectionProductStatus;
  product: StoreProduct | null;
  queueItem: CollectionProductQueueItem | null;
};
type CategoryTypeOption = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  types: CategoryTypeOption[];
};

const FILTER_SELECTION_STORAGE_PREFIX = "storeCollectionFilterSelection:";
const COLLECTION_DRAFT_STORAGE_PREFIX = "storeCollectionDraftSnapshot:";
const COLLECTION_DRAFT_ACTIVE_STORAGE_PREFIX =
  "storeCollectionDraftActiveSession:";

type CollectionDraftSnapshot = {
  sessionId: string;
  creationMode: "existing" | "new";
  title: string;
  description: string;
  visibility: CollectionVisibility;
  type: CollectionType;
  categoryId: string;
  categoryTypeId: string;
  tags: string[];
  filterSelection: FilterSelection;
  selectedProductIds: string[];
  primaryProductId: string | null;
  sessionDraftProductIds: string[];
  sessionFlowProductIds: string[];
  existingLinkedProductIds: string[];
  hasManualFilterEdits: boolean;
  hasManualTagEdits: boolean;
  hasManualCategoryEdit: boolean;
  hasManualSubCategoryEdit: boolean;
  updatedAt: number;
};

const getCollectionDraftStorageKey = (sessionId: string) =>
  `${COLLECTION_DRAFT_STORAGE_PREFIX}${sessionId}`;

const getActiveCollectionDraftKey = (userId?: string | null) =>
  `${COLLECTION_DRAFT_ACTIVE_STORAGE_PREFIX}${userId ?? "anonymous"}`;

const areFilterSelectionsEqual = (
  a: FilterSelection,
  b: FilterSelection,
): boolean => {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;

  for (let index = 0; index < aKeys.length; index += 1) {
    const key = aKeys[index];
    if (key !== bKeys[index]) return false;
    const aValues = Array.isArray(a[key]) ? [...a[key]].sort() : [];
    const bValues = Array.isArray(b[key]) ? [...b[key]].sort() : [];
    if (aValues.length !== bValues.length) return false;
    for (let valueIndex = 0; valueIndex < aValues.length; valueIndex += 1) {
      if (aValues[valueIndex] !== bValues[valueIndex]) return false;
    }
  }

  return true;
};

const normalizeFilterSelectionFromDetail = (detail: any): FilterSelection => {
  if (!detail || typeof detail !== "object") return {};

  const mapSelection = (input: unknown): FilterSelection => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {};
    }
    const next: FilterSelection = {};
    Object.entries(input as Record<string, unknown>).forEach(
      ([dimensionId, value]) => {
        if (!dimensionId) return;
        const values = Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];
        if (values.length > 0) {
          next[dimensionId] = Array.from(new Set(values));
        }
      },
    );
    return next;
  };

  const directSelection = mapSelection((detail as any).filterSelection);
  if (Object.keys(directSelection).length > 0) return directSelection;

  const rows = Array.isArray((detail as any).filters)
    ? ((detail as any).filters as any[])
    : [];
  if (rows.length === 0) return {};

  const next: FilterSelection = {};
  rows.forEach((row) => {
    const dimensionId =
      (typeof row?.dimensionId === "string" && row.dimensionId) ||
      (typeof row?.dimension?.id === "string" && row.dimension.id) ||
      (typeof row?.filterValue?.dimensionId === "string" &&
        row.filterValue.dimensionId) ||
      "";
    const valueId =
      (typeof row?.valueId === "string" && row.valueId) ||
      (typeof row?.filterValueId === "string" && row.filterValueId) ||
      (typeof row?.filterValue?.id === "string" && row.filterValue.id) ||
      "";
    if (!dimensionId || !valueId) return;
    const current = next[dimensionId] ?? [];
    if (!current.includes(valueId)) {
      next[dimensionId] = [...current, valueId];
    }
  });

  return next;
};

const normalizeFilterSelectionFromProduct = (raw: any): FilterSelection => {
  if (!raw || typeof raw !== "object") return {};

  const mapSelection = (input: unknown): FilterSelection => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {};
    }
    const next: FilterSelection = {};
    Object.entries(input as Record<string, unknown>).forEach(
      ([dimensionId, value]) => {
        if (!dimensionId) return;
        const values = Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];
        if (values.length > 0) {
          next[dimensionId] = Array.from(new Set(values));
        }
      },
    );
    return next;
  };

  const directSelection = mapSelection((raw as any).filterSelection);
  if (Object.keys(directSelection).length > 0) {
    return directSelection;
  }

  const rows = Array.isArray((raw as any).filters)
    ? ((raw as any).filters as any[])
    : [];
  if (rows.length === 0) {
    return {};
  }

  const next: FilterSelection = {};
  rows.forEach((row) => {
    const dimensionId =
      (typeof row?.dimensionId === "string" && row.dimensionId) ||
      (typeof row?.dimension?.id === "string" && row.dimension.id) ||
      (typeof row?.filterValue?.dimensionId === "string" &&
        row.filterValue.dimensionId) ||
      "";
    const valueId =
      (typeof row?.valueId === "string" && row.valueId) ||
      (typeof row?.filterValueId === "string" && row.filterValueId) ||
      (typeof row?.filterValue?.id === "string" && row.filterValue.id) ||
      "";
    if (!dimensionId || !valueId) return;
    const current = next[dimensionId] ?? [];
    if (!current.includes(valueId)) {
      next[dimensionId] = [...current, valueId];
    }
  });

  return next;
};

const normalizeLinkedProduct = (raw: any): StoreProduct | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const normalizedFilterSelection = normalizeFilterSelectionFromProduct(raw);
  const normalizedFilters = Array.isArray(raw.filters)
    ? raw.filters.filter((row: unknown) => {
        if (!row || typeof row !== "object") return false;
        const item = row as {
          dimensionId?: unknown;
          valueId?: unknown;
        };
        return (
          typeof item.dimensionId === "string" &&
          item.dimensionId.length > 0 &&
          typeof item.valueId === "string" &&
          item.valueId.length > 0
        );
      })
    : [];
  const normalizedFilterValueIds = Array.isArray(raw.filterValueIds)
    ? raw.filterValueIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.length > 0,
      )
    : [];
  return {
    id,
    collectionId: typeof raw.collectionId === "string" ? raw.collectionId : "",
    brandId: typeof raw.brandId === "string" ? raw.brandId : "",
    name:
      typeof raw.name === "string" && raw.name.trim().length > 0
        ? raw.name
        : "Untitled product",
    description: typeof raw.description === "string" ? raw.description : "",
    price: typeof raw.price === "number" ? raw.price : 0,
    salePrice: typeof raw.salePrice === "number" ? raw.salePrice : undefined,
    saleStartAt:
      typeof raw.saleStartAt === "string" ? raw.saleStartAt : undefined,
    saleEndAt: typeof raw.saleEndAt === "string" ? raw.saleEndAt : undefined,
    sizes: Array.isArray(raw.sizes)
      ? raw.sizes.filter((v: unknown) => typeof v === "string")
      : [],
    sizeStock:
      raw.sizeStock && typeof raw.sizeStock === "object"
        ? raw.sizeStock
        : undefined,
    colors: Array.isArray(raw.colors)
      ? raw.colors.filter((v: unknown) => typeof v === "string")
      : [],
    colorImages:
      raw.colorImages && typeof raw.colorImages === "object"
        ? raw.colorImages
        : undefined,
    images: Array.isArray(raw.images)
      ? raw.images.filter((v: unknown) => typeof v === "string")
      : [],
    thumbnail: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
    totalStock: typeof raw.totalStock === "number" ? raw.totalStock : 0,
    lowStockThreshold:
      typeof raw.lowStockThreshold === "number" ? raw.lowStockThreshold : 5,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((v: unknown) => typeof v === "string")
      : [],
    filterSelection: normalizedFilterSelection,
    filters: normalizedFilters as StoreProduct["filters"],
    filterValueIds: normalizedFilterValueIds,
    gender:
      raw.gender === "MALE" ||
      raw.gender === "FEMALE" ||
      raw.gender === "EVERYBODY"
        ? raw.gender
        : "EVERYBODY",
    categoryId:
      typeof raw.categoryId === "string" && raw.categoryId
        ? raw.categoryId
        : undefined,
    categoryTypeId:
      typeof raw.categoryTypeId === "string" && raw.categoryTypeId
        ? raw.categoryTypeId
        : typeof raw.subCategoryId === "string" && raw.subCategoryId
          ? raw.subCategoryId
          : undefined,
    subCategoryId:
      typeof raw.subCategoryId === "string" && raw.subCategoryId
        ? raw.subCategoryId
        : typeof raw.categoryTypeId === "string" && raw.categoryTypeId
          ? raw.categoryTypeId
          : undefined,
    categoryType:
      raw.categoryType && typeof raw.categoryType === "object"
        ? {
            id:
              typeof raw.categoryType.id === "string"
                ? raw.categoryType.id
                : "",
            categoryId:
              typeof raw.categoryType.categoryId === "string"
                ? raw.categoryType.categoryId
                : "",
            slug:
              typeof raw.categoryType.slug === "string"
                ? raw.categoryType.slug
                : "",
            name:
              typeof raw.categoryType.name === "string"
                ? raw.categoryType.name
                : "",
          }
        : undefined,
    isActive: raw.isActive !== false,
    isFeatured: Boolean(raw.isFeatured),
    viewsCount: typeof raw.viewsCount === "number" ? raw.viewsCount : 0,
    threadsCount: typeof raw.threadsCount === "number" ? raw.threadsCount : 0,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date(0).toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date(0).toISOString(),
    collection: raw.collection,
    brand: raw.brand,
    ...(Array.isArray(raw.media) ? { media: raw.media } : {}),
    ...(Array.isArray(raw.mediaIds) ? { mediaIds: raw.mediaIds } : {}),
    ...(typeof raw.coverImage === "string" ? { coverImage: raw.coverImage } : {}),
    ...(typeof raw.coverUrl === "string" ? { coverUrl: raw.coverUrl } : {}),
  };
};

const StoreCollectionCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useSelector((state: RootState) => state.user.profile);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PUBLIC");
  const [type, setType] = useState<CollectionType>("EVERYBODY");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTypeId, setCategoryTypeId] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [filterSelection, setFilterSelection] = useState<FilterSelection>({});
  const [hasManualFilterEdits, setHasManualFilterEdits] = useState(false);
  const [hasManualTagEdits, setHasManualTagEdits] = useState(false);
  const [hasManualCategoryEdit, setHasManualCategoryEdit] = useState(false);
  const [hasManualSubCategoryEdit, setHasManualSubCategoryEdit] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creationMode, setCreationMode] = useState<"existing" | "new">(
    "existing",
  );

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [primaryProductId, setPrimaryProductId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState<"draft" | "publish" | null>(
    null,
  );
  const [previewProduct, setPreviewProduct] = useState<StoreProduct | null>(
    null,
  );
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  const preselectProductId = searchParams.get("productId");
  const prefillCollectionId = searchParams.get("collectionId");
  const returnMode = searchParams.get("mode");
  const autoCleanupParam = searchParams.get("autoclean");
  const [collectionSessionId, setCollectionSessionId] = useState<string | null>(
    null,
  );
  const [openingProductEditor, setOpeningProductEditor] = useState(false);
  const [sessionDraftProductIds, setSessionDraftProductIds] = useState<
    string[]
  >([]);
  const [sessionFlowProductIds, setSessionFlowProductIds] = useState<string[]>(
    [],
  );
  const [existingCollectionStatus, setExistingCollectionStatus] = useState<
    "DRAFT" | "PUBLISHED" | "ARCHIVED" | null
  >(null);
  const [existingLinkedProductIds, setExistingLinkedProductIds] = useState<
    string[]
  >([]);
  const [queuedDraftProducts, setQueuedDraftProducts] = useState<
    CollectionProductQueueItem[]
  >([]);
  const hydratedSessionRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const hydratedSelectionMetaRef = useRef<Set<string>>(new Set());
  const ensureSessionPromiseRef = useRef<Promise<string> | null>(null);
  const autoCleanupSessionRef = useRef(
    autoCleanupParam === "1" || returnMode === "new" || returnMode === "existing",
  );
  const restoredDraftSnapshotRef = useRef(false);

  const clearSessionFilterCache = useCallback((sessionId?: string | null) => {
    if (!sessionId) return;
    try {
      localStorage.removeItem(`${FILTER_SELECTION_STORAGE_PREFIX}${sessionId}`);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const clearCollectionDraftSnapshot = useCallback(
    (sessionId?: string | null) => {
      if (!sessionId) return;
      try {
        localStorage.removeItem(getCollectionDraftStorageKey(sessionId));
      } catch {
        // Ignore localStorage errors
      }

      try {
        const activeSessionId = localStorage.getItem(
          getActiveCollectionDraftKey(user?.id),
        );
        if (activeSessionId === sessionId) {
          localStorage.removeItem(getActiveCollectionDraftKey(user?.id));
        }
      } catch {
        // Ignore localStorage errors
      }
    },
    [user?.id],
  );

  const navigateAway = useCallback(
    async (target: string | number) => {
      if (typeof target === "number") {
        navigate(target);
        return;
      }
      navigate(target);
    },
    [
      navigate,
    ],
  );

  const resetInvalidCollectionSession = useCallback(
    (invalidSessionId?: string | null) => {
      const targetSessionId = (invalidSessionId || "").trim();
      if (!targetSessionId) return;

      setCollectionSessionId((prev) =>
        prev === targetSessionId ? null : prev,
      );
      hydratedSessionRef.current = null;

      const nextParams = new URLSearchParams(searchParams);
      if (nextParams.get("collectionId") === targetSessionId) {
        nextParams.delete("collectionId");
      }
      if (nextParams.get("mode") === "edit") {
        nextParams.set("mode", "new");
      }
      nextParams.delete("autoclean");
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await brandApi.getCategoriesWithSubCategories(true);
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
            return mapped[0].types[0]?.id ?? "";
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
    if (autoCleanupParam === "1" || returnMode === "new" || returnMode === "existing") {
      autoCleanupSessionRef.current = true;
    }
  }, [autoCleanupParam, returnMode]);

  useEffect(() => {
    if (
      prefillCollectionId ||
      collectionSessionId ||
      !user?.id ||
      restoredDraftSnapshotRef.current
    ) {
      return;
    }

    let snapshot: CollectionDraftSnapshot | null = null;
    try {
      const activeSessionId = localStorage.getItem(
        getActiveCollectionDraftKey(user.id),
      );
      if (!activeSessionId) return;

      const raw = localStorage.getItem(
        getCollectionDraftStorageKey(activeSessionId),
      );
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<CollectionDraftSnapshot>;
      if (!parsed || typeof parsed !== "object") return;
      if (parsed.sessionId !== activeSessionId) return;

      snapshot = {
        sessionId: activeSessionId,
        creationMode: parsed.creationMode === "new" ? "new" : "existing",
        title: typeof parsed.title === "string" ? parsed.title : "",
        description:
          typeof parsed.description === "string" ? parsed.description : "",
        visibility:
          parsed.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
        type:
          parsed.type === "MALE" ||
          parsed.type === "FEMALE" ||
          parsed.type === "EVERYBODY"
            ? parsed.type
            : "EVERYBODY",
        categoryId:
          typeof parsed.categoryId === "string" ? parsed.categoryId : "",
        categoryTypeId:
          typeof parsed.categoryTypeId === "string" ? parsed.categoryTypeId : "",
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        filterSelection:
          parsed.filterSelection && typeof parsed.filterSelection === "object"
            ? parsed.filterSelection
            : {},
        selectedProductIds: Array.isArray(parsed.selectedProductIds)
          ? parsed.selectedProductIds.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [],
        primaryProductId:
          typeof parsed.primaryProductId === "string"
            ? parsed.primaryProductId
            : null,
        sessionDraftProductIds: Array.isArray(parsed.sessionDraftProductIds)
          ? parsed.sessionDraftProductIds.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [],
        sessionFlowProductIds: Array.isArray(parsed.sessionFlowProductIds)
          ? parsed.sessionFlowProductIds.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [],
        existingLinkedProductIds: Array.isArray(parsed.existingLinkedProductIds)
          ? parsed.existingLinkedProductIds.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [],
        hasManualFilterEdits: parsed.hasManualFilterEdits === true,
        hasManualTagEdits: parsed.hasManualTagEdits === true,
        hasManualCategoryEdit: parsed.hasManualCategoryEdit === true,
        hasManualSubCategoryEdit: parsed.hasManualSubCategoryEdit === true,
        updatedAt:
          typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      };
    } catch {
      return;
    }

    if (!snapshot) return;

    restoredDraftSnapshotRef.current = true;
    autoCleanupSessionRef.current = true;

    setCollectionSessionId(snapshot.sessionId);
    setCreationMode(snapshot.creationMode);
    setTitle(snapshot.title);
    setDescription(snapshot.description);
    setVisibility(snapshot.visibility);
    setType(snapshot.type);
    setCategoryId(snapshot.categoryId);
    setCategoryTypeId(snapshot.categoryTypeId);
    setTags(snapshot.tags);
    setFilterSelection(snapshot.filterSelection);
    setSelectedProductIds(snapshot.selectedProductIds);
    setPrimaryProductId(snapshot.primaryProductId);
    setSessionDraftProductIds(snapshot.sessionDraftProductIds);
    setSessionFlowProductIds(snapshot.sessionFlowProductIds);
    setExistingLinkedProductIds(snapshot.existingLinkedProductIds);
    setHasManualFilterEdits(snapshot.hasManualFilterEdits);
    setHasManualTagEdits(snapshot.hasManualTagEdits);
    setHasManualCategoryEdit(snapshot.hasManualCategoryEdit);
    setHasManualSubCategoryEdit(snapshot.hasManualSubCategoryEdit);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("collectionId", snapshot.sessionId);
    nextParams.set("mode", snapshot.creationMode);
    nextParams.set("autoclean", "1");
    setSearchParams(nextParams, { replace: true });

    toast.info("Restored your in-progress collection draft.");
  }, [
    collectionSessionId,
    prefillCollectionId,
    searchParams,
    setSearchParams,
    user?.id,
  ]);

  useEffect(() => {
    if (!collectionSessionId) return;

    const expectedMode = creationMode === "new" ? "new" : "existing";
    const currentCollectionId = searchParams.get("collectionId");
    const currentMode = searchParams.get("mode");
    const currentAutoclean = searchParams.get("autoclean");
    const shouldAutoclean = autoCleanupSessionRef.current;

    const isCollectionSynced = currentCollectionId === collectionSessionId;
    const isModeSynced = currentMode === expectedMode;
    const isAutocleanSynced =
      (shouldAutoclean && currentAutoclean === "1") ||
      (!shouldAutoclean && !currentAutoclean);

    if (isCollectionSynced && isModeSynced && isAutocleanSynced) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("collectionId", collectionSessionId);
    nextParams.set("mode", expectedMode);
    if (shouldAutoclean) {
      nextParams.set("autoclean", "1");
    } else {
      nextParams.delete("autoclean");
    }
    setSearchParams(nextParams, { replace: true });
  }, [
    collectionSessionId,
    creationMode,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!collectionSessionId) {
      hydratedSessionRef.current = null;
      return;
    }
    if (hydratedSessionRef.current === collectionSessionId) return;
    hydratedSessionRef.current = null;
  }, [collectionSessionId]);

  useEffect(() => {
    if (!collectionSessionId) {
      setQueuedDraftProducts([]);
      return;
    }

    setQueuedDraftProducts(getCollectionProductQueueItems(collectionSessionId));
    return subscribeToCollectionProductQueue(collectionSessionId, (items) => {
      setQueuedDraftProducts(items);
    });
  }, [collectionSessionId]);

  useEffect(() => {
    let mounted = true;
    const loadDraftDetails = async () => {
      if (!collectionSessionId) return;
      if (hydratedSessionRef.current === collectionSessionId) return;
      let detail: any = null;
      try {
        detail = await brandApi.getCollectionDetail(collectionSessionId, {
          scope: "store",
        });
      } catch (error: any) {
        if (!mounted) return;
        const statusCode = Number(error?.response?.status);
        if (statusCode === 404 || statusCode === 410) {
          clearCollectionDraftSnapshot(collectionSessionId);
          restoredDraftSnapshotRef.current = false;
          resetInvalidCollectionSession(collectionSessionId);
          toast.warning(
            "The selected collection draft is no longer available. Started a fresh collection session.",
          );
          return;
        }
        toast.error(
          error?.response?.data?.message ?? "Unable to load draft collection.",
        );
        return;
      }
      if (!mounted || !detail) return;
      hydratedSessionRef.current = collectionSessionId;
      setExistingCollectionStatus(
        detail.status === "DRAFT" ||
          detail.status === "PUBLISHED" ||
          detail.status === "ARCHIVED"
          ? detail.status
          : null,
      );

      const links = Array.isArray(detail.products) ? detail.products : [];
      const includeInactiveLinkedProducts = detail.status === "DRAFT";
      const eligibleLinks = links.filter((link: any) => {
        const product = link?.product;
        if (!product || typeof product !== "object") return false;
        if (product.deletedAt || product.archivedAt) return false;
        if (!includeInactiveLinkedProducts && product.isActive === false) {
          return false;
        }
        return true;
      });
      const orderedLinks = [...eligibleLinks].sort((a: any, b: any) => {
        const aOrder =
          typeof a?.orderIndex === "number" ? a.orderIndex : Number.MAX_SAFE_INTEGER;
        const bOrder =
          typeof b?.orderIndex === "number" ? b.orderIndex : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
      const primaryLink = orderedLinks[0] ?? null;
      const linkedIds = orderedLinks
        .map((link: any) =>
          String(link?.product?.id || link?.productId || link?.id || ""),
        )
        .filter(Boolean);
      const linkedProducts = eligibleLinks
        .map((link: any) => normalizeLinkedProduct(link?.product))
        .filter(Boolean) as StoreProduct[];
      setExistingLinkedProductIds(linkedIds);
      const shouldTreatLinkedAsFlowProducts =
        autoCleanupSessionRef.current || returnMode === "new";
      const draftIds = linkedProducts
        .filter((product) => product.isActive === false)
        .map((product) => String(product.id || ""))
        .filter(Boolean);

      if (linkedProducts.length > 0) {
        setProducts((prev) => {
          const merged = new Map(prev.map((product) => [product.id, product]));
          linkedProducts.forEach((product) => {
            const existing = merged.get(product.id);
            if (!existing) {
              merged.set(product.id, product);
              return;
            }
            const metadataScore = (candidate: StoreProduct) => {
              const filterCount = Object.values(candidate.filterSelection ?? {}).reduce(
                (sum, values) =>
                  sum +
                  (Array.isArray(values)
                    ? values.filter((value) => typeof value === "string").length
                    : 0),
                0,
              );
              const hasCategory =
                typeof candidate.categoryId === "string" && candidate.categoryId.length > 0
                  ? 1
                  : 0;
              const hasSubCategory =
                (typeof candidate.subCategoryId === "string" && candidate.subCategoryId.length > 0) ||
                (typeof candidate.categoryTypeId === "string" && candidate.categoryTypeId.length > 0)
                  ? 1
                  : 0;
              const hasTags = Array.isArray(candidate.tags) && candidate.tags.length > 0 ? 1 : 0;
              return filterCount + hasCategory + hasSubCategory + hasTags;
            };

            if (metadataScore(product) > metadataScore(existing)) {
              merged.set(product.id, {
                ...existing,
                ...product,
              });
            }
          });
          return Array.from(merged.values());
        });
      }

      if (linkedIds.length > 0) {
        setSelectedProductIds((prev) =>
          Array.from(new Set([...prev, ...linkedIds])),
        );
        if (shouldTreatLinkedAsFlowProducts) {
          setSessionFlowProductIds((prev) =>
            Array.from(new Set([...prev, ...linkedIds])),
          );
          setCreationMode("new");
        }
        const nextPrimaryId =
          primaryLink?.product?.id || primaryLink?.productId || null;
        if (nextPrimaryId) {
          setPrimaryProductId((prev) => prev ?? String(nextPrimaryId));
        }
      }
      if (draftIds.length > 0) {
        setSessionDraftProductIds((prev) =>
          Array.from(new Set([...prev, ...draftIds])),
        );
        setSessionFlowProductIds((prev) =>
          Array.from(new Set([...prev, ...draftIds])),
        );
        if (shouldTreatLinkedAsFlowProducts) {
          setCreationMode("new");
        }
      }

      if (!preselectProductId && !restoredDraftSnapshotRef.current) {
        setTitle(typeof detail.title === "string" ? detail.title : "");
        setDescription(
          typeof detail.description === "string" ? detail.description : "",
        );
        if (typeof detail.categoryId === "string" && detail.categoryId) {
          setCategoryId(detail.categoryId);
        }
        const hydratedSubCategoryId =
          (detail as any).subCategoryId || detail.categoryTypeId;
        if (
          typeof hydratedSubCategoryId === "string" &&
          hydratedSubCategoryId
        ) {
          setCategoryTypeId(hydratedSubCategoryId);
        }
        if (detail.visibility) setVisibility(detail.visibility);
        if (detail.type) setType(detail.type);
        setTags(
          Array.isArray(detail.tags)
            ? detail.tags.filter((tag: any) => typeof tag === "string")
            : [],
        );

        const detailFilterSelection = normalizeFilterSelectionFromDetail(detail);
        if (Object.keys(detailFilterSelection).length > 0) {
          setFilterSelection(detailFilterSelection);
          try {
            localStorage.setItem(
              `${FILTER_SELECTION_STORAGE_PREFIX}${collectionSessionId}`,
              JSON.stringify(detailFilterSelection),
            );
          } catch {
            // Ignore localStorage errors
          }
        } else {
          try {
            const raw = localStorage.getItem(
              `${FILTER_SELECTION_STORAGE_PREFIX}${collectionSessionId}`,
            );
            if (raw) {
              const parsed = JSON.parse(raw) as FilterSelection;
              if (parsed && typeof parsed === "object") {
                setFilterSelection(parsed);
              }
            }
          } catch {
            // Ignore localStorage errors
          }
        }
      }
    };

    void loadDraftDetails();
    return () => {
      mounted = false;
    };
  }, [
    clearCollectionDraftSnapshot,
    collectionSessionId,
    preselectProductId,
    resetInvalidCollectionSession,
    returnMode,
  ]);

  useEffect(() => {
    if (!collectionSessionId) return;
    try {
      localStorage.setItem(
        `${FILTER_SELECTION_STORAGE_PREFIX}${collectionSessionId}`,
        JSON.stringify(filterSelection),
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [collectionSessionId, filterSelection]);

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
      setProducts((prev) => {
        const merged = new Map(prev.map((product) => [product.id, product]));
        items.forEach((product: StoreProduct) => {
          merged.set(product.id, product);
        });
        return Array.from(merged.values());
      });
    } catch (error: any) {
      setProductsError(
        error?.response?.data?.message ?? "Failed to load products.",
      );
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
    setSessionFlowProductIds((prev) =>
      prev.includes(preselectProductId) ? prev : [...prev, preselectProductId],
    );
    setSelectedProductIds((prev) => {
      if (prev.includes(preselectProductId)) return prev;
      if (prev.length >= MAX_PRODUCTS) return prev;
      return [...prev, preselectProductId];
    });
    setCreationMode("new");

    // Eagerly link the product to the collection in the backend so it persists
    // across navigation (e.g. when user goes to create a second product).
    if (collectionSessionId) {
      addProductsToCollection(collectionSessionId, [preselectProductId]).catch(
        (err) => {
          console.warn(
            "[StoreCollectionCreate] Failed to eagerly link product to collection",
            preselectProductId,
            err,
          );
        },
      );
    }
  }, [preselectProductId, loadProducts, collectionSessionId]);

  useEffect(() => {
    if (returnMode === "new") {
      setCreationMode("new");
    }
  }, [returnMode]);

  useEffect(() => {
    if (!collectionSessionId || !user?.id) return;

    const snapshot: CollectionDraftSnapshot = {
      sessionId: collectionSessionId,
      creationMode,
      title,
      description,
      visibility,
      type,
      categoryId,
      categoryTypeId,
      tags,
      filterSelection,
      selectedProductIds,
      primaryProductId,
      sessionDraftProductIds,
      sessionFlowProductIds,
      existingLinkedProductIds,
      hasManualFilterEdits,
      hasManualTagEdits,
      hasManualCategoryEdit,
      hasManualSubCategoryEdit,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(
        getCollectionDraftStorageKey(collectionSessionId),
        JSON.stringify(snapshot),
      );
      localStorage.setItem(
        getActiveCollectionDraftKey(user.id),
        collectionSessionId,
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [
    categoryId,
    categoryTypeId,
    collectionSessionId,
    creationMode,
    description,
    existingLinkedProductIds,
    filterSelection,
    hasManualCategoryEdit,
    hasManualFilterEdits,
    hasManualSubCategoryEdit,
    hasManualTagEdits,
    primaryProductId,
    selectedProductIds,
    sessionDraftProductIds,
    sessionFlowProductIds,
    tags,
    title,
    type,
    user?.id,
    visibility,
  ]);

  useEffect(() => {
    if (!categoryId) {
      setCategoryTypeId("");
      return;
    }
    const selectedCategory = categories.find(
      (category) => category.id === categoryId,
    );
    if (!selectedCategory) {
      setCategoryTypeId("");
      return;
    }
    if (
      categoryTypeId &&
      selectedCategory.types.some(
        (categoryType) => categoryType.id === categoryTypeId,
      )
    ) {
      return;
    }
    setCategoryTypeId(selectedCategory.types[0]?.id ?? "");
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

  const selectedFilterValueIds = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(filterSelection)
            .flatMap((values) =>
              Array.isArray(values)
                ? values.filter((value): value is string => typeof value === "string")
                : [],
            )
            .filter((value) => value.trim().length > 0),
        ),
      ),
    [filterSelection],
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );
  const categoryTypeOptions = selectedCategory?.types ?? [];

  const handleAddTag = useCallback(() => {
    const raw = tagInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/#/g, "").trim().slice(0, TAG_CHAR_LIMIT);
    if (!cleaned) return;
    setHasManualTagEdits(true);
    setTags((prev) => {
      if (prev.length >= MAX_TAGS) {
        toast.error(`You can add up to ${MAX_TAGS} tags.`);
        return prev;
      }
      if (prev.some((t) => t.toLowerCase() === cleaned.toLowerCase()))
        return prev;
      return [...prev, cleaned];
    });
    setTagInput("");
  }, [tagInput]);

  const handleTagKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setHasManualTagEdits(true);
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  }, []);

  const handleFilterSelectionChange = useCallback((next: FilterSelection) => {
    setHasManualFilterEdits(true);
    setFilterSelection(next);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(q));
  }, [products, search]);

  const sessionProducts = useMemo(
    () => products.filter((p) => sessionFlowProductIds.includes(p.id)),
    [products, sessionFlowProductIds],
  );

  const queuedSessionProducts = useMemo(
    () =>
      queuedDraftProducts.filter(
        (item) => !item.productId || sessionFlowProductIds.includes(item.productId),
      ),
    [queuedDraftProducts, sessionFlowProductIds],
  );

  const queuedSessionProductsVisible = useMemo(
    () =>
      queuedSessionProducts.filter((item) => {
        if (!item.productId) return true;
        if (item.status !== "ready") return true;
        return !sessionProducts.some((product) => product.id === item.productId);
      }),
    [queuedSessionProducts, sessionProducts],
  );

  const visibleProducts = useMemo(() => {
    if (creationMode === "new") {
      return sessionProducts;
    }
    return filteredProducts.filter(
      (p) => p.isActive !== false && !sessionFlowProductIds.includes(p.id),
    );
  }, [creationMode, filteredProducts, sessionFlowProductIds, sessionProducts]);

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

  const queuedDraftProductsByTempId = useMemo(
    () => new Map(queuedDraftProducts.map((item) => [item.tempId, item])),
    [queuedDraftProducts],
  );

  const queuedDraftProductsByProductId = useMemo(() => {
    const byProductId = new Map<string, CollectionProductQueueItem>();
    queuedDraftProducts.forEach((item) => {
      if (item.productId) {
        byProductId.set(item.productId, item);
      }
    });
    return byProductId;
  }, [queuedDraftProducts]);

  useEffect(() => {
    if (!collectionSessionId || queuedDraftProducts.length === 0) return;

    const pendingTempIds = queuedDraftProducts
      .filter((item) => !item.productId || item.status !== "ready")
      .map((item) => item.tempId);

    if (pendingTempIds.length > 0) {
      setSelectedProductIds((prev) =>
        Array.from(new Set([...prev, ...pendingTempIds])),
      );
    }

    const readyItems = queuedDraftProducts.filter(
      (item) => item.status === "ready" && typeof item.productId === "string",
    );
    if (readyItems.length === 0) return;

    let replacedTempIds = false;
    setSelectedProductIds((prev) => {
      let next = [...prev];
      readyItems.forEach((item) => {
        if (!item.productId) return;
        if (next.includes(item.tempId)) {
          replacedTempIds = true;
        }
        next = next.map((id) => (id === item.tempId ? item.productId! : id));
      });
      return Array.from(new Set(next));
    });

    setSessionFlowProductIds((prev) => {
      let next = [...prev];
      readyItems.forEach((item) => {
        if (!item.productId) return;
        next = next.filter((id) => id !== item.tempId);
        if (!next.includes(item.productId)) {
          next.push(item.productId);
        }
      });
      return next;
    });

    setSessionDraftProductIds((prev) => {
      let next = [...prev];
      readyItems.forEach((item) => {
        if (!item.productId) return;
        next = next.filter((id) => id !== item.tempId);
        if (!next.includes(item.productId)) {
          next.push(item.productId);
        }
      });
      return next;
    });

    if (replacedTempIds) {
      void loadProducts();
    }

    readyItems.forEach((item) => {
      removeCollectionProductQueueItem(collectionSessionId, item.tempId);
    });
  }, [collectionSessionId, loadProducts, queuedDraftProducts]);

  const collectionProducts = useMemo(
    () =>
      selectedProductIds.map((selectedId): CollectionProductEntry => {
        const product = products.find((candidate) => candidate.id === selectedId) ?? null;
        const queuedByTempId = queuedDraftProductsByTempId.get(selectedId) ?? null;
        const queuedByProductId = queuedDraftProductsByProductId.get(selectedId) ?? null;
        const queueItem = queuedByTempId ?? queuedByProductId;

        if (queueItem) {
          return {
            id: selectedId,
            type: queueItem.type,
            status: queueItem.status,
            product,
            queueItem,
          };
        }

        return {
          id: selectedId,
          type: sessionDraftProductIds.includes(selectedId) ? "draft" : "existing",
          status: product ? "ready" : "processing",
          product,
          queueItem: null,
        };
      }),
    [
      products,
      queuedDraftProductsByProductId,
      queuedDraftProductsByTempId,
      selectedProductIds,
      sessionDraftProductIds,
    ],
  );

  const selectedProducts = useMemo(
    () =>
      collectionProducts
        .map((entry) => entry.product)
        .filter((product): product is StoreProduct => product !== null),
    [collectionProducts],
  );

  const nonReadyCollectionProducts = useMemo(
    () => collectionProducts.filter((entry) => entry.status !== "ready"),
    [collectionProducts],
  );

  const readySelectedProductIds = useMemo(
    () =>
      collectionProducts
        .filter((entry) => entry.status === "ready" && entry.product)
        .map((entry) => entry.product!.id),
    [collectionProducts],
  );

  useEffect(() => {
    const selectedProductMap = new Map(products.map((product) => [product.id, product]));
    const hasRenderableMedia = (product: StoreProduct) => {
      if (typeof (product as any)?.coverImage === "string" && (product as any).coverImage.trim()) {
        return true;
      }
      if (typeof (product as any)?.coverUrl === "string" && (product as any).coverUrl.trim()) {
        return true;
      }
      if (typeof product.thumbnail === "string" && product.thumbnail.trim()) {
        return true;
      }
      if (Array.isArray(product.images) && product.images.some((value) => typeof value === "string" && value.trim().length > 0)) {
        return true;
      }
      const media = (product as any)?.media;
      if (
        Array.isArray(media) &&
        media.some(
          (item: any) =>
            (typeof item?.url === "string" && item.url.trim().length > 0) ||
            (typeof item?.id === "string" && item.id.trim().length > 0),
        )
      ) {
        return true;
      }
      const mediaIds = (product as any)?.mediaIds;
      return (
        Array.isArray(mediaIds) &&
        mediaIds.some((value: unknown) => typeof value === "string" && value.trim().length > 0)
      );
    };

    const missingMetadataIds = selectedProductIds.filter((productId) => {
      if (hydratedSelectionMetaRef.current.has(productId)) return false;
      if (queuedDraftProductsByTempId.has(productId)) return false;
      const queuedProduct = queuedDraftProductsByProductId.get(productId);
      if (queuedProduct && queuedProduct.status !== "ready") return false;
      const product = selectedProductMap.get(productId);
      if (!product) return true;
      const filterSelection = normalizeFilterSelectionFromProduct(product);
      const hasFilterSelection = Object.keys(filterSelection).length > 0;
      const hasFilterRows = Array.isArray(product.filters) && product.filters.length > 0;
      const hasFilterValueIds =
        Array.isArray(product.filterValueIds) && product.filterValueIds.length > 0;
      const hasHydratedMedia = hasRenderableMedia(product);
      return !(hasFilterSelection || hasFilterRows || hasFilterValueIds) || !hasHydratedMedia;
    });

    if (missingMetadataIds.length === 0) return;

    let mounted = true;
    const hydrateMissingMetadata = async () => {
      const hydrated: StoreProduct[] = [];

      for (const productId of missingMetadataIds) {
        hydratedSelectionMetaRef.current.add(productId);
        try {
          const detail = await productApi.getProduct(productId);
          const normalized = normalizeLinkedProduct(detail);
          if (normalized) hydrated.push(normalized);
        } catch {
          // hydration fetch failed – ignore this product
        }
      }

      if (!mounted || hydrated.length === 0) return;

      setProducts((prev) => {
        const byId = new Map(prev.map((product) => [product.id, product]));
        hydrated.forEach((product) => {
          const existing = byId.get(product.id);
          byId.set(product.id, existing ? { ...existing, ...product } : product);
        });
        return Array.from(byId.values());
      });
    };

    void hydrateMissingMetadata();
    return () => {
      mounted = false;
    };
  }, [
    products,
    queuedDraftProductsByProductId,
    queuedDraftProductsByTempId,
    selectedProductIds,
  ]);

  useEffect(() => {
    // When all products are deselected, clear auto-derived fields
    if (selectedProducts.length === 0) {
      if (!hasManualFilterEdits) {
        setFilterSelection((prev) =>
          Object.keys(prev).length === 0 ? prev : {},
        );
      }
      if (!hasManualTagEdits) {
        setTags((prev) => (prev.length === 0 ? prev : []));
      }
      return;
    }

    // TAGS: re-derive from selected products (replace, not merge)
    if (!hasManualTagEdits) {
      const productTags = Array.from(
        new Set(
          selectedProducts.flatMap((product) =>
            Array.isArray(product.tags)
              ? product.tags.filter(
                  (tag): tag is string =>
                    typeof tag === "string" && tag.trim().length > 0,
                )
              : [],
          ),
        ),
      ).slice(0, MAX_TAGS);
      setTags((prev) => {
        if (
          productTags.length === prev.length &&
          productTags.every((t, i) => t === prev[i])
        ) {
          return prev;
        }
        return productTags;
      });
    }

    // FILTERS: always re-derive from products if user hasn't manually edited
    if (!hasManualFilterEdits) {
      const inferredSelection: FilterSelection = {};
      selectedProducts.forEach((product) => {
        const fromProduct = normalizeFilterSelectionFromProduct(product as any);
        console.debug(
          "[FilterDerivation] product", product.id,
          "| filterSelection:", (product as any).filterSelection,
          "| filters:", (product as any).filters,
          "| filterValueIds:", (product as any).filterValueIds,
          "| normalized:", fromProduct,
        );
        Object.entries(fromProduct).forEach(([dimensionId, valueIds]) => {
          const current = inferredSelection[dimensionId] ?? [];
          inferredSelection[dimensionId] = Array.from(
            new Set([...current, ...valueIds]),
          );
        });
      });
      console.debug(
        "[FilterDerivation] inferred:", inferredSelection,
        "| selectedProducts.length:", selectedProducts.length,
        "| hasManualFilterEdits:", hasManualFilterEdits,
      );
      setFilterSelection((prev) => {
        const equal = areFilterSelectionsEqual(prev, inferredSelection);
        console.debug(
          "[FilterDerivation] prev:", prev,
          "| equal:", equal,
          "| will update:", !equal,
        );
        if (equal) return prev;
        return inferredSelection;
      });
    }

    // CATEGORY: use majority-vote from selected products
    // Backend returns categoryType.categoryId (nested), not top-level categoryId
    if (!hasManualCategoryEdit) {
      const categoryCounts = new Map<string, number>();
      selectedProducts.forEach((product) => {
        const catId =
          (typeof product.categoryId === "string" && product.categoryId) ||
          (typeof product.categoryType?.categoryId === "string" &&
            product.categoryType.categoryId) ||
          "";
        if (catId) {
          categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
        }
      });
      if (categoryCounts.size > 0) {
        const bestCategory = [...categoryCounts.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0][0];
        setCategoryId((prev) => (prev === bestCategory ? prev : bestCategory));
      }
    }

    // SUB-CATEGORY: use majority-vote from selected products
    if (!hasManualSubCategoryEdit) {
      const subCategoryCounts = new Map<string, number>();
      selectedProducts.forEach((product) => {
        const subCatId =
          (typeof product.subCategoryId === "string" && product.subCategoryId) ||
          (typeof product.categoryTypeId === "string" && product.categoryTypeId) ||
          "";
        if (subCatId) {
          subCategoryCounts.set(
            subCatId,
            (subCategoryCounts.get(subCatId) ?? 0) + 1,
          );
        }
      });
      if (subCategoryCounts.size > 0) {
        const bestSubCategory = [...subCategoryCounts.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0][0];
        setCategoryTypeId((prev) =>
          prev === bestSubCategory ? prev : bestSubCategory,
        );
      }
    }

    // TYPE (gender): infer from products if not manually set
    const genderCounts = new Map<string, number>();
    selectedProducts.forEach((product) => {
      const g = product.gender;
      if (g) genderCounts.set(g, (genderCounts.get(g) ?? 0) + 1);
    });
    if (genderCounts.size > 0) {
      const uniqueGenders = [...genderCounts.keys()];
      const inferredType =
        uniqueGenders.length === 1
          ? (uniqueGenders[0] === "MALE"
              ? "MALE"
              : uniqueGenders[0] === "FEMALE"
                ? "FEMALE"
                : "EVERYBODY")
          : "EVERYBODY";
      if (inferredType !== "EVERYBODY") {
        setType((prev) =>
          prev === "EVERYBODY" ? (inferredType as CollectionType) : prev,
        );
      }
    }
  }, [selectedProducts, hasManualTagEdits, hasManualFilterEdits, hasManualCategoryEdit, hasManualSubCategoryEdit]);

  const orderedSelectedProductIds = useMemo(() => {
    if (
      !primaryProductId ||
      !readySelectedProductIds.includes(primaryProductId)
    ) {
      return readySelectedProductIds;
    }
    return [
      primaryProductId,
      ...readySelectedProductIds.filter((id) => id !== primaryProductId),
    ];
  }, [primaryProductId, readySelectedProductIds]);

  const hasPrimarySelection = Boolean(
    primaryProductId && readySelectedProductIds.includes(primaryProductId),
  );

  const hasPendingSelectedProducts = nonReadyCollectionProducts.length > 0;

  const isExistingCollectionEditMode = useMemo(
    () =>
      Boolean(
        prefillCollectionId &&
        existingCollectionStatus &&
        existingCollectionStatus !== "DRAFT",
      ),
    [existingCollectionStatus, prefillCollectionId],
  );
  const isDraftCollectionEditMode = useMemo(
    () => Boolean(prefillCollectionId && existingCollectionStatus === "DRAFT"),
    [existingCollectionStatus, prefillCollectionId],
  );

  const hasAnyMedia = useMemo(
    () =>
      selectedProducts.some((p) => {
        const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
        return Boolean(p.thumbnail) || images.length > 0;
      }),
    [selectedProducts],
  );

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= MAX_PRODUCTS) {
        toast.error(
          `Collections can contain a maximum of ${MAX_PRODUCTS} products.`,
        );
        return prev;
      }
      return [...prev, productId];
    });
  }, []);

  const handleSetPrimary = useCallback(
    (productId: string) => {
      if (!readySelectedProductIds.includes(productId)) {
        toast.error("Select this product first before setting it as primary.");
        return;
      }
      setPrimaryProductId(productId);
    },
    [readySelectedProductIds],
  );

  useEffect(() => {
    if (
      readySelectedProductIds.length === 0 ||
      !primaryProductId ||
      !readySelectedProductIds.includes(primaryProductId)
    ) {
      if (primaryProductId !== null) setPrimaryProductId(null);
    }
  }, [primaryProductId, readySelectedProductIds]);

  const ensureCollectionSession = useCallback(async () => {
    if (collectionSessionId) {
      return collectionSessionId;
    }

    if (!ensureSessionPromiseRef.current) {
      ensureSessionPromiseRef.current = (async () => {
        const init = await initializeStoreCollection({
          mode: creationMode === "new" ? "new-individual" : "existing",
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          visibility,
          categoryId: categoryId || undefined,
          categoryTypeId: categoryTypeId || undefined,
          type,
          tags: normalizedTags,
          isAvailableInStore: true,
          subCategoryId: categoryTypeId || undefined,
        });
        autoCleanupSessionRef.current = true;
        setCollectionSessionId(init.sessionId);
        return init.sessionId;
      })();
    }

    try {
      return await ensureSessionPromiseRef.current;
    } finally {
      ensureSessionPromiseRef.current = null;
    }
  }, [
    categoryId,
    categoryTypeId,
    collectionSessionId,
    creationMode,
    description,
    normalizedTags,
    title,
    type,
    visibility,
  ]);

  useEffect(() => {
    if (creationMode !== "new" || collectionSessionId) {
      return;
    }

    void ensureCollectionSession().catch(() => {
      // Ignore warm-up errors; explicit button click still surfaces failures.
    });
  }, [collectionSessionId, creationMode, ensureCollectionSession]);

  const openCollectionProductEditor = async (productId?: string) => {
    setOpeningProductEditor(true);
    try {
      const sessionId = await ensureCollectionSession();
      const mode = creationMode === "new" ? "new" : "existing";
      const returnPath = `/studio/store/collections/new?collectionId=${sessionId}&mode=${mode}${
        autoCleanupSessionRef.current ? "&autoclean=1" : ""
      }`;
      const basePath = productId
        ? `/studio/store/products/${productId}/edit`
        : "/studio/store/products/new";
      navigate(
        `${basePath}?returnTo=${encodeURIComponent(returnPath)}&returnContext=collection&collectionId=${sessionId}`,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "Failed to start product flow for this collection.",
      );
    } finally {
      setOpeningProductEditor(false);
    }
  };

  const handleSubmit = async (action: "publish" | "draft") => {
    if (submitLockRef.current || submitting) return;

    if (!title.trim()) {
      toast.error("Please enter a collection title.");
      return;
    }

    if (selectedProductIds.length > MAX_PRODUCTS) {
      toast.error(
        `Collections can contain a maximum of ${MAX_PRODUCTS} products.`,
      );
      return;
    }

    if (hasPendingSelectedProducts) {
      toast.error(
        "Wait for all selected products to finish processing before continuing.",
      );
      return;
    }

    if (readySelectedProductIds.length > 0 && !hasPrimarySelection) {
      toast.error("Please choose a primary product before continuing.");
      return;
    }

    if (action === "publish") {
      if (!categoryId) {
        toast.error("Choose what this item is.");
        return;
      }
      if (!categoryTypeId) {
        toast.error("Choose a garment type.");
        return;
      }
      if (!type) {
        toast.error("Choose who this item is for.");
        return;
      }
      if (selectedFilterValueIds.length === 0) {
        toast.error("Add at least one style detail.");
        return;
      }
      if (normalizedTags.length === 0) {
        toast.error("Add at least one hashtag.");
        return;
      }
      if (readySelectedProductIds.length === 0) {
        toast.error("Select at least one product to go live.");
        return;
      }
      if (!hasAnyMedia) {
        toast.error("At least one selected product needs an image to go live.");
        return;
      }
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitAction(action);
    try {
      const sessionId = await ensureCollectionSession();
      try {
        localStorage.setItem(
          `${FILTER_SELECTION_STORAGE_PREFIX}${sessionId}`,
          JSON.stringify(filterSelection),
        );
      } catch {
        // Ignore localStorage errors
      }
      const metadataPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        type,
        categoryId: categoryId || undefined,
        categoryTypeId: categoryTypeId || undefined,
        tags: normalizedTags,
        filterValueIds: selectedFilterValueIds,
        isAvailableInStore: true,
        subCategoryId: categoryTypeId || undefined,
      };

      if (isExistingCollectionEditMode) {
        const updatedResponse = await apiClient.patch(
          `/store-collections/${sessionId}`,
          metadataPayload,
        );
        const updated = unwrapApiResponse<any>(updatedResponse.data);
        if (!updated) {
          toast.error("Failed to update collection metadata.");
          return;
        }

        const previousIds = existingLinkedProductIds;
        const nextIds = orderedSelectedProductIds;
        const previousSet = new Set(previousIds);
        const nextSet = new Set(nextIds);

        const toRemove = previousIds.filter(
          (productId) => !nextSet.has(productId),
        );
        const toAdd = nextIds.filter(
          (productId) => !previousSet.has(productId),
        );

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
        autoCleanupSessionRef.current = false;
        clearSessionFilterCache(sessionId);
        clearCollectionDraftSnapshot(sessionId);
        toast.success("Collection updated.");
        navigate("/studio/store?view=collections");
        return;
      }

      if (isDraftCollectionEditMode) {
        const previousIds = existingLinkedProductIds;
        const nextIds = orderedSelectedProductIds;
        const previousSet = new Set(previousIds);
        const nextSet = new Set(nextIds);

        const toRemove = previousIds.filter(
          (productId) => !nextSet.has(productId),
        );
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
      } else if (orderedSelectedProductIds.length > 0) {
        await addProductsToCollection(sessionId, orderedSelectedProductIds);
      }

      await finalizeStoreCollection(sessionId, {
        action,
        collectionMetadata: metadataPayload,
      });

      // Clean up session-drafted products that were NOT selected for this
      // collection. These products were created during the flow but the user
      // decided not to include them.
      const selectedSet = new Set(orderedSelectedProductIds);
      const orphanedDraftIds = sessionDraftProductIds.filter(
        (id) => !selectedSet.has(id),
      );
      if (orphanedDraftIds.length > 0) {
        await Promise.allSettled(
          orphanedDraftIds.map((id) => productApi.deleteProduct(id)),
        );
      }

      autoCleanupSessionRef.current = false;
      clearSessionFilterCache(sessionId);
      clearCollectionDraftSnapshot(sessionId);
      toast.success(
        action === "publish" ? "Collection is live." : "Draft saved.",
      );
      navigate("/studio/store?view=collections");
    } catch (error: any) {
      const rawMessage = error?.response?.data?.message;
      if (rawMessage && typeof rawMessage === "object") {
        const code = rawMessage?.code;
        const message = rawMessage?.message;
        if (code === "COLLECTION_MAX_MEMBERSHIP") {
          toast.error("One or more products already belong to 3 collections.");
          setSubmitting(false);
          return;
        }
        if (typeof message === "string" && message.length) {
          toast.error(message);
          setSubmitting(false);
          return;
        }
      }
      toast.error(
        mapCreatorMetadataError(
          error?.response?.data?.message,
          isExistingCollectionEditMode
            ? "Failed to update collection."
            : action === "publish"
              ? "Failed to go live with collection."
              : "Failed to save draft.",
        ),
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      setSubmitAction(null);
    }
  };

  const formatCurrency = (price?: number | null) => {
    if (!price && price !== 0) return "-";
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(price);
    } catch {
      return `NGN ${price}`;
    }
  };

  const isLikelyFileId = useCallback((value?: string | null) =>
    Boolean(value) &&
    !value!.includes("://") &&
    !value!.startsWith("http") &&
    !value!.startsWith("/") &&
    !value!.includes("/"), []);

  const resolveImageCandidate = useCallback((value?: string | null) => {
    if (typeof value !== "string") {
      return { src: null as string | null, fileId: null as string | null };
    }
    const normalized = value.trim();
    if (!normalized) {
      return { src: null as string | null, fileId: null as string | null };
    }
    if (isLikelyFileId(normalized)) {
      return { src: null as string | null, fileId: normalized };
    }
    // Keep remote URLs and raw storage keys as src so ImageWithFallback can
    // resolve signed URLs for keys containing path segments.
    return { src: normalized, fileId: null as string | null };
  }, [isLikelyFileId]);

  const getProductImage = (product: StoreProduct) => {
    const cover =
      typeof (product as any)?.coverImage === "string"
        ? ((product as any).coverImage as string)
        : typeof (product as any)?.coverUrl === "string"
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
    const resolvedImage = resolveImageCandidate(
      primaryMedia?.url ?? fallbackImage ?? null,
    );

    const mediaIds = Array.isArray((product as any)?.mediaIds)
      ? ((product as any).mediaIds as string[])
      : [];

    const primaryId =
      typeof primaryMedia?.id === "string" && isLikelyFileId(primaryMedia.id)
        ? primaryMedia.id
        : null;
    const fallbackId = mediaIds.find((id) => isLikelyFileId(id)) ?? null;
    const resolvedFileId = primaryId ?? fallbackId ?? null;

    if (resolvedImage.src) {
      return {
        src: resolvedImage.src,
        fileId: null,
      };
    }

    return {
      src: null,
      fileId: resolvedImage.fileId ?? resolvedFileId,
    };
  };

  const getProductPreviewSources = useCallback((product: StoreProduct) => {
    const media = (product as any)?.media as
      | Array<{ id?: string; url?: string; isPrimary?: boolean }>
      | undefined;
    const mediaIds = Array.isArray((product as any)?.mediaIds)
      ? ((product as any).mediaIds as string[])
      : [];
    const cover =
      typeof (product as any)?.coverImage === "string"
        ? ((product as any).coverImage as string)
        : typeof (product as any)?.coverUrl === "string"
          ? ((product as any).coverUrl as string)
          : null;
    const imageValues = [
      cover,
      product.thumbnail,
      ...(Array.isArray(product.images) ? product.images : []),
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );

    const entries: Array<{
      src: string | null;
      fileId: string | null;
      key: string;
    }> = [];
    const seen = new Set<string>();
    const pushEntry = (
      src: string | null,
      fileId: string | null,
      keyPrefix: string,
    ) => {
      if (!src && !fileId) return;
      const dedupeKey = `${src ?? ""}|${fileId ?? ""}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      entries.push({ src, fileId, key: `${keyPrefix}-${dedupeKey}` });
    };

    const orderedMedia = Array.isArray(media)
      ? [...media].sort(
          (a, b) =>
            Number(Boolean(b?.isPrimary)) - Number(Boolean(a?.isPrimary)),
        )
      : [];

    orderedMedia.forEach((item, index) => {
      const rawUrl = typeof item?.url === "string" ? item.url : null;
      const mediaId =
        typeof item?.id === "string" && isLikelyFileId(item.id)
          ? item.id
          : null;
      if (rawUrl) {
        const resolved = resolveImageCandidate(rawUrl);
        pushEntry(
          resolved.src,
          resolved.src ? null : (resolved.fileId ?? mediaId),
          `media-${index}`,
        );
        return;
      }
      pushEntry(null, mediaId, `media-${index}`);
    });

    // Only use imageValues / mediaIds as fallbacks when the authoritative
    // media[] array produced no entries. These secondary sources often
    // contain duplicate representations of the same uploads, inflating the
    // displayed image count.
    if (entries.length === 0) {
      imageValues.forEach((value, index) => {
        const resolved = resolveImageCandidate(value);
        pushEntry(
          resolved.src,
          resolved.fileId,
          `fallback-${index}`,
        );
      });

      mediaIds.forEach((id, index) => {
        if (!isLikelyFileId(id)) return;
        pushEntry(null, id, `media-id-${index}`);
      });
    }

    return entries;
  }, [isLikelyFileId, resolveImageCandidate]);

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

  const renderProductSelectionCard = (
    product: StoreProduct,
    options?: {
      showLinkedBadge?: boolean;
      showSessionBadge?: boolean;
    },
  ) => {
    const image = getProductImageSource(product);
    const selected = selectedProductIds.includes(product.id);
    const isPrimary = primaryProductId === product.id;
    const isSession = sessionFlowProductIds.includes(product.id);
    const isLinked = existingLinkedProductIds.includes(product.id);

    const showLinkedBadge = options?.showLinkedBadge ?? isLinked;
    const showSessionBadge = options?.showSessionBadge ?? isSession;

    const actionButtonBase =
      "h-7 w-full rounded-md px-1.5 text-[10px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

    return (
      <article
        key={product.id}
        onClick={() => toggleProduct(product.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleProduct(product.id);
          }
        }}
        role="button"
        aria-pressed={selected}
        tabIndex={0}
        className={`group relative rounded-lg border p-2.5 text-left transition-all duration-200 cursor-pointer ${
          selected
            ? "border-purple-300 bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:border-purple-400/60 dark:from-purple-600/20 dark:via-fuchsia-600/10 dark:to-pink-600/10 shadow-lg shadow-purple-500/10"
            : "surface-card hover:border-purple-300/70 hover:shadow-md"
        }`}
      >
        <div className="relative mb-2 aspect-[5/4] w-full overflow-hidden rounded-lg border border-theme bg-theme-muted">
          {selected && (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              Selected
            </span>
          )}
          {image.src || image.fileId ? (
            <ImageWithFallback
              src={image.src}
              fileId={image.fileId}
              alt={product.name}
              fit="cover"
              className="h-full w-full object-cover"
              containerClassName="h-full w-full"
              rounded="none"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-theme-secondary">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="min-w-0">
            <p className="line-clamp-1 text-xs font-semibold text-theme">
              {product.name}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
              <p className="font-semibold text-theme">
                {formatCurrency(product.price)}
              </p>
              <p className="text-theme-secondary">
                Stock:{" "}
                {typeof product.totalStock === "number"
                  ? product.totalStock
                  : "-"}
              </p>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            {isPrimary && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                Primary cover
              </span>
            )}
            {showLinkedBadge && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                Already in collection
              </span>
            )}
            {showSessionBadge && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                New / Collection Flow
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleProduct(product.id);
            }}
            className={`${actionButtonBase} ${
              selected
                ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-sm"
                : "surface-control surface-interactive-hover"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleSetPrimary(product.id);
            }}
            disabled={!selected}
            className={`${actionButtonBase} ${
              isPrimary
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm"
                : selected
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "surface-control-muted cursor-not-allowed"
            }`}
          >
            {isPrimary ? "Primary" : "Set Primary"}
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewImageIndex(0);
              setPreviewProduct(product);
            }}
            className={`${actionButtonBase} bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm`}
          >
            View
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void openCollectionProductEditor(product.id);
            }}
            disabled={openingProductEditor}
            className={`${actionButtonBase} bg-violet-600 text-white hover:bg-violet-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-60`}
          >
            Edit
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-8">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-theme-secondary"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          onClick={() => void navigateAway("/studio")}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Studio
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => void navigateAway("/studio/store")}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Store
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={() => void navigateAway("/studio/store?view=collections")}
          className="font-medium hover:text-purple-600 dark:hover:text-purple-300"
        >
          Manage Collections
        </button>
        <span>/</span>
        <span className="font-semibold text-theme">
          {isExistingCollectionEditMode ? "Edit Collection" : "New Collection"}
        </span>
      </nav>

      <div className="surface-card relative overflow-hidden rounded-3xl border p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-purple-400/20 via-fuchsia-300/10 to-transparent blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-300/20 via-purple-300/10 to-transparent blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold">
            Store Collections
          </p>
          <h1 className="text-2xl font-bold text-theme">
            {isExistingCollectionEditMode
              ? "Edit Collection"
              : "Create Collection"}
          </h1>
          <p className="text-sm text-theme-secondary">
            {isExistingCollectionEditMode
              ? `Update metadata, product membership, and primary product order for this collection.`
              : `Select up to ${MAX_PRODUCTS} products and take a store collection live.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="surface-card rounded-2xl border p-6">
            <h2 className="text-base font-semibold text-theme">
              How would you like to build this collection?
            </h2>
            <p className="text-sm text-theme-secondary mt-1">
              Start with existing products or create new items before
              going live.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreationMode("existing")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  creationMode === "existing"
                    ? "border-purple-500 bg-purple-50/70 dark:bg-purple-500/10"
                    : "border-theme hover:border-purple-300"
                }`}
              >
                <div className="text-sm font-semibold text-theme">
                  From Existing Products
                </div>
                <div className="text-xs text-theme-secondary mt-1">
                  Select from your existing store products.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("new")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  creationMode === "new"
                    ? "border-purple-500 bg-purple-50/70 dark:bg-purple-500/10"
                    : "border-theme hover:border-purple-300"
                }`}
              >
                <div className="text-sm font-semibold text-theme">
                  Create New Products
                </div>
                <div className="text-xs text-theme-secondary mt-1">
                  Create products and add them directly into this collection.
                </div>
              </button>
            </div>
          </div>

          <div className="surface-card relative overflow-hidden rounded-2xl border p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400" />
            <div className="flex items-center justify-between mb-4 relative">
              <h2 className="text-lg font-semibold text-theme">
                Products
              </h2>
              <span className="text-xs font-semibold text-theme-secondary">
                Selected {selectedProductIds.length}/{MAX_PRODUCTS}
              </span>
            </div>
            {isExistingCollectionEditMode &&
              existingLinkedProductIds.length > 0 && (
                <div className="mb-4 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {existingLinkedProductIds.length} product(s) are already
                  linked to this collection. They are pinned first and marked
                  below.
                </div>
              )}
            {readySelectedProductIds.length > 0 && !hasPrimarySelection && (
              <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
                Choose one selected product as the primary product before you
                can save or go live.
              </div>
            )}
            {hasPendingSelectedProducts && (
              <div className="mb-4 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-xs font-semibold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300">
                Collection save is disabled until all selected products are ready.
              </div>
            )}

            {creationMode === "existing" ? (
              <SearchField
                placeholder="Search products..."
                value={search}
                onChange={setSearch}
                showFilter={false}
                collapsible={false}
                className="!max-w-none"
              />
            ) : (
              <div className="surface-subtle rounded-xl border border-dashed p-4">
                <p className="text-sm text-theme-secondary">
                  Add products directly to this collection. Product-level draft
                  save is disabled in this flow.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openCollectionProductEditor()}
                    disabled={openingProductEditor}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {openingProductEditor ? "Opening product editor..." : "Create a Product"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.info("Bulk upload is coming soon.");
                    }}
                    className="surface-control surface-interactive-hover rounded-lg border px-4 py-2 text-xs font-semibold"
                  >
                    Bulk Upload (Soon)
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadProducts()}
                    className="surface-control surface-interactive-hover rounded-lg border px-4 py-2 text-xs font-semibold"
                  >
                    Refresh Products
                  </button>
                </div>
              </div>
            )}

            {creationMode === "existing" && (
              <>
                {productsLoading ? (
                  <div className="py-10 text-sm text-gray-500">
                    Loading products...
                  </div>
                ) : productsError ? (
                  <div className="py-10 text-sm text-red-500">
                    {productsError}
                  </div>
                ) : visibleProducts.length === 0 ? (
                  <div className="py-10 text-sm text-gray-500">
                    No products found.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {displayedProducts.map((product) =>
                      renderProductSelectionCard(product),
                    )}
                  </div>
                )}
              </>
            )}

            {creationMode === "new" && (
              <>
                {sessionProducts.length === 0 &&
                queuedSessionProductsVisible.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-theme bg-gray-50/60 dark:bg-white/5 p-6 text-sm text-theme-secondary">
                    No new products added yet. Use "Create a Product" to add
                    items to this collection.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {sessionProducts.map((product) =>
                      renderProductSelectionCard(product, {
                        showLinkedBadge: false,
                        showSessionBadge: true,
                      }),
                    )}
                    {queuedSessionProductsVisible.map((queuedItem) => (
                      <div
                        key={queuedItem.tempId}
                        className="rounded-xl border border-sky-200/70 dark:border-sky-400/30 bg-sky-50/70 dark:bg-sky-500/10 p-3 text-xs"
                      >
                        <p className="font-semibold text-sky-700 dark:text-sky-300 line-clamp-1">
                          {queuedItem.name || "New Product"}
                        </p>
                        <p className="mt-1 text-sky-600/90 dark:text-sky-200/90 capitalize">
                          {queuedItem.status === "uploading"
                            ? "Uploading media..."
                            : queuedItem.status === "processing"
                              ? "Processing draft..."
                              : queuedItem.status === "failed"
                                ? "Failed to add"
                                : "Ready"}
                        </p>
                        {queuedItem.error && (
                          <p className="mt-2 text-[11px] text-red-600 dark:text-red-300 line-clamp-2">
                            {queuedItem.error}
                          </p>
                        )}
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => toggleProduct(queuedItem.tempId)}
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="space-y-6 lg:sticky lg:top-4 self-start">
          <div className="relative overflow-hidden rounded-2xl border border-purple-100/70 dark:border-white/10 bg-white/90 dark:bg-white/5 p-6 space-y-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
            <h2 className="text-lg font-semibold text-theme relative">
              Collection Details
            </h2>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">
                  Collection Metadata
                </p>
                <span className="text-[10px] font-medium text-gray-400">
                  Complete all fields
                </span>
              </div>
              <div className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                      Title
                      <InfoTooltip text="The name of your store collection (e.g., 'Holiday Drop', 'Summer Capsule')." />
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Holiday Drop"
                      className="w-full rounded-lg border border-theme bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-theme"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                      Description
                      <InfoTooltip text="A brief summary of this collection's theme, season, or purpose." />
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short description"
                      className="w-full rounded-lg border border-theme bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-theme"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                        What is it?
                        <InfoTooltip text="Choose the garment family this collection is built around." />
                      </label>
                      <Select
                        value={categoryId}
                        onChange={(e) => {
                          setHasManualCategoryEdit(true);
                          setCategoryId(e.target.value);
                        }}
                        disabled={loadingCategories || categories.length === 0}
                        variant="default"
                      >
                        {loadingCategories && (
                          <option>Loading categories...</option>
                        )}
                        {!loadingCategories && categories.length === 0 && (
                          <option>No categories available</option>
                        )}
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                        Garment type
                        <InfoTooltip text="Choose the specific garment type within the selected family." />
                      </label>
                      <Select
                        value={categoryTypeId}
                        onChange={(e) => {
                          setHasManualSubCategoryEdit(true);
                          setCategoryTypeId(e.target.value);
                        }}
                        disabled={
                          loadingCategories || categoryTypeOptions.length === 0
                        }
                        variant="default"
                      >
                        {loadingCategories && (
                          <option>Loading sub-categories...</option>
                        )}
                        {!loadingCategories &&
                          categoryTypeOptions.length === 0 && (
                            <option>No sub-categories available</option>
                          )}
                        {categoryTypeOptions.map((categoryType) => (
                          <option key={categoryType.id} value={categoryType.id}>
                            {categoryType.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-secondary mb-2 flex items-center">
                      Style details
                      <InfoTooltip text={CREATOR_METADATA_HELP.style} />
                    </label>
                    <FilterSelector
                      value={filterSelection}
                      onChange={handleFilterSelectionChange}
                      entityType="COLLECTION"
                      onTagSuggestions={setTagSuggestions}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                        Who can see this?
                        <InfoTooltip text={CREATOR_METADATA_HELP.visibility} />
                      </label>
                      <Select
                        value={visibility}
                        onChange={(e) =>
                          setVisibility(e.target.value as CollectionVisibility)
                        }
                        variant="default"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="PRIVATE">Private</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-theme-secondary mb-1 flex items-center">
                        Who is it for?
                        <InfoTooltip text={CREATOR_METADATA_HELP.audience} />
                      </label>
                      <Select
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as CollectionType)
                        }
                        variant="default"
                      >
                        {CREATOR_AUDIENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-secondary mb-1.5 flex items-center">
                      Hashtags
                      <InfoTooltip text={CREATOR_METADATA_HELP.hashtags} />
                    </label>
                    {tagSuggestions.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-theme-secondary mb-1">
                          Suggested tags from filters:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tagSuggestions
                            .filter((t) => !tags.includes(t))
                            .slice(0, 12)
                            .map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                  if (
                                    tags.length < MAX_TAGS &&
                                    !tags.includes(suggestion)
                                  ) {
                                    setTags([...tags, suggestion]);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10
                            text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20
                            hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                              >
                                + {normalizeHashtagLabel(suggestion)}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="surface-card/60 border border-theme-strong rounded-xl px-3 py-2 min-h-[46px] flex items-center gap-2 shadow-sm">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add hashtag..."
                        className="bg-transparent border-none outline-none text-sm text-theme placeholder-gray-400 dark:placeholder-gray-500 w-24 flex-1 p-0 focus:ring-0"
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
                            label={normalizeHashtagLabel(tag)}
                            color={getTagColor(tag, index)}
                            size="xs"
                            rightIcon={
                              <X
                                className="w-3 h-3 cursor-pointer"
                                onClick={() => handleRemoveTag(tag)}
                              />
                            }
                            className="gap-1"
                          />
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500">
                      {normalizedTags.length}/{MAX_TAGS} hashtags. Press Enter or
                      click Add.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-theme bg-white/80 dark:bg-white/5 p-6">
            <h3 className="text-sm font-semibold text-theme mb-3">
              Selected Products
            </h3>
            {readySelectedProductIds.length > 0 && !hasPrimarySelection && (
              <p className="mb-3 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Primary product is required.
              </p>
            )}
            {hasPendingSelectedProducts && (
              <p className="mb-3 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                Waiting for queued products to finish before collection can be saved.
              </p>
            )}
            {collectionProducts.length === 0 ? (
              <p className="text-xs text-gray-500">No products selected yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="space-y-2">
                  {collectionProducts.map((entry) => {
                    const product = entry.product;
                    const displayName =
                      product?.name || entry.queueItem?.name || "New Product";
                    const isDraft =
                      entry.type === "draft" ||
                      product?.isActive === false ||
                      (product ? sessionDraftProductIds.includes(product.id) : false);
                    const isPrimary = product ? primaryProductId === product.id : false;
                    const canSetPrimary = Boolean(product && entry.status === "ready");
                    const canEdit = Boolean(product?.id);
                    const statusLabel =
                      entry.status === "uploading"
                        ? "Uploading"
                        : entry.status === "processing"
                          ? "Processing"
                          : entry.status === "failed"
                            ? "Failed"
                            : "Ready";
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs text-theme-secondary"
                      >
                        <span className="line-clamp-1 flex items-center gap-2">
                          {displayName}
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
                          {entry.status !== "ready" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                entry.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-sky-100 text-sky-700"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (product?.id) {
                                handleSetPrimary(product.id);
                              }
                            }}
                            disabled={!canSetPrimary}
                            className="text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isPrimary ? "Primary" : "Set Primary"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (product?.id) {
                                void openCollectionProductEditor(product.id);
                              }
                            }}
                            disabled={openingProductEditor || !canEdit}
                            className="text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleProduct(entry.id)}
                            className="text-purple-600 hover:text-purple-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => void (async () => {
            if (isExistingCollectionEditMode) {
              await navigateAway("/studio/store?view=collections");
              return;
            }
            await navigateAway("/studio/store?view=collections");
          })()}
          className="rounded-lg border border-theme bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-theme-secondary hover:border-purple-300"
        >
          {isExistingCollectionEditMode ? "Discard changes" : "Back"}
        </button>
        {isExistingCollectionEditMode ? (
          <button
            type="button"
            onClick={() => handleSubmit("publish")}
            disabled={submitting || hasPendingSelectedProducts}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {submitting && (
              <VLoader size={14} phase="loading" showLabel={false} />
            )}
            {submitting ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleSubmit("draft")}
              disabled={submitting || hasPendingSelectedProducts}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting && submitAction === "draft" && (
                <VLoader size={14} phase="loading" showLabel={false} />
              )}
              {submitting && submitAction === "draft"
                ? "Saving..."
                : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("publish")}
              disabled={submitting || hasPendingSelectedProducts}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting && submitAction === "publish" && (
                <VLoader size={14} phase="loading" showLabel={false} />
              )}
              {submitting && submitAction === "publish"
                ? "Going live..."
                : "Go live"}
            </button>
          </>
        )}
      </div>

      {previewProduct && (
        <OverlayPortal>
          <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4 animate-in fade-in duration-200">
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
                    <div className="text-base font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                      Product Details
                    </div>
                    <div className="text-xs text-theme-secondary mt-0.5">
                      {previewProduct.name}
                    </div>
                    {previewImages.length > 0 && (
                      <div className="text-[11px] text-theme-secondary mt-0.5">
                        {previewImages.length} image
                        {previewImages.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewProduct(null)}
                    className="rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 px-4 py-2 text-xs font-semibold text-theme-secondary hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800 dark:hover:to-pink-800 hover:text-purple-700 dark:hover:text-white transition-all duration-200 shadow-sm hover:shadow-md"
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
                                ? "border-purple-500 shadow-md shadow-purple-500/20"
                                : "border-gray-200/80 dark:border-white/10 hover:border-purple-300"
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
                    <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 dark:from-white dark:via-purple-200 dark:to-white bg-clip-text text-transparent">
                      {previewProduct.name}
                    </div>
                    <div className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mt-1">
                      {formatCurrency(previewProduct.price)}
                    </div>
                  </div>
                  {previewProduct.description ? (
                    <p className="text-sm text-theme-secondary leading-relaxed bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-gray-200/50 dark:border-white/10">
                      {previewProduct.description}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border border-indigo-200/50 dark:border-indigo-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-semibold">
                        Stock
                      </div>
                      <div className="font-bold text-indigo-900 dark:text-indigo-100 text-base mt-0.5">
                        {previewProduct.totalStock ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 border border-emerald-200/50 dark:border-emerald-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-500 dark:text-emerald-400 font-semibold">
                        Status
                      </div>
                      <div
                        className={`font-bold text-base mt-0.5 ${previewProduct.isActive ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}
                      >
                        {previewProduct.isActive ? "Active" : "Draft"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/30 border border-purple-200/50 dark:border-purple-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-purple-500 dark:text-purple-400 font-semibold">
                        Sizes
                      </div>
                      <div className="font-bold text-purple-900 dark:text-purple-100 text-base mt-0.5">
                        {previewProduct.sizes?.length
                          ? previewProduct.sizes.join(", ")
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/30 dark:to-rose-900/30 border border-pink-200/50 dark:border-pink-500/20 px-4 py-3 shadow-sm">
                      <div className="text-[10px] uppercase tracking-wider text-pink-500 dark:text-pink-400 font-semibold">
                        Colors
                      </div>
                      <div className="font-bold text-pink-900 dark:text-pink-100 text-base mt-0.5">
                        {previewProduct.colors?.length
                          ? previewProduct.colors.join(", ")
                          : "-"}
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
