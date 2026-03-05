import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
  Video,
  X,
  Loader2,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

import { toast } from "sonner";
import MediaRenderer from "@/components/media/MediaRenderer";
import {
  productApi,
  type ProductCreateDto,
  type Category,
  type ProductVariant,
} from "@/api/ProductApi";
import { brandApi, type CategoryTypeOption } from "@/api/BrandApi";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { useConfirm } from "@/components/ui/useConfirm";
import { DiscardChangesModal } from "@/components/studio/store/modals";
import {
  normalizePrimary,
  reorderItems,
  setPrimary,
  validateMedia,
} from "./mediaUtils";
import { getTagColor } from "@/utils/tagColors";
import FilterSelector, {
  type FilterSelection,
} from "@/components/categories/FilterSelector";
import SizingConfigurator from "@/components/sizing/SizingConfigurator";
import { PriceChangePreviewModal } from "@/components/collections/PriceChangePreviewModal";
import {
  getProductPriceChangePreview,
  getStorePolicies,
  updateStorePolicies,
  type CollectionPriceImpact,
} from "@/api/StoreApi";

function toSkuToken(input: string): string {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-");
  return cleaned.replace(/^-+/, "").replace(/-+$/, "");
}

function brandInitialsFromProfile(profile: any): string {
  const raw = String(
    profile?.brandFullName || profile?.brandName || profile?.username || "",
  ).trim();
  if (!raw) return "BR";
  const parts = raw
    .split(/\s+/)
    .map((p: string) => p.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  const initials = parts.map((p: string) => p[0] ?? "").join("");
  return toSkuToken(initials).slice(0, 4) || "BR";
}

function randomSkuSuffix(length = 5): string {
  // Base36, uppercase, stable enough for UX (not a security token)
  let out = "";
  while (out.length < length) {
    out += Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
      .toString(36)
      .toUpperCase();
  }
  return out.slice(0, length);
}

function buildBaseSku(opts: { brandInitials: string; title?: string }): string {
  const prefix = toSkuToken(opts.brandInitials || "BR");
  const titleToken = opts.title ? toSkuToken(opts.title).replace(/-/g, "") : "";
  const shortTitle = titleToken ? titleToken.slice(0, 4) : "PRD";
  return `${prefix}-${shortTitle}-${randomSkuSuffix(5)}`;
}

function buildVariantSku(
  baseSku: string,
  variant: { size?: string; color?: string },
  index: number,
): string {
  const color = variant.color ? toSkuToken(variant.color).slice(0, 6) : "";
  const size = variant.size ? toSkuToken(variant.size).slice(0, 6) : "";
  const tokens = [color, size].filter(Boolean);
  const tail = tokens.length ? tokens.join("-") : `V${index + 1}`;
  return `${toSkuToken(baseSku)}-${tail}`;
}

type ShippingRegionOption = {
  code: string;
  label: string;
  policyValue: string;
};

const SHIPPING_REGION_OPTIONS: ShippingRegionOption[] = [
  { code: "NG", label: "Nigeria", policyValue: "nigeria" },
  { code: "GH", label: "Ghana", policyValue: "ghana" },
  { code: "KE", label: "Kenya", policyValue: "kenya" },
  { code: "ZA", label: "South Africa", policyValue: "south-africa" },
  { code: "RW", label: "Rwanda", policyValue: "rwanda" },
  { code: "EG", label: "Egypt", policyValue: "egypt" },
  { code: "GB", label: "United Kingdom", policyValue: "uk" },
  { code: "US", label: "United States", policyValue: "us" },
  { code: "INTL", label: "International", policyValue: "international" },
];

const normalizeShippingRegionCode = (
  rawValue: string | null | undefined,
): string | null => {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value) return null;

  const uppercase = value.toUpperCase();
  const byCode = SHIPPING_REGION_OPTIONS.find((opt) => opt.code === uppercase);
  if (byCode) return byCode.code;

  const lowercase = value.toLowerCase();
  const byPolicy = SHIPPING_REGION_OPTIONS.find(
    (opt) => opt.policyValue === lowercase,
  );
  if (byPolicy) return byPolicy.code;

  const byLabel = SHIPPING_REGION_OPTIONS.find(
    (opt) => opt.label.toLowerCase() === lowercase,
  );
  return byLabel?.code ?? null;
};

const normalizeShippingRegionCodes = (regions: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const region of regions) {
    const code = normalizeShippingRegionCode(region);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    normalized.push(code);
  }
  return normalized;
};

const toPolicyShippingRegion = (code: string): string => {
  const option = SHIPPING_REGION_OPTIONS.find((opt) => opt.code === code);
  return option?.policyValue ?? code.toLowerCase();
};

const areShippingRegionSetsEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  for (const value of b) {
    if (!aSet.has(value)) return false;
  }
  return true;
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
  if (Object.keys(directSelection).length > 0) return directSelection;

  const rows = Array.isArray((raw as any).filters)
    ? ((raw as any).filters as any[])
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

// =====================
// Types
// =====================

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  taxonomyCategoryId: string;
  categoryTypeId: string;
  tags: string[];
  price: number;
  compareAtPrice: number;
  costPerItem: number;
  currency: string;
  sku: string;
  weight: number;
  weightUnit: "kg" | "lb";
  materials: string;
  careInstructions: string;
  returnsEligible: boolean;
  sustainabilityClaim: boolean;
  trackInventory: boolean;
  allowBackorders: boolean;
  stock: number;
  lowStockThreshold: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isPhysicalProduct: boolean;
  customsRegion: string;
  onSale: boolean;
  mediaIds: string[];
  variants: ProductVariant[];
  sizingMode: "NONE" | "RTW" | "CUSTOM" | "RTW_PLUS_CUSTOM";
  rtwSizeSystem: string;
  customMeasurementKeys: string[];
  fitPreference: "SLIM" | "REGULAR" | "LOOSE" | "OVERSIZED" | "";
  targetAgeGroup: "ADULT" | "CHILD";
}

const defaultFormState: FormState = {
  title: "",
  description: "",
  categoryId: "",
  taxonomyCategoryId: "",
  categoryTypeId: "",
  tags: [],
  price: 0,
  compareAtPrice: 0,
  costPerItem: 0,
  currency: "NGN",
  sku: "",
  weight: 0,
  weightUnit: "kg",
  materials: "",
  careInstructions: "",
  returnsEligible: true,
  sustainabilityClaim: false,
  trackInventory: true,
  allowBackorders: false,
  stock: 0,
  lowStockThreshold: 5,
  status: "ACTIVE",
  isPhysicalProduct: true,
  customsRegion: "NG",
  onSale: false,
  mediaIds: [],
  variants: [],
  sizingMode: "NONE",
  rtwSizeSystem: "ALPHA",
  customMeasurementKeys: [],
  fitPreference: "",
  targetAgeGroup: "ADULT",
};

// =====================
// Currency Formatting
// =====================

const formatCurrency = (amount: number, currency = "NGN"): string => {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
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
  const returnTo = useMemo(
    () => new URLSearchParams(location.search).get("returnTo"),
    [location.search],
  );
  const returnContext = useMemo(
    () => new URLSearchParams(location.search).get("returnContext"),
    [location.search],
  );
  const collectionContextId = useMemo(
    () => new URLSearchParams(location.search).get("collectionId"),
    [location.search],
  );
  const user = useSelector((state: RootState) => state.user.profile);

  const isEditMode = Boolean(productId);
  const isCollectionContext = returnContext === "collection";
  const isCollectionFlow = isCollectionContext && !isEditMode;
  const pageTitle = isCollectionFlow
    ? "Add Product to Collection"
    : isCollectionContext && isEditMode
      ? "Edit Product in Collection"
      : isEditMode
        ? "Edit Product"
        : "Create Product";
  const includeDeleted = useMemo(
    () => new URLSearchParams(location.search).get("includeDeleted") === "true",
    [location.search],
  );

  // State
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collectionCategoryById, setCollectionCategoryById] = useState<
    Record<string, string>
  >({});
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeOption[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [shippingRegions, setShippingRegions] = useState<string[]>([
    defaultFormState.customsRegion,
  ]);
  const [savedShippingRegions, setSavedShippingRegions] = useState<string[]>([
    defaultFormState.customsRegion,
  ]);
  const [shippingRegionsLoading, setShippingRegionsLoading] = useState(true);
  const [saveAction, setSaveAction] = useState<"draft" | "publish" | null>(
    null,
  );
  const [submitLocked, setSubmitLocked] = useState(false);
  const submitLockRef = useRef(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<{
    pricing: boolean;
    variants: boolean;
    fulfillment: boolean;
    additional: boolean;
  }>({
    pricing: true,
    variants: true,
    fulfillment: true,
    additional: true,
  });
  const { confirm, ConfirmDialog: ConfirmModal } = useConfirm();

  // Taxonomy state (standalone category/sub-category/filters)
  type TaxonomyCategoryOption = {
    id: string;
    name: string;
    types: { id: string; name: string }[];
  };
  const [taxonomyCategories, setTaxonomyCategories] = useState<
    TaxonomyCategoryOption[]
  >([]);
  const [filterSelection, setFilterSelection] = useState<FilterSelection>({});
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Media state (simplified - using URLs for display)
  const [mediaUrls, setMediaUrls] = useState<
    Array<{ id: string; url: string; isPrimary?: boolean }>
  >([]);

  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    Array<{
      id: string;
      tempId: string;
      file: File;
      previewUrl: string;
      isPrimary: boolean;
    }>
  >([]);
  const pendingPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Price change preview state
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [showPricePreview, setShowPricePreview] = useState(false);
  const [pricePreviewData, setPricePreviewData] = useState<{
    affectedCollections: CollectionPriceImpact[];
    productName: string;
    oldPrice: number;
    newPrice: number;
  } | null>(null);
  const [pendingSaveDraft, setPendingSaveDraft] = useState(false);
  const [pendingStatusOverride, setPendingStatusOverride] = useState<
    FormState["status"] | null
  >(null);

  const maxMediaCount = 4;
  const canAddMoreMedia = mediaUrls.length < maxMediaCount;
  const hasPrimaryMedia = useMemo(
    () => mediaUrls.some((m) => m.isPrimary),
    [mediaUrls],
  );

  // Calculate profit margin
  const profitMargin = useMemo(() => {
    if (form.price <= 0 || form.costPerItem <= 0)
      return { margin: 0, profit: 0 };
    const profit = form.price - form.costPerItem;
    const margin = (profit / form.price) * 100;
    return { margin: Math.round(margin), profit };
  }, [form.price, form.costPerItem]);

  const variantTotalStock = useMemo(() => {
    if (!form.variants.length) return 0;
    return form.variants.reduce(
      (sum, v) => sum + (Number.isFinite(v.stock) ? v.stock : 0),
      0,
    );
  }, [form.variants]);

  const variantKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of form.variants) {
      const key = `${(v.color ?? "").trim().toLowerCase()}::${(v.size ?? "").trim().toLowerCase()}`;
      if (key === "::") continue;
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

  const normalizedShippingRegions = useMemo(
    () => normalizeShippingRegionCodes(shippingRegions),
    [shippingRegions],
  );

  const selectedFilterValueIds = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(filterSelection)
            .flatMap((values) =>
              Array.isArray(values)
                ? values.filter(
                    (value): value is string =>
                      typeof value === "string" && value.trim().length > 0,
                  )
                : [],
            )
            .filter((value) => value.trim().length > 0),
        ),
      ),
    [filterSelection],
  );

  const hasShippingRegionPolicyChanges = useMemo(
    () =>
      !areShippingRegionSetsEqual(
        normalizedShippingRegions,
        savedShippingRegions,
      ),
    [normalizedShippingRegions, savedShippingRegions],
  );

  const toggleShippingRegion = useCallback((regionCode: string) => {
    setShippingRegions((prev) => {
      const next = prev.includes(regionCode)
        ? prev.filter((code) => code !== regionCode)
        : [...prev, regionCode];
      const normalized = normalizeShippingRegionCodes(next);
      setForm((prevForm) => ({
        ...prevForm,
        customsRegion: normalized[0] ?? "",
      }));
      setHasChanges(true);
      return normalized;
    });
  }, []);

  const syncShippingRegions = useCallback(async (
    options?: { persistPolicy?: boolean },
  ): Promise<string | undefined> => {
    if (!form.isPhysicalProduct) {
      return undefined;
    }

    if (normalizedShippingRegions.length === 0) {
      throw new Error("MISSING_SHIPPING_REGION");
    }

    const shouldPersistPolicy = options?.persistPolicy ?? true;
    if (shouldPersistPolicy && hasShippingRegionPolicyChanges) {
      await updateStorePolicies({
        shippingRegions: normalizedShippingRegions.map(toPolicyShippingRegion),
      });
      setSavedShippingRegions(normalizedShippingRegions);
    }

    return normalizedShippingRegions[0] ?? undefined;
  }, [
    form.isPhysicalProduct,
    hasShippingRegionPolicyChanges,
    normalizedShippingRegions,
  ]);

  const revokeBlobUrl = useCallback((url?: string) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    for (const it of pendingMediaFiles) {
      if (it.previewUrl && !pendingPreviewUrlsRef.current.has(it.tempId)) {
        pendingPreviewUrlsRef.current.set(it.tempId, it.previewUrl);
      }
    }

    const keepIds = new Set(pendingMediaFiles.map((it) => it.tempId));
    for (const [tempId, url] of Array.from(
      pendingPreviewUrlsRef.current.entries(),
    )) {
      if (!keepIds.has(tempId)) {
        revokeBlobUrl(url);
        pendingPreviewUrlsRef.current.delete(tempId);
      }
    }
  }, [pendingMediaFiles, revokeBlobUrl]);

  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrlsRef.current.values()) {
        revokeBlobUrl(url);
      }
      pendingPreviewUrlsRef.current.clear();
    };
  }, [revokeBlobUrl]);

  // =====================
  // Data Loading
  // =====================

  useEffect(() => {
    let mounted = true;

    const loadStoreShippingRegions = async () => {
      try {
        setShippingRegionsLoading(true);
        const policies = await getStorePolicies();
        if (!mounted) return;

        const fromPolicy = normalizeShippingRegionCodes(
          policies.shippingRegions || [],
        );
        const fallbackRegion =
          normalizeShippingRegionCode(defaultFormState.customsRegion) ??
          defaultFormState.customsRegion;
        const resolved = fromPolicy.length > 0 ? fromPolicy : [fallbackRegion];

        setShippingRegions(resolved);
        setSavedShippingRegions(resolved);
        setForm((prev) => ({
          ...prev,
          customsRegion: resolved[0] ?? prev.customsRegion,
        }));
      } catch (error) {
        console.error("Failed to load store shipping regions", error);
        if (!mounted) return;
        const fallbackRegion =
          normalizeShippingRegionCode(defaultFormState.customsRegion) ??
          defaultFormState.customsRegion;
        setShippingRegions([fallbackRegion]);
        setSavedShippingRegions([fallbackRegion]);
        setForm((prev) => ({
          ...prev,
          customsRegion: fallbackRegion,
        }));
      } finally {
        if (mounted) setShippingRegionsLoading(false);
      }
    };

    void loadStoreShippingRegions();
    return () => {
      mounted = false;
    };
  }, []);

  // Load collections (optional for products; standalone products are allowed)
  useEffect(() => {
    let mounted = true;
    const loadCollections = async () => {
      const loadCategoryTypes = async () => {
        try {
          const fetchedTypes = await brandApi.getCategoryTypes(undefined, true);
          let resolvedTypes = Array.isArray(fetchedTypes) ? fetchedTypes : [];
          if (resolvedTypes.length === 0) {
            const categoriesWithTypes =
              await brandApi.getCategoriesWithSubCategories(true);
            const fallbackTypes = (categoriesWithTypes || [])
              .flatMap((category) => category.types ?? [])
              .filter((type) => Boolean(type?.id) && Boolean(type?.name));
            resolvedTypes = fallbackTypes;
          }
          if (mounted) {
            setCategoryTypes(resolvedTypes);
          }
        } catch (error) {
          console.error("Failed to load sub-categories", error);
          if (mounted) setCategoryTypes([]);
        }
      };

      // Load taxonomy categories (standalone category/sub-category tree)
      const loadTaxonomyCategories = async () => {
        try {
          const cats = await brandApi.getCategoriesWithSubCategories(true);
          if (mounted && Array.isArray(cats)) {
            setTaxonomyCategories(
              cats.map((c: any) => ({
                id: String(c.id),
                name: String(c.name || ""),
                types: (c.types || []).map((t: any) => ({
                  id: String(t.id),
                  name: String(t.name || ""),
                })),
              })),
            );
          }
        } catch (error) {
          console.error("Failed to load taxonomy categories", error);
        }
      };

      try {
        if (!user?.id) {
          if (mounted) {
            setCategories([]);
          }
          await Promise.all([loadCategoryTypes(), loadTaxonomyCategories()]);
          return;
        }

        const collections = await brandApi.getCollections(user.id, {
          visibility: "all",
          scope: "store",
        });
        if (!mounted) return;
        const mapped: Category[] = (collections || [])
          .filter((c: any) => Boolean(c?.isAvailableInStore))
          .map((c: any) => ({
            id: String(c.id),
            name: String(c.title || c.name || "Untitled collection"),
            slug: String(c.id),
          }));
        setCategories(mapped);
        const categoryByCollection: Record<string, string> = {};
        (collections || []).forEach((c: any) => {
          if (c?.id && c?.categoryId) {
            categoryByCollection[String(c.id)] = String(c.categoryId);
          }
        });
        setCollectionCategoryById(categoryByCollection);
        await Promise.all([loadCategoryTypes(), loadTaxonomyCategories()]);
      } catch (error) {
        console.error("Failed to load collections", error);
        if (mounted) {
          setCategories([]);
          setCollectionCategoryById({});
        }
        await Promise.all([loadCategoryTypes(), loadTaxonomyCategories()]);
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    };
    void loadCollections();
    return () => {
      mounted = false;
    };
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
        const product = await productApi.getProduct(
          productId,
          includeDeleted ? { includeDeleted: true } : undefined,
        );
        if (!product || !mounted) return;
        const resolvedStatus = (() => {
          const rawStatus = String((product as any).status || "").toUpperCase();
          if (
            rawStatus === "DRAFT" ||
            rawStatus === "ACTIVE" ||
            rawStatus === "ARCHIVED"
          ) {
            return rawStatus as FormState["status"];
          }
          if ((product as any).archivedAt) return "ARCHIVED";
          return (product as any).isActive === false ? "DRAFT" : "ACTIVE";
        })();

        // Track original price for change detection
        setOriginalPrice(product.price || 0);

        setForm({
          title: product.title || product.name || "",
          description: product.description || "",
          categoryId:
            (product as any).collectionId ||
            (product as any).collectionIds?.[0] ||
            "",
          taxonomyCategoryId:
            (product as any).categoryType?.categoryId ||
            (product as any).categoryId ||
            "",
          categoryTypeId:
            (product as any).subCategoryId ||
            (product as any).categoryTypeId ||
            "",
          tags: product.tags || [],
          price: product.price || 0,
          compareAtPrice:
            (product as any).salePrice || product.compareAtPrice || 0,
          costPerItem: product.costPerItem || 0,
          currency:
            (product as any)?.brand?.currency || product.currency || "NGN",
          sku: product.sku || "",
          weight: product.weight || 0,
          weightUnit: product.weightUnit || "kg",
          materials: product.materials || "",
          careInstructions: product.careInstructions || "",
          returnsEligible: product.returnsEligible ?? true,
          sustainabilityClaim: product.sustainabilityClaim ?? false,
          trackInventory: product.trackInventory ?? true,
          allowBackorders: product.allowBackorders ?? false,
          stock: product.stock ?? product.totalStock ?? 0,
          lowStockThreshold: product.lowStockThreshold ?? 5,
          status: resolvedStatus,
          isPhysicalProduct: product.isPhysicalProduct ?? true,
          customsRegion: product.customsRegion || "NG",
          onSale: Boolean(
            ((product as any).salePrice ?? product.compareAtPrice) &&
            ((product as any).salePrice ?? product.compareAtPrice) <
              product.price,
          ),
          mediaIds: product.mediaIds || [],
          variants:
            product.variants && product.variants.length
              ? product.variants
              : (() => {
                  const sizeStock = (product as any).sizeStock as
                    | Record<string, number>
                    | undefined;
                  if (!sizeStock) return [];
                  return Object.entries(sizeStock).map(([size, stock]) => ({
                    size,
                    stock: typeof stock === "number" ? stock : 0,
                  })) as ProductVariant[];
                })(),
          sizingMode: (product.sizingMode || "NONE") as FormState["sizingMode"],
          rtwSizeSystem: product.rtwSizeSystem || "ALPHA",
          customMeasurementKeys: Array.isArray(product.customMeasurementKeys)
            ? product.customMeasurementKeys
            : [],
          fitPreference:
            (product.fitPreference as FormState["fitPreference"]) || "",
          targetAgeGroup:
            (product.targetAgeGroup as FormState["targetAgeGroup"]) ||
            "ADULT",
        });

        setFilterSelection(normalizeFilterSelectionFromProduct(product));

        // Set media for display - resolve signed URLs
        if (product.media?.length) {
          const mediaWithSignedUrls = await Promise.all(
            product.media.map(async (m) => {
              let signedUrl = m.url;
              // Check if URL needs signing (S3 reference without query params)
              if (
                m.id &&
                m.url &&
                !m.url.includes("?") &&
                (m.url.includes("s3") || !m.url.startsWith("http"))
              ) {
                try {
                  const signed = await brandApi.getSignedFileUrl(m.id);
                  if (signed) signedUrl = signed;
                } catch (e) {
                  console.warn("Failed to sign URL for media", m.id, e);
                }
              }
              return { id: m.id, url: signedUrl, isPrimary: m.isPrimary };
            }),
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
        console.error("Failed to load product", error);
        toast.error("Failed to load product");
        navigate("/studio/store");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadProduct();
    return () => {
      mounted = false;
    };
  }, [isEditMode, productId, navigate]);

  const effectiveCollectionId = useMemo(
    () => (isCollectionFlow ? collectionContextId || form.categoryId : form.categoryId),
    [collectionContextId, form.categoryId, isCollectionFlow],
  );

  const selectedCollectionCategoryId = useMemo(
    () =>
      effectiveCollectionId
        ? collectionCategoryById[effectiveCollectionId]
        : undefined,
    [collectionCategoryById, effectiveCollectionId],
  );

  const availableCategoryTypes = useMemo(() => {
    if (!selectedCollectionCategoryId) return categoryTypes;
    return categoryTypes.filter(
      (categoryType) =>
        categoryType.categoryId === selectedCollectionCategoryId,
    );
  }, [categoryTypes, selectedCollectionCategoryId]);

  const selectedTaxonomyCategoryTypes = useMemo(() => {
    if (!form.taxonomyCategoryId) return [];
    const matched = taxonomyCategories.find(
      (category) => category.id === form.taxonomyCategoryId,
    );
    if (matched?.types?.length) {
      return matched.types;
    }
    return categoryTypes.filter(
      (categoryType) => categoryType.categoryId === form.taxonomyCategoryId,
    );
  }, [categoryTypes, form.taxonomyCategoryId, taxonomyCategories]);

  useEffect(() => {
    if (!isCollectionFlow || !collectionContextId || categoriesLoading) return;
    const contextCategoryId = collectionCategoryById[collectionContextId];

    setForm((prev) => {
      let changed = false;
      const next: FormState = { ...prev };

      if (next.categoryId !== collectionContextId) {
        next.categoryId = collectionContextId;
        changed = true;
      }

      if (contextCategoryId && !next.taxonomyCategoryId) {
        next.taxonomyCategoryId = contextCategoryId;
        changed = true;
      }

      if (contextCategoryId && !next.categoryTypeId) {
        const scopedTypes =
          taxonomyCategories.find((category) => category.id === contextCategoryId)
            ?.types ??
          categoryTypes.filter(
            (categoryType) => categoryType.categoryId === contextCategoryId,
          );

        if (scopedTypes.length > 0) {
          next.categoryTypeId = scopedTypes[0].id;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [
    categoriesLoading,
    categoryTypes,
    collectionCategoryById,
    collectionContextId,
    isCollectionFlow,
    taxonomyCategories,
  ]);

  const handleCollectionChange = useCallback(
    (nextCollectionId: string) => {
      const nextCollectionCategoryId = nextCollectionId
        ? collectionCategoryById[nextCollectionId]
        : undefined;

      setForm((prev) => {
        const next: FormState = { ...prev, categoryId: nextCollectionId };

        if (nextCollectionCategoryId) {
          next.taxonomyCategoryId = nextCollectionCategoryId;
          const scopedTypes =
            taxonomyCategories.find((c) => c.id === nextCollectionCategoryId)
              ?.types ??
            categoryTypes.filter((t) => t.categoryId === nextCollectionCategoryId);
          if (
            next.categoryTypeId &&
            !scopedTypes.some((t) => t.id === next.categoryTypeId)
          ) {
            next.categoryTypeId = "";
          }
          return next;
        }
        return next;
      });
      setHasChanges(true);

      if (nextCollectionId && !nextCollectionCategoryId) {
        toast.warning(
          "Selected collection has no category. Sub-category was cleared.",
        );
      }
    },
    [categoryTypes, collectionCategoryById, taxonomyCategories],
  );

  useEffect(() => {
    if (categoriesLoading) return;

    setForm((prev) => {
      const scopedTypes = prev.taxonomyCategoryId
        ? selectedTaxonomyCategoryTypes
        : availableCategoryTypes.length > 0
          ? availableCategoryTypes
          : categoryTypes;

      if (scopedTypes.length === 0) {
        return prev;
      }

      if (
        prev.categoryTypeId &&
        scopedTypes.some(
          (categoryType) => categoryType.id === prev.categoryTypeId,
        )
      ) {
        return prev;
      }
      return { ...prev, categoryTypeId: scopedTypes[0]?.id ?? "" };
    });
  }, [
    availableCategoryTypes,
    categoriesLoading,
    categoryTypes,
    selectedTaxonomyCategoryTypes,
  ]);

  // =====================
  // Form Handlers
  // =====================

  const updateForm = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    },
    [],
  );

  const addVariant = useCallback(() => {
    const next: ProductVariant = {
      size: "",
      color: "",
      sku: "",
      price: undefined,
      stock: 0,
    };
    updateForm("variants", [...form.variants, next]);
  }, [form.variants, updateForm]);

  const addVariantForColor = useCallback(
    (color: string) => {
      const next: ProductVariant = {
        size: "",
        color,
        sku: "",
        price: undefined,
        stock: 0,
      };
      updateForm("variants", [...form.variants, next]);
    },
    [form.variants, updateForm],
  );

  const addMultipleSizesForColor = useCallback(
    (color: string, sizesStr: string) => {
      const sizes = sizesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (sizes.length === 0) return;
      const existing = form.variants.filter(
        (v) => (v.color ?? "").trim().toLowerCase() === color.trim().toLowerCase(),
      );
      const existingSizes = new Set(
        existing.map((v) => (v.size ?? "").trim().toLowerCase()),
      );
      const newVariants = sizes
        .filter((s) => !existingSizes.has(s.toLowerCase()))
        .map((size) => ({
          size,
          color,
          sku: "",
          price: undefined as number | undefined,
          stock: 0,
        }));
      if (newVariants.length === 0) {
        toast.warning("All sizes already exist for this color");
        return;
      }
      updateForm("variants", [...form.variants, ...newVariants]);
    },
    [form.variants, updateForm],
  );

  const updateVariant = useCallback(
    (index: number, patch: Partial<ProductVariant>) => {
      const next = form.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      );
      updateForm("variants", next);
    },
    [form.variants, updateForm],
  );

  const removeVariant = useCallback(
    (index: number) => {
      const next = form.variants.filter((_, i) => i !== index);
      updateForm("variants", next);
    },
    [form.variants, updateForm],
  );

  const removeColorGroup = useCallback(
    (color: string) => {
      const next = form.variants.filter(
        (v) =>
          (v.color ?? "").trim().toLowerCase() !== color.trim().toLowerCase(),
      );
      updateForm("variants", next);
    },
    [form.variants, updateForm],
  );

  /** Group variants by color for the grouped editor view */
  const variantColorGroups = useMemo(() => {
    const groups: Array<{
      stableKey: string;
      color: string;
      variants: Array<{ variant: ProductVariant; originalIndex: number }>;
    }> = [];
    const colorMap = new Map<string, typeof groups[number]>();
    form.variants.forEach((v, idx) => {
      const colorKey = (v.color ?? "").trim().toLowerCase() || "__no_color__";
      let group = colorMap.get(colorKey);
      if (!group) {
        const stableId =
          typeof v.id === "string" && v.id.trim().length > 0
            ? v.id
            : String(idx);
        group = {
          stableKey: `group-${stableId}`,
          color: v.color ?? "",
          variants: [],
        };
        colorMap.set(colorKey, group);
        groups.push(group);
      }
      group.variants.push({ variant: v, originalIndex: idx });
    });
    return groups;
  }, [form.variants]);

  const handleAddTag = useCallback(() => {
    const raw = tagInput.trim();
    if (!raw) return;
    const cleaned = raw.replace(/#/g, "").trim();
    if (!cleaned) return;
    if (!form.tags.includes(cleaned)) {
      updateForm("tags", [...form.tags, cleaned]);
    }
    setTagInput("");
  }, [tagInput, form.tags, updateForm]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      updateForm(
        "tags",
        form.tags.filter((t) => t !== tagToRemove),
      );
    },
    [form.tags, updateForm],
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  const toggleSection = useCallback(
    (section: keyof typeof collapsedSections) => {
      setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [],
  );

  // =====================
  // Save / Submit
  // =====================

  const handleSave = useCallback(
    async (
      asDraft = false,
      options?: { forceStatus?: FormState["status"] },
    ) => {
      const forcedStatus = options?.forceStatus;
      const normalizedForcedStatus: FormState["status"] | undefined =
        isCollectionFlow ? "DRAFT" : forcedStatus;
      const effectiveDraft = normalizedForcedStatus
        ? normalizedForcedStatus === "DRAFT"
        : asDraft;
      const shouldValidatePublish = normalizedForcedStatus
        ? normalizedForcedStatus === "ACTIVE"
        : !asDraft;
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
        pendingMediaFiles.length > 0,
      );

      if (!shouldValidatePublish) {
        if (!hasDraftContent) {
          toast.error("Add at least one detail to save a draft");
          return;
        }
        if (form.variants.length > 0) {
          const invalid = form.variants.find(
            (v) => Number.isNaN(Number(v.stock)) || v.stock < 0,
          );
          if (invalid) {
            toast.error("Variant stock must be 0 or greater");
            return;
          }
        } else if (
          form.trackInventory &&
          (Number.isNaN(Number(form.stock)) || form.stock < 0)
        ) {
          toast.error("Stock must be 0 or greater");
          return;
        }
      } else {
        // Validation for published products
        if (!form.title.trim()) {
          toast.error("Please enter a product title");
          return;
        }
        if (
          form.categoryId &&
          collectionCategoryById[form.categoryId] &&
          !form.categoryTypeId
        ) {
          toast.error(
            "Please select a sub-category for the selected collection.",
          );
          return;
        }
        if (form.price <= 0) {
          toast.error("Please enter a valid price");
          return;
        }
        if (
          form.onSale &&
          form.compareAtPrice > 0 &&
          form.compareAtPrice >= form.price
        ) {
          toast.error("Sale price must be less than the price");
          return;
        }
        if (form.variants.length > 0) {
          if (hasDuplicateVariants) {
            toast.error(
              "Please remove duplicate variant options (same size/color)",
            );
            return;
          }
          const invalid = form.variants.find(
            (v) => Number.isNaN(Number(v.stock)) || v.stock < 0,
          );
          if (invalid) {
            toast.error("Variant stock must be 0 or greater");
            return;
          }
        } else {
          if (
            form.trackInventory &&
            (Number.isNaN(Number(form.stock)) || form.stock < 0)
          ) {
            toast.error("Stock must be 0 or greater");
            return;
          }
        }
      }

      const mediaValidation = validateMedia(mediaUrls, maxMediaCount);
      if (!mediaValidation.ok) {
        toast.error(
          mediaValidation.error || "Please review your media selection",
        );
        return;
      }

      // Check if price changed in edit mode - show preview before saving
      if (
        isEditMode &&
        productId &&
        originalPrice !== null &&
        form.price !== originalPrice &&
        !showPricePreview
      ) {
        try {
          const preview = await getProductPriceChangePreview(
            productId,
            form.price,
          );
          if (preview.affectedCollections.length > 0) {
            setPricePreviewData({
              affectedCollections: preview.affectedCollections,
              productName: form.title || "This product",
              oldPrice: originalPrice,
              newPrice: form.price,
            });
            setPendingSaveDraft(effectiveDraft);
            setPendingStatusOverride(normalizedForcedStatus ?? null);
            setShowPricePreview(true);
            return; // Wait for user confirmation
          }
        } catch (e) {
          // If preview fails, proceed with save anyway
          console.warn("Failed to load price change preview", e);
        }
      }

      if (isCollectionFlow && !collectionContextId) {
        toast.error(
          "Missing collection context. Please return to the collection builder and try again.",
        );
        return;
      }

      const selectedCollectionId = isCollectionFlow
        ? collectionContextId || undefined
        : form.categoryId || undefined;

      const payloadCategoryTypeId = form.categoryTypeId || undefined;

      setSaving(true);
      try {
        const ensuredSku =
          form.sku?.trim() ||
          buildBaseSku({
            brandInitials: brandInitialsFromProfile(user),
            title: form.title,
          });
        const resolvedCustomsRegion = await syncShippingRegions({
          // Collection flow should not block on store policy updates.
          persistPolicy: !isCollectionContext,
        });

        const payload: ProductCreateDto = {
          title: effectiveDraft
            ? form.title.trim() || "Untitled Draft"
            : form.title.trim(),
          description: form.description.trim() || undefined,
          collectionId: selectedCollectionId,
          subCategoryId: payloadCategoryTypeId,
          categoryTypeId: payloadCategoryTypeId,
          tags: form.tags,
          filterValueIds: selectedFilterValueIds,
          price: effectiveDraft
            ? form.price > 0
              ? form.price
              : 0
            : form.price,
          compareAtPrice:
            form.onSale && form.compareAtPrice > 0
              ? form.compareAtPrice
              : undefined,
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
          status:
            normalizedForcedStatus ?? (effectiveDraft ? "DRAFT" : form.status),
          isPhysicalProduct: form.isPhysicalProduct,
          customsRegion: resolvedCustomsRegion,
          mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
          sizingMode: form.sizingMode,
          rtwSizeSystem:
            form.sizingMode === "RTW" || form.sizingMode === "RTW_PLUS_CUSTOM"
              ? form.rtwSizeSystem || "ALPHA"
              : undefined,
          customMeasurementKeys:
            form.sizingMode === "CUSTOM" ||
            form.sizingMode === "RTW_PLUS_CUSTOM"
              ? form.customMeasurementKeys
              : [],
          fitPreference: form.fitPreference || undefined,
          targetAgeGroup: form.targetAgeGroup,
          variants:
            form.variants.length > 0
              ? form.variants.map((v, idx) => ({
                  ...v,
                  size: v.size?.trim() || undefined,
                  color: v.color?.trim() || undefined,
                  sku:
                    (
                      v.sku?.trim() || buildVariantSku(ensuredSku, v, idx)
                    ).trim() || undefined,
                  price:
                    typeof v.price === "number" && v.price > 0
                      ? v.price
                      : undefined,
                  stock: Number.isFinite(v.stock) ? v.stock : 0,
                }))
              : undefined,
        };

        if (isEditMode && productId) {
          await productApi.updateProduct(productId, payload);
          toast.success(
            isCollectionContext
              ? "Product updated for this collection."
              : "Product updated successfully",
          );
          if (returnTo && isCollectionContext) {
            navigate(returnTo);
            return;
          }
        } else {
          const created = await productApi.createProduct(payload);

          // Upload pending media after we have a product id
          if (pendingMediaFiles.length > 0) {
            const pendingById = new Map(
              pendingMediaFiles.map((p) => [p.tempId, p]),
            );
            const orderedPending = mediaUrls
              .map((m) => pendingById.get(m.id))
              .filter(Boolean)
              .map((p) => ({
                ...(p as {
                  id: string;
                  tempId: string;
                  file: File;
                  previewUrl: string;
                  isPrimary: boolean;
                }),
                id:
                  (p as { id: string }).id || (p as { tempId: string }).tempId,
              }));
            const uploads = normalizePrimary(orderedPending);

            // Upload media in parallel for faster product creation
            await Promise.all(
              uploads.map((u) =>
                productApi.uploadProductMedia(
                  created.id,
                  u.file,
                  u.isPrimary,
                ),
              ),
            );
          }

          const successMessage = isCollectionFlow
            ? "Product added to collection draft."
            : isCollectionContext
              ? "Product added to collection."
            : effectiveDraft
              ? "Draft saved successfully"
              : "Product created successfully";
          toast.success(successMessage);
          if (returnTo && returnContext === "collection") {
            const joiner = returnTo.includes("?") ? "&" : "?";
            navigate(`${returnTo}${joiner}productId=${created.id}`);
            return;
          }
        }

        setHasChanges(false);
        navigate("/studio/store");
      } catch (error: any) {
        if (error?.message === "MISSING_SHIPPING_REGION") {
          toast.error("Select at least one shipping country for this product.");
          return;
        }
        const message =
          error?.response?.data?.message ||
          "Failed to save product. Shipping policy may not have been saved.";
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [
      form,
      selectedFilterValueIds,
      hasDuplicateVariants,
      isEditMode,
      isCollectionFlow,
      isCollectionContext,
      collectionCategoryById,
      collectionContextId,
      maxMediaCount,
      mediaUrls,
      navigate,
      pendingMediaFiles,
      productId,
      variantTotalStock,
      originalPrice,
      showPricePreview,
      returnContext,
      returnTo,
      syncShippingRegions,
      user,
    ],
  );

  const handlePriceChangeConfirm = useCallback(async () => {
    setShowPricePreview(false);
    // Continue with save
    setSaving(true);
    try {
      const normalizedPendingStatus: FormState["status"] | null =
        isCollectionFlow ? "DRAFT" : pendingStatusOverride;
      const effectiveDraft = normalizedPendingStatus
        ? normalizedPendingStatus === "DRAFT"
        : pendingSaveDraft;
      const statusToPersist =
        normalizedPendingStatus ?? (effectiveDraft ? "DRAFT" : form.status);
      const ensuredSku =
        form.sku?.trim() ||
        buildBaseSku({
          brandInitials: brandInitialsFromProfile(user),
          title: form.title,
        });

      const selectedCollectionId = isCollectionFlow
        ? collectionContextId || undefined
        : form.categoryId || undefined;

      const payloadCategoryTypeId = form.categoryTypeId || undefined;
      const resolvedCustomsRegion = await syncShippingRegions({
        persistPolicy: !isCollectionContext,
      });

      const payload: ProductCreateDto = {
        title: effectiveDraft
          ? form.title.trim() || "Untitled Draft"
          : form.title.trim(),
        description: form.description.trim() || undefined,
        collectionId: selectedCollectionId,
        subCategoryId: payloadCategoryTypeId,
        categoryTypeId: payloadCategoryTypeId,
        tags: form.tags,
        filterValueIds: selectedFilterValueIds,
        price: effectiveDraft ? (form.price > 0 ? form.price : 0) : form.price,
        compareAtPrice:
          form.onSale && form.compareAtPrice > 0
            ? form.compareAtPrice
            : undefined,
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
        status: statusToPersist,
        isPhysicalProduct: form.isPhysicalProduct,
        customsRegion: resolvedCustomsRegion,
        mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
        sizingMode: form.sizingMode,
        rtwSizeSystem:
          form.sizingMode === "RTW" || form.sizingMode === "RTW_PLUS_CUSTOM"
            ? form.rtwSizeSystem || "ALPHA"
            : undefined,
        customMeasurementKeys:
          form.sizingMode === "CUSTOM" || form.sizingMode === "RTW_PLUS_CUSTOM"
            ? form.customMeasurementKeys
            : [],
        fitPreference: form.fitPreference || undefined,
        targetAgeGroup: form.targetAgeGroup,
        variants:
          form.variants.length > 0
            ? form.variants.map((v, idx) => ({
                ...v,
                size: v.size?.trim() || undefined,
                color: v.color?.trim() || undefined,
                sku:
                  (
                    v.sku?.trim() || buildVariantSku(ensuredSku, v, idx)
                  ).trim() || undefined,
                price:
                  typeof v.price === "number" && v.price > 0
                    ? v.price
                    : undefined,
                stock: Number.isFinite(v.stock) ? v.stock : 0,
              }))
            : undefined,
      };

      await productApi.updateProduct(productId!, payload);
      toast.success("Product updated successfully");
      setOriginalPrice(form.price); // Update tracked price
      setHasChanges(false);
      if (returnTo && isCollectionContext) {
        navigate(returnTo);
        return;
      }
      navigate("/studio/store");
    } catch (error: any) {
      if (error?.message === "MISSING_SHIPPING_REGION") {
        toast.error("Select at least one shipping country for this product.");
        return;
      }
      const message =
        error?.response?.data?.message ||
        "Failed to save product. Shipping policy may not have been saved.";
      toast.error(message);
    } finally {
      setSaving(false);
      setPendingSaveDraft(false);
      setPendingStatusOverride(null);
    }
  }, [
    form,
    selectedFilterValueIds,
    user,
    isCollectionFlow,
    collectionContextId,
    collectionCategoryById,
    pendingSaveDraft,
    pendingStatusOverride,
    variantTotalStock,
    productId,
    navigate,
    isCollectionContext,
    returnTo,
    syncShippingRegions,
  ]);

  const triggerSave = useCallback(
    async (
      asDraft: boolean,
      options: {
        action: "draft" | "publish";
        forceStatus?: FormState["status"];
      },
    ) => {
      if (submitLockRef.current || saving || submitLocked) return;
      submitLockRef.current = true;
      setSubmitLocked(true);
      setSaveAction(options.action);
      try {
        await handleSave(asDraft, { forceStatus: options.forceStatus });
      } finally {
        submitLockRef.current = false;
        setSaveAction(null);
        setSubmitLocked(false);
      }
    },
    [handleSave, saving, submitLocked],
  );

  // Auto-generate SKU (product + variants). Users shouldn't type SKUs manually.
  useEffect(() => {
    if (!user) return;
    if (!form.title.trim()) return;
    if (form.sku && form.sku.trim()) return;
    const nextSku = buildBaseSku({
      brandInitials: brandInitialsFromProfile(user),
      title: form.title,
    });
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
    const changed = nextVariants.some(
      (v, idx) => (v.sku ?? "") !== (form.variants[idx]?.sku ?? ""),
    );
    if (changed) {
      setForm((prev) => ({ ...prev, variants: nextVariants }));
    }
  }, [form.sku, form.variants]);

  const normalizePending = useCallback(
    (
      items: Array<{
        id: string;
        tempId: string;
        file: File;
        previewUrl: string;
        isPrimary: boolean;
      }>,
    ) => {
      return normalizePrimary(items);
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
        const tempId = `pending-${now}-${idx}-${Math.random().toString(16).slice(2)}`;
        return {
          id: tempId,
          tempId,
          file,
          previewUrl,
          isPrimary: false,
        };
      });

      setPendingMediaFiles((prev) => {
        const merged = [...prev, ...nextPending];
        if (makePrimary && nextPending[0]) {
          return normalizePending(
            merged.map((m) => ({
              ...m,
              isPrimary: m.tempId === nextPending[0].tempId,
            })),
          );
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

  const handleMediaFilesSelected: React.ChangeEventHandler<
    HTMLInputElement
  > = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    e.target.value = "";
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
          const uploaded = await productApi.uploadProductMedia(
            productId,
            file,
            makePrimary,
          );
          setMediaUrls((prev) => {
            const next = [
              ...prev,
              { id: uploaded.id, url: uploaded.url, isPrimary: makePrimary },
            ];
            const normalized = normalizePrimary(next);
            updateForm(
              "mediaIds",
              normalized
                .map((m) => m.id)
                .filter((id) => !id.startsWith("pending-")),
            );
            return normalized;
          });
          toast.success(
            makePrimary ? "Cover image uploaded" : "Image uploaded",
          );
        } catch (err) {
          console.error("Upload failed", err);
          toast.error("Failed to upload image");
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
      setPendingMediaFiles((prev) =>
        normalizePending(
          prev.map((p) => ({ ...p, isPrimary: p.tempId === mediaId })),
        ),
      );

      if (isEditMode && productId && !mediaId.startsWith("pending-")) {
        try {
          await productApi.setPrimaryMedia(productId, mediaId);
          toast.success("Cover image updated");
        } catch (error) {
          toast.error("Failed to update cover image");
        }
      }
    },
    [isEditMode, normalizePending, productId],
  );

  const handleDeleteMedia = useCallback(
    async (mediaId: string) => {
      const target = mediaUrls.find((m) => m.id === mediaId);
      if (!target) return;

      const pendingTarget = pendingMediaFiles.find((p) => p.tempId === mediaId);
      if (pendingTarget) {
        revokeBlobUrl(pendingTarget.previewUrl);
        pendingPreviewUrlsRef.current.delete(pendingTarget.tempId);
      }

      const nextMedia = normalizePrimary(
        mediaUrls.filter((m) => m.id !== mediaId),
      );
      setMediaUrls(nextMedia);
      setPendingMediaFiles((prev) => prev.filter((p) => p.tempId !== mediaId));

      if (isEditMode && productId && !mediaId.startsWith("pending-")) {
        try {
          await productApi.deleteProductMedia(productId, mediaId);
          const orderedIds = nextMedia
            .map((m) => m.id)
            .filter((id) => !id.startsWith("pending-"));
          updateForm("mediaIds", orderedIds);
          if (target.isPrimary && orderedIds[0]) {
            await productApi.setPrimaryMedia(productId, orderedIds[0]);
          }
          toast.success("Image deleted");
        } catch (error) {
          toast.error("Failed to delete image");
          setMediaUrls((prev) => normalizePrimary([...prev, target]));
        }
      }
    },
    [
      isEditMode,
      mediaUrls,
      pendingMediaFiles,
      productId,
      revokeBlobUrl,
      updateForm,
    ],
  );

  const handleReorderMedia = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const nextMedia = reorderItems(mediaUrls, fromIndex, toIndex);
      setMediaUrls(nextMedia);

      setPendingMediaFiles((prev) => {
        if (!prev.length) return prev;
        const byId = new Map(prev.map((p) => [p.tempId, p]));
        return nextMedia
          .map((m) => byId.get(m.id))
          .filter(Boolean) as typeof prev;
      });

      const orderedIds = nextMedia
        .map((m) => m.id)
        .filter((id) => !id.startsWith("pending-"));
      if (isEditMode && productId && orderedIds.length > 0) {
        try {
          await productApi.reorderProductMedia(productId, orderedIds);
          updateForm("mediaIds", orderedIds);
        } catch (error) {
          toast.error("Failed to reorder images");
        }
      }
    },
    [isEditMode, mediaUrls, productId, updateForm],
  );

  const handleDuplicate = useCallback(async () => {
    if (!productId) return;
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success("Product duplicated");
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch (error) {
      toast.error("Failed to duplicate product");
    }
  }, [productId, navigate]);

  const handleArchive = useCallback(async () => {
    if (!productId) return;
    try {
      await productApi.archiveProduct(productId);
      toast.success("Product archived");
      navigate("/studio/store");
    } catch (error) {
      toast.error("Failed to archive product");
    }
  }, [productId, navigate]);

  const handleDelete = useCallback(async () => {
    if (!productId) return;
    const approved = await confirm({
      title: "Delete product?",
      message: "This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      isDestructive: true,
    });
    if (!approved) return;
    try {
      await productApi.deleteProduct(productId);
      toast.success("Product deleted");
      navigate("/studio/store");
    } catch (error) {
      toast.error("Failed to delete product");
    }
  }, [confirm, productId, navigate]);

  void handleReorderMedia;
  void handleDuplicate;
  void handleArchive;
  void handleDelete;

  const navigateBack = useCallback(() => {
    if (isCollectionContext && returnTo) {
      navigate(returnTo);
      return;
    }
    navigate(-1);
  }, [isCollectionContext, navigate, returnTo]);

  const handleDiscard = useCallback(() => {
    if (hasChanges) {
      setShowDiscardPrompt(true);
      return;
    }
    navigateBack();
  }, [hasChanges, navigateBack]);

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
  const isDraftEditMode = isEditMode && form.status === "DRAFT";

  return (
    <div className="flex flex-col min-h-full bg-transparent text-gray-900 dark:text-[#e5e5e5] font-sans">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 gap-2">
              {isCollectionContext ? (
                <>
                  <button
                    onClick={() => navigate("/studio/store?view=collections")}
                    className="hover:text-gray-900 dark:hover:text-white transition-colors flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Collections
                  </button>
                  <span>/</span>
                  <button
                    onClick={() =>
                      navigate(returnTo || "/studio/store/collections/new")
                    }
                    className="hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Create Collection
                  </button>
                  <span>/</span>
                  <span>{isEditMode ? "Edit Product" : "Add Product"}</span>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate("/studio/store")}
                    className="hover:text-gray-900 dark:hover:text-white transition-colors flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Store
                  </button>
                  <span>/</span>
                  <span>{pageTitle}</span>
                </>
              )}
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
                      form.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"
                        : form.status === "DRAFT"
                          ? "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20"
                          : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        form.status === "ACTIVE"
                          ? "bg-green-500"
                          : form.status === "DRAFT"
                            ? "bg-gray-400"
                            : "bg-orange-500"
                      }`}
                    />
                    {form.status === "ACTIVE"
                      ? "Active"
                      : form.status === "DRAFT"
                        ? "Draft"
                        : "Archived"}
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
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Media
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {mediaUrls.length} of {maxMediaCount} used
                </span>
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
                              onClick={() =>
                                handleSetCover(mediaUrls[carouselIndex].id)
                              }
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
                          onClick={() =>
                            setCarouselIndex(Math.max(0, carouselIndex - 1))
                          }
                          disabled={carouselIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCarouselIndex(
                              Math.min(mediaUrls.length - 1, carouselIndex + 1),
                            )
                          }
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
                            ? "bg-purple-600 scale-110"
                            : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
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
                  <span className="text-xs text-gray-400 mt-1">
                    Up to 4 images
                  </span>
                </button>
              )}

              {!hasPrimaryMedia && mediaUrls.length > 0 && (
                <p className="mt-3 text-xs text-orange-500">
                  Select a cover image before saving.
                </p>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                <p className="text-xs text-gray-500">
                  Up to 4 images • Full preview • Cover required when images
                  exist
                </p>
              </div>
            </div>

            {/* Video Section */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Product Video
                </h3>
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-white/20 p-6 flex flex-col items-center justify-center text-center hover:bg-purple-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-white/10 flex items-center justify-center mb-3 text-purple-500">
                  <Video className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Add Video
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  MP4, WebM up to 50MB
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Details (58% approx -> 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Basic Info */}
            <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                Basic Information
              </h2>

              <div className="space-y-5">
                <Input
                  label="Product Title"
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="Enter product title"
                  data-testid="product-title-input"
                />

                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Product Metadata
                    </p>
                    <span className="text-[10px] font-medium text-gray-400">
                      Scroll inside panel
                    </span>
                  </div>

                  <div className="h-[360px] overflow-y-auto scrollbar-threadly-strong pr-1 sm:pr-2">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-6">
                          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center">
                            Collection (optional)
                            <InfoTooltip text="Link this product to a Store Collection for grouped merchandising. Products can also exist standalone." />
                          </label>
                          <Select
                            value={form.categoryId}
                            onChange={(e) =>
                              handleCollectionChange(e.target.value)
                            }
                            disabled={categoriesLoading || isCollectionFlow}
                          >
                            <option value="">No collection (standalone)</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="md:col-span-6">
                          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center">
                            Category
                            <InfoTooltip text="The primary taxonomy category for this product (e.g., Women's Wear, Men's Wear). Helps with discovery and filtering." />
                          </label>
                          <Select
                            value={form.taxonomyCategoryId}
                            onChange={(e) => {
                              updateForm("taxonomyCategoryId", e.target.value);
                              updateForm("categoryTypeId", "");
                            }}
                            disabled={categoriesLoading}
                          >
                            <option value="">Select category</option>
                            {taxonomyCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="md:col-span-6">
                          <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center">
                            Sub-Category
                            <InfoTooltip text="A more specific type within the selected category (e.g., Evening Wear, Casual Tops)." />
                          </label>
                          <Select
                            value={form.categoryTypeId}
                            onChange={(e) =>
                              updateForm("categoryTypeId", e.target.value)
                            }
                            disabled={
                              !form.taxonomyCategoryId &&
                              availableCategoryTypes.length === 0
                            }
                          >
                            {(() => {
                              const scoped = form.taxonomyCategoryId
                                ? selectedTaxonomyCategoryTypes
                                : availableCategoryTypes;
                              if (scoped.length === 0) {
                                return (
                                  <option value="">
                                    No sub-categories available
                                  </option>
                                );
                              }
                              return [
                                <option key="subcategory-placeholder" value="">
                                  Select sub-category
                                </option>,
                                ...scoped.map((ct) => (
                                  <option key={ct.id} value={ct.id}>
                                    {ct.name}
                                  </option>
                                )),
                              ];
                            })()}
                          </Select>
                        </div>

                        <div className="md:col-span-6 flex items-start justify-between gap-3 rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2.5">
                          <p className="text-[11px] text-gray-500">
                            {categoriesLoading
                              ? "Loading collections…"
                              : categories.length
                                ? "Choose a collection or keep this product standalone."
                                : "No collections yet. This product can stay standalone."}
                          </p>
                          {!categoriesLoading && categories.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const suffix = productId
                                  ? `?productId=${encodeURIComponent(productId)}`
                                  : "";
                                navigate(
                                  `/studio/store/collections/new${suffix}`,
                                );
                              }}
                              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 transition-colors whitespace-nowrap"
                            >
                              Create collection
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                          Filters
                          <InfoTooltip text="Select filter dimensions (fabric, occasion, season, etc.) to generate relevant tag suggestions for your product." />
                        </label>
                        <FilterSelector
                          value={filterSelection}
                          onChange={setFilterSelection}
                          entityType="PRODUCT"
                          onTagSuggestions={setTagSuggestions}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center">
                          Tags
                          <InfoTooltip text="Tags improve discoverability. Add them manually or click suggested tags from the filter selections above." />
                        </label>
                        {tagSuggestions.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                              Suggested tags from filters:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {tagSuggestions
                                .filter((t) => !form.tags.includes(t))
                                .slice(0, 12)
                                .map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => {
                                      if (!form.tags.includes(suggestion)) {
                                        updateForm("tags", [
                                          ...form.tags,
                                          suggestion,
                                        ]);
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-purple-50 dark:bg-purple-500/10
                                      text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-500/20
                                      hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                                  >
                                    + {suggestion}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        <div className="bg-white dark:bg-zinc-900/60 border border-gray-300/80 dark:border-zinc-700/60 rounded-xl px-3 py-2 min-h-[44px] flex items-center gap-2 shadow-sm">
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
                        <p className="text-[11px] text-gray-500 mt-1">
                          Add one tag at a time. Use Enter or the Add button.
                        </p>
                      </div>

                      <Textarea
                        label="Description"
                        rows={4}
                        placeholder="Describe your product..."
                        value={form.description}
                        onChange={(e) =>
                          updateForm("description", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/30 dark:bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Product Operations
                </p>
                <span className="text-[10px] font-medium text-gray-400">
                  Scroll inside panel
                </span>
              </div>
              <div className="h-[460px] md:h-[520px] overflow-y-auto scrollbar-threadly-strong p-4 space-y-4">
                {/* Pricing */}
                <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSection("pricing")}
                      className="flex items-center gap-2 text-left"
                    >
                      <h2 className="text-base font-medium text-gray-900 dark:text-white">
                        Pricing
                      </h2>
                      {collapsedSections.pricing ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        On Sale
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.onSale}
                          onChange={(e) =>
                            updateForm("onSale", e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                      </label>
                    </div>
                  </div>

                  {!collapsedSections.pricing && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        label="Price"
                        required
                        type="number"
                        value={form.price || ""}
                        onChange={(e) =>
                          updateForm("price", Number(e.target.value))
                        }
                        placeholder="0"
                        startIcon={
                          <span className="text-gray-400 dark:text-zinc-500 text-sm">
                            ₦
                          </span>
                        }
                        data-testid="product-price-input"
                        inputSize="sm"
                        className="[&_label]:text-xs [&_label]:mb-1"
                      />
                      <Input
                        label="Sale Price"
                        type="number"
                        value={form.compareAtPrice || ""}
                        onChange={(e) =>
                          updateForm("compareAtPrice", Number(e.target.value))
                        }
                        placeholder="0"
                        disabled={!form.onSale}
                        startIcon={
                          <span className="text-gray-400 dark:text-zinc-500 text-sm">
                            ₦
                          </span>
                        }
                        inputSize="sm"
                        className="[&_label]:text-xs [&_label]:mb-1"
                      />
                      <div>
                        <Input
                          label="Cost per Item"
                          type="number"
                          value={form.costPerItem || ""}
                          onChange={(e) =>
                            updateForm("costPerItem", Number(e.target.value))
                          }
                          placeholder="0"
                          startIcon={
                            <span className="text-gray-400 dark:text-zinc-500 text-sm">
                              ₦
                            </span>
                          }
                          inputSize="sm"
                          className="[&_label]:text-xs [&_label]:mb-1"
                        />
                        {profitMargin.margin > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Margin: {profitMargin.margin}% • Profit:{" "}
                            {formatCurrency(profitMargin.profit, form.currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Variants */}
                <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl overflow-hidden">
                  <div
                    className={`p-4 flex items-center justify-between ${collapsedSections.variants ? "" : "border-b border-gray-200 dark:border-white/5"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection("variants")}
                      className="flex items-center gap-2 text-left"
                    >
                      <h2 className="text-base font-medium text-gray-900 dark:text-white">
                        Variants
                      </h2>
                      {collapsedSections.variants ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {!collapsedSections.variants && (
                      <button
                        type="button"
                        onClick={addVariant}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition"
                      >
                        + Add Color Group
                      </button>
                    )}
                  </div>

                  {!collapsedSections.variants && hasDuplicateVariants && (
                    <div className="px-6 py-3 text-xs text-orange-300 bg-orange-500/10 border-b border-orange-500/20">
                      Duplicate variants detected (same size/color). Please
                      adjust or remove duplicates.
                    </div>
                  )}

                  {!collapsedSections.variants &&
                    (form.variants.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-gray-400 text-sm mb-2">
                          No variants yet
                        </p>
                        <p className="text-gray-500 text-xs">
                          Add a color group, then add multiple sizes to it
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        {variantColorGroups.map((group) => {
                          return (
                            <div
                              key={group.stableKey}
                              className="rounded-lg border border-gray-200/70 dark:border-white/10 overflow-hidden"
                            >
                              {/* Color group header */}
                              <div className="px-3 py-2 bg-gray-50/80 dark:bg-white/5 flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 shrink-0">
                                    Color:
                                  </span>
                                  <Input
                                    type="text"
                                    value={group.color}
                                    onChange={(e) => {
                                      const newColor = e.target.value;
                                      group.variants.forEach(({ originalIndex }) => {
                                        updateVariant(originalIndex, {
                                          color: newColor,
                                        });
                                      });
                                    }}
                                    placeholder="e.g. Green"
                                    inputSize="sm"
                                    fullWidth={false}
                                    className="w-28"
                                  />
                                  <span className="text-[10px] text-gray-400">
                                    {group.variants.length} size
                                    {group.variants.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addVariantForColor(group.color)
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition"
                                  >
                                    <Plus className="w-3 h-3" /> Size
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeColorGroup(group.color)
                                    }
                                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                    title="Remove all sizes for this color"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Quick-add sizes */}
                              <div className="px-3 py-1.5 border-b border-gray-200/50 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.02]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 shrink-0">
                                    Quick add:
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="e.g. S, M, L, XL, 6XL"
                                    className="flex-1 text-xs bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const input = e.currentTarget;
                                        addMultipleSizesForColor(
                                          group.color,
                                          input.value,
                                        );
                                        input.value = "";
                                      }
                                    }}
                                  />
                                  <span className="text-[9px] text-gray-400 shrink-0">
                                    Enter to add
                                  </span>
                                </div>
                              </div>

                              {/* Size rows */}
                              <div className="divide-y divide-gray-100 dark:divide-white/5">
                                {group.variants.map(
                                  ({ variant, originalIndex }) => (
                                    <div
                                      key={variant.id || originalIndex}
                                      className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                      <Input
                                        type="text"
                                        list="threadly-size-options"
                                        value={variant.size ?? ""}
                                        onChange={(e) =>
                                          updateVariant(originalIndex, {
                                            size: e.target.value,
                                          })
                                        }
                                        placeholder="Size"
                                        inputSize="sm"
                                        fullWidth={false}
                                        className="w-20"
                                      />
                                      <Input
                                        type="number"
                                        value={
                                          typeof variant.price === "number"
                                            ? variant.price
                                            : ""
                                        }
                                        onChange={(e) =>
                                          updateVariant(originalIndex, {
                                            price:
                                              e.target.value === ""
                                                ? undefined
                                                : Number(e.target.value),
                                          })
                                        }
                                        placeholder={String(form.price || 0)}
                                        startIcon={
                                          <span className="text-gray-400 dark:text-zinc-500 text-[10px]">
                                            ₦
                                          </span>
                                        }
                                        inputSize="sm"
                                        fullWidth={false}
                                        className="w-24"
                                      />
                                      <Input
                                        type="number"
                                        value={
                                          variant.stock === ("" as any)
                                            ? ""
                                            : Number.isFinite(variant.stock)
                                              ? variant.stock
                                              : ""
                                        }
                                        min={0}
                                        onChange={(e) =>
                                          updateVariant(originalIndex, {
                                            stock:
                                              e.target.value === ""
                                                ? ("" as any)
                                                : Number(e.target.value),
                                          })
                                        }
                                        placeholder="Stock"
                                        inputSize="sm"
                                        fullWidth={false}
                                        className="w-16"
                                      />
                                      <span className="text-[9px] text-gray-400 truncate flex-1 min-w-0">
                                        {variant.sku || "auto-SKU"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeVariant(originalIndex)
                                        }
                                        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition shrink-0"
                                        title="Remove size"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <datalist id="threadly-size-options">
                          <option value="XS" />
                          <option value="S" />
                          <option value="M" />
                          <option value="L" />
                          <option value="XL" />
                          <option value="XXL" />
                          <option value="3XL" />
                          <option value="4XL" />
                          <option value="5XL" />
                          <option value="6XL" />
                          <option value="One Size" />
                        </datalist>

                        <div className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                          <span>
                            Total variant stock:{" "}
                            <span className="text-gray-900 dark:text-gray-200">
                              {variantTotalStock}
                            </span>
                          </span>
                          <span>Tip: leave price blank to use base price</span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Inventory & Shipping Grid */}
                <SizingConfigurator
                  contentType="product"
                  sizingMode={form.sizingMode}
                  onSizingModeChange={(value) => updateForm("sizingMode", value)}
                  rtwSizeSystem={form.rtwSizeSystem}
                  onRtwSizeSystemChange={(value) =>
                    updateForm("rtwSizeSystem", value)
                  }
                  customMeasurementKeys={form.customMeasurementKeys}
                  onCustomMeasurementKeysChange={(keys) =>
                    updateForm("customMeasurementKeys", keys)
                  }
                  fitPreference={form.fitPreference}
                  onFitPreferenceChange={(value) =>
                    updateForm("fitPreference", value)
                  }
                  targetAgeGroup={form.targetAgeGroup}
                  onTargetAgeGroupChange={(value) =>
                    updateForm("targetAgeGroup", value)
                  }
                />

                <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={() => toggleSection("fulfillment")}
                    className="flex items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-medium text-gray-900 dark:text-white">
                      Inventory & Shipping
                    </h2>
                    {collapsedSections.fulfillment ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  {!collapsedSections.fulfillment && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Inventory */}
                      <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-medium text-gray-900 dark:text-white">
                            Inventory
                          </h2>
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
                            inputSize="sm"
                            className="[&_label]:text-xs [&_label]:mb-1"
                          />
                          <div>
                            <Input
                              label="Stock Quantity"
                              type="number"
                              value={
                                form.variants.length > 0
                                  ? variantTotalStock
                                  : form.stock || ""
                              }
                              onChange={(e) =>
                                updateForm("stock", Number(e.target.value))
                              }
                              placeholder="0"
                              disabled={form.variants.length > 0}
                              inputSize="sm"
                              className="[&_label]:text-xs [&_label]:mb-1"
                            />
                            {form.variants.length > 0 && (
                              <p className="text-[10px] text-gray-500 mt-1">
                                Derived from variants. Edit stock per variant
                                above.
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <input
                              type="checkbox"
                              id="track-qty"
                              checked={form.trackInventory}
                              onChange={(e) =>
                                updateForm("trackInventory", e.target.checked)
                              }
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="track-qty"
                              className="text-xs text-gray-700 dark:text-gray-300"
                            >
                              Track quantity
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="continue-selling"
                              checked={form.allowBackorders}
                              onChange={(e) =>
                                updateForm("allowBackorders", e.target.checked)
                              }
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="continue-selling"
                              className="text-xs text-gray-700 dark:text-gray-300"
                            >
                              Continue selling when out of stock
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Shipping */}
                      <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
                        <h2 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                          Shipping
                        </h2>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-4">
                            <input
                              type="checkbox"
                              id="physical-product"
                              checked={form.isPhysicalProduct}
                              onChange={(e) =>
                                updateForm(
                                  "isPhysicalProduct",
                                  e.target.checked,
                                )
                              }
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="physical-product"
                              className="text-xs text-gray-700 dark:text-gray-300"
                            >
                              This is a physical product
                            </label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="relative">
                                <Input
                                  label="Weight"
                                  type="number"
                                  value={form.weight || ""}
                                  onChange={(e) =>
                                    updateForm("weight", Number(e.target.value))
                                  }
                                  placeholder="0"
                                  endIcon={
                                    <span className="text-gray-400 dark:text-zinc-500 text-xs">
                                      {form.weightUnit}
                                    </span>
                                  }
                                  inputSize="sm"
                                  className="[&_label]:text-xs [&_label]:mb-1"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                Ship To Countries
                              </p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                                Prefilled from Store Setup. Changes here update
                                your store shipping regions.
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {SHIPPING_REGION_OPTIONS.map((opt) => {
                                  const isSelected =
                                    normalizedShippingRegions.includes(opt.code);
                                  return (
                                    <label
                                      key={opt.code}
                                      className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                                        isSelected
                                          ? "border-purple-500/60 bg-purple-500/10 text-gray-900 dark:text-white"
                                          : "border-gray-300/70 dark:border-white/15 text-gray-700 dark:text-gray-300"
                                      } ${!form.isPhysicalProduct ? "opacity-60" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          toggleShippingRegion(opt.code)
                                        }
                                        disabled={!form.isPhysicalProduct}
                                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {shippingRegionsLoading && (
                                <p className="mt-2 text-[10px] text-gray-500">
                                  Loading store shipping regions...
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Details */}
                <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={() => toggleSection("additional")}
                    className="flex items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-medium text-gray-900 dark:text-white">
                      Additional Details
                    </h2>
                    {collapsedSections.additional ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    )}
                  </button>

                  {!collapsedSections.additional && (
                    <>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Materials"
                          type="text"
                          value={form.materials}
                          onChange={(e) =>
                            updateForm("materials", e.target.value)
                          }
                          placeholder="e.g., 100% Organic Cotton"
                          inputSize="sm"
                          className="[&_label]:text-xs [&_label]:mb-1"
                        />
                        <Input
                          label="Care Instructions"
                          type="text"
                          value={form.careInstructions}
                          onChange={(e) =>
                            updateForm("careInstructions", e.target.value)
                          }
                          placeholder="e.g., Machine wash cold, tumble dry low"
                          inputSize="sm"
                          className="[&_label]:text-xs [&_label]:mb-1"
                        />
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200/70 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-900 dark:text-white font-medium">
                              Returns Eligible
                            </p>
                            <p className="text-xs text-gray-500">
                              Allow customers to return this item within 30 days
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.returnsEligible}
                              onChange={(e) =>
                                updateForm("returnsEligible", e.target.checked)
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-900 dark:text-white font-medium">
                              Sustainability Claim
                            </p>
                            <p className="text-xs text-gray-500">
                              Display eco-friendly badge on product page
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.sustainabilityClaim}
                              onChange={(e) =>
                                updateForm(
                                  "sustainabilityClaim",
                                  e.target.checked,
                                )
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                          </label>
                        </div>
                      </div>
                    </>
                  )}
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
            {!isEditMode && !isCollectionContext && (
              <button
                onClick={() =>
                  void triggerSave(true, {
                    action: "draft",
                    forceStatus: "DRAFT",
                  })
                }
                disabled={saving || submitLocked}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                {(saving || submitLocked) && saveAction === "draft" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save as Draft
              </button>
            )}
            {isDraftEditMode && !isCollectionContext && (
              <button
                onClick={() =>
                  void triggerSave(true, {
                    action: "draft",
                    forceStatus: "DRAFT",
                  })
                }
                disabled={saving || submitLocked}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                {(saving || submitLocked) && saveAction === "draft" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save Changes
              </button>
            )}
            <button
              onClick={handleDiscard}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              {hasChanges
                ? "Discard Changes"
                : isCollectionContext
                  ? "Back to Collection"
                  : "Cancel"}
            </button>
            <button
              onClick={() =>
                void triggerSave(false, {
                  action: "publish",
                  forceStatus: isCollectionFlow
                    ? "DRAFT"
                    : isCollectionContext
                    ? "ACTIVE"
                    : isDraftEditMode
                      ? "ACTIVE"
                      : undefined,
                })
              }
                disabled={saving || submitLocked}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white text-sm font-semibold rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
                {(saving || submitLocked) && saveAction === "publish" && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isDraftEditMode
                ? "Publish Product"
                : isCollectionContext && isEditMode
                  ? "Save to Collection"
                  : isEditMode
                    ? "Save Changes"
                    : isCollectionFlow
                      ? "Add to Collection"
                      : "Create Product"}
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
          currentPrice={pricePreviewData.oldPrice}
          newPrice={pricePreviewData.newPrice}
          affectedCollections={pricePreviewData.affectedCollections}
          onConfirm={handlePriceChangeConfirm}
          onClose={() => setShowPricePreview(false)}
          isLoading={saving}
        />
      )}

      {/* Discard Changes Modal - Premium styled */}
      <DiscardChangesModal
        isOpen={showDiscardPrompt}
        onClose={() => setShowDiscardPrompt(false)}
        onDiscard={() => {
          setHasChanges(false);
          navigateBack();
        }}
        title="Discard Changes?"
        message={
          !isEditMode
            ? isCollectionContext
              ? "You have unsaved changes. Go back to collection without adding this product?"
              : "You have unsaved changes. Would you like to save this as a draft before leaving?"
            : "You have unsaved changes. Are you sure you want to discard them? This action cannot be undone."
        }
      />
    </div>
  );
};

export default EditProduct;
