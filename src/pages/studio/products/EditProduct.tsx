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
  X,

} from "lucide-react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import VLoader from "@/components/loaders/VLoader";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

import { toast } from "sonner";
import MediaRenderer from "@/components/media/MediaRenderer";
import {
  productApi,
  type ProductCreateDto,
  type ProductDto,
  type Category,
  type ProductVariant,
} from "@/api/ProductApi";
import { brandApi, type CategoryTypeOption } from "@/api/BrandApi";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import UniversalSelect, {
  type UniversalSelectOption,
} from "@/components/forms/UniversalSelect";
import Tag from "@/components/ui/Tag";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { useConfirm } from "@/components/ui/useConfirm";
import { DiscardChangesModal } from "@/components/studio/store/modals";
import { isCustomSizingMode, isRtwSizingMode, normalizeSizingMode, type SizingMode } from '@/types/sizing';
import CustomOrderConfigurationEditor, {
  type CustomOrderConfigurationEditorHandle,
} from '@/components/custom-orders/CustomOrderConfigurationEditor';
import {
  customOrderConfigurationsApi,
  type CustomOrderConfigurationUpsertInput,
} from '@/api/CustomOrderApi';
import {
  normalizePrimary,
  reorderItems,
  setPrimary,
  validateMedia,
} from "./mediaUtils";
import { getTagColor } from "@/utils/tagColors";
import {
  needsResubmission,
  normalizeContentReviewStatus,
  primaryActionLabel,
  reviewStateHint,
} from "@/utils/contentReviewActions";
import FilterSelector, {
  type FilterSelection,
} from "@/components/categories/FilterSelector";
import SizingConfigurator from "@/components/sizing/SizingConfigurator";
import HashtagPickerModal from "@/components/tags/HashtagPickerModal";
import ReviewFeedbackBanner from "@/components/content-review/ReviewFeedbackBanner";
import { PriceChangePreviewModal } from "@/components/collections/PriceChangePreviewModal";
import {
  getProductPriceChangePreview,
  getStorePolicies,
  updateStorePolicies,
  type CollectionPriceImpact,
} from "@/api/StoreApi";
import { emitProductStudioSync } from "@/utils/productStudioEvents";
import { createPublishTask } from "@/utils/publishTracker";
import { runProductPublishJob } from "@/features/products/productPublishJob";
import { TourOverlay, type TourStep } from "@/components/ui/TourOverlay";
import { useOneTimeTour } from "@/hooks/useOneTimeTour";
import StudioPageSkeleton from "@/components/studio/StudioPageSkeleton";
import {
  isBrandProfileComplete,
  resolveBrandProfileSetupDestination,
} from "@/utils/storeSetup";
import {
  deriveProductionLeadDaysFromStoreTime,
  getStoreProcessingTimeLabel,
} from "@/utils/storeProcessing";
import { preprocessImageFile } from "@/utils/imagePreprocess";
import {
  isBrowserDisplayableSniff,
  isUnreadableSniff,
  sniffImageFormat,
} from "@/utils/imageByteSniff";
import { WEB_UPLOAD_POLICIES } from "@/utils/uploadValidation";
import { getNormalizedImageFile } from "@/api/UploadApi";
import {
  CREATOR_AUDIENCE_OPTIONS,
  CREATOR_METADATA_HELP,
  type CreatorAudience,
  mapCreatorMetadataError,
  normalizeHashtagLabel,
} from "@/utils/creatorMetadata";
import {
  MEDIA_VIEW_SLOT_OPTIONS,
  getContentStatusLabel,
  getContentStatusTone,
  getMediaViewSlotLabel,
  getMissingRequiredMediaSlots,
  normalizeMediaViewSlot,
  toBackendMediaViewSlot,
  type MediaViewSlot,
} from "@/utils/contentIntegrity";
import { queryKeys } from "@/query/queryKeys";
import useCachedResource from "@/hooks/useCachedResource";
import MediaSlotGrid, {
  type MediaSlotGridItem,
} from "@/components/media/MediaSlotGrid";
import {
  PRODUCT_PUBLISH_FIELD_ANCHOR,
  PRODUCT_PUBLISH_FIELD_LABEL,
  PRODUCT_PUBLISH_FIELD_STEP,
  fieldsForStep,
  validateProductForPublish,
  type ProductPublishField,
} from "./productPublishValidation";

// The media grid only renders the first 6 view-slots (one per allowed image).
// Every media item must map to one of these, uniquely — otherwise an item lands
// on a non-rendered slot (or collides with another) and silently disappears,
// which reads to users as a lost/duplicated image on drag-and-drop.
const RENDERABLE_MEDIA_SLOTS: MediaViewSlot[] = MEDIA_VIEW_SLOT_OPTIONS.slice(
  0,
  6,
).map((option) => option.value);

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

// ── Variant color-group identity (UI only) ──────────────────────────────────
// The editor groups size rows under a color. Grouping used to key purely on the
// color STRING, so two not-yet-named colors both collapsed into one group (and
// every keystroke re-grouped, dropping focus). A stable per-group id fixes both.
let colorGroupIdSeq = 0;
const nextColorGroupId = (): string =>
  `cg_${Date.now().toString(36)}_${(colorGroupIdSeq++).toString(36)}`;

/** Backfill a stable colorGroupId onto loaded variants — one per distinct color,
 *  and a unique group for each blank color so unnamed colors never merge. */
const withColorGroupIds = (variants: ProductVariant[]): ProductVariant[] => {
  const byColor = new Map<string, string>();
  return variants.map((v) => {
    if (v.colorGroupId && v.colorGroupId.trim()) return v;
    const color = (v.color ?? "").trim().toLowerCase();
    if (!color) return { ...v, colorGroupId: nextColorGroupId() };
    let gid = byColor.get(color);
    if (!gid) {
      gid = nextColorGroupId();
      byColor.set(color, gid);
    }
    return { ...v, colorGroupId: gid };
  });
};

const variantMatchesGroup = (
  v: ProductVariant,
  group: { colorGroupId?: string; color: string },
): boolean => {
  if (group.colorGroupId) return v.colorGroupId === group.colorGroupId;
  return (
    (v.color ?? "").trim().toLowerCase() === group.color.trim().toLowerCase()
  );
};

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

const PRODUCT_VARIANT_SIZE_OPTIONS = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "XXXXL",
] as const;

const PRODUCT_VARIANT_SIZE_ALIAS_MAP: Record<string, string> = {
  XSM: "XS",
  "2XL": "XXL",
  "3XL": "XXXL",
  "4XL": "XXXXL",
};

const MIN_PUBLISH_VARIANT_COUNT = 5;

const MAX_PRODUCT_TAGS = 20;

const PRODUCT_VARIANT_SIZE_LABELS = PRODUCT_VARIANT_SIZE_OPTIONS.join(", ");

const normalizeProductVariantSize = (
  value: string | null | undefined,
): string | null => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const compact = normalized.toUpperCase().replace(/[\s-]+/g, "");
  const aliased = PRODUCT_VARIANT_SIZE_ALIAS_MAP[compact] ?? compact;
  return PRODUCT_VARIANT_SIZE_OPTIONS.includes(
    aliased as (typeof PRODUCT_VARIANT_SIZE_OPTIONS)[number],
  )
    ? aliased
    : null;
};

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
  gender: CreatorAudience;
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
  sizingMode: SizingMode;
  rtwSizeSystem: string;
  customMeasurementKeys: string[];
  customOrderEnabled: boolean;
}

type ProductMediaPreview = {
  id: string;
  url: string;
  isPrimary?: boolean;
  fileUploadId?: string | null;
  viewSlot?: MediaViewSlot | string | null;
};

type TaxonomyCategoryOption = {
  id: string;
  name: string;
  types: { id: string; name: string }[];
};

type ProductEditorSupportData = {
  categories: Category[];
  collectionCategoryById: Record<string, string>;
  taxonomyCategories: TaxonomyCategoryOption[];
  categoryTypes: CategoryTypeOption[];
};

type ProductEditorPolicyDefaults = {
  shippingRegions: string[];
  processingTime: string;
  customOrderLeadTime: string;
};

const defaultFormState: FormState = {
  title: "",
  description: "",
  categoryId: "",
  taxonomyCategoryId: "",
  categoryTypeId: "",
  gender: "EVERYBODY",
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
  customOrderEnabled: false,
};

const STANDALONE_COLLECTION_VALUE = "__standalone__";

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

const buildHiddenCustomOrderBasisLabel = (productTitle: string): string => {
  const trimmedTitle = productTitle.trim();
  return `${trimmedTitle || 'Product'} fabric rules`;
};

const createCustomOrderConfigurationWithBasis = async (
  draft: Omit<CustomOrderConfigurationUpsertInput, 'sourceId'>,
  sourceId: string,
  productTitle: string,
) => {
  const payload: Omit<CustomOrderConfigurationUpsertInput, 'sourceId'> = { ...draft };
  const basisId = String(payload.fabricRuleBasisId ?? '').trim();

  if (!basisId) {
    const hiddenBasis = await customOrderConfigurationsApi.createFabricRuleBasis({
      label: buildHiddenCustomOrderBasisLabel(productTitle),
      measurementKeys: payload.requiredMeasurementKeys,
    });
    payload.fabricRuleBasisId = hiddenBasis.id;
  } else if (basisId !== payload.fabricRuleBasisId) {
    payload.fabricRuleBasisId = basisId;
  }

  return customOrderConfigurationsApi.create({
    ...payload,
    sourceId,
  });
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
  const queryClient = useQueryClient();

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
  const catalogVerificationRedirect = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    return `/profile?verifyEmailPrompt=catalog-create&next=${encodeURIComponent(nextPath)}`;
  }, [location.pathname, location.search]);
  const catalogProfileSetupRedirect = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    return resolveBrandProfileSetupDestination(nextPath);
  }, [location.pathname, location.search]);
  const requiresCatalogEmailVerification =
    !isEditMode && user?.type === "BRAND" && user?.isEmailVerified === false;
  const requiresCatalogProfileSetup =
    !isEditMode && user?.type === "BRAND" && !isBrandProfileComplete(user);
  const productDetailQueryKey = useMemo(
    () => queryKeys.store.product(productId, { includeDeleted }),
    [includeDeleted, productId],
  );
  const cachedProductDetail = productId
    ? queryClient.getQueryData<ProductDto | null>(productDetailQueryKey)
    : undefined;
  const defaultShippingRegion =
    normalizeShippingRegionCode(defaultFormState.customsRegion) ??
    defaultFormState.customsRegion;
  const productEditorSupportQueryKey = useMemo(
    () => ['product-editor', 'support-data', user?.id ?? 'anon'] as const,
    [user?.id],
  );
  const storePolicyDefaultsQueryKey = useMemo(
    () => ['product-editor', 'store-policy-defaults', user?.id ?? 'anon'] as const,
    [user?.id],
  );

  const { data: productEditorSupportData, loading: categoriesLoading } =
    useCachedResource<ProductEditorSupportData>({
      queryKey: productEditorSupportQueryKey,
      queryFn: async () => {
        const [collectionsResult, categoryTypesResult, categoriesWithSubResult] =
          await Promise.allSettled([
            user?.id
              ? brandApi.getCollections(user.id, { visibility: "all", scope: "store" })
              : Promise.resolve(null),
            brandApi.getCategoryTypes(undefined, true),
            brandApi.getCategoriesWithSubCategories(true),
          ]);

        const collections =
          collectionsResult.status === "fulfilled" ? collectionsResult.value : null;
        const mappedCollections: Category[] = user?.id
          ? (collections || [])
              .filter((c: any) => Boolean(c?.isAvailableInStore))
              .map((c: any) => ({
                id: String(c.id),
                name: String(c.title || c.name || "Untitled collection"),
                slug: String(c.id),
              }))
          : [];

        const categoryByCollection: Record<string, string> = {};
        (collections || []).forEach((c: any) => {
          if (c?.id && c?.categoryId) {
            categoryByCollection[String(c.id)] = String(c.categoryId);
          }
        });

        const categoriesWithSub =
          categoriesWithSubResult.status === "fulfilled"
            ? categoriesWithSubResult.value
            : null;
        const taxonomyCategories: TaxonomyCategoryOption[] = Array.isArray(categoriesWithSub)
          ? categoriesWithSub.map((c: any) => ({
              id: String(c.id),
              name: String(c.name || ""),
              types: (c.types || []).map((t: any) => ({
                id: String(t.id),
                name: String(t.name || ""),
              })),
            }))
          : [];

        let resolvedTypes =
          categoryTypesResult.status === "fulfilled" &&
          Array.isArray(categoryTypesResult.value)
            ? categoryTypesResult.value
            : [];
        if (resolvedTypes.length === 0 && Array.isArray(categoriesWithSub)) {
          resolvedTypes = categoriesWithSub
            .flatMap((category: any) => category.types ?? [])
            .filter((type: any) => Boolean(type?.id) && Boolean(type?.name));
        }

        return {
          categories: mappedCollections,
          collectionCategoryById: categoryByCollection,
          taxonomyCategories,
          categoryTypes: resolvedTypes,
        };
      },
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

  const { data: storePolicyDefaults, loading: shippingRegionsLoading } =
    useCachedResource<ProductEditorPolicyDefaults>({
      queryKey: storePolicyDefaultsQueryKey,
      enabled: Boolean(user?.id),
      queryFn: async () => {
        try {
          const policies = await getStorePolicies();
          const fromPolicy = normalizeShippingRegionCodes(
            policies.shippingRegions || [],
          );
          return {
            shippingRegions: fromPolicy.length > 0 ? fromPolicy : [defaultShippingRegion],
            processingTime: policies.processingTime || '',
            customOrderLeadTime:
              policies.shippingRules?.customOrderSettings?.leadTime || '',
          };
        } catch (error) {
          console.error("Failed to load store shipping regions", error);
          return {
            shippingRegions: [defaultShippingRegion],
            processingTime: '',
            customOrderLeadTime: '',
          };
        }
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    });

  // State
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [contentStatus, setContentStatus] = useState<string | null>(null);
  const [reviewSearchParams] = useSearchParams();
  // Reviewer note carried on the notification deep link — display fallback
  // only; the banner itself is gated on the server-side review state.
  const reviewNoteParam = reviewSearchParams.get('reviewNote')?.trim() || '';
  const [categories, setCategories] = useState<Category[]>(
    () => productEditorSupportData?.categories ?? [],
  );
  const [collectionCategoryById, setCollectionCategoryById] = useState<
    Record<string, string>
  >(() => productEditorSupportData?.collectionCategoryById ?? {});
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeOption[]>(
    () => productEditorSupportData?.categoryTypes ?? [],
  );
  const [loading, setLoading] = useState(
    () => isEditMode && cachedProductDetail === undefined,
  );
  const [saving, setSaving] = useState(false);
  const [shippingRegions, setShippingRegions] = useState<string[]>([
    ...(storePolicyDefaults?.shippingRegions ?? [defaultShippingRegion]),
  ]);
  const [savedShippingRegions, setSavedShippingRegions] = useState<string[]>([
    ...(storePolicyDefaults?.shippingRegions ?? [defaultShippingRegion]),
  ]);
  const [storeProcessingTime, setStoreProcessingTime] = useState('');
  const [storeCustomOrderLeadTime, setStoreCustomOrderLeadTime] = useState('');
  const [saveAction, setSaveAction] = useState<"draft" | "publish" | null>(
    null,
  );
  const [submitLocked, setSubmitLocked] = useState(false);
  const submitLockRef = useRef(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Warn before tab close/refresh with unsaved edits — protects long forms
  // (incl. custom-order settings that attach on save).
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);
  const [tagInput, setTagInput] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
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
  // 3-step wizard: 1 = Details (media + basics), 2 = Operations
  // (pricing/variants/inventory/sizing/fulfillment/additional), 3 = Review.
  // Steps are toggled by visibility only — every section stays mounted so no
  // state, ref, preview, or drag-drop handler is ever lost between steps.
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const wizardTopRef = useRef<HTMLDivElement | null>(null);
  // Auto-start the tour the first time a user opens the create-product page.
  // The seen-flag is persisted the moment it is shown (not only on close), so
  // ignoring it or navigating away is as permanent as pressing "Skip tour".
  const { isActive: isTourActive, close: handleTourClose } = useOneTimeTour(
    'wiez_tour_product_create',
    { enabled: !isEditMode },
  );
  const { confirm, ConfirmDialog: ConfirmModal } = useConfirm();

  const [taxonomyCategories, setTaxonomyCategories] = useState<
    TaxonomyCategoryOption[]
  >(() => productEditorSupportData?.taxonomyCategories ?? []);
  const [filterSelection, setFilterSelection] = useState<FilterSelection>({});
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Media state (simplified - using URLs for display)
  const [mediaUrls, setMediaUrls] = useState<ProductMediaPreview[]>([]);

  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const quickAddSizeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingUploadSlotRef = useRef<MediaViewSlot | null>(null);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    Array<{
      id: string;
      tempId: string;
      file: File;
      previewUrl: string;
      isPrimary: boolean;
      viewSlot: MediaViewSlot;
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
  // Custom order: on new product, hidden by default. On edit, shown if a
  // configuration already exists (resolved via the editor's own load logic).
  const [showCustomOrderForm, setShowCustomOrderForm] = useState(false);
  const customOrderEditorRef =
    useRef<CustomOrderConfigurationEditorHandle | null>(null);
  const [pendingStatusOverride, setPendingStatusOverride] = useState<
    FormState["status"] | null
  >(null);

  const minRequiredMediaCount = 4;
  const maxMediaCount = 6;
  const canAddMoreMedia = mediaUrls.length < maxMediaCount;
  const hasPrimaryMedia = useMemo(
    () => mediaUrls.some((m) => m.isPrimary),
    [mediaUrls],
  );
  const missingRequiredProductMediaSlots = useMemo(
    () => getMissingRequiredMediaSlots(mediaUrls),
    [mediaUrls],
  );

  // Assign every media item a UNIQUE, rendered slot. If an item's stored slot is
  // not one of the 6 rendered slots, or is already taken by an earlier item, it
  // spills to the next free rendered slot instead of overwriting (Map collision)
  // and vanishing. This keeps what the user sees consistent with drag/drop, which
  // identifies items by the slot they are actually DISPLAYED in.
  const mediaBySlot = useMemo(() => {
    const bySlot = new Map<MediaViewSlot, ProductMediaPreview>();
    const used = new Set<MediaViewSlot>();
    mediaUrls.forEach((item, index) => {
      let slot = normalizeMediaViewSlot(item.viewSlot, index);
      if (!RENDERABLE_MEDIA_SLOTS.includes(slot) || used.has(slot)) {
        slot = RENDERABLE_MEDIA_SLOTS.find((candidate) => !used.has(candidate)) ?? slot;
      }
      used.add(slot);
      bySlot.set(slot, item);
    });
    return bySlot;
  }, [mediaUrls]);

  const buildStructuredMediaPayload = useCallback(
    () =>
      mediaUrls
        .map((item, index) => ({
          fileUploadId: String(item.fileUploadId || item.id || "").trim(),
          viewSlot: toBackendMediaViewSlot(item.viewSlot, index),
          orderIndex: index,
        }))
        .filter(
          (entry) =>
            entry.fileUploadId.length > 0 &&
            !entry.fileUploadId.startsWith("pending-"),
        ),
    [mediaUrls],
  );

  const openMediaPickerForSlot = useCallback((slot: MediaViewSlot) => {
    pendingUploadSlotRef.current = slot;
    mediaFileInputRef.current?.click();
  }, []);

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

  /** Fallback base price so drafts priced only at variant level don't render ₦0 on catalog cards. */
  const minVariantPrice = useMemo(() => {
    const prices = form.variants
      .map((v) => (typeof v.price === "number" && v.price > 0 ? v.price : null))
      .filter((p): p is number => p !== null);
    return prices.length ? Math.min(...prices) : 0;
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

  // Live publish readiness — one evaluation of the backend contract, reused for
  // the stepper fillers, the Continue/Submit gates, the inline field errors and
  // the "still needed" summary. Before this, the wizard checked title + cover
  // and let the server discover the other eleven rules mid-submit.
  const publishErrors = useMemo(
    () =>
      validateProductForPublish({
        title: form.title,
        description: form.description,
        taxonomyCategoryId: form.taxonomyCategoryId,
        categoryTypeId: form.categoryTypeId,
        gender: form.gender,
        tags: form.tags,
        price: form.price,
        minVariantPrice,
        variantCount: form.variants.length,
        hasDuplicateVariants,
        mediaCount: mediaUrls.length,
        hasCover: hasPrimaryMedia,
        missingMediaSlots:
          missingRequiredProductMediaSlots.map(getMediaViewSlotLabel),
        styleDetailCount: selectedFilterValueIds.length,
        trackInventory: form.trackInventory,
        stock: form.stock,
        customOrderEnabled: form.customOrderEnabled,
      }),
    [
      form.title,
      form.description,
      form.taxonomyCategoryId,
      form.categoryTypeId,
      form.gender,
      form.tags,
      form.price,
      form.variants.length,
      form.trackInventory,
      form.stock,
      form.customOrderEnabled,
      minVariantPrice,
      hasDuplicateVariants,
      mediaUrls.length,
      hasPrimaryMedia,
      missingRequiredProductMediaSlots,
      selectedFilterValueIds.length,
    ],
  );

  const step1Missing = useMemo(
    () => fieldsForStep(publishErrors, 1),
    [publishErrors],
  );
  const step2Missing = useMemo(
    () => fieldsForStep(publishErrors, 2),
    [publishErrors],
  );
  const step1Complete = step1Missing.length === 0;
  const step2Complete = step2Missing.length === 0;

  // A blank new product should not open covered in red. Errors surface once a
  // field has been touched, or immediately when editing an existing product —
  // there, an empty required field is a real defect the brand has to fix, not
  // a form they have not filled in yet.
  const [touchedPublishFields, setTouchedPublishFields] = useState<
    Set<ProductPublishField>
  >(() => new Set());
  const markPublishFieldTouched = useCallback((field: ProductPublishField) => {
    setTouchedPublishFields((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);
  const fieldError = useCallback(
    (field: ProductPublishField): string | undefined =>
      isEditMode || touchedPublishFields.has(field)
        ? publishErrors[field]
        : undefined,
    [isEditMode, publishErrors, touchedPublishFields],
  );

  /** Jump to the field behind a "still needed" chip and reveal its error. */
  const focusPublishField = useCallback(
    (field: ProductPublishField) => {
      markPublishFieldTouched(field);
      const targetStep = PRODUCT_PUBLISH_FIELD_STEP[field];
      setWizardStep(targetStep);
      const anchorId = PRODUCT_PUBLISH_FIELD_ANCHOR[field];
      // One frame so the step's container is visible before we measure it —
      // steps are toggled with `hidden`, and a hidden element has no position.
      requestAnimationFrame(() => {
        const node = document.getElementById(anchorId);
        if (!node) return;
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = node.matches('input, textarea, select')
          ? node
          : node.querySelector<HTMLElement>('input, textarea, button, [tabindex]');
        focusable?.focus({ preventScroll: true });
      });
    },
    [markPublishFieldTouched],
  );

  const normalizedShippingRegions = useMemo(
    () => normalizeShippingRegionCodes(shippingRegions),
    [shippingRegions],
  );

  const hasShippingRegionPolicyChanges = useMemo(
    () =>
      !areShippingRegionSetsEqual(
        normalizedShippingRegions,
        savedShippingRegions,
      ),
    [normalizedShippingRegions, savedShippingRegions],
  );
  const storeProcessingTimeLabel = useMemo(
    () => getStoreProcessingTimeLabel(storeProcessingTime),
    [storeProcessingTime],
  );
  const storeCustomOrderLeadTimeLabel = useMemo(
    () => getStoreProcessingTimeLabel(storeCustomOrderLeadTime || storeProcessingTime),
    [storeCustomOrderLeadTime, storeProcessingTime],
  );
  const storeDefaultProductionLeadDays = useMemo(
    () =>
      deriveProductionLeadDaysFromStoreTime(
        storeCustomOrderLeadTime || storeProcessingTime,
      ),
    [storeCustomOrderLeadTime, storeProcessingTime],
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
    options?: { persistPolicy?: boolean; requireRegions?: boolean },
  ): Promise<string | undefined> => {
    if (!form.isPhysicalProduct) {
      return undefined;
    }

    // Drafts must not require shipping countries — only go-live does.
    if (normalizedShippingRegions.length === 0) {
      if (options?.requireRegions === false) {
        return undefined;
      }
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
    const pendingPreviewUrls = pendingPreviewUrlsRef.current;
    return () => {
      for (const url of pendingPreviewUrls.values()) {
        revokeBlobUrl(url);
      }
      pendingPreviewUrls.clear();
    };
  }, [revokeBlobUrl]);

  // =====================
  // Data Loading
  // =====================

  useEffect(() => {
    if (!storePolicyDefaults) return;
    setShippingRegions(storePolicyDefaults.shippingRegions);
    setSavedShippingRegions(storePolicyDefaults.shippingRegions);
    setStoreProcessingTime(storePolicyDefaults.processingTime);
    setStoreCustomOrderLeadTime(storePolicyDefaults.customOrderLeadTime);
    setForm((prev) => ({
      ...prev,
      customsRegion: storePolicyDefaults.shippingRegions[0] ?? prev.customsRegion,
    }));
  }, [storePolicyDefaults]);

  useEffect(() => {
    if (!productEditorSupportData) return;
    setCategories(productEditorSupportData.categories);
    setCollectionCategoryById(productEditorSupportData.collectionCategoryById);
    setTaxonomyCategories(productEditorSupportData.taxonomyCategories);
    setCategoryTypes(productEditorSupportData.categoryTypes);
  }, [productEditorSupportData]);

  // Load product if editing
  useEffect(() => {
    if (!isEditMode || !productId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadProduct = async () => {
      try {
        const cached = queryClient.getQueryData<ProductDto | null>(productDetailQueryKey);
        setLoading(cached === undefined);
        const product = await queryClient.fetchQuery({
          queryKey: productDetailQueryKey,
          queryFn: () =>
            productApi.getProduct(
              productId,
              includeDeleted ? { includeDeleted: true } : undefined,
            ),
        });
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
        setContentStatus(
          String((product as any).publicationStatus || (product as any).status || resolvedStatus),
        );

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
          gender:
            product.gender === "MALE" ||
            product.gender === "FEMALE" ||
            product.gender === "EVERYBODY"
              ? product.gender
              : "EVERYBODY",
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
              ? withColorGroupIds(product.variants)
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
          sizingMode: normalizeSizingMode(product.sizingMode) as FormState["sizingMode"],
          rtwSizeSystem: product.rtwSizeSystem || "ALPHA",
          customMeasurementKeys: Array.isArray(product.customMeasurementKeys)
            ? product.customMeasurementKeys
            : [],
          customOrderEnabled:
            product.customOrderEnabled ?? product.customAvailable ?? false,
        });
        setShowCustomOrderForm(
          product.customOrderEnabled ?? product.customAvailable ?? false,
        );

        setFilterSelection(normalizeFilterSelectionFromProduct(product));

        // Set media for display - resolve signed URLs
        if (product.media?.length) {
          const mediaWithSignedUrls = await Promise.all(
            product.media.map(async (m, index) => {
              let signedUrl = m.url;
              // Check if URL needs signing (S3 reference without query params)
              const remoteFileId = m.fileUploadId || m.id;
              if (
                remoteFileId &&
                m.url &&
                !m.url.includes("?") &&
                (m.url.includes("s3") || !m.url.startsWith("http"))
              ) {
                try {
                  const signed = await brandApi.getSignedFileUrl(remoteFileId);
                  if (signed) signedUrl = signed;
                } catch (e) {
                  console.warn("Failed to sign URL for media", remoteFileId, e);
                }
              }
              const fileUploadId = remoteFileId;
              return {
                id: fileUploadId,
                fileUploadId,
                url: signedUrl,
                isPrimary: m.isPrimary,
                viewSlot: normalizeMediaViewSlot(m.viewSlot, index),
              };
            }),
          );
          setMediaUrls(normalizePrimary(mediaWithSignedUrls));
        } else if (product.images?.length) {
          const mapped = product.images.map((url, i) => ({
            id: `img-${i}`,
            url,
            isPrimary: product.thumbnail ? url === product.thumbnail : i === 0,
            viewSlot: normalizeMediaViewSlot(null, i),
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
  }, [includeDeleted, isEditMode, productDetailQueryKey, productId, navigate, queryClient]);

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

  const collectionSelectOptions = useMemo<UniversalSelectOption[]>(
    () => [
      {
        value: STANDALONE_COLLECTION_VALUE,
        label: 'No collection (standalone)',
        description: 'Keep this product separate from a Store Collection.',
      },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );

  const taxonomyCategorySelectOptions = useMemo<UniversalSelectOption[]>(
    () =>
      taxonomyCategories.map((category) => ({
        value: category.id,
        label: category.name,
        description:
          category.types.length > 0
            ? `${category.types.length} ${category.types.length === 1 ? 'sub-category' : 'sub-categories'}`
            : 'No sub-categories yet',
      })),
    [taxonomyCategories],
  );

  const subCategorySelectOptions = useMemo<UniversalSelectOption[]>(
    () => {
      const scopedTypes = form.taxonomyCategoryId
        ? selectedTaxonomyCategoryTypes
        : availableCategoryTypes;

      return scopedTypes.map((categoryType) => ({
        value: categoryType.id,
        label: categoryType.name,
      }));
    },
    [availableCategoryTypes, form.taxonomyCategoryId, selectedTaxonomyCategoryTypes],
  );

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

  const syncPersistedMediaIds = useCallback(
    (items: ProductMediaPreview[]) => {
      updateForm(
        "mediaIds",
        items
          .map((item) => item.fileUploadId || item.id)
          .filter((id) => id && !id.startsWith("pending-")),
      );
    },
    [updateForm],
  );

  // "+ Add Color" — always a brand-new, independent color group (its own stable
  // id), so a second unnamed color does NOT merge into the first empty one.
  const addColorGroup = useCallback(() => {
    const next: ProductVariant = {
      size: "",
      color: "",
      sku: "",
      price: undefined,
      stock: 0,
      colorGroupId: nextColorGroupId(),
    };
    updateForm("variants", [...form.variants, next]);
  }, [form.variants, updateForm]);

  const addSizeToGroup = useCallback(
    (group: { colorGroupId?: string; color: string }) => {
      const next: ProductVariant = {
        size: "",
        color: group.color,
        sku: "",
        price: undefined,
        stock: 0,
        colorGroupId: group.colorGroupId ?? nextColorGroupId(),
      };
      updateForm("variants", [...form.variants, next]);
    },
    [form.variants, updateForm],
  );

  const setGroupColor = useCallback(
    (group: { colorGroupId?: string; color: string }, newColor: string) => {
      // Update every size row in this group at once, keyed by the stable group
      // id — grouping no longer shifts mid-type, so the field keeps focus.
      const next = form.variants.map((v) =>
        variantMatchesGroup(v, group) ? { ...v, color: newColor } : v,
      );
      updateForm("variants", next);
    },
    [form.variants, updateForm],
  );

  const addMultipleSizesForGroup = useCallback(
    (group: { colorGroupId?: string; color: string }, sizesStr: string) => {
      const rawSizes = sizesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (rawSizes.length === 0) return;
      const unsupportedSizes = rawSizes.filter(
        (size) => normalizeProductVariantSize(size) === null,
      );
      if (unsupportedSizes.length > 0) {
        toast.error(`Use supported sizes only: ${PRODUCT_VARIANT_SIZE_LABELS}`);
        return;
      }
      const sizes = rawSizes
        .map((size) => normalizeProductVariantSize(size))
        .filter((size): size is string => Boolean(size));
      const existing = form.variants.filter((v) =>
        variantMatchesGroup(v, group),
      );
      const existingSizes = new Set(
        existing.map((v) => (v.size ?? "").trim().toLowerCase()),
      );
      const groupId = group.colorGroupId ?? nextColorGroupId();
      const newVariants = sizes
        .filter((s) => !existingSizes.has(s.toLowerCase()))
        .map((size) => ({
          size,
          color: group.color,
          sku: "",
          price: undefined as number | undefined,
          stock: 0,
          colorGroupId: groupId,
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
    (group: { colorGroupId?: string; color: string }) => {
      const next = form.variants.filter((v) => !variantMatchesGroup(v, group));
      updateForm("variants", next);
    },
    [form.variants, updateForm],
  );

  /**
   * Group variants into color cards for the editor. Keyed by the stable
   * colorGroupId (falling back to color string for any legacy variant) so
   * multiple unnamed colors stay as separate cards and renaming a color never
   * re-shuffles the cards mid-keystroke.
   */
  const variantColorGroups = useMemo(() => {
    const groups: Array<{
      stableKey: string;
      colorGroupId?: string;
      color: string;
      variants: Array<{ variant: ProductVariant; originalIndex: number }>;
    }> = [];
    const keyMap = new Map<string, (typeof groups)[number]>();
    form.variants.forEach((v, idx) => {
      const colorGroupId = v.colorGroupId?.trim() || undefined;
      const key = colorGroupId
        ? `id:${colorGroupId}`
        : (v.color ?? "").trim().toLowerCase() || `__idx_${idx}`;
      let group = keyMap.get(key);
      if (!group) {
        group = {
          stableKey: key,
          colorGroupId,
          color: v.color ?? "",
          variants: [],
        };
        keyMap.set(key, group);
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
      if (form.tags.length >= MAX_PRODUCT_TAGS) {
        toast.error(`You can add up to ${MAX_PRODUCT_TAGS} hashtags`);
        return;
      }
      updateForm("tags", [...form.tags, cleaned]);
    }
    setTagInput("");
  }, [tagInput, form.tags, updateForm]);

  const handleToggleTagFromPicker = useCallback(
    (tag: string) => {
      const cleaned = tag.replace(/#/g, "").trim();
      if (!cleaned) return;
      const existing = form.tags.find(
        (t) => t.toLowerCase() === cleaned.toLowerCase(),
      );
      if (existing) {
        updateForm(
          "tags",
          form.tags.filter((t) => t !== existing),
        );
        return;
      }
      if (form.tags.length >= MAX_PRODUCT_TAGS) {
        toast.error(`You can add up to ${MAX_PRODUCT_TAGS} hashtags`);
        return;
      }
      updateForm("tags", [...form.tags, cleaned]);
    },
    [form.tags, updateForm],
  );

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

  const goToStep = useCallback((next: 1 | 2 | 3) => {
    setWizardStep(next);
    // Scroll the wizard back to the top so each step opens from its start,
    // without jumping the page around during the transition.
    requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        targetId: 'product-media-section',
        title: 'Upload product media',
        description:
          'Add front, left, right, and back-view photos. Clear multi-angle images build buyer trust and reduce return requests.',
        emoji: '🖼️',
      },
      {
        targetId: 'product-category-section',
        title: 'What is it? and garment type',
        description:
          'Choose the garment family, garment type, audience, and style details buyers use for discovery.',
        emoji: '🏷️',
      },
      {
        targetId: 'product-pricing-section',
        title: 'Pricing & go-live status',
        description:
          'Set the selling price, an optional compare-at price, and decide whether to go live now or keep this as a draft.',
        emoji: '💳',
        onEnter: () => {
          // Pricing now lives in Operations (step 2) — reveal it before the
          // tour measures the target, otherwise the spotlight has nothing to
          // anchor to (the section is display:none on step 1).
          setWizardStep(2);
          setCollapsedSections((prev) =>
            prev.pricing ? { ...prev, pricing: false } : prev,
          );
        },
        enterDelay: 400,
      },
    ],
    [],
  );

  const notifyProductStudioSync = useCallback(
    (reason: string, syncedProductId?: string) => {
      const targetProductId = syncedProductId || productId || undefined;
      emitProductStudioSync({
        productId: targetProductId,
        reason,
      });
      // The Store panel only hears the window event while it is mounted. A
      // cover/media change made here and then a reroute back to the Store would
      // otherwise paint STALE cached data (global refetchOnMount is off), which
      // is why the old cover stuck until a manual browser refresh. Invalidate
      // AND refetch (`refetchType: 'all'` reaches the now-inactive list query)
      // so the fresh cover is in cache before the panel remounts.
      void queryClient.invalidateQueries({
        queryKey: ['store', 'panel'],
        refetchType: 'all',
      });
      if (targetProductId) {
        void queryClient.invalidateQueries({
          queryKey: ['store', 'product', targetProductId],
        });
      }
    },
    [productId, queryClient],
  );

  const rollbackCreatedProduct = useCallback(
    async (createdProductId: string) => {
      if (!createdProductId) return;
      try {
        await productApi.permanentlyDeleteProduct(createdProductId);
      } catch {
        try {
          await productApi.deleteProduct(createdProductId);
        } catch {
          // Keep original failure surfaced; rollback best-effort is enough here.
        }
      } finally {
        notifyProductStudioSync("product-create-rollback", createdProductId);
      }
    },
    [notifyProductStudioSync],
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
      const invalidVariantSizes = Array.from(
        new Set(
          form.variants
            .map((variant) => String(variant.size ?? "").trim())
            .filter(
              (size) =>
                size.length > 0 && normalizeProductVariantSize(size) === null,
            ),
        ),
      );
      const hasMissingVariantSize = form.variants.some(
        (variant) => String(variant.size ?? "").trim().length === 0,
      );
      let validationError: string | null = null;
      if (!shouldValidatePublish) {
        if (!hasDraftContent) {
          validationError = 'Add at least one detail to save a draft';
        } else if (mediaUrls.length > maxMediaCount) {
          validationError = `You can upload up to ${maxMediaCount} images`;
        }
      } else {
        const publishValidationErrors = [
          !form.variants.length
            ? 'Add at least one size variant before this product goes live.'
            : null,
          form.variants.length < MIN_PUBLISH_VARIANT_COUNT
            ? `Add at least ${MIN_PUBLISH_VARIANT_COUNT} size variants before this product goes live.`
            : null,
          hasMissingVariantSize
            ? `Each variant needs a supported size: ${PRODUCT_VARIANT_SIZE_LABELS}`
            : null,
          variantTotalStock <= 0
            ? 'Add stock to at least one size variant before this product goes live.'
            : null,
          invalidVariantSizes.length > 0
            ? `Supported sizes: ${PRODUCT_VARIANT_SIZE_LABELS}`
            : null,
          !form.title.trim() ? 'Please enter a product title' : null,
          // Description is optional — do not block go-live/draft when empty.
          !form.taxonomyCategoryId ? 'Choose what this item is.' : null,
          !form.categoryTypeId ? 'Choose a garment type.' : null,
          !form.gender ? 'Choose who this item is for.' : null,
          selectedFilterValueIds.length === 0
            ? 'Add at least one style detail.'
            : null,
          form.tags.length === 0 ? 'Add at least one hashtag.' : null,
          form.price <= 0 ? 'Please enter a valid price' : null,
          form.onSale && form.compareAtPrice > 0 && form.compareAtPrice >= form.price
            ? 'Sale price must be less than the price'
            : null,
          hasDuplicateVariants
            ? 'Please remove duplicate variant options (same size/color)'
            : null,
          form.variants.some(
            (variant) => Number.isNaN(Number(variant.stock)) || variant.stock < 0,
          )
            ? 'Variant stock must be 0 or greater'
            : null,
        ];

        validationError =
          publishValidationErrors.find((error) => Boolean(error)) ?? null;
      }

      if (validationError) {
        toast.error(validationError);
        return;
      }

      if (shouldValidatePublish) {
        const mediaValidation = validateMedia(
          mediaUrls,
          maxMediaCount,
          minRequiredMediaCount,
        );
        if (!mediaValidation.ok) {
          toast.error(
            mediaValidation.error || "Please review your media selection",
          );
          return;
        }
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
      const payloadCategoryId = form.taxonomyCategoryId || undefined;
      const finalStatus =
        normalizedForcedStatus ?? (effectiveDraft ? "DRAFT" : form.status);
      const pendingCustomOrderDraft =
        form.customOrderEnabled
          ? customOrderEditorRef.current?.buildConfigurationDraft() ?? null
          : null;
      const structuredMediaPayload = shouldValidatePublish
        ? buildStructuredMediaPayload()
        : undefined;

      if (shouldValidatePublish && form.customOrderEnabled && !pendingCustomOrderDraft) {
        toast.error('Save the custom-order setup before this product goes live.');
        return;
      }

      setSaving(true);
      try {
        if (shouldValidatePublish && !isCollectionFlow) {
          await productApi.acknowledgeContentPolicy();
        }
        const resolvedCustomsRegion = await syncShippingRegions({
          // Collection flow should not block on store policy updates.
          persistPolicy: !isCollectionContext && !effectiveDraft,
          requireRegions: !effectiveDraft,
        });
        const ensuredSku =
          form.sku?.trim() ||
          buildBaseSku({
            brandInitials: brandInitialsFromProfile(user),
            title: form.title,
          });
        const normalizedVariants =
          form.variants.length > 0
            ? form.variants.map((v, idx) => ({
                ...v,
                size: normalizeProductVariantSize(v.size) || undefined,
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
            : undefined;

        const payload: ProductCreateDto = {
          title: effectiveDraft
            ? form.title.trim() || "Untitled Draft"
            : form.title.trim(),
          description: form.description.trim() || undefined,
          collectionId: selectedCollectionId,
          categoryId: payloadCategoryId,
          subCategoryId: payloadCategoryTypeId,
          categoryTypeId: payloadCategoryTypeId,
          gender: form.gender,
          tags: form.tags,
          filterValueIds: selectedFilterValueIds,
          price: effectiveDraft
            ? form.price > 0
              ? form.price
              : minVariantPrice
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
          status: finalStatus,
          isPhysicalProduct: form.isPhysicalProduct,
          customsRegion: resolvedCustomsRegion,
          customOrderEnabled: form.customOrderEnabled,
          mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
          media:
            structuredMediaPayload && structuredMediaPayload.length > 0
              ? structuredMediaPayload
              : undefined,
          sizingMode: normalizeSizingMode(form.sizingMode),
          rtwSizeSystem:
            isRtwSizingMode(form.sizingMode)
              ? form.rtwSizeSystem || "ALPHA"
              : undefined,
          customMeasurementKeys:
            isCustomSizingMode(form.sizingMode)
              ? form.customMeasurementKeys
              : [],
          variants: normalizedVariants,
        };

        let createdProductId: string | null = null;

        if (isEditMode && productId) {
          if (form.customOrderEnabled) {
            let saved = false;
            try {
              saved =
                (await customOrderEditorRef.current?.saveConfiguration({
                  silentSuccess: true,
                })) === true;
            } catch (customOrderError: any) {
              throw new Error(
                customOrderError?.response?.data?.message ||
                  "Custom-order setup could not be saved. Product changes were not saved.",
              );
            }
            if (!saved) {
              throw new Error(
                "Custom-order setup could not be saved. Product changes were not saved.",
              );
            }
          }

          const updated = await productApi.updateProduct(productId, payload);
          queryClient.setQueryData(productDetailQueryKey, updated);
          setContentStatus(
            String((updated as any).publicationStatus || (updated as any).status || finalStatus),
          );
          notifyProductStudioSync("product-updated", productId);
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
          // Ordered pending media uploads — shared by the instant-reroute path
          // and the legacy inline path below.
          const pendingUploads = (() => {
            if (pendingMediaFiles.length === 0)
              return [] as Array<{
                file: File;
                isPrimary: boolean;
                viewSlot: MediaViewSlot;
                previewUrl?: string;
              }>;
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
                  viewSlot: MediaViewSlot;
                }),
                id:
                  (p as { id: string }).id ||
                  (p as { tempId: string }).tempId,
              }));
            return normalizePrimary(orderedPending);
          })();

          // ── New product (go-live OR draft): reroute NOW, finish in a job ──
          // Parity with design creation — the store shows a live filler card
          // while create → upload → publish runs in the background instead of
          // blocking on the button loader. The synchronous inline path below is
          // kept ONLY for the collection builder, which must hand the new
          // product id straight back to the collection (async can't do that).
          if (!isCollectionContext && !isCollectionFlow) {
            const goingLive = !effectiveDraft;
            const productTitle =
              payload.title || form.title.trim() || "New product";
            // Mint a preview URL that belongs to the publish task. Reusing the
            // editor's `previewUrl` looked equivalent but was not: this page
            // revokes every pending preview blob on unmount, and the reroute
            // below unmounts it immediately — so the store's new card pointed
            // at a dead blob and rendered broken until a manual refresh.
            const coverUpload =
              pendingUploads.find((u) => u.isPrimary) ?? pendingUploads[0];
            const coverPreviewUrl = coverUpload?.file
              ? URL.createObjectURL(coverUpload.file)
              : undefined;
            const task = createPublishTask({
              ownerId: user?.id,
              title: productTitle,
              visibility: "PUBLIC",
              coverPreviewUrl,
              ownsCoverPreview: Boolean(coverPreviewUrl),
              entity: "product",
              kind: goingLive ? "publish" : "draft",
              message: goingLive ? "Uploading…" : "Saving…",
            });
            setSaving(false);
            setHasChanges(false);
            toast.info(
              goingLive ? "Submitting for review…" : "Saving draft…",
            );
            navigate(
              goingLive
                ? "/studio/store?status=in_review"
                : "/studio/store?status=draft",
              { state: { publishingProductTaskId: task.id } },
            );
            void runProductPublishJob({
              taskId: task.id,
              ownerId: user?.id,
              title: productTitle,
              payload,
              finalStatus,
              pendingUploads: pendingUploads.map((u) => ({
                file: u.file,
                isPrimary: u.isPrimary,
                viewSlot: u.viewSlot,
              })),
              pendingCustomOrderDraft,
              // ack + shipping policy already ran synchronously above.
              acknowledgeContentPolicy: false,
              shippingRegionsToPersist: null,
              publishTaskScope: { ownerId: user?.id },
            });
            return;
          }

          const shouldCreateAsDraftForUploads =
            pendingUploads.length > 0 && finalStatus === "ACTIVE";
          const created = await productApi.createProduct(
            shouldCreateAsDraftForUploads
              ? { ...payload, status: "DRAFT" }
              : payload,
          );
          createdProductId = created.id;

          try {
            const [customOrderSaveResult, mediaUploadResult] =
              await Promise.allSettled([
                pendingCustomOrderDraft
                  ? createCustomOrderConfigurationWithBasis(
                      pendingCustomOrderDraft,
                      created.id,
                      form.title,
                    )
                  : Promise.resolve(),
                pendingUploads.length > 0
                  ? Promise.all(
                      pendingUploads.map((upload) =>
                        productApi.uploadProductMedia(
                          created.id,
                          upload.file,
                          upload.isPrimary,
                          upload.viewSlot,
                        ),
                      ),
                    )
                  : Promise.resolve([]),
              ]);

            if (customOrderSaveResult.status === "rejected") {
              throw customOrderSaveResult.reason;
            }

            if (mediaUploadResult.status === "rejected") {
              throw mediaUploadResult.reason;
            }

            if (pendingUploads.length > 0) {
              notifyProductStudioSync("product-media-uploaded", created.id);
            }

            if (shouldCreateAsDraftForUploads) {
              const uploadedMedia = (
                mediaUploadResult.status === "fulfilled"
                  ? mediaUploadResult.value
                  : []
              ).map((item, index) => ({
                fileUploadId: item.id,
                viewSlot: toBackendMediaViewSlot(
                  pendingUploads[index]?.viewSlot,
                  index,
                ),
                orderIndex: index,
              }));
              const updated = await productApi.updateProduct(created.id, {
                ...payload,
                status: finalStatus,
                media: uploadedMedia,
              });
              queryClient.setQueryData(
                queryKeys.store.product(created.id, { includeDeleted: false }),
                updated,
              );
              setContentStatus(
                String((updated as any).publicationStatus || (updated as any).status || finalStatus),
              );
            }
          } catch (createError: any) {
            await rollbackCreatedProduct(created.id);
            throw new Error(
              createError?.response?.data?.message ||
                createError?.message ||
                "Product save failed and was rolled back.",
            );
          }

          const successMessage = isCollectionContext
            ? "Product added to collection."
            : effectiveDraft
              ? "Draft saved successfully"
              : "Product created successfully";
          notifyProductStudioSync("product-created", created.id);
          toast.success(successMessage);
          if (returnTo && returnContext === "collection") {
            const joiner = returnTo.includes("?") ? "&" : "?";
            navigate(`${returnTo}${joiner}productId=${created.id}`);
            return;
          }
        }

        setHasChanges(false);
        if (!isEditMode && createdProductId) {
          navigate(`/studio/store?createdProductId=${createdProductId}`);
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
          error?.message ||
          "Failed to save product. No changes were committed.";
        toast.error(
          mapCreatorMetadataError(
            message,
            "Failed to save product. No changes were committed.",
          ),
        );
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
      collectionContextId,
      maxMediaCount,
      mediaUrls,
      navigate,
      pendingMediaFiles,
      productId,
      variantTotalStock,
      originalPrice,
      showPricePreview,
      notifyProductStudioSync,
      rollbackCreatedProduct,
      returnContext,
      returnTo,
      syncShippingRegions,
      user,
      buildStructuredMediaPayload,
      productDetailQueryKey,
      queryClient,
    ],
  );

  const handlePriceChangeConfirm = useCallback(async () => {
    const pendingCustomOrderDraft =
      form.customOrderEnabled
        ? customOrderEditorRef.current?.buildConfigurationDraft() ?? null
        : null;

    if (form.customOrderEnabled && !pendingCustomOrderDraft) {
      return;
    }

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
      const structuredMediaPayload =
        statusToPersist === "ACTIVE" ? buildStructuredMediaPayload() : undefined;
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
      const payloadCategoryId = form.taxonomyCategoryId || undefined;
      const resolvedCustomsRegion = await syncShippingRegions({
        persistPolicy: !isCollectionContext && !effectiveDraft,
        requireRegions: !effectiveDraft,
      });
      const normalizedVariants =
        form.variants.length > 0
          ? form.variants.map((v, idx) => ({
              ...v,
              size: normalizeProductVariantSize(v.size) || undefined,
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
          : undefined;

      const payload: ProductCreateDto = {
        title: effectiveDraft
          ? form.title.trim() || "Untitled Draft"
          : form.title.trim(),
        description: form.description.trim() || undefined,
        collectionId: selectedCollectionId,
        categoryId: payloadCategoryId,
        subCategoryId: payloadCategoryTypeId,
        categoryTypeId: payloadCategoryTypeId,
        gender: form.gender,
        tags: form.tags,
        filterValueIds: selectedFilterValueIds,
        price: effectiveDraft
          ? form.price > 0
            ? form.price
            : minVariantPrice
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
        status: statusToPersist,
        isPhysicalProduct: form.isPhysicalProduct,
        customsRegion: resolvedCustomsRegion,
        customOrderEnabled: form.customOrderEnabled,
        mediaIds: form.mediaIds.length > 0 ? form.mediaIds : undefined,
        media:
          structuredMediaPayload && structuredMediaPayload.length > 0
            ? structuredMediaPayload
            : undefined,
        sizingMode: normalizeSizingMode(form.sizingMode),
        rtwSizeSystem:
          isRtwSizingMode(form.sizingMode)
            ? form.rtwSizeSystem || "ALPHA"
            : undefined,
        customMeasurementKeys:
          isCustomSizingMode(form.sizingMode)
            ? form.customMeasurementKeys
            : [],
        variants: normalizedVariants,
      };

      if (productId) {
        if (statusToPersist === "ACTIVE" && !isCollectionFlow) {
          await productApi.acknowledgeContentPolicy();
        }
        if (form.customOrderEnabled) {
          let saved = false;
          try {
            saved =
              (await customOrderEditorRef.current?.saveConfiguration({
                silentSuccess: true,
              })) === true;
          } catch (customOrderError: any) {
            throw new Error(
              customOrderError?.response?.data?.message ||
                "Custom-order setup could not be saved. Product changes were not saved.",
            );
          }
          if (!saved) {
            throw new Error(
              "Custom-order setup could not be saved. Product changes were not saved.",
            );
          }
        }

        const updated = await productApi.updateProduct(productId, payload);
        queryClient.setQueryData(productDetailQueryKey, updated);
        setContentStatus(
          String((updated as any).publicationStatus || (updated as any).status || statusToPersist),
        );
      } else {
        const created = await productApi.createProduct(payload);
        try {
          if (pendingCustomOrderDraft) {
            await createCustomOrderConfigurationWithBasis(
              pendingCustomOrderDraft,
              created.id,
              form.title,
            );
          }
        } catch (customOrderError: any) {
          await rollbackCreatedProduct(created.id);
          throw new Error(
            customOrderError?.response?.data?.message ||
              customOrderError?.message ||
              "Custom-order setup could not be saved for the new product. The draft was rolled back.",
          );
        }
      }
      notifyProductStudioSync("product-updated", productId || undefined);
      toast.success(
        productId ? "Product updated successfully" : "Product created successfully",
      );
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
        error?.message ||
        "Failed to save product. Shipping policy may not have been saved.";
      toast.error(
        mapCreatorMetadataError(
          message,
          "Failed to save product. Shipping policy may not have been saved.",
        ),
      );
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
    pendingSaveDraft,
    pendingStatusOverride,
    variantTotalStock,
    productId,
    navigate,
    isCollectionContext,
    returnTo,
    syncShippingRegions,
    notifyProductStudioSync,
    rollbackCreatedProduct,
    buildStructuredMediaPayload,
    productDetailQueryKey,
    queryClient,
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
        viewSlot: MediaViewSlot;
      }>,
    ) => {
      return normalizePrimary(items);
    },
    [],
  );

  const pushMediaPreviews = useCallback(
    (
      files: File[],
      {
        makePrimary,
        replacingSlot = false,
      }: { makePrimary: boolean; replacingSlot?: boolean },
    ): Array<{
      id: string;
      tempId: string;
      file: File;
      previewUrl: string;
      isPrimary: boolean;
      viewSlot: MediaViewSlot;
    }> => {
      if (!files.length) return [];

      // A replacement refills the slot it just emptied, so it is net-zero
      // against the cap. `mediaUrls` here is captured from the render BEFORE
      // that delete, so without the bonus a replace-at-cap computed `remaining`
      // as 0, bailed out with the cap toast, and left the slot permanently
      // empty — the delete had already gone through.
      const remaining = Math.max(
        0,
        maxMediaCount - mediaUrls.length + (replacingSlot ? 1 : 0),
      );
      const toAdd = files.slice(0, remaining);
      if (toAdd.length === 0) {
        toast.error(`You can upload up to ${maxMediaCount} images`);
        return [];
      }

      const now = Date.now();
      const requestedSlot = pendingUploadSlotRef.current;
      pendingUploadSlotRef.current = null;
      const occupiedSlots = new Set(
        mediaUrls.map((item, index) => normalizeMediaViewSlot(item.viewSlot, index)),
      );
      const availableSlots = MEDIA_VIEW_SLOT_OPTIONS.slice(0, maxMediaCount)
        .map((option) => option.value)
        .filter((slot) => !occupiedSlots.has(slot));
      const nextPending = toAdd.map((file, idx) => {
        const previewUrl = URL.createObjectURL(file);
        const tempId = `pending-${now}-${idx}-${Math.random().toString(16).slice(2)}`;
        const viewSlot =
          idx === 0 && requestedSlot
            ? requestedSlot
            : availableSlots[idx] ?? normalizeMediaViewSlot(null, mediaUrls.length + idx);
        return {
          id: tempId,
          tempId,
          file,
          previewUrl,
          isPrimary: false,
          viewSlot,
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
          viewSlot: m.viewSlot,
        }));
        const next = [...prev, ...mapped];
        if (makePrimary && mapped[0]) {
          return normalizePrimary(setPrimary(next, mapped[0].id));
        }
        return normalizePrimary(next);
      });

      return nextPending;
    },
    [mediaUrls, maxMediaCount, normalizePending],
  );

  const preprocessProductMediaFiles = useCallback(async (files: File[]) => {
    const maxSizeBytes = WEB_UPLOAD_POLICIES.productMedia.maxSizeBytes;
    const isAlreadyUploadReady = (file: File) => {
      const type = file.type.trim().toLowerCase();
      if (file.size > maxSizeBytes) return false;
      if (/image\/(jpeg|png|webp|avif|gif)/i.test(type)) return true;
      if (/\.pre\.(jpe?g|png|webp|avif)$/i.test(file.name)) return true;
      return false;
    };

    const prepResults = await Promise.all(
      files.map(async (file) => {
        if (isAlreadyUploadReady(file)) {
          return { ok: true as const, file, optimized: false };
        }

        let localFailureReason: 'preprocess-failed' | 'still-over-limit' | null = null;
        try {
          const processed = await preprocessImageFile(file, "detail", {
            maxSizeBytes,
          });
          if (processed.file.size <= maxSizeBytes) {
            return { ok: true as const, file: processed.file, optimized: !processed.skipped };
          }
          localFailureReason = 'still-over-limit';
        } catch {
          localFailureReason = 'preprocess-failed';
        }

        try {
          const sniffedFormat = await sniffImageFormat(file);
          const needsServerTranscode =
            !isUnreadableSniff(sniffedFormat) &&
            (file.size > maxSizeBytes ||
              localFailureReason === 'still-over-limit' ||
              !isBrowserDisplayableSniff(sniffedFormat));

          if (needsServerTranscode) {
            const transcoded = await getNormalizedImageFile(file);
            if (transcoded.size <= maxSizeBytes) {
              return { ok: true as const, file: transcoded, optimized: true };
            }
          }
        } catch {
          /* Server normalize unavailable — fall through to raw checks. */
        }

        return file.size <= maxSizeBytes
          ? { ok: true as const, file, optimized: false }
          : { ok: false as const, file };
      }),
    );

    const validFiles = prepResults
      .filter((result) => result.ok)
      .map((result) => result.file);
    const optimizedCount = prepResults.filter((result) => result.ok && result.optimized).length;
    const failedCount = prepResults.length - validFiles.length;

    if (optimizedCount > 0) {
      toast.message(
        optimizedCount === 1
          ? "Optimized 1 image for faster upload"
          : `Optimized ${optimizedCount} images for faster upload`,
      );
    }

    if (failedCount > 0) {
      toast.error(
        failedCount === 1
          ? "1 image could not be prepared"
          : `${failedCount} images could not be prepared`,
      );
    }

    return validFiles;
  }, []);

  const processAndUploadFiles = async (
    selectedFiles: File[],
    targetSlot?: MediaViewSlot,
    options?: { replacingSlot?: boolean },
  ) => {
    // See `pushMediaPreviews`: every capacity read in this function is captured
    // from the render before the slot was cleared, so a replacement has to be
    // told it is one or it gets rejected for exceeding a cap it cannot exceed.
    const replacingSlot = options?.replacingSlot === true;

    if (!canAddMoreMedia && !replacingSlot) {
      toast.error(`You can upload up to ${maxMediaCount} images`);
      return;
    }

    const files = await preprocessProductMediaFiles(selectedFiles);
    if (!files.length) return;

    if (targetSlot) {
      pendingUploadSlotRef.current = targetSlot;
    }

    if (isEditMode && productId) {
      const uploadQueue = files.slice(
        0,
        Math.max(0, maxMediaCount - mediaUrls.length + (replacingSlot ? 1 : 0)),
      );
      const queuedPreviews = pushMediaPreviews(uploadQueue, {
        makePrimary: !hasPrimaryMedia,
        replacingSlot,
      });
      if (!queuedPreviews.length) return;

      const results = await Promise.all(
        queuedPreviews.map(async (pending) => {
          try {
            const uploaded = await productApi.uploadProductMedia(
              productId,
              pending.file,
              pending.isPrimary,
              pending.viewSlot,
            );

            setMediaUrls((prev) => {
              const next = prev.map((item) =>
                item.id === pending.tempId
                  ? {
                      id: uploaded.id,
                      fileUploadId: uploaded.id,
                      url: uploaded.url,
                      isPrimary: item.isPrimary,
                      viewSlot:
                        normalizeMediaViewSlot(
                          uploaded.viewSlot ?? pending.viewSlot,
                        ),
                    }
                  : item,
              );
              const normalized = normalizePrimary(next);
              syncPersistedMediaIds(normalized);
              return normalized;
            });
            setPendingMediaFiles((prev) =>
              normalizePending(
                prev.filter((item) => item.tempId !== pending.tempId),
              ),
            );

            return { ok: true as const };
          } catch (err) {
            console.error("Upload failed", err);
            setMediaUrls((prev) => {
              const next = normalizePrimary(
                prev.filter((item) => item.id !== pending.tempId),
              );
              syncPersistedMediaIds(next);
              return next;
            });
            setPendingMediaFiles((prev) =>
              normalizePending(
                prev.filter((item) => item.tempId !== pending.tempId),
              ),
            );
            return { ok: false as const };
          }
        }),
      );

      const successCount = results.filter((result) => result.ok).length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        notifyProductStudioSync("product-media-uploaded", productId);
        toast.success(
          successCount === 1
            ? "Image uploaded"
            : `${successCount} images uploaded`,
        );
      }
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? "Failed to upload 1 image"
            : `Failed to upload ${failedCount} images`,
        );
      }
      return;
    }

    const makePrimary = !hasPrimaryMedia;
    pushMediaPreviews(files, { makePrimary, replacingSlot });
  };

  const handleMediaFilesSelected: React.ChangeEventHandler<
    HTMLInputElement
  > = async (e) => {
    const selectedFiles = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    e.target.value = "";
    if (!selectedFiles.length) return;
    await processAndUploadFiles(selectedFiles);
  };



  const handleSwapMediaSlots = useCallback(
    (sourceSlot: string, targetSlot: string) => {
      const sourceSlotNormalized = normalizeMediaViewSlot(sourceSlot) as MediaViewSlot;
      const targetSlotNormalized = normalizeMediaViewSlot(targetSlot) as MediaViewSlot;
      if (sourceSlotNormalized === targetSlotNormalized) return;

      // Identify the items by the slot they are actually displayed in, then move
      // each to the other's slot. A missing side means the target slot is empty,
      // so we simply move the dragged item there. Reassigning viewSlot by item id
      // (never touching array order) makes this a true swap — no duplication and
      // no dependence on fragile index-based fallbacks.
      const sourceItem = mediaBySlot.get(sourceSlotNormalized);
      const targetItem = mediaBySlot.get(targetSlotNormalized);
      if (!sourceItem && !targetItem) return;

      const slotUpdates = new Map<string, MediaViewSlot>();
      if (sourceItem) slotUpdates.set(sourceItem.id, targetSlotNormalized);
      if (targetItem) slotUpdates.set(targetItem.id, sourceSlotNormalized);

      setMediaUrls((prev) => {
        const next = prev.map((item) =>
          slotUpdates.has(item.id)
            ? { ...item, viewSlot: slotUpdates.get(item.id) as MediaViewSlot }
            : item,
        );
        const normalized = normalizePrimary(next);
        syncPersistedMediaIds(normalized);
        return normalized;
      });

      // Pending items live in mediaUrls keyed by their tempId, so the same id map
      // applies here to keep both arrays consistent.
      setPendingMediaFiles((prev) => {
        if (!prev.some((item) => slotUpdates.has(item.tempId))) return prev;
        return normalizePending(
          prev.map((item) =>
            slotUpdates.has(item.tempId)
              ? { ...item, viewSlot: slotUpdates.get(item.tempId) as MediaViewSlot }
              : item,
          ),
        );
      });

      setHasChanges(true);
      toast.success(
        `Swapped positions: ${getMediaViewSlotLabel(sourceSlotNormalized)} and ${getMediaViewSlotLabel(targetSlotNormalized)}`,
      );
    },
    [mediaBySlot, normalizePending, syncPersistedMediaIds],
  );

  /**
   * Slot map in the shape `MediaSlotGrid` renders. Product media is already
   * uploaded, so no local `file` is attached — the grid uses the plain remote
   * renderer for those, and only design creation's pre-upload files take the
   * local preview path.
   */
  const slotGridMedia = useMemo(() => {
    const grid = new Map<MediaViewSlot, MediaSlotGridItem>();
    mediaBySlot.forEach((item, slot) => {
      grid.set(slot, {
        id: item.id,
        url: item.url,
        kind: "image",
        isCover: Boolean(item.isPrimary),
      });
    });
    return grid;
  }, [mediaBySlot]);

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
          notifyProductStudioSync("product-media-primary", productId);
          toast.success("Cover image updated");
        } catch {
          toast.error("Failed to update cover image");
        }
      }
    },
    [isEditMode, normalizePending, notifyProductStudioSync, productId],
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
          notifyProductStudioSync("product-media-deleted", productId);
          toast.success("Image deleted");
        } catch {
          toast.error("Failed to delete image");
          setMediaUrls((prev) => normalizePrimary([...prev, target]));
        }
      }
    },
    [
      isEditMode,
      mediaUrls,
      notifyProductStudioSync,
      pendingMediaFiles,
      productId,
      revokeBlobUrl,
      updateForm,
    ],
  );

  /**
   * Dropping a photo onto an occupied slot replaces what is there.
   *
   * Order matters: this deletes the occupant to free the slot, and a delete in
   * edit mode is a server delete that cannot be undone. So nothing is removed
   * until we know there is a usable image to put in its place — this used to
   * delete first and validate afterwards, which turned every rejected drop into
   * silent data loss.
   */
  const handleDropFilesOnSlot = useCallback(
    async (targetSlot: MediaViewSlot, files: File[]) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (!images.length) return;

      const existing = mediaBySlot.get(targetSlot);
      // Only a drop onto an EMPTY slot can push us past the cap; a replacement
      // is net-zero. Checking here means the occupant survives a rejection.
      if (!existing && !canAddMoreMedia) {
        toast.error(`You can upload up to ${maxMediaCount} images`);
        return;
      }

      if (existing) {
        await handleDeleteMedia(existing.id);
      }
      await processAndUploadFiles(images, targetSlot, {
        replacingSlot: Boolean(existing),
      });
    },
    // `processAndUploadFiles` is a plain function redefined every render, so it
    // is deliberately not a dependency — including it would rebuild this on
    // every keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDeleteMedia, mediaBySlot, canAddMoreMedia],
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
          notifyProductStudioSync("product-media-reordered", productId);
        } catch {
          toast.error("Failed to reorder images");
        }
      }
    },
    [isEditMode, mediaUrls, notifyProductStudioSync, productId, updateForm],
  );

  const handleDuplicate = useCallback(async () => {
    if (!productId) return;
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success("Product duplicated");
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch {
      toast.error("Failed to duplicate product");
    }
  }, [productId, navigate]);

  const handleArchive = useCallback(async () => {
    if (!productId) return;
    try {
      await productApi.archiveProduct(productId);
      toast.success("Product archived");
      navigate("/studio/store");
    } catch {
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
      if (isCollectionContext && returnTo) {
        navigate(returnTo);
        return;
      }
      if (typeof window !== "undefined" && window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/studio/store");
    } catch {
      toast.error("Failed to delete product");
    }
  }, [confirm, isCollectionContext, productId, navigate, returnTo]);

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

  if (requiresCatalogEmailVerification) {
    return <Navigate to={catalogVerificationRedirect} replace />;
  }

  if (requiresCatalogProfileSetup) {
    return <Navigate to={catalogProfileSetupRedirect} replace />;
  }

  if (loading) {
    return <StudioPageSkeleton variant="form" />;
  }

  // =====================
  // Render
  // =====================
  const isDraftEditMode = isEditMode && form.status === "DRAFT";
  /**
   * Where this product sits in the review lifecycle, from the server's own
   * status rather than the local form status. `CHANGES_REQUESTED` / `REJECTED`
   * mean the owner is answering the review team, and the action bar has to say
   * so — "Save Changes" reads as a metadata edit and left owners believing
   * their resubmission never went anywhere.
   */
  const productReviewStatus = useMemo(
    () => normalizeContentReviewStatus(contentStatus),
    [contentStatus],
  );
  const isResubmission = needsResubmission(productReviewStatus);
  const productReviewHint = useMemo(
    () => reviewStateHint(productReviewStatus),
    [productReviewStatus],
  );

  // Drafts are allowed to be incomplete — that is what a draft is for. Only
  // submissions that will actually reach the server's publish validation are
  // gated: the collection flow saves as DRAFT, and editing an existing product
  // without forcing a status leaves DRAFT/ARCHIVED products where they are.
  const submitKeepsCurrentStatus =
    isEditMode && !isDraftEditMode && !isCollectionContext && !isCollectionFlow;
  const isDraftOnlySubmit =
    isCollectionFlow ||
    (submitKeepsCurrentStatus &&
      (form.status === "DRAFT" || form.status === "ARCHIVED"));
  const blockingPublishFields: ProductPublishField[] = isDraftOnlySubmit
    ? []
    : [...step1Missing, ...step2Missing];
  const canAdvanceFromCurrentStep =
    isDraftOnlySubmit ||
    (wizardStep === 1
      ? step1Complete
      : wizardStep === 2
        ? step2Complete
        : true);

  return (
    <div className="flex flex-col min-h-full bg-transparent text-theme font-sans">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 py-3 pb-28 sm:px-5 sm:py-5 md:pb-12">
        <div className="mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:mb-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-xs text-theme-secondary gap-2">
              {isCollectionContext ? (
                <>
                  <button
                    onClick={() => navigate("/studio/store?view=collections")}
                    className="hover:text-theme transition-colors flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Collections
                  </button>
                  <span>/</span>
                  <button
                    onClick={() =>
                      navigate(returnTo || "/studio/store/collections/new")
                    }
                    className="hover:text-theme transition-colors"
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
                    className="hover:text-theme transition-colors flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" /> Store
                  </button>
                  <span>/</span>
                  <span>{pageTitle}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-theme flex items-center gap-2">
                {pageTitle}
              </h1>
              {isEditMode && form.title && (
                <span className="text-sm text-theme-secondary">• {form.title}</span>
              )}
              {isEditMode && (
                <div className="relative group">
                  <button
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${getContentStatusTone(contentStatus ?? form.status)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {getContentStatusLabel(contentStatus ?? form.status)}
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

        {isEditMode && productId ? (
          <ReviewFeedbackBanner productId={productId} fallbackNote={reviewNoteParam} />
        ) : null}

        {/* Wizard progress stepper — jumpable, fillers reflect live completion */}
        <div ref={wizardTopRef} className="mb-6 sm:mb-8">
          <div className="mx-auto flex w-full max-w-3xl items-center">
            {([
              { n: 1 as const, label: "Details", done: step1Complete },
              { n: 2 as const, label: "Operations", done: step2Complete },
              { n: 3 as const, label: "Review", done: false },
            ]).map((s, i, arr) => {
              const isActive = wizardStep === s.n;
              return (
                <React.Fragment key={s.n}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.n)}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                          : s.done
                            ? "bg-purple-600/15 text-purple-600 dark:text-purple-300"
                            : "surface-control text-theme-secondary"
                      }`}
                    >
                      {s.done && !isActive ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        s.n
                      )}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isActive ? "text-theme" : "text-theme-secondary"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < arr.length - 1 && (
                    <div className="mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded-full surface-control">
                      <div
                        className={`h-full rounded-full bg-purple-600 transition-all duration-500 ${
                          s.done ? "w-full" : "w-0"
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* STEP 1 — Details: Media + Basic Information */}
        <div className={wizardStep === 1 ? "" : "hidden"}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT COLUMN: Media — sticky rail so it stays in view while the long
              details column scrolls, instead of leaving a tall empty gap and
              pushing overall page height down. */}
          <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
            {/* Media Gallery */}
            <div
              id="product-media-section"
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-theme">
                  Media
                </h3>
                <span className="text-xs text-theme-secondary">
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
                  <div className="relative rounded-xl bg-theme-muted aspect-[4/5] overflow-hidden">
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

                        {/* Slot label overlay */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          {mediaUrls[carouselIndex].isPrimary && (
                            <span className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-[10px] font-semibold text-white">
                              Cover
                            </span>
                          )}
                          <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white/90">
                            {carouselIndex + 1}. {getMediaViewSlotLabel(
                              normalizeMediaViewSlot(
                                mediaUrls[carouselIndex].viewSlot,
                                carouselIndex,
                              ),
                            )}
                          </span>
                        </div>

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
                            : "surface-control-muted hover:bg-gray-400"
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                    {canAddMoreMedia && (
                      <button
                        type="button"
                        onClick={() => mediaFileInputRef.current?.click()}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-theme-strong flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                        aria-label="Add more images"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files).filter((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (files.length > 0) {
                      await processAndUploadFiles(files);
                    }
                  }}
                  className="group aspect-[4/3] w-full rounded-2xl border-2 border-dashed border-gray-300/80 bg-gray-50/50 hover:bg-purple-50/5 hover:border-purple-500/50 dark:border-white/15 dark:bg-white/[0.02] flex items-center justify-center transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-white/10 flex items-center justify-center text-purple-600 transition-colors group-hover:bg-purple-200">
                    <Plus className="w-6 h-6" />
                  </div>
                </button>
              )}

              <MediaSlotGrid
                className="mt-4"
                mediaBySlot={slotGridMedia}
                maxSlots={maxMediaCount}
                missingRequiredSlots={missingRequiredProductMediaSlots}
                selectedId={mediaUrls[carouselIndex]?.id ?? null}
                disabled={saving}
                canAddMore={canAddMoreMedia}
                onPickForSlot={(slot) => openMediaPickerForSlot(slot)}
                onSelect={(item) => {
                  const idx = mediaUrls.findIndex((media) => media.id === item.id);
                  if (idx !== -1) setCarouselIndex(idx);
                }}
                onDelete={(item) => void handleDeleteMedia(item.id)}
                onSetCover={(item) => void handleSetCover(item.id)}
                onSlotDrop={(from, to) => handleSwapMediaSlots(from, to)}
                onDropFiles={(slot, files) => void handleDropFilesOnSlot(slot, files)}
              />

              {publishErrors.media && mediaUrls.length > 0 && (
                <p className="mt-3 text-xs text-orange-500">
                  {publishErrors.media}
                </p>
              )}

              {publishErrors.cover && (
                <p className="mt-3 text-xs text-orange-500">
                  {publishErrors.cover}
                </p>
              )}

              <div className="pt-4">
                <p className="text-xs text-theme-secondary">
                  Up to 6 images • Cover required when images exist
                </p>
                <p className="text-[11px] text-theme-secondary mt-1">
                  Minimum 4 images required: front, left, right, and back.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Details — widened to take the space freed by the
              narrower sticky media rail. */}
          <div className="space-y-6 lg:col-span-7">
            {/* Basic Info — same collapsible card language as Create Design */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📝</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Basic Information
                </h2>
              </div>

              <div className="space-y-4">
                <Input
                  id="product-title-field"
                  label="Product Title"
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  onBlur={() => markPublishFieldTouched("title")}
                  error={fieldError("title")}
                  placeholder="Enter product title"
                  data-testid="product-title-input"
                />

                <div className="space-y-4" id="product-category-section">
                        {/* Group 1: Category & Subcategory */}
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                          <div className="min-w-0">
                            <UniversalSelect
                              label="What is it?"
                              required
                              error={fieldError("taxonomyCategoryId")}
                              value={form.taxonomyCategoryId}
                              onChange={(value) => {
                                markPublishFieldTouched("taxonomyCategoryId");
                                updateForm("taxonomyCategoryId", value);
                              }}
                              options={taxonomyCategorySelectOptions}
                              placeholder={
                                categoriesLoading
                                  ? 'Loading categories...'
                                  : 'Choose what this item is'
                              }
                              disabled={
                                categoriesLoading ||
                                taxonomyCategorySelectOptions.length === 0
                              }
                              searchable
                              emptyMessage="No categories available"
                              optionAllowWrap
                              selectedAllowWrap
                              menuLayer="modal"
                            />
                          </div>

                          <div className="min-w-0">
                            <UniversalSelect
                              label="Garment type"
                              required
                              error={fieldError("categoryTypeId")}
                              value={form.categoryTypeId}
                              onChange={(value) => {
                                markPublishFieldTouched("categoryTypeId");
                                updateForm("categoryTypeId", value);
                              }}
                              options={subCategorySelectOptions}
                              placeholder={
                                form.taxonomyCategoryId ||
                                availableCategoryTypes.length > 0
                                  ? 'Choose a garment type'
                                  : 'Select a category first'
                              }
                              disabled={
                                (!form.taxonomyCategoryId &&
                                  availableCategoryTypes.length === 0 &&
                                  subCategorySelectOptions.length === 0) ||
                                categoriesLoading
                              }
                              searchable
                              emptyMessage={
                                form.taxonomyCategoryId ||
                                availableCategoryTypes.length > 0
                                  ? 'No sub-categories available'
                                  : 'Select a category first'
                              }
                              optionAllowWrap
                              selectedAllowWrap
                              menuLayer="modal"
                            />
                          </div>
                        </div>

                        {/* Group 2: Audience & Collection */}
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                          <div className="min-w-0">
                            <UniversalSelect
                              label="Who is it for?"
                              required
                              error={fieldError("gender")}
                              value={form.gender}
                              onChange={(value) => {
                                markPublishFieldTouched("gender");
                                updateForm("gender", value as CreatorAudience);
                              }}
                              options={CREATOR_AUDIENCE_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                              }))}
                              disabled={saving}
                              optionAllowWrap
                              selectedAllowWrap
                              menuLayer="modal"
                            />
                          </div>

                          <div className="min-w-0">
                            <UniversalSelect
                              label="Collection (optional)"
                              value={
                                form.categoryId || STANDALONE_COLLECTION_VALUE
                              }
                              onChange={(value) =>
                                handleCollectionChange(
                                  value === STANDALONE_COLLECTION_VALUE
                                    ? ''
                                    : value,
                                )
                              }
                              options={collectionSelectOptions}
                              placeholder={
                                categoriesLoading
                                  ? 'Loading collections...'
                                  : 'No collection (standalone)'
                              }
                              disabled={categoriesLoading || isCollectionFlow}
                              searchable
                              emptyMessage="No collections available"
                              optionAllowWrap
                              selectedAllowWrap
                              menuLayer="modal"
                            />
                            <p className="mt-1.5 text-[11px] text-theme-secondary">
                              {categoriesLoading
                                ? 'Loading collections…'
                                : categories.length
                                  ? 'Optional. Use only if this product belongs in a store collection.'
                                  : 'No collections yet — product can stay standalone.'}
                              {!categoriesLoading && categories.length === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const suffix = productId
                                      ? `?productId=${encodeURIComponent(productId)}`
                                      : '';
                                    navigate(
                                      `/studio/store/collections/new${suffix}`,
                                    );
                                  }}
                                  className="ml-1 font-semibold text-purple-600 hover:text-purple-700"
                                >
                                  Create collection
                                </button>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div id="product-style-details-field">
                        <FilterSelector
                          value={filterSelection}
                          onChange={(next) => {
                            markPublishFieldTouched("styleDetails");
                            setFilterSelection(next);
                          }}
                          entityType="PRODUCT"
                          onTagSuggestions={setTagSuggestions}
                        />
                        {fieldError("styleDetails") && (
                          <p className="mt-1.5 text-xs text-red-500">
                            {fieldError("styleDetails")}
                          </p>
                        )}
                        {selectedFilterValueIds.length > 8 && (
                          <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                            ⚠️ {selectedFilterValueIds.length} style details selected — fewer,
                            precise details improve discovery and buyer trust.
                          </p>
                        )}
                      </div>

                      <div id="product-hashtags-field">
                        <label className="text-[11px] font-semibold text-theme-secondary mb-1.5 flex items-center">
                          Hashtags (up to {MAX_PRODUCT_TAGS})
                          <span className="text-purple-500 ml-1">*</span>
                          <InfoTooltip text={CREATOR_METADATA_HELP.hashtags} />
                        </label>
                        {tagSuggestions.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-theme-secondary mb-1.5">
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
                                        if (form.tags.length >= MAX_PRODUCT_TAGS) {
                                          toast.error(`You can add up to ${MAX_PRODUCT_TAGS} hashtags`);
                                          return;
                                        }
                                        updateForm("tags", [
                                          ...form.tags,
                                          suggestion,
                                        ]);
                                      }
                                    }}
                                    className="tag-badge-outline px-2.5 py-1.5 rounded-full text-[12px] font-medium sm:py-1"
                                  >
                                    + {normalizeHashtagLabel(suggestion)}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowTagPicker(true)}
                          className="mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-[12px] font-semibold text-purple-700 transition hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
                        >
                          🔎 See more hashtags ({form.tags.length}/{MAX_PRODUCT_TAGS})
                        </button>
                        <div className="surface-control flex min-h-[42px] items-center gap-2 rounded-lg border border-gray-200/60 px-3 py-2 shadow-sm dark:border-white/10">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            placeholder="Add hashtag..."
                            className="placeholder-theme bg-transparent border-none outline-none text-sm text-theme w-24 flex-1 p-0 focus:ring-0"
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
                                label={normalizeHashtagLabel(tag)}
                                color={getTagColor(tag, index)}
                                size="sm"
                                rightIcon={
                                  <X
                                    className="w-3.5 h-3.5 cursor-pointer"
                                    onClick={() => handleRemoveTag(tag)}
                                  />
                                }
                                className="gap-1"
                              />
                            ))}
                          </div>
                        )}
                        {fieldError("tags") ? (
                          <p className="mt-1 text-xs text-red-500">
                            {fieldError("tags")}
                          </p>
                        ) : (
                          <p className="text-[11px] text-theme-secondary mt-1">
                            Add one tag at a time. Use Enter or the Add button.
                          </p>
                        )}
                        <HashtagPickerModal
                          open={showTagPicker}
                          onClose={() => setShowTagPicker(false)}
                          selected={form.tags}
                          onToggle={handleToggleTagFromPicker}
                          maxTags={MAX_PRODUCT_TAGS}
                          extraSuggestions={tagSuggestions}
                        />
                      </div>

                      <Textarea
                        id="product-description-field"
                        label="Description"
                        required
                        error={fieldError("description")}
                        rows={4}
                        placeholder="Describe your product..."
                        value={form.description}
                        onChange={(e) =>
                          updateForm("description", e.target.value)
                        }
                        onBlur={() => markPublishFieldTouched("description")}
                      />
                    </div>
                  </div>

        </div>
        </div>
        </div>

        {/* STEP 2 — Operations: Pricing, Variants, Inventory & Shipping, Sizing, Fulfillment, Additional Details */}
        <div className={wizardStep === 2 ? "" : "hidden"}>
        <div className="mx-auto w-full max-w-4xl">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">⚙️</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Product Operations
                </h2>
              </div>
              <div className="space-y-4">
                {/* Pricing */}
                <div
                  id="product-pricing-section"
                  className="scroll-mt-24 py-2 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => toggleSection("pricing")}
                      className="flex items-center gap-2 text-left"
                    >
                      <h2 className="text-base font-medium text-theme">
                        Pricing
                      </h2>
                      {collapsedSections.pricing ? (
                        <ChevronDown className="h-4 w-4 text-[color:var(--text-secondary)]" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-[color:var(--text-secondary)]" />
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-theme-secondary">
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
                        <div className="w-9 h-5 surface-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                      </label>
                    </div>
                  </div>

                  {!collapsedSections.pricing && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-start">
                      <Input
                        label="Price"
                        required
                        error={fieldError("price")}
                        type="number"
                        value={form.price || ""}
                        onChange={(e) =>
                          updateForm("price", Number(e.target.value))
                        }
                        onBlur={() => markPublishFieldTouched("price")}
                        placeholder="0"
                        startIcon={
                          <span className="text-theme-secondary text-xs">
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
                          <span className="text-theme-secondary text-xs">
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
                            <span className="text-theme-secondary text-xs">
                              ₦
                            </span>
                          }
                          inputSize="sm"
                          className="[&_label]:text-xs [&_label]:mb-1"
                        />
                        {profitMargin.margin > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1 truncate">
                            Margin: {profitMargin.margin}% • Profit:{" "}
                            {formatCurrency(profitMargin.profit, form.currency)}
                          </p>
                        )}
                      </div>
                      <Input
                        label="Currency"
                        type="text"
                        value={form.currency}
                        onChange={() => {}}
                        disabled
                        inputSize="sm"
                        className="[&_label]:text-xs [&_label]:mb-1"
                      />
                    </div>
                  )}
                </div>

                {/* Variants */}
                <div id="product-variants-section" className="scroll-mt-24 space-y-4 py-2">
                  <div
                    className={`pb-2 ${collapsedSections.variants ? "" : "border-b border-gray-100 dark:border-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSection("variants")}
                        className="flex items-center gap-2 text-left"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-medium text-theme">
                              Variants
                            </h2>
                            {collapsedSections.variants ? (
                              <ChevronDown className="h-4 w-4 text-[color:var(--text-secondary)]" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-[color:var(--text-secondary)]" />
                            )}
                          </div>
                        </div>
                      </button>
                      {!collapsedSections.variants && (
                        <button
                          type="button"
                          onClick={addColorGroup}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition"
                        >
                          + Add Color
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-theme-secondary mt-0.5 font-medium tracking-wide">
                      Supported sizes: XXS, XS, S, M, L, XL, XXL, XXXL, XXXXL
                    </span>
                    <p
                      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${
                        collapsedSections.variants
                          ? 'mt-2 px-2 py-0.5 text-[10px]'
                          : 'mt-3 px-3 py-1 text-[11px]'
                      } ${
                        form.variants.length >= MIN_PUBLISH_VARIANT_COUNT
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100'
                          : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100'
                      }`}
                    >
                      <span aria-hidden="true">
                        {form.variants.length >= MIN_PUBLISH_VARIANT_COUNT ? '✅' : 'ℹ️'}
                      </span>
                      {collapsedSections.variants
                        ? `${form.variants.length}/${MIN_PUBLISH_VARIANT_COUNT} sizes`
                        : form.variants.length >= MIN_PUBLISH_VARIANT_COUNT
                          ? `Go-live ready: ${form.variants.length}/${MIN_PUBLISH_VARIANT_COUNT} size variants.`
                          : `Progress: ${form.variants.length}/${MIN_PUBLISH_VARIANT_COUNT} size variants added. Add ${MIN_PUBLISH_VARIANT_COUNT - form.variants.length} more to go live.`}
                    </p>
                  </div>

                  {!collapsedSections.variants && hasDuplicateVariants && (
                    <div className="px-6 py-3 text-xs text-orange-700 bg-orange-50 border-b border-orange-300 dark:text-orange-300 dark:bg-orange-500/10 dark:border-orange-500/20">
                      Duplicate variants detected (same size/color). Please
                      adjust or remove duplicates.
                    </div>
                  )}

                  {!collapsedSections.variants &&
                    (form.variants.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-theme-secondary text-sm mb-2">
                          No colors yet
                        </p>
                        <p className="text-theme-secondary text-xs">
                          Tap <span className="font-semibold">+ Add Color</span>{" "}
                          to name a color (e.g. Green), then add the sizes it
                          comes in. Add another color for each colorway.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        {variantColorGroups.map((group) => {
                          return (
                            <div
                              key={group.stableKey}
                              className="overflow-hidden bg-transparent py-2 border-b border-gray-100 dark:border-white/5 last:border-0"
                            >
                              {/* Color group header & Add sizes — compact side-by-side row */}
                              <div className="py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-transparent border-b border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-[10px] font-semibold uppercase text-theme-secondary shrink-0">
                                    Color
                                  </span>
                                  <Input
                                    type="text"
                                    value={group.color}
                                    onChange={(e) =>
                                      setGroupColor(group, e.target.value)
                                    }
                                    placeholder="e.g. Green"
                                    inputSize="sm"
                                    fullWidth={false}
                                    className="w-24 sm:w-28 shrink-0"
                                  />
                                  <span className="text-[10px] text-gray-400 shrink-0">
                                    {group.variants.length} size
                                    {group.variants.length !== 1 ? "s" : ""}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="text-[10px] font-semibold uppercase text-theme-secondary shrink-0">
                                    Add sizes
                                  </span>
                                  <div className="flex items-center gap-1 flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-0.5 bg-white/50 dark:bg-white/[0.03]">
                                    <input
                                      ref={(el) => {
                                        quickAddSizeInputRefs.current[group.stableKey] = el;
                                      }}
                                      type="text"
                                      enterKeyHint="done"
                                      autoCapitalize="characters"
                                      placeholder="e.g. S, M, L, XL"
                                      className="h-7 flex-1 min-w-0 text-xs bg-transparent border-none outline-none text-theme-secondary placeholder:text-gray-400"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const input = e.currentTarget;
                                          addMultipleSizesForGroup(
                                            group,
                                            input.value,
                                          );
                                          input.value = "";
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const input =
                                          quickAddSizeInputRefs.current[group.stableKey];
                                        if (!input) return;
                                        addMultipleSizesForGroup(
                                          group,
                                          input.value,
                                        );
                                        input.value = "";
                                        input.focus();
                                      }}
                                      className="inline-flex h-6 shrink-0 items-center justify-center rounded bg-purple-600 px-2 text-[10px] font-semibold text-white transition hover:bg-purple-500"
                                    >
                                      Add
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeColorGroup(group)}
                                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition shrink-0 ml-1"
                                    title="Remove this color and all its sizes"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Size rows */}
                              {group.variants.length > 0 && (
                                <div className="px-3 pt-1.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                                  <span className="w-20">Size</span>
                                  <span className="w-24">Price (₦)</span>
                                  <span className="w-16">Stock</span>
                                  <span className="flex-1" />
                                </div>
                              )}
                              <div className="divide-y divide-gray-100 dark:divide-white/5">
                                {group.variants.map(
                                  ({ variant, originalIndex }) => (
                                    <div
                                      key={variant.id || originalIndex}
                                      className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                      <Input
                                        type="text"
                                        list="wiez-size-options"
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
                                          <span className="text-theme-secondary text-[10px]">
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

                              {/* Manual add for a one-off / custom size */}
                              <button
                                type="button"
                                onClick={() => addSizeToGroup(group)}
                                className="mt-1 inline-flex items-center gap-1 px-3 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                              >
                                <Plus className="w-3 h-3" /> Add size row
                              </button>
                            </div>
                          );
                        })}

                        <datalist id="wiez-size-options">
                          <option value="XXS" />
                          <option value="XS" />
                          <option value="S" />
                          <option value="M" />
                          <option value="L" />
                          <option value="XL" />
                          <option value="XXL" />
                          <option value="XXXL" />
                          <option value="XXXXL" />
                        </datalist>

                        <div className="px-3 py-2 text-[11px] text-theme-secondary flex items-center justify-between">
                          <span>
                            Total variant stock:{" "}
                            <span className="text-theme">
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
                  // Must match what the design form passes, or the two screens
                  // scope the measurement registry differently again: without
                  // this the product picker showed the FULL registry while the
                  // design picker showed an audience-scoped subset.
                  measurementGender={
                    form.gender === "MALE"
                      ? "MEN"
                      : form.gender === "FEMALE"
                        ? "WOMEN"
                        : "UNISEX"
                  }
                />
                {form.variants.length > 0 &&
                normalizeSizingMode(form.sizingMode) === "NONE" ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <span aria-hidden="true">ℹ️</span>
                    <span>
                      You added {form.variants.length} size variant
                      {form.variants.length === 1 ? "" : "s"} but the sizing
                      mode is "No Sizing". Switch it to RTW so buyers get size
                      guidance that matches your stocked sizes.
                    </span>
                  </div>
                ) : null}

                {/* Custom order toggle */}
                <div className="py-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer transition-colors hover:border-purple-500/30">
                    <input
                      type="checkbox"
                      checked={form.customOrderEnabled}
                      onChange={(e) => {
                        const nextValue = e.target.checked;
                        updateForm("customOrderEnabled", nextValue);
                        setShowCustomOrderForm(nextValue);
                      }}
                      className="w-5 h-5 mt-0.5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-slate-900"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-theme">
                        Custom Order
                      </span>
                      <p className="mt-0.5 text-xs text-theme-secondary leading-relaxed">
                        Allow buyers to request this product with their own measurements. Custom order does not replace the required stocked size variants.
                      </p>
                    </div>
                  </label>

                  {showCustomOrderForm && (
                    <div className="mt-4">
                      <CustomOrderConfigurationEditor
                        ref={customOrderEditorRef}
                        sourceType="PRODUCT"
                        sourceId={isEditMode ? productId : undefined}
                        sourceTitle={form.title}
                        measurementKeys={form.customMeasurementKeys}
                        // Filter measurement points by the product's audience,
                        // exactly like the design creation flow — otherwise the
                        // product form showed the full (unfiltered) registry while
                        // designs showed a gendered subset, so the two screens
                        // rendered different measurement points for the same brand.
                        measurementGender={
                          form.gender === "MALE"
                            ? "MEN"
                            : form.gender === "FEMALE"
                              ? "WOMEN"
                              : "UNISEX"
                        }
                        defaultBaseCharge={form.price > 0 ? form.price : null}
                        defaultProductionLeadDays={storeDefaultProductionLeadDays}
                        defaultProductionLeadLabel={storeCustomOrderLeadTimeLabel}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>

                <div className="py-2">
                  <button
                    type="button"
                    onClick={() => toggleSection("fulfillment")}
                    className="flex items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-medium text-theme">
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
                      <div id="product-inventory-section" className="scroll-mt-24 py-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-base font-medium text-theme">
                            Inventory
                          </h2>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              label="SKU (Stock Keeping Unit)"
                              type="text"
                              value={form.sku}
                              onChange={() => {}}
                              placeholder="Auto-generated"
                              disabled
                              helperText="Auto-generated inventory code."
                              inputSize="sm"
                              className="[&_label]:text-xs [&_label]:mb-1"
                            />
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
                          </div>
                          {form.variants.length > 0 && (
                            <p className="text-[10px] text-gray-500">
                              Stock is derived from variants. Edit stock per variant above.
                            </p>
                          )}
                          <div className="flex items-center gap-3 pt-2">
                            <input
                              type="checkbox"
                              id="track-qty"
                              checked={form.trackInventory}
                              onChange={(e) =>
                                updateForm("trackInventory", e.target.checked)
                              }
                              className="w-4 h-4 rounded border-theme-strong bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="track-qty"
                              className="text-xs text-theme-secondary"
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
                              className="w-4 h-4 rounded border-theme-strong bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="continue-selling"
                              className="text-xs text-theme-secondary"
                            >
                              Continue selling when out of stock
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Shipping */}
                      <div className="space-y-4">
                        <h2 className="text-base font-medium text-theme">
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
                              className="w-4 h-4 rounded border-theme-strong bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="physical-product"
                              className="text-xs text-theme-secondary"
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
                                    <span className="text-theme-secondary text-xs">
                                      {form.weightUnit}
                                    </span>
                                  }
                                  inputSize="sm"
                                  className="[&_label]:text-xs [&_label]:mb-1"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold text-theme-secondary mb-1">
                                Ship To Countries
                              </p>
                              <p className="text-[11px] text-theme-secondary mb-2">
                                Prefilled from Store Setup. Changes here update
                                your store shipping regions.
                              </p>
                              <p className="mb-2 text-[11px] text-theme-secondary">
                                Processing time defaults from Store Setup:{" "}
                                <span className="font-semibold text-theme">
                                  {shippingRegionsLoading
                                    ? "Loading..."
                                    : storeProcessingTimeLabel || "Not set"}
                                </span>
                                .
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {SHIPPING_REGION_OPTIONS.map((opt) => {
                                  const isSelected =
                                    normalizedShippingRegions.includes(opt.code);
                                  return (
                                    <label
                                      key={opt.code}
                                      className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                                        isSelected
                                          ? "border-purple-500/60 bg-purple-500/10 text-theme"
                                          : "border-gray-300/70 dark:border-white/15 text-theme-secondary"
                                      } ${!form.isPhysicalProduct ? "opacity-60" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          toggleShippingRegion(opt.code)
                                        }
                                        disabled={!form.isPhysicalProduct}
                                        className="w-3.5 h-3.5 rounded border-theme-strong bg-white dark:bg-gray-700 text-purple-600 focus:ring-purple-500"
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
                <div className="rounded-xl bg-white/35 p-4 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => toggleSection("additional")}
                    className="flex items-center gap-2 text-left"
                  >
                    <h2 className="text-base font-medium text-theme">
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
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
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
                            <p className="text-xs text-theme font-medium">
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
                            <div className="w-9 h-5 surface-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-theme font-medium">
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
                            <div className="w-9 h-5 surface-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
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

        {/* STEP 3 — Review: read-only summary + publish (numbers reuse the same
            live form state / profitMargin, so they always match Operations) */}
        <div className={wizardStep === 3 ? "" : "hidden"}>
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="mb-1">
              <h2 className="text-lg font-semibold text-theme">Review &amp; publish</h2>
              <p className="text-sm text-theme-secondary">
                Confirm everything looks right, then publish or save as a draft.
              </p>
            </div>

            {/* Media */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Media
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              {mediaUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mediaUrls.map((m) => (
                    <div
                      key={m.id}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-theme"
                    >
                      <img
                        src={m.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {m.isPrimary && (
                        <span className="absolute inset-x-0 bottom-0 bg-purple-600/80 text-center text-[10px] text-white">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-theme-secondary">No images added yet.</p>
              )}
            </section>

            {/* Basic Information */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Basic Information
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-theme-secondary">Title</dt>
                  <dd className="text-sm text-theme">{form.title || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Audience</dt>
                  <dd className="text-sm text-theme">
                    {CREATOR_AUDIENCE_OPTIONS.find((o) => o.value === form.gender)
                      ?.label ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Category</dt>
                  <dd className="text-sm text-theme">
                    {productEditorSupportData?.taxonomyCategories?.find(
                      (c) => c.id === form.taxonomyCategoryId,
                    )?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Subcategory</dt>
                  <dd className="text-sm text-theme">
                    {productEditorSupportData?.taxonomyCategories
                      ?.find((c) => c.id === form.taxonomyCategoryId)
                      ?.types?.find((t) => t.id === form.categoryTypeId)?.name ??
                      productEditorSupportData?.categoryTypes?.find(
                        (t) => t.id === form.categoryTypeId,
                      )?.name ??
                      "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-theme-secondary">Description</dt>
                  <dd className="whitespace-pre-wrap text-sm text-theme">
                    {form.description || "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Pricing */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Pricing
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-theme-secondary">Price</dt>
                  <dd className="text-sm text-theme">
                    {formatCurrency(form.price || minVariantPrice, form.currency)}
                  </dd>
                </div>
                {form.onSale && form.compareAtPrice > 0 && (
                  <div>
                    <dt className="text-xs text-theme-secondary">Sale price</dt>
                    <dd className="text-sm text-theme">
                      {formatCurrency(form.compareAtPrice, form.currency)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-theme-secondary">Unit cost</dt>
                  <dd className="text-sm text-theme">
                    {form.costPerItem > 0
                      ? formatCurrency(form.costPerItem, form.currency)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Margin</dt>
                  <dd className="text-sm text-theme">
                    {profitMargin.margin > 0 ? `${profitMargin.margin}%` : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Variants */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Variants
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              {form.variants.length > 0 ? (
                <div className="space-y-1">
                  {form.variants.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-theme">
                        {[v.color, v.size].filter(Boolean).join(" · ") ||
                          `Variant ${i + 1}`}
                      </span>
                      <span className="text-theme-secondary">
                        Stock: {Number.isFinite(v.stock) ? v.stock : 0}
                        {typeof v.price === "number" && v.price > 0
                          ? ` · ${formatCurrency(v.price, form.currency)}`
                          : ""}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1 text-xs text-theme-secondary">
                    Total stock: {variantTotalStock}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-theme-secondary">No variants added.</p>
              )}
            </section>

            {/* Inventory & Fulfillment */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Inventory &amp; Fulfillment
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-theme-secondary">Track inventory</dt>
                  <dd className="text-sm text-theme">
                    {form.trackInventory ? "On" : "Off"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Sizing</dt>
                  <dd className="text-sm text-theme">
                    {form.sizingMode === "NONE" ? "None" : form.sizingMode}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Custom order</dt>
                  <dd className="text-sm text-theme">
                    {form.customOrderEnabled ? "Enabled" : "Off"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Additional Details */}
            <section className="rounded-2xl border border-theme p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-theme-secondary">
                  Additional Details
                </h3>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-xs font-medium text-purple-600 hover:underline"
                >
                  Edit
                </button>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-theme-secondary">SKU</dt>
                  <dd className="text-sm text-theme">
                    {form.sku || "Auto-generated"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-theme-secondary">Materials</dt>
                  <dd className="text-sm text-theme">{form.materials || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-theme-secondary">Tags</dt>
                  <dd className="text-sm text-theme">
                    {form.tags.length > 0 ? form.tags.join(", ") : "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 w-full px-4 py-2.5 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-t border-gray-200/40 dark:border-white/10 sm:px-6">
        {/* Why the primary button is inactive. A disabled control with no
            explanation is worse than the mid-submit toast it replaces, so the
            blockers are named here and each one jumps to its field. */}
        {blockingPublishFields.length > 0 && !isDraftOnlySubmit && (
          <div className="mx-auto mb-2 flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[11px] font-semibold text-theme-secondary">
              Still needed:
            </span>
            {blockingPublishFields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => focusPublishField(field)}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                {PRODUCT_PUBLISH_FIELD_LABEL[field]}
                {PRODUCT_PUBLISH_FIELD_STEP[field] !== wizardStep ? (
                  <span className="opacity-70">
                    · step {PRODUCT_PUBLISH_FIELD_STEP[field]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-theme-secondary">
            {/* The "changes" concept only means something when editing an entity
                that already exists (draft or active). For a first-time create
                there is no saved version to have unsaved changes against — the
                indicator would just be noise next to "Save as Draft". */}
            {productReviewHint ? (
              <span>{productReviewHint}</span>
            ) : isEditMode &&
              (hasChanges ? (
                <span className="text-orange-400">Unsaved changes</span>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span>All changes saved</span>
                </>
              ))}
          </div>
          <div className="flex w-full flex-wrap items-stretch gap-2 md:w-auto md:items-center md:gap-4">
            {wizardStep > 1 && (
              <button
                type="button"
                onClick={() => goToStep((wizardStep - 1) as 1 | 2 | 3)}
                className="surface-control surface-interactive-hover inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition md:min-h-10 md:flex-initial md:px-4 md:text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {/*
              Also shown while answering a change request. Previously this was
              create-only, so an owner whose product came back with requested
              changes had exactly one control — submit — and no way to park the
              work in progress. Deliberately NOT extended to live products:
              draft-saving an ACTIVE product would silently unpublish it.
            */}
            {((!isEditMode && !isCollectionContext) ||
              (isResubmission && !isCollectionContext && !isCollectionFlow)) && (
              <button
                onClick={() =>
                  void triggerSave(true, {
                    action: "draft",
                    forceStatus: "DRAFT",
                  })
                }
                disabled={saving || submitLocked}
                className="surface-control surface-interactive-hover relative inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 md:min-h-10 md:flex-initial md:px-4 md:text-sm"
              >
                {(saving || submitLocked) && saveAction === "draft" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <VLoader size={16} phase="loading" showLabel={false} />
                  </span>
                )}
                <span className={(saving || submitLocked) && saveAction === "draft" ? "opacity-0" : ""}>
                  Save as Draft
                </span>
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
                className="surface-control surface-interactive-hover relative inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 md:min-h-10 md:flex-initial md:px-4 md:text-sm"
              >
                {(saving || submitLocked) && saveAction === "draft" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <VLoader size={16} phase="loading" showLabel={false} />
                  </span>
                )}
                <span className={(saving || submitLocked) && saveAction === "draft" ? "opacity-0" : ""}>
                  Save Changes
                </span>
              </button>
            )}
            <button
              onClick={handleDiscard}
              className="surface-control surface-interactive-hover inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition md:min-h-10 md:flex-initial md:px-4 md:text-sm"
            >
              {isCollectionContext
                ? "Back to Collection"
                : isEditMode && hasChanges
                  ? "Discard Changes"
                  : "Cancel"}
            </button>
            {wizardStep < 3 ? (
              <button
                type="button"
                onClick={() => goToStep((wizardStep + 1) as 1 | 2 | 3)}
                disabled={!canAdvanceFromCurrentStep}
                title={
                  canAdvanceFromCurrentStep
                    ? undefined
                    : "Complete this step's required fields first"
                }
                className="relative inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-600/40 disabled:shadow-none md:min-h-10 md:flex-initial md:px-6 md:text-sm"
              >
                Continue to {wizardStep === 1 ? "Operations" : "Review"}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
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
                        // Answering a change request is a SUBMISSION. Leaving
                        // this undefined kept the product on its existing
                        // CHANGES_REQUESTED/REJECTED status, so the owner's
                        // edits never re-entered the review queue and the
                        // content sat stuck with nobody waiting on it.
                        : isResubmission
                          ? "ACTIVE"
                          : !isEditMode
                          // A first-time "Create Product" submit is always a
                          // submission — it must resolve to IN_REVIEW server-
                          // side, never fall back to whatever `form.status`
                          // happens to hold. Drafts are an explicit choice
                          // ("Save as Draft"), not a submit outcome.
                          ? "ACTIVE"
                          : undefined,
                  })
                }
                disabled={
                  saving || submitLocked || blockingPublishFields.length > 0
                }
                title={
                  blockingPublishFields.length > 0
                    ? `Still needed: ${blockingPublishFields
                        .map((field) => PRODUCT_PUBLISH_FIELD_LABEL[field])
                        .join(", ")}`
                    : undefined
                }
                className="relative inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-600/50 disabled:shadow-none md:min-h-10 md:flex-initial md:px-6 md:text-sm"
              >
                {(saving || submitLocked) && saveAction === "publish" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <VLoader size={16} phase="loading" showLabel={false} />
                  </span>
                )}
                <span className={(saving || submitLocked) && saveAction === "publish" ? "opacity-0" : ""}>
                  {isResubmission
                    ? primaryActionLabel({
                        status: productReviewStatus,
                        isEditMode,
                        entity: "product",
                      })
                    : isDraftEditMode
                      ? "Go live"
                      : isCollectionContext && isEditMode
                        ? "Save to Collection"
                        : isEditMode
                          ? "Save Changes"
                          : isCollectionFlow
                            ? "Add to Collection"
                            : "Create Product"}
                </span>
              </button>
            )}
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

      {/* Spotlight tour — shown automatically on first visit (create mode) */}
      <TourOverlay
        steps={tourSteps}
        isActive={isTourActive}
        onClose={handleTourClose}
      />

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
