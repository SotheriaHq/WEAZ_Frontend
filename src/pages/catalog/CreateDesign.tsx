import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import VLoader from "@/components/loaders/VLoader";
import {
  FiArrowLeft,
  FiTrash2,
  FiStar,
  FiMove,
  FiMaximize2,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiSearch,
  FiX,
  FiFile,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiPlus,
} from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi";
import CustomOrderConfigurationEditor, {
  type CustomOrderConfigurationEditorHandle,
} from '@/components/custom-orders/CustomOrderConfigurationEditor';
import { customOrderConfigurationsApi } from '@/api/CustomOrderApi';
import { getStorePolicies } from '@/api/StoreApi';

// Context & Hooks
import TextField from "../../components/forms/TextField";
import UniversalSelect from "@/components/forms/UniversalSelect";
import MediaUploadZone from "../../components/upload/MediaUploadZone";
import ThumbnailStrip from "../../components/upload/ThumbnailStrip";
import MediaRenderer from "../../components/media/MediaRenderer";
import useFilePicker from "../../components/upload/useFilePicker";
import { PrePublishConfirmModal } from "@/components/modals";
import TagsApi from "@/api/TagsApi";
import { brandApi } from "@/api/BrandApi";
import FilterSelector, {
  type FilterSelection,
} from "@/components/categories/FilterSelector";
import InfoTooltip from "@/components/ui/InfoTooltip";
import type { MediaItem } from "@/types/media";
import { MediaProvider, useMediaStore } from "../../hooks/useMediaStore";
import useDesignUpload from "../../hooks/useDesignUpload";
import { useBrandProfile } from "../../hooks/UseBrandHook";
import { DesignApi, finalizeDesignUploads, resolveDesignId } from "@/api/DesignApi";
import type { SizingMode } from '@/types/sizing';
import {
  DESIGN_FIT_PREFERENCE_OPTIONS,
  DESIGN_MAX_MEDIA_COUNT,
  DESIGN_MEDIA_SLOTS,
  DESIGN_REQUIRED_MEDIA_COUNT,
  DESIGN_TARGET_AGE_OPTIONS,
  type DesignFitPreference,
  type DesignTargetAgeGroup,
} from '@/features/designs/designCreationRules';
import {
  createPublishTask,
  updatePublishTask,
  removePublishTask,
} from '@/utils/publishTracker';
import { buildDesignRoute } from '@/utils/catalogRoutes';
import {
  CREATOR_AUDIENCE_OPTIONS,
  CREATOR_METADATA_HELP,
  getAudienceLabel,
  mapCreatorMetadataError,
  normalizeHashtagLabel,
} from '@/utils/creatorMetadata';
import {
  deriveProductionLeadDaysFromStoreTime,
  getStoreProcessingTimeLabel,
} from '@/utils/storeProcessing';
import { TourOverlay, type TourStep } from '@/components/ui/TourOverlay';
// ============================================================================

type CategoryTypeOption = { id: string; name: string };
type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  types: CategoryTypeOption[];
};

const DESIGN_SIZING_MODE_OPTIONS = [
  { value: 'NONE', label: 'No size specification' },
  { value: 'RTW', label: 'Ready-to-Wear only' },
  { value: 'RTW_PLUS_FITTINGS', label: 'Ready-to-Wear + fittings' },
  { value: 'CUSTOM', label: 'Custom only' },
] as const;
type DesignSizingMode = Extract<SizingMode, (typeof DESIGN_SIZING_MODE_OPTIONS)[number]['value']>;

const normalizeMeasurementLabel = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

const normalizeMeasurementKeyList = (keys: string[]) =>
  Array.from(
    new Set(
      keys
        .map((key) => String(key ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  );

const measurementKeyToLabel = (key: string) =>
  key
    .replace(/^BRAND_[^_]+_/, '')
    .replace(/^(MEN|WOMEN|UNISEX)_/, '')
    .replace(/_/g, ' ');

const dedupeMeasurementKeysByLabel = (keys: string[]) => {
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  const deduped: string[] = [];

  for (const rawKey of keys) {
    const normalizedKey = String(rawKey ?? '').trim().toUpperCase();
    if (!normalizedKey || seenKeys.has(normalizedKey)) {
      continue;
    }

    const label = normalizeMeasurementLabel(measurementKeyToLabel(normalizedKey));
    if (!label || seenLabels.has(label)) {
      continue;
    }

    seenKeys.add(normalizedKey);
    seenLabels.add(label);
    deduped.push(normalizedKey);
  }

  return deduped;
};

const extractDesignId = (response: unknown): string | undefined => {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const record = response as Record<string, unknown>;
  const directDesignId = resolveDesignId(record);
  if (directDesignId) return directDesignId;

  const nestedData =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null;
  const nestedDesignId = resolveDesignId(nestedData);
  if (nestedDesignId) return nestedDesignId;

  return undefined;
};

const CreateDesignInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const navigate = useNavigate();
  const location = useLocation();
  const customOrderEditorRef = useRef<CustomOrderConfigurationEditorHandle | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isMadeToOrder, setIsMadeToOrder] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryTypeId, setCategoryTypeId] = useState<string>("");
  const [filterSelection, setFilterSelection] = useState<FilterSelection>({});
  const [type, setType] = useState<"MALE" | "FEMALE" | "EVERYBODY">(
    "EVERYBODY",
  );
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [sizingMode, setSizingMode] = useState<DesignSizingMode>('RTW_PLUS_FITTINGS');
  const [fitPreference, setFitPreference] = useState<DesignFitPreference>('REGULAR');
  const [targetAgeGroup, setTargetAgeGroup] = useState<DesignTargetAgeGroup>('ADULT');
  const [metadataEditedAt, setMetadataEditedAt] = useState<Date | null>(null);
  const [storeProcessingTime, setStoreProcessingTime] = useState('');
  const [storeCustomOrderLeadTime, setStoreCustomOrderLeadTime] = useState('');
  const [customMeasurementKeys, setCustomMeasurementKeys] = useState<string[]>(
    [],
  );

  // UI state
  const [isTourActive, setIsTourActive] = useState(false);

  // Auto-start the tour the first time a user opens the create-design page.
  // Persisted in localStorage so it never shows again after the first visit.
  useEffect(() => {
    if (isEditMode) return;
    if (localStorage.getItem('threadly_tour_design_create')) return;
    const timer = window.setTimeout(() => setIsTourActive(true), 800);
    return () => clearTimeout(timer);
    // isEditMode is stable for the lifetime of this page instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTourClose = useCallback(() => {
    setIsTourActive(false);
    localStorage.setItem('threadly_tour_design_create', '1');
  }, []);

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
  const [showDraftSavedChoices, setShowDraftSavedChoices] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<"draft" | "publish" | null>(
    null,
  );
  const tagStylePalette = useMemo(
    () => [
      "surface-control border border-theme text-theme backdrop-blur-md shadow-sm",
      "bg-gradient-to-r from-purple-500/60 to-blue-500/50 text-white shadow-md",
      "bg-gradient-to-r from-amber-400/70 to-pink-500/70 text-white shadow-md",
      "surface-control border border-theme text-theme backdrop-blur",
      "bg-gradient-to-r from-emerald-400/70 to-teal-500/70 text-white shadow-md",
      "bg-gradient-to-r from-indigo-500/70 to-cyan-500/70 text-white shadow-md",
    ],
    [],
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

  // Track original items for deletion in edit mode
  const originalItemIds = useRef<Set<string>>(new Set());
  const transientObjectUrlsRef = useRef<Map<string, string>>(new Map());

  const {
    uploadDesign,
    isUploading,
    progress,
    perFileProgress,
    cancelUploads,
  } = useDesignUpload();
  const { user, fetchCollections } = useBrandProfile();
  const publishTaskScope = useMemo(
    () => ({ ownerId: user?.id ?? undefined }),
    [user?.id],
  );
  const emailVerificationRedirect = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    return `/profile?verifyEmailPrompt=design-create&next=${encodeURIComponent(nextPath)}`;
  }, [location.pathname, location.search]);
  const requiresEmailVerification = !isEditMode && user?.isEmailVerified === false;

  const disabled = false;
  const titleDescriptionLocked = useMemo(() => {
    if (!isEditMode || !metadataEditedAt) return false;
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() < metadataEditedAt.getTime() + cooldownMs;
  }, [metadataEditedAt, isEditMode]);
  const nextTitleEditDate = useMemo(() => {
    if (!metadataEditedAt) return null;
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    return new Date(metadataEditedAt.getTime() + cooldownMs);
  }, [metadataEditedAt]);
  const picker = useFilePicker({
    accept: ["image/*", "video/*"],
    maxFiles: Math.max(0, DESIGN_MAX_MEDIA_COUNT - files.length),
    onFiles: (incomingFiles) => mediaStore.addFiles(incomingFiles, DESIGN_MAX_MEDIA_COUNT),
    disabled,
  });

  const getSelectedFilterValueIds = useCallback(() => {
    return Array.from(
      new Set(
        Object.values(filterSelection)
          .flatMap((ids) => ids)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
  }, [filterSelection]);

  // Load initial data
  // Load initial data (tags, categories, and design when editing)
  // Note: do not include `mediaStore` (unstable) or setters in deps to avoid rerunning
  // this effect and spamming APIs; run only on mount or when edit id changes.
  useEffect(() => {
    let mounted = true;

    const loadTagSuggestions = async () => {
      try {
        const s = await TagsApi.getSuggestions(80);
        if (mounted) setTagSuggestions(Array.isArray(s) ? s : []);
      } catch (error) {
        console.warn("Failed to load tag suggestions", error);
        if (mounted) setTagSuggestions([]);
      }
    };

    const loadCategories = async () => {
      try {
        const cats = await brandApi.getCategoriesWithSubCategories(true);
        if (!mounted || !Array.isArray(cats)) return;
        const mapped = cats.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          types: Array.isArray(c.types)
            ? c.types.map((t) => ({ id: t.id, name: t.name }))
            : [],
        }));
        setCategories(mapped);
        if (mapped.length) {
          setCategoryId((prev) =>
            prev && mapped.some((category) => category.id === prev)
              ? prev
              : mapped[0].id,
          );
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
      } catch (error) {
        console.warn("Failed to load categories", error);
        if (mounted) setCategories([]);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    };

    const loadStoreProcessingDefaults = async () => {
      try {
        const policies = await getStorePolicies();
        if (!mounted) return;
        setStoreProcessingTime(policies.processingTime || '');
        setStoreCustomOrderLeadTime(
          policies.shippingRules?.customOrderSettings?.leadTime || '',
        );
      } catch {
        if (!mounted) return;
        setStoreProcessingTime('');
        setStoreCustomOrderLeadTime('');
      }
    };

    const loadDesignDetail = async () => {
      if (!isEditMode || !id) return;
      try {
        const d = (await DesignApi.getDesignDetail(id)) as any;
        if (!mounted || !d) return;
        setTitle(d.title || "");
        setDescription(d.description || "");
        setMinPrice(d.minPrice ? String(d.minPrice) : "");
        setMaxPrice(d.maxPrice ? String(d.maxPrice) : "");
        setSelectedTags(Array.isArray(d.tags) ? d.tags : []);
        setCategoryId(d.categoryId || "");
        setCategoryTypeId((d as any).subCategoryId || d.categoryTypeId || "");
        setType(d.type || "EVERYBODY");
        setVisibility(d.visibility || "PUBLIC");
        setSizingMode(
          d.sizingMode === 'CUSTOM' || d.sizingMode === 'RTW' || d.sizingMode === 'NONE'
            ? d.sizingMode
            : 'RTW_PLUS_FITTINGS',
        );
        setFitPreference(
          d.fitPreference === 'SLIM' ||
            d.fitPreference === 'LOOSE' ||
            d.fitPreference === 'OVERSIZED'
            ? d.fitPreference
            : 'REGULAR',
        );
        setTargetAgeGroup(d.targetAgeGroup === 'CHILD' ? 'CHILD' : 'ADULT');
        setCustomMeasurementKeys(
          Array.isArray(d.customMeasurementKeys) ? dedupeMeasurementKeysByLabel(d.customMeasurementKeys) : [],
        );
        setIsMadeToOrder(Boolean((d as any).customOrderEnabled));
        setMetadataEditedAt(
          d.metadataEditedAt ? new Date(d.metadataEditedAt) : null,
        );

        const draftFilters = Array.isArray((d as any).filters)
          ? ((d as any).filters as Array<{ dimensionId?: string; valueId?: string }>).reduce(
              (acc, item) => {
                if (!item?.dimensionId || !item?.valueId) return acc;
                if (!acc[item.dimensionId]) acc[item.dimensionId] = [];
                if (!acc[item.dimensionId].includes(item.valueId)) {
                  acc[item.dimensionId].push(item.valueId);
                }
                return acc;
              },
              {} as FilterSelection,
            )
          : {};
        setFilterSelection(draftFilters);

        if (d.medias && Array.isArray(d.medias)) {
          const mediaResults = await Promise.all(
            d.medias.map(async (m: any) => {
              const fileId = m.file?.id || m.fileId;
              const remoteUrl =
                typeof m.file?.s3Url === "string" ? m.file.s3Url : "";
              const signedUrl = fileId
                ? await brandApi.getSignedFileUrl(fileId)
                : null;
              originalItemIds.current.add(m.id);
              const previewUrl = signedUrl || remoteUrl;
              if (!previewUrl) return null;
              return {
                id: m.id,
                file: undefined,
                previewUrl,
                kind: m.type === "VIDEO" ? "video" : "image",
                remoteId: m.id,
              } as MediaItem;
            }),
          );
          const items = mediaResults.filter(Boolean) as MediaItem[];
          mediaStore.set(items);
        }
      } catch (error: any) {
        console.error(error);
        toast.error(
          error?.response?.data?.message ??
            "Failed to load design for editing.",
        );
      }
    };

    void Promise.all([
      loadTagSuggestions(),
      loadCategories(),
      loadDesignDetail(),
      loadStoreProcessingDefaults(),
    ]);

    return () => {
      mounted = false;
    };
  }, [id, isEditMode]);

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

  const normalizedCustomMeasurementKeys = useMemo(
    () => dedupeMeasurementKeysByLabel(customMeasurementKeys),
    [customMeasurementKeys],
  );

  // Validation
  const isValid =
    title.trim().length > 0 &&
    files.length >= DESIGN_REQUIRED_MEDIA_COUNT &&
    files.length <= DESIGN_MAX_MEDIA_COUNT &&
    selectedTags.length > 0 &&
    getSelectedFilterValueIds().length > 0 &&
    categoryId.trim().length > 0 &&
    categoryTypeId.trim().length > 0 &&
    type.trim().length > 0;
  const hasDraftContent = Boolean(
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    minPrice.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    selectedTags.length > 0 ||
    categoryId.trim().length > 0 ||
    categoryTypeId.trim().length > 0 ||
    files.length > 0 ||
    isMadeToOrder ||
    sizingMode !== 'RTW_PLUS_FITTINGS' ||
    fitPreference !== 'REGULAR' ||
    targetAgeGroup !== 'ADULT' ||
    normalizedCustomMeasurementKeys.length > 0 ||
    type !== 'EVERYBODY' ||
    visibility !== 'PUBLIC' ||
    Object.values(filterSelection).some((values) => values.length > 0),
  );

  const resolveMediaWithUrl = useCallback((item?: MediaItem | null) => {
    if (!item) return null;
    if (item.previewUrl) {
      // Prefer stable preview URL from store (already lifecycle-managed).
      const transient = transientObjectUrlsRef.current.get(item.id);
      if (transient) {
        URL.revokeObjectURL(transient);
        transientObjectUrlsRef.current.delete(item.id);
      }
      return { ...item, url: item.previewUrl };
    }

    let url = transientObjectUrlsRef.current.get(item.id);
    if (!url && item.file) {
      url = URL.createObjectURL(item.file);
      transientObjectUrlsRef.current.set(item.id, url);
    }
    return url ? { ...item, url } : null;
  }, []);

  useEffect(() => {
    const keepIds = new Set(files.map((item) => item.id));
    for (const [id, url] of Array.from(
      transientObjectUrlsRef.current.entries(),
    )) {
      const item = files.find((it) => it.id === id);
      if (!keepIds.has(id) || item?.previewUrl) {
        URL.revokeObjectURL(url);
        transientObjectUrlsRef.current.delete(id);
      }
    }
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of transientObjectUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      transientObjectUrlsRef.current.clear();
    };
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
    if (!search)
      return tagSuggestions
        .filter((t) => !selectedTags.includes(t))
        .slice(0, 12);
    return tagSuggestions
      .filter(
        (t) => t.toLowerCase().includes(search) && !selectedTags.includes(t),
      )
      .slice(0, 12);
  }, [tagSearch, tagSuggestions, selectedTags]);

  const handleFilterTagSuggestions = useCallback((suggestions: string[]) => {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return;
    }

    setTagSuggestions((prev) => {
      const merged = new Set(prev);
      let changed = false;

      suggestions.forEach((tag) => {
        if (!merged.has(tag)) {
          merged.add(tag);
          changed = true;
        }
      });

      return changed ? Array.from(merged) : prev;
    });
  }, []);

  // Get category name for summary
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryTypeOptions = selectedCategory?.types ?? [];
  const measurementGender = useMemo(
    (): 'MEN' | 'WOMEN' | 'UNISEX' => (type === 'MALE' ? 'MEN' : type === 'FEMALE' ? 'WOMEN' : 'UNISEX'),
    [type],
  );

  const handleCustomOrderMeasurementKeysChange = useCallback((keys: string[]) => {
    const normalizedKeys = normalizeMeasurementKeyList(keys);
    setCustomMeasurementKeys((current) => {
      const currentSignature = normalizeMeasurementKeyList(current).join('|');
      const nextSignature = normalizedKeys.join('|');
      return currentSignature === nextSignature ? current : normalizedKeys;
    });
  }, []);

  // Handlers
  const handleDelete = (itemId: string) => {
    mediaStore.remove(itemId);
  };

  const handleSetCover = (index: number) => {
    setCoverIndex(index);
    toast.success("Cover image updated");
  };

  const goToMediaIndex = useCallback(
    (nextIndex: number) => {
      if (!files.length) return;
      const bounded = Math.min(Math.max(nextIndex, 0), files.length - 1);
      setSelectedIndex(bounded);
      setFullscreenIndex(bounded);
      setFullscreenZoom(1);
    },
    [files.length],
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
      if (event.key === "Escape") {
        event.preventDefault();
        closeFullscreen();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleFullscreenNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleFullscreenPrev();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    closeFullscreen,
    handleFullscreenNext,
    handleFullscreenPrev,
    isFullscreen,
  ]);

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
      toast.error("Maximum 10 tags allowed");
      return;
    }
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setTagSearch("");
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagSearch.trim()) {
      e.preventDefault();
      addTag(tagSearch.trim().toLowerCase().replace(/\s+/g, "-"));
    }
  };

  const handleSaveDraft = async () => {
    if (!hasDraftContent) {
      toast.error('Add at least one detail to save a draft');
      return;
    }
    setShowSaveDraftConfirm(true);
  };

  const executeSaveDraft = async () => {
    // Guard: prevent double submission
    if (isSubmitting) return;

    setSubmitIntent("draft");
    setIsSubmitting(true);
    setShowSaveDraftConfirm(false);
    try {
      const pendingCustomOrderDraft =
        !isEditMode && isMadeToOrder
          ? customOrderEditorRef.current?.buildConfigurationDraft() ?? null
          : null;

      if (isEditMode && id && isMadeToOrder) {
        const saved = await customOrderEditorRef.current?.saveConfiguration({
          silentSuccess: true,
        });
        if (!saved) {
          setIsSubmitting(false);
          setSubmitIntent(null);
          return;
        }
      }

      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const draftTitle = title.trim() || "Untitled Draft";
      const finalTags = (selectedTags.length ? selectedTags : ["draft"]).slice(
        0,
        10,
      );

      if (isEditMode && id) {
        await DesignApi.updateDesign(id, {
          title: draftTitle,
          description,
          minPrice: parsedMinPrice,
          maxPrice: parsedMaxPrice,
          tags: finalTags,
          categoryId,
          subCategoryId: categoryTypeId,
          categoryTypeId,
          type,
          visibility,
          filterValueIds: getSelectedFilterValueIds(),
          sizingMode,
          rtwSizeSystem: null,
          customMeasurementKeys: normalizedCustomMeasurementKeys,
          customOrderEnabled: isMadeToOrder,
          fitPreference,
          targetAgeGroup,
        } as any);
      } else {
        const response = await uploadDesign(
          files,
          draftTitle,
          description,
          parsedMinPrice,
          parsedMaxPrice,
          false,
          finalTags,
          {
            categoryId,
            subCategoryId: categoryTypeId,
            categoryTypeId,
            type,
            visibility,
            filterValueIds: getSelectedFilterValueIds(),
            coverIndex,
            sizingMode,
            rtwSizeSystem: undefined,
            customMeasurementKeys: normalizedCustomMeasurementKeys,
            customOrderEnabled: isMadeToOrder,
            fitPreference,
            targetAgeGroup,
          },
          undefined,
          false, // shouldPublish = false
        );

        const newDesignId = extractDesignId(response);
        if (pendingCustomOrderDraft && newDesignId) {
          await customOrderConfigurationsApi.create({
            ...pendingCustomOrderDraft,
            fabricRuleBasisId: String(pendingCustomOrderDraft.fabricRuleBasisId ?? '').trim() || (
              await customOrderConfigurationsApi.createFabricRuleBasis({
                label: `${draftTitle} fabric rules`,
                measurementKeys: pendingCustomOrderDraft.requiredMeasurementKeys,
                gender: measurementGender,
              })
            ).id,
            sourceId: newDesignId,
          });
        }
      }

      setLastSaved(new Date());

      if (user?.id) {
        await fetchCollections(user.id);
      }

      toast.success("Draft saved successfully!");
      setShowDraftSavedChoices(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save draft");
    } finally {
      setIsSubmitting(false);
      setSubmitIntent(null);
      setShowSaveDraftConfirm(false);
    }
  };

  const handlePublishClick = () => {
    if (!isValid) {
      const reasons: string[] = [];
      if (title.trim().length === 0) reasons.push("Add a title.");
      if (files.length < DESIGN_REQUIRED_MEDIA_COUNT)
        reasons.push(
          `Add the required ${DESIGN_REQUIRED_MEDIA_COUNT} media slots (${DESIGN_MEDIA_SLOTS.slice(0, DESIGN_REQUIRED_MEDIA_COUNT).join(', ')}).`,
        );
      if (files.length > DESIGN_MAX_MEDIA_COUNT)
        reasons.push(`Use no more than ${DESIGN_MAX_MEDIA_COUNT} media assets.`);
      if (categoryId.trim().length === 0) reasons.push("Choose what this item is.");
      if (categoryTypeId.trim().length === 0)
        reasons.push("Choose a garment type.");
      if (type.trim().length === 0) reasons.push("Choose who this item is for.");
      if (!targetAgeGroup) reasons.push("Choose an age group.");
      if (getSelectedFilterValueIds().length === 0)
        reasons.push("Add at least one style detail.");
      if (selectedTags.length === 0) reasons.push("Add at least one hashtag.");
      toast.error(reasons[0] ?? "Complete the required details before going live.");
      return;
    }

    if (isMadeToOrder) {
      const pendingCustomOrderDraft =
        customOrderEditorRef.current?.buildConfigurationDraft() ?? null;
      if (!pendingCustomOrderDraft) {
        return;
      }
    }

    setShowPublishModal(true);
  };

  const handlePublishConfirm = async () => {
    setSubmitIntent("publish");
    setIsSubmitting(true);
    try {
      const pendingCustomOrderDraft =
        !isEditMode && isMadeToOrder
          ? customOrderEditorRef.current?.buildConfigurationDraft() ?? null
          : null;

      if (!isEditMode && isMadeToOrder && !pendingCustomOrderDraft) {
        return;
      }

      if (isEditMode && id && isMadeToOrder) {
        const saved = await customOrderEditorRef.current?.saveConfiguration({
          silentSuccess: true,
        });
        if (!saved) {
          setIsSubmitting(false);
          setSubmitIntent(null);
          return;
        }
      }

      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const finalTags = selectedTags.slice(0, 10);

      if (isEditMode && id) {
        // Build a preview URL from the existing cover
        const editPreviewUrl: string | undefined = (() => {
          const coverItem = files[coverIndex];
          if (coverItem?.previewUrl) return coverItem.previewUrl;
          return undefined;
        })();

        const task = createPublishTask({
          ownerId: user?.id,
          title,
          visibility,
          coverPreviewUrl: editPreviewUrl,
          designId: id,
          legacyCollectionId: id,
          collectionId: id,
          message: 'Updating design...',
        });

        setShowPublishModal(false);
        navigate(`/profile?tab=Content&visibility=${visibility === 'PRIVATE' ? 'Private' : 'Public'}`, {
          replace: true,
          state: {
            publishingTaskId: task.id,
            publishingTitle: title,
            publishingStartedAt: task.startedAt,
            publishingVisibility: visibility,
          },
        });

        toast.info('Going live in the background. You can keep browsing your profile.');

        void (async () => {
          try {
            updatePublishTask(task.id, { progress: 10, message: 'Updating metadata...' }, publishTaskScope);

            await DesignApi.updateDesign(id, {
              title,
              description,
              minPrice: parsedMinPrice,
              maxPrice: parsedMaxPrice,
              tags: finalTags,
              categoryId,
              subCategoryId: categoryTypeId,
              categoryTypeId,
              type,
              visibility,
              coverMediaId: files[coverIndex]?.remoteId || undefined,
              filterValueIds: getSelectedFilterValueIds(),
              sizingMode,
              rtwSizeSystem: null,
              customMeasurementKeys: normalizedCustomMeasurementKeys,
              customOrderEnabled: isMadeToOrder,
              fitPreference,
              targetAgeGroup,
            } as any);

            updatePublishTask(task.id, { progress: 40, message: 'Cleaning up items...' }, publishTaskScope);

            const currentIds = new Set(files.map((f) => f.id));
            const toDelete = Array.from(originalItemIds.current).filter(
              (oid) => !currentIds.has(oid),
            );
            if (toDelete.length > 0) {
              await Promise.all(
                toDelete.map((itemId) => DesignApi.deleteDesignMedia(id, itemId)),
              );
            }

            updatePublishTask(task.id, { status: 'finalizing', progress: 70, message: 'Finalizing...' }, publishTaskScope);

            await finalizeDesignUploads(
              id,
              [],
              true,
              {
                action: "publish",
                coverIndex,
                designMetadata: {
                  title,
                  description,
                  visibility,
                  type,
                  categoryId,
                  subCategoryId: categoryTypeId,
                  categoryTypeId,
                  tags: finalTags,
                  filterValueIds: getSelectedFilterValueIds(),
                  sizingMode,
                  rtwSizeSystem: undefined,
                  customMeasurementKeys: normalizedCustomMeasurementKeys,
                  customOrderEnabled: isMadeToOrder,
                  fitPreference,
                  targetAgeGroup,
                },
              },
            );

            updatePublishTask(task.id, {
              status: 'published',
              progress: 100,
              designId: id,
              legacyCollectionId: id,
              collectionId: id,
              coverPreviewUrl: undefined,
              message: 'Live',
            }, publishTaskScope);
            toast.success('Design is live');
            window.setTimeout(() => removePublishTask(task.id, publishTaskScope), 30_000);
          } catch (backgroundError) {
            const rawErrMsg =
              (backgroundError as any)?.response?.data?.message ||
              (backgroundError instanceof Error ? backgroundError.message : 'Failed to go live with design');
            const errMsg = mapCreatorMetadataError(rawErrMsg, 'Failed to go live with design');
            updatePublishTask(task.id, {
              status: 'failed',
              progress: 100,
              message: 'Go live failed',
              error: errMsg,
            }, publishTaskScope);
            toast.error(errMsg);
          }
        })();
        return;
      } else {
        const buildCoverPreviewDataUrl = async (): Promise<string | undefined> => {
          const coverItem = files[coverIndex];
          if (!coverItem || coverItem.kind !== 'image' || !coverItem.file) {
            return undefined;
          }
          const file = coverItem.file;
          if (file.size > 4 * 1024 * 1024) {
            return undefined;
          }
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(file);
          });
        };

        const previewDataUrl = await buildCoverPreviewDataUrl();
        const task = createPublishTask({
          ownerId: user?.id,
          title,
          visibility,
          coverPreviewUrl: previewDataUrl,
          message: 'Preparing draft upload...',
        });

        setShowPublishModal(false);
        navigate(`/profile?tab=Content&visibility=${visibility === 'PRIVATE' ? 'Private' : 'Public'}`, {
          replace: true,
          state: {
            publishingTaskId: task.id,
            publishingTitle: title,
            publishingStartedAt: task.startedAt,
            publishingVisibility: visibility,
          },
        });
        toast.info('Going live in the background. You can keep browsing your profile.');

        void (async () => {
          let uploadedDesignId: string | undefined;
          try {
            const response = await uploadDesign(
              files,
              title,
              description,
              parsedMinPrice,
              parsedMaxPrice,
              false,
              finalTags,
              {
                categoryId,
                subCategoryId: categoryTypeId,
                categoryTypeId,
                type,
                visibility,
                filterValueIds: getSelectedFilterValueIds(),
                coverIndex,
                sizingMode,
                rtwSizeSystem: undefined,
                customMeasurementKeys: normalizedCustomMeasurementKeys,
                customOrderEnabled: isMadeToOrder,
                fitPreference,
                targetAgeGroup,
              },
              (value: number) => {
                const mappedProgress = Math.max(5, Math.min(90, Math.round(value * 0.9)));
                updatePublishTask(task.id, {
                  status: value >= 100 ? 'finalizing' : 'uploading',
                  progress: mappedProgress,
                  message: value >= 100 ? 'Draft uploaded. Preparing go-live...' : 'Uploading media...',
                }, publishTaskScope);
              },
              false,
            );

            uploadedDesignId = extractDesignId(response);
            if (!uploadedDesignId) {
              throw new Error('Upload completed but no design id was returned. Please retry go-live.');
            }

            if (pendingCustomOrderDraft) {
              updatePublishTask(task.id, {
                status: 'finalizing',
                progress: 94,
                designId: uploadedDesignId,
                legacyCollectionId: uploadedDesignId,
                collectionId: uploadedDesignId,
                message: 'Saving custom-order setup...',
              }, publishTaskScope);
              await customOrderConfigurationsApi.create({
                ...pendingCustomOrderDraft,
                fabricRuleBasisId: String(pendingCustomOrderDraft.fabricRuleBasisId ?? '').trim() || (
                  await customOrderConfigurationsApi.createFabricRuleBasis({
                    label: `${title.trim() || 'Custom order'} fabric rules`,
                    measurementKeys: pendingCustomOrderDraft.requiredMeasurementKeys,
                    gender: measurementGender,
                  })
                ).id,
                sourceId: uploadedDesignId,
              });
            }

            updatePublishTask(task.id, {
              status: 'finalizing',
              progress: 97,
              designId: uploadedDesignId,
              legacyCollectionId: uploadedDesignId,
              collectionId: uploadedDesignId,
              message: 'Taking design live...',
            }, publishTaskScope);

            await finalizeDesignUploads(
              uploadedDesignId,
              [],
              true,
              {
                action: 'publish',
                coverIndex,
                designMetadata: {
                  title,
                  description,
                  visibility,
                  type,
                  categoryId,
                  subCategoryId: categoryTypeId,
                  categoryTypeId,
                  tags: finalTags,
                  filterValueIds: getSelectedFilterValueIds(),
                  sizingMode,
                  rtwSizeSystem: undefined,
                  customMeasurementKeys: normalizedCustomMeasurementKeys,
                  customOrderEnabled: isMadeToOrder,
                  fitPreference,
                  targetAgeGroup,
                },
              },
            );

            updatePublishTask(task.id, {
              status: 'published',
              progress: 100,
              designId: uploadedDesignId,
              legacyCollectionId: uploadedDesignId,
              collectionId: uploadedDesignId,
              coverPreviewUrl: undefined,
              message: 'Live',
            }, publishTaskScope);

            if (user?.id) {
              await fetchCollections(user.id);
            }

            toast.success('Design is live');
            window.setTimeout(() => removePublishTask(task.id, publishTaskScope), 30_000);
          } catch (backgroundError) {
            const rawErrMsg =
              (backgroundError as any)?.response?.data?.message ||
              (backgroundError instanceof Error ? backgroundError.message : 'Failed to go live with design');
            const errMsg = mapCreatorMetadataError(rawErrMsg, 'Failed to go live with design');
            updatePublishTask(task.id, {
              status: 'failed',
              progress: 100,
              designId: uploadedDesignId,
              legacyCollectionId: uploadedDesignId,
              collectionId: uploadedDesignId,
              message: uploadedDesignId
                ? 'Uploaded with setup issue. Open editor to complete and go live again.'
                : 'Go live failed',
              error: errMsg,
            }, publishTaskScope);
            toast.error(
              uploadedDesignId
                ? `${errMsg}. Your media was uploaded; open the design editor to finish setup.`
                : errMsg,
            );
          }
        })();

        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("cancelled")) {
        toast.info("Go-live cancelled");
        setShowPublishModal(false);
        return;
      }
      console.error(error);
      const errMsg = (error as any)?.response?.data?.message;
      toast.error(
        typeof errMsg === "string" || Array.isArray(errMsg)
          ? mapCreatorMetadataError(errMsg, "Failed to go live with design")
          : isEditMode
            ? "Failed to update design"
            : "Failed to go live with design",
      );
      throw error; // Re-throw so modal can handle state
    } finally {
      setIsSubmitting(false);
      setSubmitIntent(null);
    }
  };

  const handleViewPublishedDesign = () => {
    setShowPublishModal(false);
    navigate(`/profile?tab=Content&visibility=${visibility === 'PRIVATE' ? 'Private' : 'Public'}`, { replace: true });
  };

  const handleGoToDrafts = () => {
    setShowDraftSavedChoices(false);
    navigate("/profile?tab=Content&visibility=Drafts");
  };

  const handleCreateNewDesign = () => {
    setShowDraftSavedChoices(false);
    setTitle("");
    setDescription("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedTags([]);
    setTagSearch("");
    setType("EVERYBODY");
    setVisibility("PUBLIC");
    setFitPreference('REGULAR');
    setTargetAgeGroup('ADULT');
    setCustomMeasurementKeys([]);
    setCoverIndex(0);
    setSelectedIndex(0);
    mediaStore.clear();
    navigate(buildDesignRoute({ mode: 'create' }));
  };

  const handleModalCloseRequest = () => {
    setShowPublishModal(false);
    setShowCancelPrompt(true);
  };

  const handleCancelPromptChoice = (action: "return" | "cancel") => {
    setShowCancelPrompt(false);
    if (action === "cancel") {
      navigate("/profile");
    }
  };

  // Build summary for modal
  const designSummary = {
    title,
    description,
    category: selectedCategory?.name,
    priceRange: {
      min: minPrice ? parseFloat(minPrice) : undefined,
      max: maxPrice ? parseFloat(maxPrice) : undefined,
    },
    visibility,
    type,
    tags: selectedTags,
    mediaCount: files.filter((f) => f.kind === "image").length,
    videoCount: files.filter((f) => f.kind === "video").length,
    coverImageUrl,
    isAvailableInStore: false,
    isMadeToOrder,
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        targetId: 'design-media-section',
        title: 'Upload your design images',
        description:
          'Add front, left, right, and back-view images. The starred image becomes the cover shown in the catalog.',
        emoji: '🖼️',
      },
      {
        targetId: 'design-details-section',
        title: 'Design title & story',
        description:
          'Give your design a compelling title and describe the inspiration behind it. These appear in the public catalog.',
        emoji: '📝',
        onEnter: () => setExpandedSections((prev) => ({ ...prev, details: true })),
        enterDelay: 350,
      },
      {
        targetId: 'design-pricing-section',
        title: 'Set a price range',
        description:
          'Add an indicative min–max price so buyers understand what to expect. This is not a checkout price.',
        emoji: '💰',
        onEnter: () => setExpandedSections((prev) => ({ ...prev, pricing: true })),
        enterDelay: 350,
      },
      {
        targetId: 'design-targeting-section',
        title: 'Sizing & visibility',
        description:
          "Set sizing expectations, then decide whether everyone can see it or only you can.",
        emoji: '🎯',
        onEnter: () => setExpandedSections((prev) => ({ ...prev, targeting: true })),
        enterDelay: 350,
      },
    ],
    [],
  );

  if (requiresEmailVerification) {
    return <Navigate to={emailVerificationRedirect} replace />;
  }

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)] transition-colors duration-300">
      {/* CreateStoreModal removed as per request */}
      {/* Save Draft Confirmation */}
      {showSaveDraftConfirm && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
          <div
            className="absolute inset-0 surface-overlay-strong"
            onClick={() => setShowSaveDraftConfirm(false)}
          />
          <div className="surface-modal relative z-10 w-[min(92vw,420px)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border shadow-xl p-5 sm:p-6">
            <h3 className="text-lg font-semibold mb-2">Save as Draft?</h3>
            <p className="text-sm text-theme-secondary mb-4">
              Your media will be uploaded and saved as a draft. You can continue
              editing later.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="surface-control surface-interactive-hover w-full rounded-lg border px-4 py-2 sm:w-auto"
                onClick={() => setShowSaveDraftConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50 sm:w-auto"
                onClick={executeSaveDraft}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDraftSavedChoices && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
          <div className="absolute inset-0 surface-overlay-strong" />
          <div className="surface-modal relative z-10 w-[min(92vw,460px)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border shadow-xl p-5 sm:p-6">
            <h3 className="text-lg font-semibold mb-2">Draft saved</h3>
            <p className="text-sm text-theme-secondary mb-5">
              Choose what you want to do next.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                className="surface-control surface-interactive-hover w-full rounded-lg border px-4 py-2 sm:w-auto"
                onClick={handleCreateNewDesign}
              >
                Create New Design
              </button>
              <button
                className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white sm:w-auto"
                onClick={handleGoToDrafts}
              >
                Go to Drafts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-32">
        <div className="mb-4 flex items-center justify-between sm:mb-6">
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
              {isEditMode ? "Edit Design" : "Create Design"}
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
                <VLoader size={32} phase="loading" showLabel={false} />
                <span className="text-theme font-medium">
                  Uploading files... {progress}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    cancelUploads();
                    toast.info("Upload cancelled");
                  }}
                  className="surface-control surface-interactive-hover ml-auto px-3 py-1 rounded-lg text-sm"
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

        <div className="mb-8 grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
          {/* Media Section */}
          <section id="design-media-section" className="min-w-0">
            {files.length === 0 ? (
              <div className="space-y-3">
                <MediaUploadZone
                  onFilesUpload={mediaStore.addFiles}
                  picker={picker}
                  disabled={disabled}
                  maxFiles={DESIGN_MAX_MEDIA_COUNT}
                />
                <div className="flex flex-wrap justify-center gap-1.5 px-2">
                  {DESIGN_MEDIA_SLOTS.map((label, index) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        index < DESIGN_REQUIRED_MEDIA_COUNT
                          ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                          : 'surface-control-muted'
                      }`}
                    >
                      <span className="font-bold">{index + 1}.</span> {label}{index < DESIGN_REQUIRED_MEDIA_COUNT && ' *'}
                    </span>
                  ))}
                </div>
                <p className="text-center text-[10px] text-theme-secondary mt-1">
                  * Required to go live - fill Front, Back, Left, and Right
                </p>
              </div>
            ) : (
              <div className="space-y-4 h-full min-w-0">
                {/* Main Preview - NO background; media defines layout */}
                <div className="relative rounded-2xl border border-theme shadow-sm">
                  {/* Slot label badge on the preview */}
                  {selectedIndex < 6 && (
                    <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
                      <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">
                        {DESIGN_MEDIA_SLOTS[selectedIndex]}
                      </span>
                    </div>
                  )}
                  <div className="relative w-full min-h-[280px] sm:min-h-[420px] lg:min-h-[620px] max-h-[85vh] flex items-center justify-center overflow-y-auto">
                    <AnimatePresence mode="wait">
                      {selectedFile && (
                        <motion.div
                          key={selectedFile.id || selectedFile.url}
                          className="w-full h-full flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <MediaRenderer
                            kind={
                              selectedFile.kind === "video" ? "video" : "image"
                            }
                            src={selectedFile.url}
                            alt={selectedFile.file?.name || "Preview"}
                            className="w-full h-full flex items-center justify-center"
                            mediaClassName="h-full w-full object-contain"
                            maxHeightClassName="max-h-[85vh]"
                            maxWidthClassName="max-w-full"
                            allowScroll
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
                          onClick={() =>
                            selectedFile?.id && handleDelete(selectedFile.id)
                          }
                          disabled={disabled}
                        />
                        <ActionButton
                          icon={
                            <FiStar
                              className={`w-4 h-4 ${coverIndex === selectedIndex ? "fill-purple-400 text-purple-400" : ""}`}
                            />
                          }
                          label={coverIndex === selectedIndex ? "Cover" : "Set as Cover"}
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
                  onAddMore={picker.open}
                  canAddMore={files.length < DESIGN_MAX_MEDIA_COUNT}
                  disabled={disabled}
                  progressById={perFileProgress}
                  showSlotLabels
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
                <p className="text-center text-sm text-theme-secondary">
                  {selectedFile?.kind === "video" ? "Video" : "Image"}{" "}
                  {selectedIndex + 1} of {files.length}
                  {selectedFile?.file?.name && ` • ${selectedFile.file.name}`}
                  {selectedFile?.file?.size &&
                    ` • ${(selectedFile.file.size / (1024 * 1024)).toFixed(1)} MB`}
                </p>
              </div>
            )}
          </section>

          {/* Design Details */}
          <div>
            <FormSection
              id="design-details-section"
              title="Design Details"
              icon="📝"
              isOpen={expandedSections.details}
              onToggle={() => toggleSection("details")}
              className="!border-gray-200/40 !bg-transparent !shadow-none dark:!border-white/10 lg:max-h-[560px] lg:overflow-y-auto scrollbar-hide"
            >
              <div className="space-y-3">
                <TextField
                  label="Design Title"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTitle(e.target.value)
                  }
                  placeholder="e.g., Summer Breeze '24"
                  disabled={disabled || titleDescriptionLocked}
                  variant="glass"
                  required
                />

                <div className="rounded-lg border border-gray-200/40 bg-transparent p-3 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">
                      Creator metadata
                    </p>
                  </div>
                  <div className="pr-1 sm:pr-2">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-theme flex items-center">
                          Tell Your Story
                          <InfoTooltip text="Describe the inspiration, mood, and story behind this design. This is visible to buyers browsing the catalog." />
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Inspired by the warm coastal breeze of Lagos..."
                          rows={3}
                          disabled={disabled || titleDescriptionLocked}
                          className="surface-control placeholder-theme w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                        />
                        <p className="text-right text-xs text-theme-secondary">
                          {description.length} / 500 characters
                        </p>
                      </div>
                      {titleDescriptionLocked && (
                        <p className="rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          Title and description can only be updated once every
                          30 days.
                          {nextTitleEditDate
                            ? ` Next edit available on ${nextTitleEditDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`
                            : ""}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <UniversalSelect
                          label="What is it?"
                          value={categoryId}
                          onChange={setCategoryId}
                          options={categories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                          placeholder={
                            loadingCategories
                              ? "Loading..."
                              : "Choose what this item is"
                          }
                          disabled={disabled}
                          searchable
                          emptyMessage="No categories available"
                          optionAllowWrap
                          selectedAllowWrap
                        />

                        <UniversalSelect
                          label="Garment type"
                          value={categoryTypeId}
                          onChange={setCategoryTypeId}
                          options={categoryTypeOptions.map((categoryType) => ({
                            value: categoryType.id,
                            label: categoryType.name,
                          }))}
                          placeholder={
                            loadingCategories
                              ? "Loading..."
                              : categoryTypeOptions.length
                                ? "Choose a garment type"
                                : "No types available"
                          }
                          disabled={
                            disabled || categoryTypeOptions.length === 0
                          }
                          searchable
                          emptyMessage="No sub-categories available"
                          optionAllowWrap
                          selectedAllowWrap
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-2 flex items-center text-sm font-medium text-theme">
                            Who is it for?
                            <InfoTooltip text={CREATOR_METADATA_HELP.audience} />
                          </label>
                          <div className="grid grid-cols-1 gap-2">
                            {CREATOR_AUDIENCE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setType(option.value)}
                                disabled={disabled}
                                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all ${
                                  type === option.value
                                    ? "border-purple-400/80 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                    : "border-gray-200/70 text-theme-secondary hover:border-purple-200 dark:border-white/10 dark:hover:border-white/20"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <UniversalSelect
                          label="Age group"
                          value={targetAgeGroup}
                          onChange={(value) => setTargetAgeGroup(value as DesignTargetAgeGroup)}
                          options={DESIGN_TARGET_AGE_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          }))}
                          disabled={disabled}
                        />
                      </div>

                      <FilterSelector
                        value={filterSelection}
                        onChange={setFilterSelection}
                        entityType="DESIGN"
                        disabled={disabled}
                        onTagSuggestions={handleFilterTagSuggestions}
                      />

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-theme flex items-center">
                          Hashtags (up to 10)
                          <InfoTooltip text={CREATOR_METADATA_HELP.hashtags} />
                        </label>

                        <div className="rounded-lg border border-gray-200/40 bg-transparent p-3 dark:border-white/10">
                          {selectedTags.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {selectedTags.map((tag, idx) => (
                                <motion.span
                                  key={tag}
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.8, opacity: 0 }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold ${tagStylePalette[idx % tagStylePalette.length]}`}
                                >
                                  {normalizeHashtagLabel(tag)}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="hover:text-purple-200 transition-colors"
                                  >
                                    <FiX className="w-3 h-3" />
                                  </button>
                                </motion.span>
                              ))}
                            </div>
                          )}

                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-secondary)]" />
                            <input
                              type="text"
                              value={tagSearch}
                              onChange={(e) => setTagSearch(e.target.value)}
                              onKeyDown={handleTagInputKeyDown}
                              placeholder="Search or create a hashtag..."
                              disabled={disabled || selectedTags.length >= 10}
                              className="threadly-search-input pl-10 pr-12"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                tagSearch.trim() &&
                                addTag(
                                  tagSearch
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, "-"),
                                )
                              }
                              disabled={
                                disabled ||
                                selectedTags.length >= 10 ||
                                !tagSearch.trim()
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:shadow-none"
                              aria-label="Add tag"
                            >
                              <FiPlus className="w-4 h-4" />
                              Add
                            </button>
                          </div>

                          {filteredSuggestions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-theme-secondary mb-2">
                                Popular hashtags:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {filteredSuggestions.map((tag) => {
                                  const isSelected = selectedTags.some(
                                    (t) => t.toLowerCase() === tag.toLowerCase(),
                                  );
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => addTag(tag)}
                                      disabled={disabled || isSelected}
                                      className={`tag-badge-outline px-2.5 py-1 rounded-full text-[12px] font-medium ${
                                        isSelected
                                          ? 'opacity-40 cursor-not-allowed ring-1 ring-purple-400/40'
                                          : ''
                                      }`}
                                    >
                                      {normalizeHashtagLabel(tag)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
            id="design-pricing-section"
            title="Pricing & Availability"
            icon="💰"
            isOpen={expandedSections.pricing}
            onToggle={() => toggleSection("pricing")}
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-theme mb-2 flex items-center">
                  Price Range
                  <InfoTooltip text="An indicative price range for this design. This is NOT a checkout price — it helps buyers understand the expected cost." />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]">
                      ₦
                    </span>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="15,000"
                      disabled={disabled}
                      className="surface-control placeholder-theme w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-theme-secondary">
                      Minimum Price
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]">
                      ₦
                    </span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="45,000"
                      disabled={disabled}
                      className="surface-control placeholder-theme w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-theme-secondary">
                      Maximum Price
                    </span>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="mt-8 p-3 rounded-xl bg-blue-50 border border-blue-200 text-gray-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-100 flex items-start gap-2">
                <FiInfo className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Setting a price range helps buyers know what to expect. Leave
                  empty if prices vary significantly.
                </p>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 mt-4">
                <label className="surface-card flex items-start gap-3 p-4 rounded-xl border cursor-pointer hover:border-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => {}}
                    disabled={true}
                    className="w-5 h-5 mt-0.5 rounded border-theme text-purple-600 focus:ring-purple-500 bg-theme"
                  />
                  <div>
                    <span className="text-theme font-medium">
                      Store availability
                    </span>
                    <p className="text-sm text-theme-secondary">
                      Store collections are created in Store Studio.
                    </p>
                  </div>
                </label>

                <label className="surface-card flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:border-purple-500/30">
                  <input
                    type="checkbox"
                    checked={isMadeToOrder}
                    onChange={(e) => setIsMadeToOrder(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 mt-0.5 rounded border-theme text-purple-600 focus:ring-purple-500 bg-theme"
                  />
                  <div>
                    <span className="text-theme font-medium">
                      Custom Order
                    </span>
                    <p className="text-sm text-theme-secondary">
                      Allow buyers to request this design with their own measurements.
                    </p>
                  </div>
                </label>
              </div>

              {isMadeToOrder && (
                <CustomOrderConfigurationEditor
                  ref={customOrderEditorRef}
                  sourceType="DESIGN"
                  sourceId={isEditMode ? id : undefined}
                  sourceTitle={title}
                  measurementKeys={customMeasurementKeys}
                  measurementGender={measurementGender}
                  defaultBaseCharge={minPrice}
                  defaultProductionLeadDays={storeDefaultProductionLeadDays}
                  defaultProductionLeadLabel={storeCustomOrderLeadTimeLabel}
                  disabled={disabled}
                  onRequiredMeasurementKeysChange={handleCustomOrderMeasurementKeysChange}
                />
              )}
            </div>
          </FormSection>

          {/* Sizing & visibility */}
          <FormSection
            id="design-targeting-section"
            title="Sizing & visibility"
            icon="🎯"
            isOpen={expandedSections.targeting}
            onToggle={() => toggleSection("targeting")}
          >
            <div className="space-y-4">
              <UniversalSelect
                label="Sizing Mode"
                value={sizingMode}
                onChange={(value) => setSizingMode(value as DesignSizingMode)}
                options={DESIGN_SIZING_MODE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={disabled}
                searchable
                optionAllowWrap
                selectedAllowWrap
              />

              <UniversalSelect
                label="Fit Preference"
                value={fitPreference}
                onChange={(value) => setFitPreference(value as DesignFitPreference)}
                options={DESIGN_FIT_PREFERENCE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={disabled}
              />

              <div>
                <label className="mb-2 flex items-center text-sm font-medium text-theme">
                  Who can see this?
                  <InfoTooltip text={CREATOR_METADATA_HELP.visibility} />
                </label>
                <div className="space-y-2">
                  {(
                    [
                      {
                        value: "PUBLIC",
                        emoji: "🌍",
                        label: "Everyone",
                        desc: "Everyone can see this design",
                      },
                      {
                        value: "PRIVATE",
                        emoji: "🔒",
                        label: "Only me",
                        desc: "Only you and collaborators can see",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`
                        flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-all
                        ${
                          visibility === option.value
                            ? "border-purple-400/80 bg-purple-500/10"
                            : "border-gray-200/70 surface-panel-subtle hover:border-purple-200 dark:border-white/10 dark:hover:border-white/20"
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
                      <div>
                        <span
                          className={`font-medium ${visibility === option.value ? "text-purple-600 dark:text-purple-400" : "text-theme"}`}
                        >
                          {option.label}
                        </span>
                        <p className="text-xs text-theme-secondary">
                          {option.desc}
                        </p>
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
          <div className="text-sm text-theme-secondary">
            {lastSaved
              ? `Design saved locally • Last edit: ${formatTimeAgo(lastSaved)}`
              : "Unsaved changes"}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={disabled}
              className="surface-control surface-interactive-hover flex-1 sm:flex-none py-3 px-6 rounded-xl border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              {isSubmitting && submitIntent === "publish" ? (
                <VLoader size={16} phase="loading" showLabel={false} />
              ) : (
                <HiOutlineSparkles className="w-5 h-5" />
              )}
              {isSubmitting && submitIntent === "publish"
                ? "Going live..."
                : isEditMode
                  ? "Update Design"
                  : "Go live"}
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
        summary={designSummary}
        entityLabel="Design"
        onViewPublished={handleViewPublishedDesign}
        loadingProgress={isUploading ? progress : null}
      />

      {/* Cancel/Exit prompt */}
      <AnimatePresence>
        {showCancelPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-md rounded-2xl glass-panel-dark border border-white/10 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-200 font-semibold">
                  ?
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">
                    What would you like to do?
                  </p>
                  <p className="text-sm text-white/70">
                    Return to editing or cancel the entire process.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleCancelPromptChoice("return")}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white font-medium hover:border-purple-300/40"
                >
                  Return to creation
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelPromptChoice("cancel")}
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
            className="fixed inset-0 z-layer-modal bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeFullscreen}
          >
            <div
              className="absolute top-4 right-4 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div
              className="relative w-full h-full max-w-6xl flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
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
                    disabled={
                      (fullscreenIndex ?? selectedIndex) >= files.length - 1
                    }
                    aria-label="Next media"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1 disabled:opacity-50"
                    onClick={() =>
                      setFullscreenZoom((z) =>
                        Math.max(1, +(z - 0.25).toFixed(2)),
                      )
                    }
                    disabled={fullscreenZoom <= 1}
                  >
                    <FiZoomOut className="w-4 h-4" />
                    <span>Zoom out</span>
                  </button>
                  <button
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
                    onClick={() =>
                      setFullscreenZoom((z) =>
                        Math.min(3, +(z + 0.25).toFixed(2)),
                      )
                    }
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

                <div
                  style={{
                    transform: `scale(${fullscreenZoom})`,
                    transition: "transform 0.2s ease",
                  }}
                >
                  <MediaRenderer
                    kind={fullscreenFile.kind === "video" ? "video" : "image"}
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
                      className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
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
                            <p className="text-sm text-white/60">
                              Draft snapshot
                            </p>
                            <h3 className="text-xl font-semibold text-white">
                              {title || "Untitled design"}
                            </h3>
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
                              kind={
                                selectedFile.kind === "video"
                                  ? "video"
                                  : "image"
                              }
                              src={selectedFile.url}
                              alt="Draft cover"
                              maxHeightClassName="max-h-[420px]"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/90 text-sm">
                          <div className="space-y-2">
                            <p>
                              <span className="text-white/60">
                                Description:
                              </span>{" "}
                              {description || "—"}
                            </p>
                            <p>
                              <span className="text-white/60">What is it?:</span>{" "}
                              {selectedCategory?.name || "—"}
                            </p>
                            <p>
                              <span className="text-white/60">
                                Who is it for?:
                              </span>{" "}
                              {getAudienceLabel(type)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p>
                              <span className="text-white/60">
                                Who can see this?:
                              </span>{" "}
                              {visibility}
                            </p>
                            <p>
                              <span className="text-white/60">
                                Price Range:
                              </span>{" "}
                              {minPrice || maxPrice
                                ? `${minPrice || "—"} - ${maxPrice || "—"}`
                                : "—"}
                            </p>
                            <p>
                              <span className="text-white/60">Hashtags:</span>{" "}
                              {selectedTags.length
                                ? selectedTags.map(normalizeHashtagLabel).join(", ")
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-white/70 text-sm mb-2">Media</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {files.map((file) => {
                              const withUrl = resolveMediaWithUrl(file);
                              if (!withUrl) return null;
                              return (
                                <div
                                  key={withUrl.id}
                                  className="rounded-xl flex items-center justify-center"
                                >
                                  <MediaRenderer
                                    kind={
                                      withUrl.kind === "video"
                                        ? "video"
                                        : "image"
                                    }
                                    src={withUrl.url}
                                    alt=""
                                    maxHeightClassName="max-h-32"
                                    maxWidthClassName="max-w-[240px]"
                                  />
                                </div>
                              );
                            })}
                            {files.length === 0 && (
                              <div className="text-white/60 text-sm">
                                No media yet
                              </div>
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
                  disabled={
                    (fullscreenIndex ?? selectedIndex) >= files.length - 1
                  }
                  aria-label="Next"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center text-sm text-white/70">
                {files.length > 0 && (
                  <span>
                    Image {(fullscreenIndex ?? selectedIndex) + 1} of{" "}
                    {files.length}
                    {fullscreenFile.file?.name
                      ? ` • ${fullscreenFile.file.name}`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spotlight tour — shown automatically on first visit (create mode) */}
      <TourOverlay
        steps={tourSteps}
        isActive={isTourActive}
        onClose={handleTourClose}
      />
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
  id?: string;
}> = ({ title, icon, isOpen, onToggle, children, className, id }) => (
  <div
    id={id}
    className={`surface-card rounded-2xl border overflow-hidden backdrop-blur ${className ?? ""}`}
  >
    <button
      type="button"
      onClick={onToggle}
      className="surface-interactive-hover w-full flex items-center justify-between p-3 text-left transition-colors sm:p-4"
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-base sm:h-10 sm:w-10 sm:text-lg">
          {icon}
        </span>
        <span className="truncate text-base font-semibold text-theme sm:text-lg">
          {title}
        </span>
      </div>
      {isOpen ? (
        <FiChevronUp className="w-5 h-5 text-[color:var(--text-secondary)]" />
      ) : (
        <FiChevronDown className="w-5 h-5 text-[color:var(--text-secondary)]" />
      )}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex-1 px-3 pb-4 sm:px-4">{children}</div>
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
      surface-control surface-interactive-hover flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md border
      text-sm font-medium transition-all
      ${active ? "bg-purple-500/20 border-purple-500/50" : ""}
      ${disabled ? "opacity-50 cursor-not-allowed" : ""}
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

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// ============================================================================
// WRAPPER WITH PROVIDER
// ============================================================================

const CreateDesignPage: React.FC = () => (
  <MediaProvider>
    <CreateDesignInner />
  </MediaProvider>
);

export default CreateDesignPage;
