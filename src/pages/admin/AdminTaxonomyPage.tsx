import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminModerationApi, adminTaxonomyApi } from '@/api/AdminApi';
import { MeasurementPointsApi } from '@/api/MeasurementPointsApi';
import { customOrdersAdminApi, type CustomFabricRuleBasis } from '@/api/CustomOrderApi';
import { unwrapApiResponse } from '@/types/auth';
import type { AdminCategory } from '@/types/admin';
import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

type TabKey = 'taxonomy' | 'measurements' | 'custom-order-configurations';

type AdminSubCategory = {
  id: string;
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
};

type ModerationQueueResponse = {
  freeformPoints?: any[];
  sizeCharts?: any[];
};

type MeasurementSortMode = 'CATEGORY_ORDER' | 'ALPHA' | 'RANGE_ASC' | 'RANGE_DESC';
type MeasurementViewMode = 'cards' | 'list';
type MeasurementUnitMode = 'CM' | 'IN';

const CATEGORY_ORDER: MeasurementPointCategory[] = [
  'UPPER_BODY',
  'ARMS',
  'LOWER_BODY',
  'LENGTH',
  'GENERAL',
  'ACCESSORIES',
];

const toNumberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatCategory = (value?: string | null) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Not set';

const formatGender = (value?: string | null) =>
  value ? String(value).toUpperCase() : 'UNSPECIFIED';

const normalizeMeasurementLabel = (label?: string | null) => {
  const value = String(label ?? '').trim();
  if (!value) return 'Untitled measurement';
  return value
    .replace(/^men[\s'/-]+/i, '')
    .replace(/^women[\s'/-]+/i, '')
    .replace(/^unisex[\s'/-]+/i, '')
    .trim();
};

const normalizeMeasurementKey = (key?: string | null) => {
  const value = String(key ?? '').trim();
  if (!value) return 'UNSPECIFIED_KEY';
  return value.replace(/^(MEN|WOMEN|UNISEX)_/i, '').trim();
};

const formatMeasurementValue = (valueCm: number | null | undefined, unit: MeasurementUnitMode) => {
  if (valueCm == null || !Number.isFinite(valueCm)) return '—';
  if (unit === 'IN') return `${(valueCm / 2.54).toFixed(1)} in`;
  return `${valueCm.toFixed(0)} cm`;
};

const convertMeasurement = (value: number, from: MeasurementUnitMode, to: MeasurementUnitMode) => {
  if (from === to) return value;
  return from === 'CM' ? value / 2.54 : value * 2.54;
};

const formatMeasurementKeyLabel = (rawKey: string) => {
  const noPrefix = rawKey.replace(/^(MEN|WOMEN|UNISEX)_/, '');
  return noPrefix
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const AdminTaxonomyPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  /** True when rendered via /admin/measurements — only show the measurements tab */
  const isMeasurementsRoute = location.pathname.includes('/admin/measurements');

  const initialTab = useMemo<TabKey>(() => {
    const fromQuery = searchParams.get('tab');
    if (isMeasurementsRoute) return 'measurements';
    if (fromQuery === 'measurements') return 'measurements';
    return 'taxonomy';
  }, [isMeasurementsRoute, searchParams]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const notifications = useSelector((state: RootState) => state.notifications.items);
  const lastMeasurementNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const [showInactive, setShowInactive] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [subCategoryMap, setSubCategoryMap] = useState<Record<string, AdminSubCategory[]>>({});
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  const [categorySearch, setCategorySearch] = useState('');
  const [measurementSearch, setMeasurementSearch] = useState('');
  const [measurementSortMode, setMeasurementSortMode] = useState<MeasurementSortMode>('CATEGORY_ORDER');
  const [measurementViewMode, setMeasurementViewMode] = useState<MeasurementViewMode>('cards');
  const [measurementUnitMode, setMeasurementUnitMode] = useState<MeasurementUnitMode>('IN');
  const [converterInput, setConverterInput] = useState('0');
  const [converterFromUnit, setConverterFromUnit] = useState<MeasurementUnitMode>('IN');
  const [globalYardBasisLabel, setGlobalYardBasisLabel] = useState('');
  const [configurationMeasurementKeys, setConfigurationMeasurementKeys] = useState<string[]>([
    'MEN_CHEST_CIRCUMFERENCE',
    'MEN_WAIST_CIRCUMFERENCE',
  ]);
  const [configurationMeasurementGender, setConfigurationMeasurementGender] = useState<'MEN' | 'WOMEN' | 'UNISEX'>('UNISEX');
  const [editingGlobalYardBasisId, setEditingGlobalYardBasisId] = useState<string | null>(null);
  const [globalYardBasisSaving, setGlobalYardBasisSaving] = useState(false);
  const [globalYardBasisLoading, setGlobalYardBasisLoading] = useState(false);
  const [globalYardBases, setGlobalYardBases] = useState<CustomFabricRuleBasis[]>([]);

  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormDescription, setCategoryFormDescription] = useState('');
  const [categoryFormOrder, setCategoryFormOrder] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const [showSubCategoryCreateFor, setShowSubCategoryCreateFor] = useState<AdminCategory | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<AdminSubCategory | null>(null);
  const [subCategoryManagerCategory, setSubCategoryManagerCategory] = useState<AdminCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<AdminSubCategory | null>(null);
  const [subCategoryFormName, setSubCategoryFormName] = useState('');
  const [subCategoryFormDescription, setSubCategoryFormDescription] = useState('');
  const [subCategoryFormOrder, setSubCategoryFormOrder] = useState('');
  const [subCategorySaving, setSubCategorySaving] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [freeformPoints, setFreeformPoints] = useState<any[]>([]);
  const [sizeCharts, setSizeCharts] = useState<any[]>([]);

  const [allMeasurementPoints, setAllMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [measurementPointsLoading, setMeasurementPointsLoading] = useState(true);

  const [rejectReasonByPointId, setRejectReasonByPointId] = useState<Record<string, string>>({});
  const [reviewingIds, setReviewingIds] = useState<Record<string, boolean>>({});

  const resetCategoryForm = useCallback(() => {
    setCategoryFormName('');
    setCategoryFormDescription('');
    setCategoryFormOrder('');
  }, []);

  const resetSubCategoryForm = useCallback(() => {
    setSubCategoryFormName('');
    setSubCategoryFormDescription('');
    setSubCategoryFormOrder('');
  }, []);

  const hydrateSubCategories = useCallback(async (rows: AdminCategory[], includeInactive: boolean) => {
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const res = await adminTaxonomyApi.listSubCategories(row.id, includeInactive);
          const payload = unwrapApiResponse<
            AdminSubCategory[] | { items?: AdminSubCategory[] }
          >(res.data as any);
          const items = Array.isArray(payload) ? payload : payload?.items ?? [];
          return [row.id, items.map((item) => ({ ...item, categoryId: row.id }))] as const;
        } catch {
          return [row.id, []] as const;
        }
      }),
    );
    setSubCategoryMap(Object.fromEntries(entries));
  }, []);

  const fetchTaxonomy = useCallback(async () => {
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    try {
      const res = await adminTaxonomyApi.listCategories(true);
      const payload = unwrapApiResponse<AdminCategory[] | { items?: AdminCategory[] }>(res.data as any);
      const rows = Array.isArray(payload) ? payload : payload?.items ?? [];
      setCategories(rows);
      await hydrateSubCategories(rows, true);
    } catch (error: any) {
      setTaxonomyError(error?.response?.data?.message || 'Failed to load taxonomy');
    } finally {
      setTaxonomyLoading(false);
    }
  }, [hydrateSubCategories]);

  const fetchMeasurementQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await adminModerationApi.getQueue();
      const payload = unwrapApiResponse<ModerationQueueResponse>(res.data as any);
      setFreeformPoints(payload.freeformPoints ?? []);
      setSizeCharts(payload.sizeCharts ?? []);
    } catch (error: any) {
      setQueueError(error?.response?.data?.message || 'Failed to load measurement moderation queue');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchMeasurementPoints = useCallback(async () => {
    setMeasurementPointsLoading(true);
    try {
      const points = await MeasurementPointsApi.getAll();
      setAllMeasurementPoints(points);
    } catch {
      setAllMeasurementPoints([]);
    } finally {
      setMeasurementPointsLoading(false);
    }
  }, []);

  const fetchGlobalYardBases = useCallback(async () => {
    setGlobalYardBasisLoading(true);
    try {
      const bases = await customOrdersAdminApi.listFabricRuleBases();
      setGlobalYardBases(Array.isArray(bases) ? bases : []);
    } catch {
      setGlobalYardBases([]);
      toast.error('Failed to load global yard options');
    } finally {
      setGlobalYardBasisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'measurements') {
      void Promise.all([fetchMeasurementQueue(), fetchMeasurementPoints()]);
      return;
    }

    if (activeTab === 'custom-order-configurations') {
      void Promise.all([fetchMeasurementPoints(), fetchGlobalYardBases()]);
    }
  }, [activeTab, fetchGlobalYardBases, fetchMeasurementPoints, fetchMeasurementQueue]);

  useEffect(() => {
    if (activeTab === 'taxonomy') {
      void fetchTaxonomy();
    }
  }, [activeTab, fetchTaxonomy]);

  useEffect(() => {
    if (activeTab !== 'measurements') return;

    const latestMeasurementNotification = notifications.find((notification) => {
      const payload = notification.payload as Record<string, unknown> | undefined;
      return notification.type === 'ADMIN_ACTION' && payload?.action === 'MEASUREMENT_FREEFORM_SUBMITTED';
    });

    if (!latestMeasurementNotification) return;
    if (lastMeasurementNotificationIdRef.current === latestMeasurementNotification.id) return;

    lastMeasurementNotificationIdRef.current = latestMeasurementNotification.id;
    void Promise.all([fetchMeasurementQueue(), fetchMeasurementPoints()]);
  }, [activeTab, fetchMeasurementPoints, fetchMeasurementQueue, notifications]);

  const resetGlobalYardBasisForm = useCallback(() => {
    setGlobalYardBasisLabel('');
    setConfigurationMeasurementKeys([
      'MEN_CHEST_CIRCUMFERENCE',
      'MEN_WAIST_CIRCUMFERENCE',
    ]);
    setConfigurationMeasurementGender('UNISEX');
    setEditingGlobalYardBasisId(null);
  }, []);

  const saveGlobalYardBasis = useCallback(async () => {
    const label = globalYardBasisLabel.trim();
    const measurementKeys = Array.from(new Set(configurationMeasurementKeys.map((key) => key.trim()).filter(Boolean)));

    if (!label) {
      toast.error('Provide a clear option name');
      return;
    }

    if (measurementKeys.length === 0) {
      toast.error('Select at least one measurement point');
      return;
    }

    setGlobalYardBasisSaving(true);
    try {
      const payload = {
        label,
        measurementKeys,
        gender: configurationMeasurementGender,
      };

      if (editingGlobalYardBasisId) {
        await customOrdersAdminApi.updateFabricRuleBasis(editingGlobalYardBasisId, payload);
        toast.success('Global yard option updated');
      } else {
        await customOrdersAdminApi.createFabricRuleBasis(payload);
        toast.success('Global yard option created');
      }
      resetGlobalYardBasisForm();
      await fetchGlobalYardBases();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save global yard option');
    } finally {
      setGlobalYardBasisSaving(false);
    }
  }, [
    configurationMeasurementGender,
    configurationMeasurementKeys,
    editingGlobalYardBasisId,
    fetchGlobalYardBases,
    globalYardBasisLabel,
    resetGlobalYardBasisForm,
  ]);

  const startEditingGlobalYardBasis = useCallback((basis: CustomFabricRuleBasis) => {
    setEditingGlobalYardBasisId(basis.id);
    setGlobalYardBasisLabel(basis.label);
    setConfigurationMeasurementKeys(Array.isArray(basis.measurementKeys) ? basis.measurementKeys : []);
    setConfigurationMeasurementGender((basis.gender as 'MEN' | 'WOMEN' | 'UNISEX') ?? 'UNISEX');
  }, []);

  const deleteGlobalYardBasis = useCallback((basis: CustomFabricRuleBasis) => {
    setConfirmAction({
      title: `Delete ${basis.label}?`,
      message: 'This global yard option will be removed for future brand configuration setup.',
      isDestructive: true,
      action: async () => {
        await customOrdersAdminApi.deleteFabricRuleBasis(basis.id);
        if (editingGlobalYardBasisId === basis.id) {
          resetGlobalYardBasisForm();
        }
        toast.success('Global yard option deleted');
        await fetchGlobalYardBases();
      },
    });
  }, [editingGlobalYardBasisId, fetchGlobalYardBases, resetGlobalYardBasisForm]);

  const activeCategoryCount = useMemo(
    () => categories.filter((item) => item.isActive !== false).length,
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const visibleRows = showInactive
      ? categories
      : categories.filter((category) => category.isActive !== false);

    if (!query) return visibleRows;

    return visibleRows.filter((category) => {
      const categoryMatches =
        category.name.toLowerCase().includes(query) ||
        (category.slug ?? '').toLowerCase().includes(query) ||
        (category.description ?? '').toLowerCase().includes(query);

      const subCategories = (subCategoryMap[category.id] ?? []).filter((sub) =>
        showInactive ? true : sub.isActive !== false,
      );
      const subMatches = subCategories.some(
        (sub) =>
          sub.name.toLowerCase().includes(query) ||
          (sub.slug ?? '').toLowerCase().includes(query) ||
          (sub.description ?? '').toLowerCase().includes(query),
      );

      return categoryMatches || subMatches;
    });
  }, [categories, categorySearch, showInactive, subCategoryMap]);

  const pointsByCategory = useMemo(() => {
    const query = measurementSearch.trim().toLowerCase();
    const filtered = allMeasurementPoints.filter((point) => {
      const normalizedLabel = normalizeMeasurementLabel(point.label).toLowerCase();
      const normalizedKey = normalizeMeasurementKey(point.key).toLowerCase();
      if (!query) return true;
      const queryMatch = (
        normalizedLabel.includes(query) ||
        normalizedKey.includes(query) ||
        (point.description ?? '').toLowerCase().includes(query)
      );

      return queryMatch;
    });

    const mergedPointsByCategory = CATEGORY_ORDER.reduce<Record<string, MeasurementPoint[]>>(
      (acc, category) => {
        const categoryPoints = filtered.filter((point) => point.category === category);
        const merged = new Map<string, MeasurementPoint>();

        categoryPoints.forEach((point) => {
          const normalizedKey = normalizeMeasurementKey(point.key);
          const normalizedLabel = normalizeMeasurementLabel(point.label);
          const mapKey = `${category}:${normalizedKey}`;
          const existing = merged.get(mapKey);
          if (!existing) {
            merged.set(mapKey, {
              ...point,
              key: normalizedKey,
              label: normalizedLabel,
              gender: 'UNISEX',
            });
            return;
          }

          const nextMin =
            existing.minValueCm == null
              ? point.minValueCm
              : point.minValueCm == null
                ? existing.minValueCm
                : Math.min(existing.minValueCm, point.minValueCm);
          const nextMax =
            existing.maxValueCm == null
              ? point.maxValueCm
              : point.maxValueCm == null
                ? existing.maxValueCm
                : Math.max(existing.maxValueCm, point.maxValueCm);

          merged.set(mapKey, {
            ...existing,
            minValueCm: nextMin,
            maxValueCm: nextMax,
            description: existing.description || point.description,
          });
        });

        acc[category] = Array.from(merged.values());
        return acc;
      },
      {},
    );

    const sortPoints = (points: MeasurementPoint[]) => {
      const sorted = [...points];
      if (measurementSortMode === 'ALPHA') {
        sorted.sort((a, b) => a.label.localeCompare(b.label));
        return sorted;
      }

      if (measurementSortMode === 'RANGE_ASC' || measurementSortMode === 'RANGE_DESC') {
        sorted.sort((a, b) => {
          const aMin = a.minValueCm ?? Number.POSITIVE_INFINITY;
          const bMin = b.minValueCm ?? Number.POSITIVE_INFINITY;
          return measurementSortMode === 'RANGE_ASC' ? aMin - bMin : bMin - aMin;
        });
        return sorted;
      }

      sorted.sort((a, b) => {
        const aOrder = Number(a.sortOrder ?? 0);
        const bOrder = Number(b.sortOrder ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.label.localeCompare(b.label);
      });
      return sorted;
    };

    return CATEGORY_ORDER.map((category) => ({
      category,
      points: sortPoints(mergedPointsByCategory[category] ?? []),
    })).filter((group) => group.points.length > 0);
  }, [
    allMeasurementPoints,
    measurementSearch,
    measurementSortMode,
  ]);

  const availableMeasurementKeyOptions = useMemo(() => {
    const seen = new Set<string>();
    return allMeasurementPoints
      .filter((point) => point.isActive !== false)
      .filter((point) => {
        if (configurationMeasurementGender === 'UNISEX') return true;
        return point.gender === configurationMeasurementGender || point.gender === 'UNISEX' || point.gender == null;
      })
      .filter((point) => {
        if (!point.key || seen.has(point.key)) return false;
        seen.add(point.key);
        return true;
      })
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((point) => ({
        key: point.key,
        label: normalizeMeasurementLabel(point.label || formatMeasurementKeyLabel(point.key)),
      }));
  }, [allMeasurementPoints, configurationMeasurementGender]);

  const sortedGlobalYardBases = useMemo(
    () => [...globalYardBases].sort((left, right) => left.label.localeCompare(right.label)),
    [globalYardBases],
  );

  const configurationGenderOptions = useMemo(
    () => [
      { value: 'UNISEX', label: 'Unisex' },
      { value: 'MEN', label: 'Men' },
      { value: 'WOMEN', label: 'Women' },
    ],
    [],
  );

  void [
    UniversalSelect,
    globalYardBasisLabel,
    configurationMeasurementKeys,
    configurationMeasurementGender,
    editingGlobalYardBasisId,
    globalYardBasisSaving,
    globalYardBasisLoading,
    fetchGlobalYardBases,
    resetGlobalYardBasisForm,
    saveGlobalYardBasis,
    startEditingGlobalYardBasis,
    deleteGlobalYardBasis,
    availableMeasurementKeyOptions,
    sortedGlobalYardBases,
    configurationGenderOptions,
  ];

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const openCreateCategory = () => {
    resetCategoryForm();
    setEditingCategory(null);
    setShowCategoryCreate(true);
  };

  const openEditCategory = (category: AdminCategory) => {
    setCategoryFormName(category.name);
    setCategoryFormDescription(category.description ?? '');
    setCategoryFormOrder(
      typeof category.order === 'number' ? String(category.order) : '',
    );
    setEditingCategory(category);
    setShowCategoryCreate(false);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryFormName.trim()) return;

    setCategorySaving(true);
    const payload = {
      name: categoryFormName.trim(),
      description: categoryFormDescription.trim() || undefined,
      order: toNumberOrUndefined(categoryFormOrder),
    };

    try {
      if (editingCategory) {
        await adminTaxonomyApi.updateCategory(editingCategory.id, payload);
        toast.success('Category updated');
      } else {
        await adminTaxonomyApi.createCategory(payload);
        toast.success('Category created');
      }

      setEditingCategory(null);
      setShowCategoryCreate(false);
      resetCategoryForm();
      await fetchTaxonomy();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save category');
    } finally {
      setCategorySaving(false);
    }
  };

  const openCreateSubCategory = (category: AdminCategory) => {
    resetSubCategoryForm();
    setEditingSubCategory(null);
    setShowSubCategoryCreateFor(category);
  };

  const openSubCategoryManager = (category: AdminCategory) => {
    setSubCategoryManagerCategory(category);
    setSelectedSubCategory(null);
  };

  const openSubCategoryDetails = (subCategory: AdminSubCategory) => {
    setSelectedSubCategory(subCategory);
  };

  const openEditSubCategory = (subCategory: AdminSubCategory) => {
    setSubCategoryFormName(subCategory.name);
    setSubCategoryFormDescription(subCategory.description ?? '');
    setSubCategoryFormOrder(
      typeof subCategory.order === 'number' ? String(subCategory.order) : '',
    );
    setEditingSubCategory(subCategory);
    const category = categories.find((item) => item.id === subCategory.categoryId) ?? null;
    setShowSubCategoryCreateFor(category);
    setSubCategoryManagerCategory(null);
    setSelectedSubCategory(null);
  };

  const saveSubCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subCategoryFormName.trim() || !showSubCategoryCreateFor) return;

    setSubCategorySaving(true);
    const payload = {
      name: subCategoryFormName.trim(),
      description: subCategoryFormDescription.trim() || undefined,
      order: toNumberOrUndefined(subCategoryFormOrder),
    };

    try {
      if (editingSubCategory) {
        await adminTaxonomyApi.updateSubCategory(editingSubCategory.id, payload);
        toast.success('Sub-category updated');
      } else {
        await adminTaxonomyApi.createSubCategory(showSubCategoryCreateFor.id, payload);
        toast.success('Sub-category created');
      }
      setShowSubCategoryCreateFor(null);
      setEditingSubCategory(null);
      resetSubCategoryForm();
      await fetchTaxonomy();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save sub-category');
    } finally {
      setSubCategorySaving(false);
    }
  };

  const toggleCategoryActive = (category: AdminCategory) => {
    const isActive = category.isActive !== false;
    setConfirmAction({
      title: `${isActive ? 'Deactivate' : 'Activate'} ${category.name}?`,
      message: isActive
        ? 'This category will no longer appear in active taxonomy lists.'
        : 'This category will be visible in active taxonomy lists again.',
      isDestructive: isActive,
      action: async () => {
        if (isActive) {
          await adminTaxonomyApi.deactivateCategory(category.id);
        } else {
          await adminTaxonomyApi.activateCategory(category.id);
        }
        await fetchTaxonomy();
      },
    });
  };

  const toggleSubCategoryActive = (subCategory: AdminSubCategory) => {
    const isActive = subCategory.isActive !== false;
    setConfirmAction({
      title: `${isActive ? 'Deactivate' : 'Activate'} ${subCategory.name}?`,
      message: isActive
        ? 'This sub-category will no longer appear in active taxonomy lists.'
        : 'This sub-category will be visible in active taxonomy lists again.',
      isDestructive: isActive,
      action: async () => {
        if (isActive) {
          await adminTaxonomyApi.deactivateSubCategory(subCategory.id);
        } else {
          await adminTaxonomyApi.activateSubCategory(subCategory.id);
        }
        await fetchTaxonomy();
      },
    });
  };

  const handleReviewMeasurementPoint = async (
    pointId: string,
    action: 'approve' | 'reject',
  ) => {
    const reason = rejectReasonByPointId[pointId]?.trim();
    if (action === 'reject' && !reason) {
      toast.error('Provide a rejection reason so the brand understands what to change.');
      return;
    }

    setReviewingIds((current) => ({ ...current, [pointId]: true }));
    try {
      await adminModerationApi.reviewItem(pointId, {
        action,
        reason: action === 'reject' ? reason : undefined,
      });
      toast.success(action === 'approve' ? 'Measurement point approved globally.' : 'Measurement point rejected with feedback.');
      setRejectReasonByPointId((current) => {
        const next = { ...current };
        delete next[pointId];
        return next;
      });
      await Promise.all([fetchMeasurementQueue(), fetchMeasurementPoints()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to review measurement point');
    } finally {
      setReviewingIds((current) => ({ ...current, [pointId]: false }));
    }
  };

  const handleReviewSizeChart = async (
    chartId: string,
    action: 'approve' | 'reject',
  ) => {
    setReviewingIds((current) => ({ ...current, [chartId]: true }));
    try {
      await adminModerationApi.reviewItem(chartId, { action });
      toast.success(action === 'approve' ? 'Size chart published.' : 'Size chart sent back for revision.');
      await fetchMeasurementQueue();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to review size chart');
    } finally {
      setReviewingIds((current) => ({ ...current, [chartId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-[#f7f9ff] to-[#eef3ff] p-6 shadow-lg shadow-slate-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#101422] dark:to-[#1a2033]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {isMeasurementsRoute ? 'Measurement Points' : 'Taxonomy Configuration'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {isMeasurementsRoute
                ? 'Define the global measurement points brands and buyers use across sizing, custom orders, and size charts.'
                : 'Manage product categories, sub-categories, and taxonomy used across the platform.'}
            </p>
          </div>

          {/* Only show tab switcher on the taxonomy route — measurements route is focused */}
          {!isMeasurementsRoute && (
            <div className="inline-flex rounded-full border border-white/70 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActiveTab('taxonomy')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'taxonomy'
                    ? 'bg-white text-indigo-700 shadow dark:bg-white/15 dark:text-indigo-200'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Taxonomy Tree
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('measurements')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'measurements'
                    ? 'bg-white text-indigo-700 shadow dark:bg-white/15 dark:text-indigo-200'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Measurement Points
              </button>
            </div>
          )}
        </div>
      </section>

      {activeTab === 'taxonomy' ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                {activeCategoryCount} active categories
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {categories.length} total
              </span>
              {showInactive ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  Including inactive
                </span>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <input
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                placeholder="Search taxonomy..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white sm:w-[320px]"
              />
              <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                />
                Show inactive
              </label>
              <button
                type="button"
                onClick={openCreateCategory}
                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create Category
              </button>
            </div>
          </div>

          {taxonomyError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {taxonomyError}
            </div>
          ) : null}

          {taxonomyLoading ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-white/70 bg-white/80 shadow-lg shadow-slate-400/10 dark:border-white/10 dark:bg-white/[0.04]">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="px-6 py-4">Category Name</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Sub-categories</th>
                    <th className="px-6 py-4 text-right">Menu</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => {
                    const subCategories = (subCategoryMap[category.id] ?? []).filter((subCategory) =>
                      showInactive ? true : subCategory.isActive !== false,
                    );
                    const isCategoryActive = category.isActive !== false;

                    return (
                      <tr
                        key={category.id}
                        className="border-b border-slate-100/80 align-top transition hover:bg-indigo-50/50 dark:border-white/5 dark:hover:bg-white/5"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{category.name}</div>
                          {category.description ? (
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{category.description}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                              isCategoryActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                                : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            {isCategoryActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                              {subCategories.length} total
                            </span>
                            <button
                              type="button"
                              onClick={() => openSubCategoryManager(category)}
                              className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200"
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <details className="relative inline-block text-left">
                            <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">
                              ⋯
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => openCreateSubCategory(category)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                              >
                                Add sub-category
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCategory(category)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                              >
                                Edit category
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCategoryActive(category)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                              >
                                {isCategoryActive ? 'Deactivate category' : 'Activate category'}
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                        No taxonomy nodes found for this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'measurements' ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-100">
            <div className="font-semibold">What you are approving or rejecting</div>
            <ul className="mt-2 space-y-1 text-xs">
              <li>
                Approve: the brand-submitted measurement point becomes globally available and other brands can reuse it.
              </li>
              <li>
                Reject: the point is not published globally; provide a reason so the brand can correct and resubmit.
              </li>
              <li>
                Why it is sent to admin: freeform points are user-generated and require quality review before entering shared measurement standards.
              </li>
            </ul>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto_auto]">
            <input
              value={measurementSearch}
              onChange={(event) => setMeasurementSearch(event.target.value)}
              placeholder="Search measurement points..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
              🌍 Universal points
            </div>
            <select
              value={measurementSortMode}
              onChange={(event) => setMeasurementSortMode(event.target.value as MeasurementSortMode)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="CATEGORY_ORDER">Sort: Category order</option>
              <option value="ALPHA">Sort: A-Z</option>
              <option value="RANGE_ASC">Sort: Min range low-high</option>
              <option value="RANGE_DESC">Sort: Min range high-low</option>
            </select>
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-black/20">
              <button
                type="button"
                onClick={() => setMeasurementViewMode('cards')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  measurementViewMode === 'cards'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setMeasurementViewMode('list')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  measurementViewMode === 'list'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                List
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                void Promise.all([fetchMeasurementQueue(), fetchMeasurementPoints()]);
              }}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:grid-cols-[200px_1fr] dark:border-white/10 dark:bg-white/[0.04]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Library Unit</div>
              <div className="mt-2 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-black/20">
                <button
                  type="button"
                  onClick={() => setMeasurementUnitMode('IN')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    measurementUnitMode === 'IN'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Inches (default)
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementUnitMode('CM')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    measurementUnitMode === 'CM'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Centimeters
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Conversion Calculator</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[120px_140px_auto]">
                <input
                  value={converterInput}
                  onChange={(event) => setConverterInput(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  placeholder="10"
                />
                <select
                  value={converterFromUnit}
                  onChange={(event) => setConverterFromUnit(event.target.value as MeasurementUnitMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                >
                  <option value="IN">From inches</option>
                  <option value="CM">From centimeters</option>
                </select>
                <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-white/20 dark:text-slate-200">
                  {(() => {
                    const parsed = Number(converterInput);
                    if (!Number.isFinite(parsed)) return 'Enter a valid number';
                    const targetUnit = converterFromUnit === 'CM' ? 'IN' : 'CM';
                    const converted = convertMeasurement(parsed, converterFromUnit, targetUnit);
                    return `${parsed.toFixed(2)} ${converterFromUnit === 'CM' ? 'cm' : 'in'} = ${converted.toFixed(2)} ${targetUnit === 'CM' ? 'cm' : 'in'}`;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {queueError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {queueError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-400/10 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Pending Freeform Points</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  {freeformPoints.length}
                </span>
              </div>

              {queueLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                  ))}
                </div>
              ) : freeformPoints.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                  No pending freeform measurement points.
                </div>
              ) : (
                <div className="space-y-3">
                  {freeformPoints.map((point) => {
                    const rejectingReason = rejectReasonByPointId[point.id] ?? '';
                    const isReviewing = Boolean(reviewingIds[point.id]);

                    return (
                      <div
                        key={point.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{point.label}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                              Key: {point.key} · {formatCategory(point.category)} · {formatGender(point.gender)}
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {point.source}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          {point.description?.trim() || 'No description provided by brand.'}
                        </p>

                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Limits: {point.minValueCm ?? '—'} cm to {point.maxValueCm ?? '—'} cm
                        </div>

                        <textarea
                          value={rejectingReason}
                          onChange={(event) =>
                            setRejectReasonByPointId((current) => ({
                              ...current,
                              [point.id]: event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="If rejecting, explain why (required for reject)..."
                          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                        />

                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleReviewMeasurementPoint(point.id, 'approve');
                            }}
                            disabled={isReviewing}
                            className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleReviewMeasurementPoint(point.id, 'reject');
                            }}
                            disabled={isReviewing}
                            className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/20 dark:text-rose-200"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-400/10 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Pending Brand Size Charts</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  {sizeCharts.length}
                </span>
              </div>

              {queueLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                  ))}
                </div>
              ) : sizeCharts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                  No pending size charts.
                </div>
              ) : (
                <div className="space-y-3">
                  {sizeCharts.map((chart) => {
                    const isReviewing = Boolean(reviewingIds[chart.id]);
                    return (
                      <div
                        key={chart.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{chart.name ?? `Size Chart ${chart.version ?? ''}`}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          Status: {chart.status} · Version: {chart.version ?? '—'}
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleReviewSizeChart(chart.id, 'approve');
                            }}
                            disabled={isReviewing}
                            className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleReviewSizeChart(chart.id, 'reject');
                            }}
                            disabled={isReviewing}
                            className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/20 dark:text-rose-200"
                          >
                            Send Back
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Measurement Library</h2>

            {measurementPointsLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                ))}
              </div>
            ) : pointsByCategory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                No measurement points match this filter.
              </div>
            ) : (
              pointsByCategory.map((group) => (
                <section key={group.category} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                      {formatCategory(group.category)}
                    </div>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  </div>

                  {measurementViewMode === 'cards' ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {group.points.map((point) => (
                        <article
                          key={point.id}
                          className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-md shadow-slate-400/10 dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white">{point.label}</h3>
                              <div className="mt-1 inline-flex rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                                {point.key}
                              </div>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                              🌍 Universal
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {point.description?.trim() || 'No description provided.'}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Validation</span>
                            <span className="font-mono text-slate-700 dark:text-slate-200">
                              {formatMeasurementValue(point.minValueCm, measurementUnitMode)} - {formatMeasurementValue(point.maxValueCm, measurementUnitMode)}
                            </span>
                            {measurementUnitMode === 'IN' ? (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                ({point.minValueCm ?? '—'} cm - {point.maxValueCm ?? '—'} cm)
                              </span>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/70 text-left uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                            <th className="px-3 py-2">Label</th>
                            <th className="px-3 py-2">Key</th>
                            <th className="px-3 py-2">Validation</th>
                            <th className="px-3 py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.points.map((point) => (
                            <tr key={point.id} className="border-b border-slate-100/80 dark:border-white/5">
                              <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{point.label}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{point.key}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                {formatMeasurementValue(point.minValueCm, measurementUnitMode)} - {formatMeasurementValue(point.maxValueCm, measurementUnitMode)}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{point.description?.trim() || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        </section>
      ) : null}

      <Modal
        open={showCategoryCreate || Boolean(editingCategory)}
        onClose={() => {
          setShowCategoryCreate(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? `Edit ${editingCategory.name}` : 'Create Category'}
        size="sm"
        backdropStyle="light"
      >
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Category name</label>
            <input
              value={categoryFormName}
              onChange={(event) => setCategoryFormName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Description (optional)</label>
            <textarea
              value={categoryFormDescription}
              onChange={(event) => setCategoryFormDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Display order (optional)</label>
            <input
              type="number"
              value={categoryFormOrder}
              onChange={(event) => setCategoryFormOrder(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCategoryCreate(false);
                setEditingCategory(null);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={categorySaving || !categoryFormName.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {categorySaving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(showSubCategoryCreateFor)}
        onClose={() => {
          setShowSubCategoryCreateFor(null);
          setEditingSubCategory(null);
        }}
        title={editingSubCategory ? `Edit ${editingSubCategory.name}` : `Add sub-category to ${showSubCategoryCreateFor?.name ?? ''}`}
        size="sm"
        backdropStyle="light"
      >
        <form onSubmit={saveSubCategory} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Sub-category name</label>
            <input
              value={subCategoryFormName}
              onChange={(event) => setSubCategoryFormName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Description (optional)</label>
            <textarea
              value={subCategoryFormDescription}
              onChange={(event) => setSubCategoryFormDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Display order (optional)</label>
            <input
              type="number"
              value={subCategoryFormOrder}
              onChange={(event) => setSubCategoryFormOrder(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowSubCategoryCreateFor(null);
                setEditingSubCategory(null);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={subCategorySaving || !subCategoryFormName.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {subCategorySaving ? 'Saving...' : editingSubCategory ? 'Update Sub-category' : 'Create Sub-category'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(subCategoryManagerCategory)}
        onClose={() => {
          setSubCategoryManagerCategory(null);
          setSelectedSubCategory(null);
        }}
        title={`Manage sub-categories • ${subCategoryManagerCategory?.name ?? ''}`}
        size="md"
        backdropStyle="light"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Click a sub-category to open details and actions.
            </p>
            {subCategoryManagerCategory ? (
              <button
                type="button"
                onClick={() => openCreateSubCategory(subCategoryManagerCategory)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Add sub-category
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {(subCategoryManagerCategory
              ? (subCategoryMap[subCategoryManagerCategory.id] ?? []).filter((subCategory) =>
                  showInactive ? true : subCategory.isActive !== false,
                )
              : []).map((subCategory) => (
              <button
                key={subCategory.id}
                type="button"
                onClick={() => openSubCategoryDetails(subCategory)}
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{subCategory.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-300">Order: {subCategory.order ?? 0}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    subCategory.isActive !== false
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  }`}>
                    {subCategory.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </button>
            ))}
            {subCategoryManagerCategory &&
            (subCategoryMap[subCategoryManagerCategory.id] ?? []).filter((subCategory) =>
              showInactive ? true : subCategory.isActive !== false,
            ).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-300">
                No sub-categories yet.
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedSubCategory)}
        onClose={() => setSelectedSubCategory(null)}
        title={selectedSubCategory ? `Sub-category • ${selectedSubCategory.name}` : 'Sub-category'}
        size="sm"
        backdropStyle="light"
      >
        {selectedSubCategory ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <div><span className="font-semibold text-slate-800 dark:text-slate-100">Description:</span> {selectedSubCategory.description || '—'}</div>
              <div className="mt-1"><span className="font-semibold text-slate-800 dark:text-slate-100">Order:</span> {selectedSubCategory.order ?? 0}</div>
              <div className="mt-1"><span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span> {selectedSubCategory.isActive !== false ? 'Active' : 'Inactive'}</div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => openEditSubCategory(selectedSubCategory)}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleSubCategoryActive(selectedSubCategory);
                  setSelectedSubCategory(null);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  selectedSubCategory.isActive !== false
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200'
                }`}
              >
                {selectedSubCategory.isActive !== false ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AdminTaxonomyPage;
