import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminModerationApi, adminTaxonomyApi } from '@/api/AdminApi';
import { customOrdersAdminApi, type CustomFabricRuleBasis } from '@/api/CustomOrderApi';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import type {
  AdminCategory,
  AdminMeasurementPointLifecycleDetails,
  AdminMeasurementPointRow,
} from '@/types/admin';
import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import useDebounce from '@/hooks/useDebounce';

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
type MeasurementLifecycleSortMode = 'recent' | 'oldest' | 'updated' | 'label';
type MeasurementLifecycleActiveMode = 'all' | 'active' | 'inactive';
type MeasurementLifecycleStatusMode = 'all' | 'brand_only' | 'approved_global' | 'rejected';
type MeasurementLifecycleSourceMode = 'all' | 'brand_freeform' | 'system';
type MeasurementLifecycleAction = 'approve' | 'reject' | 'activate' | 'deactivate';

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

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMeasurementLifecycleStatusLabel = (status: string) => {
  if (status === 'APPROVED_GLOBAL') return 'Approved globally';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending review';
};

const mapAdminMeasurementPointRowToMeasurementPoint = (
  row: AdminMeasurementPointRow,
): MeasurementPoint => ({
  id: row.id,
  key: row.key,
  label: normalizeMeasurementLabel(row.label),
  description: row.description,
  category: row.category as MeasurementPointCategory,
  gender: (row.gender as MeasurementPoint['gender']) ?? null,
  source: row.source as MeasurementPoint['source'],
  status: row.status as MeasurementPoint['status'],
  brandId: row.brandId,
  minValueCm: row.minValueCm,
  maxValueCm: row.maxValueCm,
  minValueChildCm: row.minValueChildCm ?? null,
  maxValueChildCm: row.maxValueChildCm ?? null,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
});

const measurementLifecycleRowMatchesFilters = (
  row: AdminMeasurementPointRow,
  filters: {
    search: string;
    status: MeasurementLifecycleStatusMode;
    source: MeasurementLifecycleSourceMode;
    category: string;
    active: MeasurementLifecycleActiveMode;
  },
) => {
  const search = filters.search.trim().toLowerCase();
  if (search) {
    const label = normalizeMeasurementLabel(row.label).toLowerCase();
    const key = normalizeMeasurementKey(row.key).toLowerCase();
    const description = String(row.description ?? '').toLowerCase();

    if (!label.includes(search) && !key.includes(search) && !description.includes(search)) {
      return false;
    }
  }

  if (filters.status !== 'all' && row.status.toLowerCase() !== filters.status) {
    return false;
  }

  if (filters.source !== 'all' && row.source.toLowerCase() !== filters.source) {
    return false;
  }

  if (filters.category !== 'all' && row.category !== filters.category) {
    return false;
  }

  if (filters.active === 'active' && !row.isActive) {
    return false;
  }

  if (filters.active === 'inactive' && row.isActive) {
    return false;
  }

  return true;
};

const AdminTaxonomyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = useMemo<TabKey>(() => {
    const fromQuery = searchParams.get('tab');
    if (fromQuery === 'measurements') return 'measurements';
    return 'taxonomy';
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const isMeasurementsRoute = activeTab === 'measurements';
  const { hasPermission } = useAdminPermissions();
  const canReadMeasurementLifecycle = hasPermission('MEASUREMENTS_READ');
  const canReviewMeasurementLifecycle = hasPermission('MEASUREMENTS_REVIEW');
  const canReadModerationQueue = hasPermission('MODERATION_READ');
  const canReviewModerationQueue = hasPermission('MODERATION_REVIEW');
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
  const [measurementLifecycleSearch, setMeasurementLifecycleSearch] = useState('');
  const [measurementLifecycleSortMode, setMeasurementLifecycleSortMode] = useState<MeasurementLifecycleSortMode>('recent');
  const [measurementLifecycleStatusMode, setMeasurementLifecycleStatusMode] = useState<MeasurementLifecycleStatusMode>('brand_only');
  const [measurementLifecycleSourceMode, setMeasurementLifecycleSourceMode] = useState<MeasurementLifecycleSourceMode>('brand_freeform');
  const [measurementLifecycleCategoryMode, setMeasurementLifecycleCategoryMode] = useState<string>('all');
  const [measurementLifecycleActiveMode, setMeasurementLifecycleActiveMode] = useState<MeasurementLifecycleActiveMode>('all');
  const [measurementLifecycleRows, setMeasurementLifecycleRows] = useState<AdminMeasurementPointRow[]>([]);
  const [measurementLifecycleLoading, setMeasurementLifecycleLoading] = useState(true);
  const [measurementLifecycleError, setMeasurementLifecycleError] = useState<string | null>(null);
  const [selectedMeasurementPoint, setSelectedMeasurementPoint] = useState<AdminMeasurementPointRow | null>(null);
  const [selectedMeasurementLifecycle, setSelectedMeasurementLifecycle] =
    useState<AdminMeasurementPointLifecycleDetails | null>(null);
  const [measurementLifecycleModalLoading, setMeasurementLifecycleModalLoading] = useState(false);
  const [measurementLifecycleActionLoading, setMeasurementLifecycleActionLoading] = useState(false);
  const [measurementLifecycleRejectReason, setMeasurementLifecycleRejectReason] = useState('');

  const [rejectReasonByPointId, setRejectReasonByPointId] = useState<Record<string, string>>({});
  const [reviewingIds, setReviewingIds] = useState<Record<string, boolean>>({});
  const debouncedMeasurementLifecycleSearch = useDebounce(measurementLifecycleSearch, 300);

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
      const [measurementLifecycleRes, moderationQueueRes] = await Promise.all([
        canReadMeasurementLifecycle
          ? adminModerationApi.listMeasurementPoints({
              limit: 80,
              status: 'BRAND_ONLY',
              source: 'BRAND_FREEFORM',
              sort: 'recent',
            })
          : Promise.resolve(null),
        canReadModerationQueue
          ? adminModerationApi.getQueue()
          : Promise.resolve(null),
      ]);

      if (measurementLifecycleRes) {
        const lifecyclePayload = unwrapApiResponse<
          { items?: AdminMeasurementPointRow[] } | AdminMeasurementPointRow[]
        >(measurementLifecycleRes.data as any);
        const lifecycleRows = Array.isArray(lifecyclePayload)
          ? lifecyclePayload
          : Array.isArray(lifecyclePayload?.items)
            ? lifecyclePayload.items
            : [];
        setFreeformPoints(lifecycleRows);
      } else if (moderationQueueRes) {
        const queuePayload = unwrapApiResponse<ModerationQueueResponse>(
          moderationQueueRes.data as any,
        );
        setFreeformPoints(queuePayload.freeformPoints ?? []);
      } else {
        setFreeformPoints([]);
      }

      if (moderationQueueRes) {
        const queuePayload = unwrapApiResponse<ModerationQueueResponse>(
          moderationQueueRes.data as any,
        );
        setSizeCharts(queuePayload.sizeCharts ?? []);
      } else {
        setSizeCharts([]);
      }

      if (!canReadMeasurementLifecycle && !canReadModerationQueue) {
        setQueueError('You do not have permission to view moderation queues.');
      }
    } catch (error: any) {
      setQueueError(error?.response?.data?.message || 'Failed to load measurement moderation queue');
    } finally {
      setQueueLoading(false);
    }
  }, [canReadMeasurementLifecycle, canReadModerationQueue]);

  const fetchMeasurementPoints = useCallback(async () => {
    setMeasurementPointsLoading(true);
    try {
      const points: MeasurementPoint[] = [];
      let cursor: string | undefined;

      while (true) {
        const response = await adminModerationApi.listMeasurementPoints({
          limit: 100,
          sort: 'label',
          ...(cursor ? { cursor } : {}),
        });
        const payload = unwrapApiResponse<
          { items?: AdminMeasurementPointRow[]; nextCursor?: string | null } | AdminMeasurementPointRow[]
        >(response.data as any);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

        points.push(...rows.map(mapAdminMeasurementPointRowToMeasurementPoint));

        const nextCursor = Array.isArray(payload) ? null : payload?.nextCursor ?? null;
        if (!nextCursor || rows.length === 0) {
          break;
        }
        cursor = nextCursor;
      }

      setAllMeasurementPoints(points);
    } catch {
      setAllMeasurementPoints([]);
    } finally {
      setMeasurementPointsLoading(false);
    }
  }, []);

  const fetchMeasurementLifecycleRows = useCallback(async () => {
    setMeasurementLifecycleLoading(true);
    setMeasurementLifecycleError(null);
    try {
      const params: Record<string, string | number> = {
        limit: 80,
        sort: measurementLifecycleSortMode,
      };

      const search = debouncedMeasurementLifecycleSearch.trim();
      if (search) {
        params.search = search;
      }

      if (measurementLifecycleStatusMode !== 'all') {
        params.status = measurementLifecycleStatusMode.toUpperCase();
      }

      if (measurementLifecycleSourceMode !== 'all') {
        params.source = measurementLifecycleSourceMode.toUpperCase();
      }

      if (measurementLifecycleCategoryMode !== 'all') {
        params.category = measurementLifecycleCategoryMode;
      }

      if (measurementLifecycleActiveMode !== 'all') {
        params.isActive = measurementLifecycleActiveMode;
      }

      const response = await adminModerationApi.listMeasurementPoints(params);
      const payload = unwrapApiResponse<
        { items?: AdminMeasurementPointRow[] } | AdminMeasurementPointRow[]
      >(response.data as any);
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

      setMeasurementLifecycleRows(rows);
    } catch (error: any) {
      setMeasurementLifecycleRows([]);
      setMeasurementLifecycleError(
        error?.response?.data?.message ||
          'Failed to load measurement lifecycle records',
      );
    } finally {
      setMeasurementLifecycleLoading(false);
    }
  }, [
    debouncedMeasurementLifecycleSearch,
    measurementLifecycleActiveMode,
    measurementLifecycleCategoryMode,
    measurementLifecycleSortMode,
    measurementLifecycleSourceMode,
    measurementLifecycleStatusMode,
  ]);

  const openMeasurementLifecycle = useCallback(
    async (row: AdminMeasurementPointRow) => {
      setSelectedMeasurementPoint(row);
      setSelectedMeasurementLifecycle(null);
      setMeasurementLifecycleRejectReason(row.rejectionReason ?? '');
      setMeasurementLifecycleModalLoading(true);
      try {
        const response = await adminModerationApi.getMeasurementPointLifecycle(row.id);
        const payload =
          unwrapApiResponse<AdminMeasurementPointLifecycleDetails>(
            response.data as any,
          );
        setSelectedMeasurementLifecycle(payload);
        setSelectedMeasurementPoint(payload.point);
        setMeasurementLifecycleRejectReason(payload.point.rejectionReason ?? '');
      } catch (error: any) {
        setSelectedMeasurementPoint(null);
        setSelectedMeasurementLifecycle(null);
        toast.error(
          error?.response?.data?.message ||
            'Failed to load measurement lifecycle details',
        );
      } finally {
        setMeasurementLifecycleModalLoading(false);
      }
    },
    [],
  );

  const applyMeasurementLifecycleAction = useCallback(
    async (action: MeasurementLifecycleAction) => {
      if (!selectedMeasurementPoint) return;

      const reason = measurementLifecycleRejectReason.trim();
      if (action === 'reject' && !reason) {
        toast.error('Provide a rejection reason before rejecting this point.');
        return;
      }

      setMeasurementLifecycleActionLoading(true);
      try {
        await adminModerationApi.updateMeasurementPointLifecycle(
          selectedMeasurementPoint.id,
          {
            action,
            reason: action === 'reject' ? reason : undefined,
          },
        );

        const successMessageByAction: Record<MeasurementLifecycleAction, string> = {
          approve: 'Measurement point approved globally.',
          reject: 'Measurement point rejected with feedback.',
          activate: 'Measurement point activated.',
          deactivate: 'Measurement point deactivated.',
        };
        toast.success(successMessageByAction[action]);

        const lifecycleResponse =
          await adminModerationApi.getMeasurementPointLifecycle(selectedMeasurementPoint.id);
        const lifecyclePayload =
          unwrapApiResponse<AdminMeasurementPointLifecycleDetails>(
            lifecycleResponse.data as any,
          );
        const updatedPoint = lifecyclePayload.point;
        setSelectedMeasurementLifecycle(lifecyclePayload);
        setSelectedMeasurementPoint(updatedPoint);
        setMeasurementLifecycleRejectReason(updatedPoint.rejectionReason ?? '');
        setMeasurementLifecycleRows((current) => {
          const nextRows = current.map((row) =>
            row.id === updatedPoint.id ? updatedPoint : row,
          );
          if (
            !measurementLifecycleRowMatchesFilters(updatedPoint, {
              search: debouncedMeasurementLifecycleSearch,
              status: measurementLifecycleStatusMode,
              source: measurementLifecycleSourceMode,
              category: measurementLifecycleCategoryMode,
              active: measurementLifecycleActiveMode,
            })
          ) {
            return nextRows.filter((row) => row.id !== updatedPoint.id);
          }
          return nextRows;
        });
        setFreeformPoints((current) => current.filter((row) => row.id !== updatedPoint.id));
        setAllMeasurementPoints((current) =>
          current.map((point) =>
            point.id === updatedPoint.id
              ? mapAdminMeasurementPointRowToMeasurementPoint(updatedPoint)
              : point,
          ),
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            'Failed to update measurement point lifecycle',
        );
      } finally {
        setMeasurementLifecycleActionLoading(false);
      }
    },
    [
      debouncedMeasurementLifecycleSearch,
      measurementLifecycleActiveMode,
      measurementLifecycleCategoryMode,
      measurementLifecycleSourceMode,
      measurementLifecycleStatusMode,
      measurementLifecycleRejectReason,
      selectedMeasurementPoint,
    ],
  );

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
    if (activeTab !== 'measurements') return;

    void Promise.all([fetchMeasurementQueue(), fetchMeasurementPoints()]);
  }, [activeTab, fetchMeasurementPoints, fetchMeasurementQueue]);

  useEffect(() => {
    if (activeTab !== 'measurements') return;

    void fetchMeasurementLifecycleRows();
  }, [activeTab, fetchMeasurementLifecycleRows]);

  useEffect(() => {
    if (activeTab !== 'custom-order-configurations') return;

    void Promise.all([fetchMeasurementPoints(), fetchGlobalYardBases()]);
  }, [activeTab, fetchGlobalYardBases, fetchMeasurementPoints]);

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
    void Promise.all([
      fetchMeasurementQueue(),
      fetchMeasurementPoints(),
      fetchMeasurementLifecycleRows(),
    ]);
  }, [
    activeTab,
    fetchMeasurementLifecycleRows,
    fetchMeasurementPoints,
    fetchMeasurementQueue,
    notifications,
  ]);

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

  const measurementSortOptions = useMemo(
    () => [
      { value: 'CATEGORY_ORDER', label: 'Sort: Category order' },
      { value: 'ALPHA', label: 'Sort: A-Z' },
      { value: 'RANGE_ASC', label: 'Sort: Min range low-high' },
      { value: 'RANGE_DESC', label: 'Sort: Min range high-low' },
    ],
    [],
  );

  const converterUnitOptions = useMemo(
    () => [
      { value: 'IN', label: 'From inches' },
      { value: 'CM', label: 'From centimeters' },
    ],
    [],
  );

  const measurementLifecycleSortOptions = useMemo(
    () => [
      { value: 'recent', label: 'Lifecycle sort: Recently created' },
      { value: 'oldest', label: 'Lifecycle sort: Oldest created' },
      { value: 'updated', label: 'Lifecycle sort: Recently updated' },
      { value: 'label', label: 'Lifecycle sort: Label A-Z' },
    ],
    [],
  );

  const measurementLifecycleStatusOptions = useMemo(
    () => [
      { value: 'all', label: 'Status: All' },
      { value: 'brand_only', label: 'Status: Pending review' },
      { value: 'approved_global', label: 'Status: Approved global' },
      { value: 'rejected', label: 'Status: Rejected' },
    ],
    [],
  );

  const measurementLifecycleSourceOptions = useMemo(
    () => [
      { value: 'all', label: 'Source: All' },
      { value: 'brand_freeform', label: 'Source: Brand freeform' },
      { value: 'system', label: 'Source: System seeded' },
    ],
    [],
  );

  const measurementLifecycleCategoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Category: All' },
      ...CATEGORY_ORDER.map((category) => ({
        value: category,
        label: `Category: ${formatCategory(category)}`,
      })),
    ],
    [],
  );

  const measurementLifecycleActiveOptions = useMemo(
    () => [
      { value: 'all', label: 'Visibility: All' },
      { value: 'active', label: 'Visibility: Active' },
      { value: 'inactive', label: 'Visibility: Inactive' },
    ],
    [],
  );

  void [
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
    measurementSortOptions,
    converterUnitOptions,
    measurementLifecycleSortOptions,
    measurementLifecycleStatusOptions,
    measurementLifecycleSourceOptions,
    measurementLifecycleCategoryOptions,
    measurementLifecycleActiveOptions,
    openMeasurementLifecycle,
    applyMeasurementLifecycleAction,
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
    if (!canReviewMeasurementLifecycle) {
      toast.error('You do not have permission to review measurement points.');
      return;
    }

    const reason = rejectReasonByPointId[pointId]?.trim();
    if (action === 'reject' && !reason) {
      toast.error('Provide a rejection reason so the brand understands what to change.');
      return;
    }

    setReviewingIds((current) => ({ ...current, [pointId]: true }));
    try {
      await adminModerationApi.updateMeasurementPointLifecycle(pointId, {
        action,
        reason: action === 'reject' ? reason : undefined,
      });

      const lifecycleResponse = await adminModerationApi.getMeasurementPointLifecycle(pointId);
      const lifecyclePayload = unwrapApiResponse<AdminMeasurementPointLifecycleDetails>(
        lifecycleResponse.data as any,
      );
      const updatedPoint = lifecyclePayload.point;

      toast.success(action === 'approve' ? 'Measurement point approved globally.' : 'Measurement point rejected with feedback.');
      setRejectReasonByPointId((current) => {
        const next = { ...current };
        delete next[pointId];
        return next;
      });
      setSelectedMeasurementPoint((current) => (current?.id === updatedPoint.id ? updatedPoint : current));
      setSelectedMeasurementLifecycle((current) =>
        current?.point.id === updatedPoint.id ? lifecyclePayload : current,
      );
      setMeasurementLifecycleRejectReason(updatedPoint.rejectionReason ?? '');
      setMeasurementLifecycleRows((current) => {
        const nextRows = current.map((row) => (row.id === updatedPoint.id ? updatedPoint : row));
        if (
          !measurementLifecycleRowMatchesFilters(updatedPoint, {
            search: debouncedMeasurementLifecycleSearch,
            status: measurementLifecycleStatusMode,
            source: measurementLifecycleSourceMode,
            category: measurementLifecycleCategoryMode,
            active: measurementLifecycleActiveMode,
          })
        ) {
          return nextRows.filter((row) => row.id !== updatedPoint.id);
        }
        return nextRows;
      });
      setFreeformPoints((current) => current.filter((row) => row.id !== updatedPoint.id));
      setAllMeasurementPoints((current) =>
        current.map((point) =>
          point.id === updatedPoint.id ? mapAdminMeasurementPointRowToMeasurementPoint(updatedPoint) : point,
        ),
      );
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
    if (!canReviewModerationQueue) {
      toast.error('You do not have permission to review size charts.');
      return;
    }

    setReviewingIds((current) => ({ ...current, [chartId]: true }));
    try {
      await adminModerationApi.reviewItem(chartId, { action });
      toast.success(action === 'approve' ? 'Size chart published.' : 'Size chart sent back for revision.');
      setSizeCharts((current) => current.filter((chart) => chart.id !== chartId));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to review size chart');
    } finally {
      setReviewingIds((current) => ({ ...current, [chartId]: false }));
    }
  };

  return (
    <div className="min-w-0 space-y-6">
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
          {activeTab !== 'custom-order-configurations' && (
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

          <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
            <input
              value={measurementSearch}
              onChange={(event) => setMeasurementSearch(event.target.value)}
              placeholder="Search measurement points..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white md:col-span-2 2xl:col-span-1"
            />
            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
              🌍 Universal points
            </div>
            <UniversalSelect
              value={measurementSortMode}
              onChange={(value) => setMeasurementSortMode(value as MeasurementSortMode)}
              options={measurementSortOptions}
            />
            <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-black/20 2xl:w-auto">
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
                void Promise.all([
                  fetchMeasurementQueue(),
                  fetchMeasurementPoints(),
                  fetchMeasurementLifecycleRows(),
                ]);
              }}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Refresh
            </button>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:grid-cols-[200px_minmax(0,1fr)] dark:border-white/10 dark:bg-white/[0.04]">
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

            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Conversion Calculator</div>
              <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-[120px_180px_minmax(0,1fr)]">
                <input
                  value={converterInput}
                  onChange={(event) => setConverterInput(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  placeholder="10"
                />
                <UniversalSelect
                  value={converterFromUnit}
                  onChange={(value) => setConverterFromUnit(value as MeasurementUnitMode)}
                  options={converterUnitOptions}
                />
                <div className="min-w-0 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-white/20 dark:text-slate-200">
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

                        {canReviewMeasurementLifecycle ? (
                          <>
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
                          </>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                            Read-only access. You need measurement review permission to approve or reject points.
                          </p>
                        )}
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
                        {canReviewModerationQueue ? (
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
                        ) : (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                            Read-only access. You need moderation review permission to publish or send back charts.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <section className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-lg shadow-slate-400/10 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Measurement Lifecycle Management
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                  Manage brand-submitted measurement points with full lifecycle actions and usage context.
                </p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {measurementLifecycleRows.length} points
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px_190px_170px_220px_auto]">
              <input
                value={measurementLifecycleSearch}
                onChange={(event) => setMeasurementLifecycleSearch(event.target.value)}
                placeholder="Search lifecycle points..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white md:col-span-2 xl:col-span-1"
              />
              <UniversalSelect
                value={measurementLifecycleStatusMode}
                onChange={(value) =>
                  setMeasurementLifecycleStatusMode(
                    value as MeasurementLifecycleStatusMode,
                  )
                }
                options={measurementLifecycleStatusOptions}
              />
              <UniversalSelect
                value={measurementLifecycleSourceMode}
                onChange={(value) =>
                  setMeasurementLifecycleSourceMode(
                    value as MeasurementLifecycleSourceMode,
                  )
                }
                options={measurementLifecycleSourceOptions}
              />
              <UniversalSelect
                value={measurementLifecycleCategoryMode}
                onChange={(value) => setMeasurementLifecycleCategoryMode(String(value))}
                options={measurementLifecycleCategoryOptions}
              />
              <UniversalSelect
                value={measurementLifecycleActiveMode}
                onChange={(value) =>
                  setMeasurementLifecycleActiveMode(
                    value as MeasurementLifecycleActiveMode,
                  )
                }
                options={measurementLifecycleActiveOptions}
              />
              <UniversalSelect
                value={measurementLifecycleSortMode}
                onChange={(value) =>
                  setMeasurementLifecycleSortMode(value as MeasurementLifecycleSortMode)
                }
                options={measurementLifecycleSortOptions}
              />
              <button
                type="button"
                onClick={() => {
                  void fetchMeasurementLifecycleRows();
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-black/20 dark:text-slate-200"
              >
                Refresh lifecycle
              </button>
            </div>

            {measurementLifecycleError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {measurementLifecycleError}
              </div>
            ) : null}

            {measurementLifecycleLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10"
                  />
                ))}
              </div>
            ) : measurementLifecycleRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                No measurement points match these lifecycle filters.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
                <table className="w-full min-w-[1020px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 text-left uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <th className="px-3 py-2">Point</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Created By</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurementLifecycleRows.map((row) => {
                      const submittedBy =
                        row.brand?.owner?.brandFullName ||
                        row.brand?.owner?.username ||
                        row.brand?.name ||
                        'System';
                      const statusBadgeClass =
                        row.status === 'APPROVED_GLOBAL'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : row.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100/80 align-top dark:border-white/5"
                        >
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {normalizeMeasurementLabel(row.label)}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {normalizeMeasurementKey(row.key)}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {formatCategory(row.category)} · {formatGender(row.gender)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass}`}
                              >
                                {formatMeasurementLifecycleStatusLabel(row.status)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  row.isActive
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                                    : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                                }`}
                              >
                                {row.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                            {row.source === 'BRAND_FREEFORM'
                              ? 'Brand freeform'
                              : 'System seeded'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                            <div className="font-semibold">{submittedBy}</div>
                            {row.brand?.name ? (
                              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                Brand: {row.brand.name}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                            <div>{formatDate(row.createdAt)}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              Updated {formatDate(row.updatedAt)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                void openMeasurementLifecycle(row);
                              }}
                              className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200"
                            >
                              Open lifecycle
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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

      <Modal
        open={Boolean(selectedMeasurementPoint)}
        onClose={() => {
          setSelectedMeasurementPoint(null);
          setSelectedMeasurementLifecycle(null);
          setMeasurementLifecycleRejectReason('');
          setMeasurementLifecycleModalLoading(false);
          setMeasurementLifecycleActionLoading(false);
        }}
        title={
          selectedMeasurementPoint
            ? `Measurement Lifecycle • ${normalizeMeasurementLabel(selectedMeasurementPoint.label)}`
            : 'Measurement Lifecycle'
        }
        size="lg"
        backdropStyle="light"
      >
        {measurementLifecycleModalLoading || !selectedMeasurementLifecycle ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                  {normalizeMeasurementKey(selectedMeasurementLifecycle.point.key)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    selectedMeasurementLifecycle.point.status === 'APPROVED_GLOBAL'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : selectedMeasurementLifecycle.point.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                  }`}
                >
                  {formatMeasurementLifecycleStatusLabel(selectedMeasurementLifecycle.point.status)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    selectedMeasurementLifecycle.point.isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {selectedMeasurementLifecycle.point.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  {selectedMeasurementLifecycle.point.source === 'BRAND_FREEFORM'
                    ? 'Brand freeform'
                    : 'System seeded'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Created:</span>{' '}
                  {formatDateTime(selectedMeasurementLifecycle.point.createdAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Updated:</span>{' '}
                  {formatDateTime(selectedMeasurementLifecycle.point.updatedAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Submitted:</span>{' '}
                  {formatDateTime(selectedMeasurementLifecycle.point.submittedAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Reviewed:</span>{' '}
                  {formatDateTime(selectedMeasurementLifecycle.point.reviewedAt)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-slate-500 dark:text-slate-400">Users</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {selectedMeasurementLifecycle.usage.distinctUsersCount}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-slate-500 dark:text-slate-400">Collections (ID)</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {selectedMeasurementLifecycle.usage.collectionUsageCountById}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-slate-500 dark:text-slate-400">Collections (Key)</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {selectedMeasurementLifecycle.usage.collectionUsageCountByKey}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-slate-500 dark:text-slate-400">Products (ID)</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {selectedMeasurementLifecycle.usage.productUsageCountById}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-slate-500 dark:text-slate-400">Products (Key)</div>
                <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {selectedMeasurementLifecycle.usage.productUsageCountByKey}
                </div>
              </div>
            </div>

            {selectedMeasurementLifecycle.point.rejectionReason ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                <span className="font-semibold">Latest rejection reason:</span>{' '}
                {selectedMeasurementLifecycle.point.rejectionReason}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Rejection feedback
              </label>
              <textarea
                value={measurementLifecycleRejectReason}
                onChange={(event) =>
                  setMeasurementLifecycleRejectReason(event.target.value)
                }
                rows={2}
                placeholder="Required when rejecting this measurement point"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  void applyMeasurementLifecycleAction('approve');
                }}
                disabled={measurementLifecycleActionLoading}
                className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
              >
                Approve Global
              </button>
              <button
                type="button"
                onClick={() => {
                  void applyMeasurementLifecycleAction('reject');
                }}
                disabled={measurementLifecycleActionLoading}
                className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/20 dark:text-rose-200"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  void applyMeasurementLifecycleAction(
                    selectedMeasurementLifecycle.point.isActive
                      ? 'deactivate'
                      : 'activate',
                  );
                }}
                disabled={measurementLifecycleActionLoading}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-60 dark:bg-white/10 dark:text-slate-200"
              >
                {selectedMeasurementLifecycle.point.isActive
                  ? 'Deactivate'
                  : 'Activate'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Used by whom
                </div>
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
                  {selectedMeasurementLifecycle.usage.users.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      No usage actors yet.
                    </div>
                  ) : (
                    selectedMeasurementLifecycle.usage.users
                      .slice(0, 25)
                      .map((actor) => (
                        <div
                          key={actor.userId}
                          className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {actor.brandFullName || actor.username || actor.userId}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            Usage {actor.usageCount} · Last used {formatDate(actor.latestUsedAt)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Lifecycle timeline
                </div>
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
                  {selectedMeasurementLifecycle.timeline.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      No lifecycle events.
                    </div>
                  ) : (
                    selectedMeasurementLifecycle.timeline.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {event.summary}
                        </div>
                        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {formatDateTime(event.at)} · {event.type}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Collection references
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {selectedMeasurementLifecycle.references.collections.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      No collections reference this point.
                    </div>
                  ) : (
                    selectedMeasurementLifecycle.references.collections
                      .slice(0, 30)
                      .map((collection) => (
                        <div
                          key={collection.id}
                          className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {collection.title || collection.id}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {collection.status} · {collection.visibility} · Updated {formatDate(collection.updatedAt)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Product references
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {selectedMeasurementLifecycle.references.products.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      No products reference this point.
                    </div>
                  ) : (
                    selectedMeasurementLifecycle.references.products
                      .slice(0, 30)
                      .map((product) => (
                        <div
                          key={product.id}
                          className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {product.name}
                          </div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {product.isActive ? 'Active' : 'Inactive'} · {product.brandName} · Updated {formatDate(product.updatedAt)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
