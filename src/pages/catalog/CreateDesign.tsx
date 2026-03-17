import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import { useMeasurementPoints } from '@/hooks/useMeasurementPoints';
import CustomOrderConfigurationEditor from '@/components/custom-orders/CustomOrderConfigurationEditor';

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
import useCollectionUpload from "../../hooks/useCollectionUpload";
import { useBrandProfile } from "../../hooks/UseBrandHook";
import { finalizeCollectionUploads } from "@/api/collectionUploads";
import type { SizingMode } from '@/types/sizing';
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
  { value: 'RTW', label: 'Ready-to-Wear (standard sizes only)' },
  { value: 'RTW_PLUS_FITTINGS', label: 'Ready-to-Wear + Fittings' },
  { value: 'CUSTOM', label: 'Custom Only' },
] as const;
type DesignSizingMode = Extract<SizingMode, (typeof DESIGN_SIZING_MODE_OPTIONS)[number]['value']>;

const normalizeMeasurementLabel = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

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

const CreateDesignInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const mediaStore = useMediaStore();
  const files = mediaStore.items;
  const navigate = useNavigate();

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
  const [metadataEditedAt, setMetadataEditedAt] = useState<Date | null>(null);
  const [customMeasurementKeys, setCustomMeasurementKeys] = useState<string[]>(
    [],
  );

  // UI state
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
      "bg-white/30 border border-white/40 text-purple-900 dark:text-white backdrop-blur-md shadow-sm",
      "bg-gradient-to-r from-purple-500/60 to-blue-500/50 text-white shadow-md",
      "bg-gradient-to-r from-amber-400/70 to-pink-500/70 text-white shadow-md",
      "bg-white/20 text-white border border-white/30 backdrop-blur",
      "bg-gradient-to-r from-emerald-400/70 to-teal-500/70 text-white shadow-md",
      "bg-gradient-to-r from-indigo-500/70 to-cyan-500/70 text-white shadow-md",
    ],
    [],
  );

  // Track original items for deletion in edit mode
  const originalItemIds = useRef<Set<string>>(new Set());
  const transientObjectUrlsRef = useRef<Map<string, string>>(new Map());

  const {
    uploadCollection,
    isUploading,
    progress,
    perFileProgress,
    cancelUploads,
  } = useCollectionUpload();
  const { user, fetchCollections } = useBrandProfile();

  const disabled = isSubmitting || isUploading;
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
    maxFiles: 20,
    onFiles: mediaStore.addFiles,
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
  // Load initial data (tags, categories, and collection when editing)
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

    const loadCollectionDetail = async () => {
      if (!isEditMode || !id) return;
      try {
        const d = await brandApi.getCollectionDetail(id);
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
        setCustomMeasurementKeys(
          Array.isArray(d.customMeasurementKeys) ? dedupeMeasurementKeysByLabel(d.customMeasurementKeys) : [],
        );
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
      loadCollectionDetail(),
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

  // Validation
  const isValid =
    title.trim().length > 0 &&
    files.length > 0 &&
    selectedTags.length > 0 &&
    categoryId.trim().length > 0 &&
    categoryTypeId.trim().length > 0;

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
  const designMeasurementFilter = useMemo(
    (): { gender?: 'MEN' | 'WOMEN' | 'UNISEX' } | undefined =>
      measurementGender === 'UNISEX' ? undefined : { gender: measurementGender },
    [measurementGender],
  );
  const { points: designMeasurementPoints } = useMeasurementPoints(designMeasurementFilter);
  const defaultDesignMeasurementKeys = useMemo(() => {
    const prioritized = [...designMeasurementPoints].sort(
      (left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER),
    );
    const seenLabels = new Set<string>();
    const dedupedKeys: string[] = [];

    for (const point of prioritized) {
      const key = String(point?.key ?? '').trim().toUpperCase();
      if (!key) {
        continue;
      }
      const label = normalizeMeasurementLabel(point.label || measurementKeyToLabel(key));
      if (!label || seenLabels.has(label)) {
        continue;
      }
      seenLabels.add(label);
      dedupedKeys.push(key);
    }

    return dedupeMeasurementKeysByLabel(dedupedKeys);
  }, [designMeasurementPoints]);

  useEffect(() => {
    if (defaultDesignMeasurementKeys.length === 0) {
      return;
    }
    setCustomMeasurementKeys((current) =>
      current.length > 0 ? dedupeMeasurementKeysByLabel(current) : defaultDesignMeasurementKeys,
    );
  }, [defaultDesignMeasurementKeys]);

  const normalizedCustomMeasurementKeys = useMemo(
    () => dedupeMeasurementKeysByLabel(customMeasurementKeys),
    [customMeasurementKeys],
  );

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
    // Drafts require only media selection; auto-fill other fields for backend validation
    if (files.length === 0) {
      toast.error("Please upload at least one file to save");
      return;
    }
    setShowSaveDraftConfirm(true);
  };

  const executeSaveDraft = async () => {
    // Guard: prevent double submission
    if (isSubmitting) return;

    setSubmitIntent("draft");
    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const draftTitle = title.trim() || "Untitled Draft";
      const finalTags = (selectedTags.length ? selectedTags : ["draft"]).slice(
        0,
        10,
      );

      if (isEditMode && id) {
        await brandApi.updateCollection(id, {
          title: draftTitle,
          description,
          minPrice: parsedMinPrice,
          maxPrice: parsedMaxPrice,
          isAvailableInStore: false,
          tags: finalTags,
          categoryId,
          categoryTypeId,
          type,
          visibility,
          filterValueIds: getSelectedFilterValueIds(),
          sizingMode,
          rtwSizeSystem: null,
          customMeasurementKeys: normalizedCustomMeasurementKeys,
          fitPreference: null,
          targetAgeGroup: 'ADULT',
        } as any);
      } else {
        await uploadCollection(
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
            fitPreference: undefined,
            targetAgeGroup: 'ADULT',
          },
          undefined,
          false, // shouldPublish = false
        );
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
      if (title.trim().length === 0) reasons.push("a title");
      if (files.length === 0) reasons.push("at least one file");
      if (selectedTags.length === 0) reasons.push("at least one tag");
      if (categoryId.trim().length === 0) reasons.push("a category");
      if (categoryTypeId.trim().length === 0)
        reasons.push("a sub-category");
      toast.error(`Please provide ${reasons.join(", ")}.`);
      return;
    }
    setShowPublishModal(true);
  };

  const handlePublishConfirm = async () => {
    setSubmitIntent("publish");
    setIsSubmitting(true);
    try {
      const parsedMinPrice = minPrice ? parseFloat(minPrice) : undefined;
      const parsedMaxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      const finalTags = selectedTags.slice(0, 10);

      const extractCollectionId = (res: any): string | undefined => {
        if (!res || typeof res !== "object") return undefined;
        if (typeof (res as any).collectionId === "string")
          return (res as any).collectionId;
        if (typeof (res as any).id === "string") return (res as any).id;
        if (
          (res as any).data &&
          typeof (res as any).data === "object" &&
          typeof (res as any).data.id === "string"
        )
          return (res as any).data.id;
        return undefined;
      };

      if (isEditMode && id) {
        await brandApi.updateCollection(id, {
          title,
          description,
          minPrice: parsedMinPrice,
          maxPrice: parsedMaxPrice,
          isAvailableInStore: false,
          tags: finalTags,
          categoryId,
          categoryTypeId,
          type,
          visibility,
          coverMediaId: files[coverIndex]?.remoteId || undefined,
          filterValueIds: getSelectedFilterValueIds(),
          sizingMode,
          rtwSizeSystem: null,
          customMeasurementKeys: normalizedCustomMeasurementKeys,
          fitPreference: null,
          targetAgeGroup: 'ADULT',
        } as any);

        const currentIds = new Set(files.map((f) => f.id));
        const toDelete = Array.from(originalItemIds.current).filter(
          (oid) => !currentIds.has(oid),
        );
        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map((itemId) => brandApi.deleteCollectionItem(id, itemId)),
          );
        }

        await finalizeCollectionUploads(
          id,
          [],
          true,
          {
            action: "publish",
            coverIndex,
            collectionMetadata: {
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
              fitPreference: undefined,
              targetAgeGroup: 'ADULT',
            },
          },
        );

        toast.success("Design published");
        setShowPublishModal(false);
        navigate(`/profile?tab=Content&visibility=Public`, { replace: true });
        return;
      } else {
        const response = await uploadCollection(
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
            fitPreference: undefined,
            targetAgeGroup: 'ADULT',
          },
        );
        const newCollectionId = extractCollectionId(response);
        toast.success("Design published");
        setShowPublishModal(false);
        navigate(`/profile?tab=Content&visibility=Public`, {
          replace: true,
          state: {
            publishingCollectionId: newCollectionId,
            publishingTitle: title,
            publishingStartedAt: Date.now(),
          },
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("cancelled")) {
        toast.info("Publish cancelled");
        setShowPublishModal(false);
        return;
      }
      console.error(error);
      const errMsg = (error as any)?.response?.data?.message;
      toast.error(
        typeof errMsg === "string"
          ? errMsg
          : isEditMode
            ? "Failed to update design"
            : "Failed to publish design",
      );
      throw error; // Re-throw so modal can handle state
    } finally {
      setIsSubmitting(false);
      setSubmitIntent(null);
    }
  };

  const handleViewPublishedDesign = () => {
    setShowPublishModal(false);
    navigate(`/profile?tab=Content&visibility=Public`, { replace: true });
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
    setCustomMeasurementKeys([]);
    setCoverIndex(0);
    setSelectedIndex(0);
    mediaStore.clear();
    navigate("/profile/collections/create");
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
  const collectionSummary = {
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

  return (
    <div className="min-h-screen bg-transparent text-[var(--text-primary)] transition-colors duration-300">
      {/* CreateStoreModal removed as per request */}
      {/* Save Draft Confirmation */}
      {showSaveDraftConfirm && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSaveDraftConfirm(false)}
          />
          <div className="relative z-10 w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Save as Draft?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Your media will be uploaded and saved as a draft. You can continue
              editing later.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => setShowSaveDraftConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
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
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 w-[460px] bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Draft saved</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Choose what you want to do next.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={handleCreateNewDesign}
              >
                Create New Design
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-purple-600 text-white"
                onClick={handleGoToDrafts}
              >
                Go to Drafts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="mb-6 flex items-center justify-between">
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
                <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                <span className="text-white font-medium">
                  Uploading files... {progress}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    cancelUploads();
                    toast.info("Upload cancelled");
                  }}
                  className="ml-auto px-3 py-1 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
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

        <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-6 items-start mb-8">
          {/* Media Section */}
          <section className="h-full min-w-0">
            {files.length === 0 ? (
              <MediaUploadZone
                onFilesUpload={mediaStore.addFiles}
                picker={picker}
                disabled={disabled}
                maxFiles={20}
              />
            ) : (
              <div className="space-y-4 h-full min-w-0">
                {/* Main Preview - NO background; media defines layout */}
                <div className="relative rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm">
                  <div className="relative w-full h-[360px] sm:h-[460px] lg:h-[620px] flex items-center justify-center overflow-hidden">
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
                            maxHeightClassName="max-h-full"
                            maxWidthClassName="max-w-full"
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
                          label={
                            coverIndex === selectedIndex
                              ? "Cover"
                              : "Set as Cover"
                          }
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
                  disabled={disabled}
                  progressById={perFileProgress}
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
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
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
          <div className="h-full">
            <FormSection
              title="Design Details"
              icon="📝"
              isOpen={expandedSections.details}
              onToggle={() => toggleSection("details")}
              className="h-full flex flex-col"
            >
              <div className="space-y-4">
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

                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Design Metadata
                    </p>
                  </div>
                  <div className="pr-1 sm:pr-2">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
                          Tell Your Story
                          <InfoTooltip text="Describe the inspiration, mood, and story behind this design. This is visible to buyers browsing the catalog." />
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Inspired by the warm coastal breeze of Lagos..."
                          rows={4}
                          disabled={disabled || titleDescriptionLocked}
                          className="w-full px-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                        />
                        <p className="text-right text-xs text-gray-600 dark:text-gray-400">
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
                          label="Category"
                          value={categoryId}
                          onChange={setCategoryId}
                          options={categories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                          placeholder={
                            loadingCategories
                              ? "Loading..."
                              : "Select a category"
                          }
                          disabled={disabled}
                        />

                        <UniversalSelect
                          label="Sub-Category"
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
                                ? "Select a sub-category"
                                : "No types available"
                          }
                          disabled={
                            disabled || categoryTypeOptions.length === 0
                          }
                        />
                      </div>

                      {/* Filter Selector */}
                      <FilterSelector
                        value={filterSelection}
                        onChange={setFilterSelection}
                        entityType="COLLECTION"
                        disabled={disabled}
                        onTagSuggestions={handleFilterTagSuggestions}
                      />

                      {/* Tags Section */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
                          🏷️ Tags (up to 10)
                          <InfoTooltip text="Tags improve catalog discoverability. Add manually or use filter-driven suggestions. Up to 10 tags per design." />
                        </label>

                        <div className="p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                          {/* Selected tags */}
                          {selectedTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {selectedTags.map((tag, idx) => (
                                <motion.span
                                  key={tag}
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.8, opacity: 0 }}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${tagStylePalette[idx % tagStylePalette.length]}`}
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="ml-1 hover:text-purple-200 transition-colors"
                                  >
                                    <FiX className="w-3.5 h-3.5" />
                                  </button>
                                </motion.span>
                              ))}
                            </div>
                          )}

                          {/* Search input */}
                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={tagSearch}
                              onChange={(e) => setTagSearch(e.target.value)}
                              onKeyDown={handleTagInputKeyDown}
                              placeholder="Search or create a tag..."
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

                          {/* Popular tags */}
                          {filteredSuggestions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Popular Tags:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {filteredSuggestions.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => addTag(tag)}
                                    disabled={disabled}
                                    className="tag-badge-outline px-3 py-1.5 rounded-full text-sm font-medium"
                                  >
                                    {tag}
                                  </button>
                                ))}
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
            title="Pricing & Availability"
            icon="💰"
            isOpen={expandedSections.pricing}
            onToggle={() => toggleSection("pricing")}
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center">
                  Price Range
                  <InfoTooltip text="An indicative price range for this design. This is NOT a checkout price — it helps buyers understand the expected cost." />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      ₦
                    </span>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="15,000"
                      disabled={disabled}
                      className="w-full pl-8 pr-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-gray-600 dark:text-gray-400">
                      Minimum Price
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      ₦
                    </span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="45,000"
                      disabled={disabled}
                      className="w-full pl-8 pr-4 py-3 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <span className="absolute -bottom-5 left-0 text-xs text-gray-600 dark:text-gray-400">
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
                <label className="flex items-start gap-3 p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:border-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => {}}
                    disabled={true}
                    className="w-5 h-5 mt-0.5 rounded border-gray-400 dark:border-gray-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-transparent"
                  />
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Store availability
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Store collections are created in Store Studio.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl glass-light bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:border-purple-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={isMadeToOrder}
                    onChange={(e) => setIsMadeToOrder(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 mt-0.5 rounded border-gray-400 dark:border-gray-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-transparent"
                  />
                  <div>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Made to Order
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Show "Custom Order" badge on design
                    </p>
                  </div>
                </label>
              </div>

              <CustomOrderConfigurationEditor
                sourceType="DESIGN"
                sourceId={isEditMode ? id : undefined}
                measurementKeys={customMeasurementKeys}
                measurementGender={measurementGender}
                disabled={disabled}
              />
            </div>
          </FormSection>

          {/* Targeting & Visibility */}
          <FormSection
            title="Targeting & Visibility"
            icon="🎯"
            isOpen={expandedSections.targeting}
            onToggle={() => toggleSection("targeting")}
          >
            <div className="space-y-6">
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  Target Audience
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {(["EVERYBODY", "MALE", "FEMALE"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      disabled={disabled}
                      className={`
                        flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all
                        ${
                          type === option
                            ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-200 dark:hover:border-white/20"
                        }
                      `}
                    >
                      {option === "EVERYBODY"
                        ? "Everybody"
                        : option === "MALE"
                          ? "Men"
                          : "Women"}
                    </button>
                  ))}
                </div>
              </div>

              <UniversalSelect
                label="Sizing Mode"
                value={sizingMode}
                onChange={(value) => setSizingMode(value as DesignSizingMode)}
                options={DESIGN_SIZING_MODE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={disabled}
              />

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  Who Can See This?
                </label>
                <div className="space-y-3">
                  {(
                    [
                      {
                        value: "PUBLIC",
                        emoji: "🌍",
                        label: "Public",
                        desc: "Everyone can see this design",
                      },
                      {
                        value: "PRIVATE",
                        emoji: "🔒",
                        label: "Private",
                        desc: "Only you and collaborators can see",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`
                        flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${
                          visibility === option.value
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-gray-200 dark:border-white/10 glass-light hover:border-purple-200 dark:hover:border-white/20"
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
                      <span className="text-2xl">{option.emoji}</span>
                      <div>
                        <span
                          className={`font-medium ${visibility === option.value ? "text-purple-600 dark:text-purple-400" : "text-gray-900 dark:text-white"}`}
                        >
                          {option.label}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
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
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {lastSaved
              ? `Design saved locally • Last edit: ${formatTimeAgo(lastSaved)}`
              : "Unsaved changes"}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={disabled}
              className="flex-1 sm:flex-none py-3 px-6 rounded-xl glass-light border border-gray-200/70 dark:border-white/15 text-gray-900 dark:text-white font-medium hover:bg-white/40 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <HiOutlineSparkles className="w-5 h-5" />
              )}
              {isSubmitting && submitIntent === "publish"
                ? "Publishing..."
                : isEditMode
                  ? "Update Design"
                  : "Publish Design"}
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
        summary={collectionSummary}
        entityLabel="Design"
        onViewPublished={handleViewPublishedDesign}
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
                              <span className="text-white/60">Category:</span>{" "}
                              {selectedCategory?.name || "—"}
                            </p>
                            <p>
                              <span className="text-white/60">Audience:</span>{" "}
                              {type}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p>
                              <span className="text-white/60">Visibility:</span>{" "}
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
                              <span className="text-white/60">Tags:</span>{" "}
                              {selectedTags.length
                                ? selectedTags.join(", ")
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
}> = ({ title, icon, isOpen, onToggle, children, className }) => (
  <div
    className={`rounded-2xl glass-panel border border-gray-200 dark:border-white/10 overflow-hidden bg-white/80 dark:bg-gray-900/60 backdrop-blur ${className ?? ""}`}
  >
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-lg">
          {icon}
        </span>
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
      </div>
      {isOpen ? (
        <FiChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      ) : (
        <FiChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
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
          <div className="px-4 pb-4 flex-1">{children}</div>
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
      flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10
      text-gray-900 dark:text-white text-sm font-medium transition-all
      ${active ? "bg-purple-500/20 border-purple-500/50" : "hover:bg-white/10"}
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
