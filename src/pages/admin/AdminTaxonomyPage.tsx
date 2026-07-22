import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminAuditApi, adminModerationApi, adminTaxonomyApi } from '@/api/AdminApi';
import { customOrdersAdminApi, type CustomFabricRuleBasis } from '@/api/CustomOrderApi';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import type {
  AdminAuditLog,
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

type PendingSizeChart = {
  id: string;
  brandId?: string;
  name?: string | null;
  version?: number | null;
  status?: string;
  notes?: string | null;
  data?: unknown;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ModerationQueueResponse = {
  freeformPoints?: AdminMeasurementPointRow[];
  sizeCharts?: PendingSizeChart[];
};

type MeasurementSortMode = 'CATEGORY_ORDER' | 'ALPHA' | 'RANGE_ASC' | 'RANGE_DESC';
type MeasurementViewMode = 'cards' | 'list';
type MeasurementUnitMode = 'CM' | 'IN';
type MeasurementLifecycleSortMode = 'recent' | 'oldest' | 'updated' | 'label';
type MeasurementLifecycleActiveMode = 'all' | 'active' | 'inactive';
type MeasurementLifecycleStatusMode = 'all' | 'brand_only' | 'approved_global' | 'rejected';
type MeasurementLifecycleSourceMode = 'all' | 'brand_freeform' | 'system';
type MeasurementLifecycleAction = 'approve' | 'reject' | 'activate' | 'deactivate';
const PENDING_QUEUE_PAGE_SIZE = 10;

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
  const canReadAuditLogs = hasPermission('AUDIT_READ');
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
  const [freeformPoints, setFreeformPoints] = useState<AdminMeasurementPointRow[]>([]);
  const [sizeCharts, setSizeCharts] = useState<PendingSizeChart[]>([]);
  const [freeformQueuePage, setFreeformQueuePage] = useState(1);
  const [sizeChartQueuePage, setSizeChartQueuePage] = useState(1);
  const [selectedSizeChart, setSelectedSizeChart] = useState<PendingSizeChart | null>(null);
  const [selectedSizeChartHistory, setSelectedSizeChartHistory] = useState<AdminAuditLog[]>([]);
  const [selectedSizeChartLoading, setSelectedSizeChartLoading] = useState(false);
  const [sizeChartRejectReason, setSizeChartRejectReason] = useState('');

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

  const [reviewingIds, setReviewingIds] = useState<Record<string, boolean>>({});
  const debouncedMeasurementLifecycleSearch = useDebounce(measurementLifecycleSearch, 300);
  const freeformQueueTotalPages = useMemo(
    () => Math.max(1, Math.ceil(freeformPoints.length / PENDING_QUEUE_PAGE_SIZE)),
    [freeformPoints.length],
  );
  const sizeChartQueueTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sizeCharts.length / PENDING_QUEUE_PAGE_SIZE)),
    [sizeCharts.length],
  );
  const pagedFreeformPoints = useMemo(() => {
    const start = (freeformQueuePage - 1) * PENDING_QUEUE_PAGE_SIZE;
    return freeformPoints.slice(start, start + PENDING_QUEUE_PAGE_SIZE);
  }, [freeformPoints, freeformQueuePage]);
  const pagedSizeCharts = useMemo(() => {
    const start = (sizeChartQueuePage - 1) * PENDING_QUEUE_PAGE_SIZE;
    return sizeCharts.slice(start, start + PENDING_QUEUE_PAGE_SIZE);
  }, [sizeCharts, sizeChartQueuePage]);
  const selectedSizeChartTimeline = useMemo(() => {
    if (!selectedSizeChart) return [];

    type TimelineEntry = {
      id: string;
      at: string;
      summary: string;
      type: string;
    };

    const events: TimelineEntry[] = [];
    if (selectedSizeChart.createdAt) {
      events.push({
        id: `size-chart-created:${selectedSizeChart.id}`,
        at: selectedSizeChart.createdAt,
        type: 'CREATED',
        summary: 'Size chart request submitted by brand.',
      });
    }
    if (
      selectedSizeChart.updatedAt &&
      selectedSizeChart.createdAt &&
      selectedSizeChart.updatedAt !== selectedSizeChart.createdAt
    ) {
      events.push({
        id: `size-chart-updated:${selectedSizeChart.id}`,
        at: selectedSizeChart.updatedAt,
        type: 'UPDATED',
        summary: 'Size chart request data updated.',
      });
    }
    if (selectedSizeChart.publishedAt) {
      events.push({
        id: `size-chart-published:${selectedSizeChart.id}`,
        at: selectedSizeChart.publishedAt,
        type: 'PUBLISHED',
        summary: 'Size chart published.',
      });
    }

    selectedSizeChartHistory.forEach((entry) => {
      const nextState =
        entry.newState && typeof entry.newState === 'object'
          ? (entry.newState as Record<string, unknown>)
          : null;
      const statusValue =
        nextState && typeof nextState.status === 'string' ? nextState.status : null;
      const reasonValue =
        nextState && typeof nextState.reason === 'string' ? nextState.reason : null;
      const statusSummary = statusValue
        ? `Moderation status changed to ${statusValue}.`
        : `Moderation action ${entry.action} applied.`;
      const summary = reasonValue?.trim()
        ? `${statusSummary} Reason: ${reasonValue.trim()}`
        : statusSummary;
      events.push({
        id: entry.id,
        at: entry.createdAt,
        type: entry.action,
        summary,
      });
    });

    return events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [selectedSizeChart, selectedSizeChartHistory]);

  useEffect(() => {
    setFreeformQueuePage((current) => Math.min(current, freeformQueueTotalPages));
  }, [freeformQueueTotalPages]);

  useEffect(() => {
    setSizeChartQueuePage((current) => Math.min(current, sizeChartQueueTotalPages));
  }, [sizeChartQueueTotalPages]);

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

  const closeSizeChartDetails = useCallback(() => {
    setSelectedSizeChart(null);
    setSelectedSizeChartHistory([]);
    setSelectedSizeChartLoading(false);
    setSizeChartRejectReason('');
  }, []);

  const openSizeChartDetails = useCallback(
    async (chart: PendingSizeChart) => {
      setSelectedSizeChart(chart);
      setSelectedSizeChartHistory([]);
      setSelectedSizeChartLoading(true);
      setSizeChartRejectReason('');
      try {
        if (!canReadAuditLogs) {
          return;
        }
        const response = await adminAuditApi.list({
          limit: '80',
          targetType: 'BrandSizeChart',
          targetId: chart.id,
        });
        const payload = unwrapApiResponse<
          { items?: AdminAuditLog[] } | AdminAuditLog[]
        >(response.data as any);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        setSelectedSizeChartHistory(rows);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || 'Failed to load size chart request history',
        );
      } finally {
        setSelectedSizeChartLoading(false);
      }
    },
    [canReadAuditLogs],
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
      title: `${isActive ? "Deactivate" : "Activate"} ${subCategory.name}?`,
      message: isActive
        ? "This sub-category will no longer appear in active taxonomy lists."
        : "This sub-category will be visible in active taxonomy lists again.",
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

  const handleReviewSizeChart = async (
    chartId: string,
    action: "approve" | "reject",
    reason?: string,
  ) => {
    if (!canReviewModerationQueue) {
      toast.error('You do not have permission to review size charts.');
      return;
    }

    const rejectReason = String(reason ?? '').trim();
    if (action === 'reject' && !rejectReason) {
      toast.error('Reason is required when rejecting a size chart.');
      return;
    }

    setReviewingIds((current) => ({ ...current, [chartId]: true }));

    try {
      await adminModerationApi.reviewItem(chartId, {
        action,
        reason: action === 'reject' ? rejectReason : undefined,
      });
      toast.success(action === 'approve' ? 'Size chart published.' : 'Size chart sent back for revision.');
      setSizeCharts((current) => current.filter((chart) => chart.id !== chartId));
      if (selectedSizeChart?.id === chartId) {
        closeSizeChartDetails();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to review size chart');
    } finally {
      setReviewingIds((current) => ({ ...current, [chartId]: false }));
    }
  };

  void [
    formatGender,
    globalYardBasisSaving,
    globalYardBasisLoading,
    setMeasurementLifecycleSearch,
    setMeasurementLifecycleSortMode,
    setMeasurementLifecycleStatusMode,
    setMeasurementLifecycleSourceMode,
    saveGlobalYardBasis,
    startEditingGlobalYardBasis,
    deleteGlobalYardBasis,
    availableMeasurementKeyOptions,
    sortedGlobalYardBases,
    configurationGenderOptions,
    converterUnitOptions,
    measurementLifecycleSortOptions,
    measurementLifecycleStatusOptions,
    measurementLifecycleSourceOptions,
  ];

  return (
    <div className="min-w-0 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Taxonomy</span>
              <span>/</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isMeasurementsRoute ? 'Measurement Library' : 'Garment Categories'}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {isMeasurementsRoute ? 'Measurement Library' : 'Garment Categories'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {isMeasurementsRoute
                ? 'Define and validate global measurement points for industrial garment production. Approve brand-submitted points to ensure universal sizing standards.'
                : 'Garment categories define what the item is. Garment subcategories define the specific item type. Do not use audience, occasion, style, cultural, price, or service terms as categories.'}
            </p>
          </div>

          {activeTab !== 'custom-order-configurations' && (
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActiveTab('taxonomy')}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeTab === 'taxonomy'
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Garment categories
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('measurements')}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                  activeTab === 'measurements'
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Measurement Points
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Context Alert Banner - Standardization Protocol */}
      <div className="flex items-start gap-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">Standardization Protocol</h3>
          <p className="mt-1 text-xs leading-relaxed text-indigo-900/80 dark:text-indigo-300/90">
            Approving a measurement point makes it globally available for all manufacturers and size charts. Rejected points require clear documentation for resubmission. Universal points (marked with blue badges) are immutable core standards.
          </p>
        </div>
      </div>

      {activeTab === 'taxonomy' ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                {activeCategoryCount} active garment categories
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                {categories.length} total
              </span>
              {showInactive ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  Including inactive
                </span>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-[320px]">
                <input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search garment categories..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <svg className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Show inactive
              </label>

              <button
                type="button"
                onClick={openCreateCategory}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create category
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
            <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    <th className="px-6 py-4 font-bold">Garment Category</th>
                    <th className="px-5 py-4 font-bold">Status</th>
                    <th className="px-5 py-4 font-bold font-semibold">Subcategories</th>
                    <th className="px-6 py-4 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredCategories.map((category) => {
                    const subCategories = (subCategoryMap[category.id] ?? []).filter((subCategory) =>
                      showInactive ? true : subCategory.isActive !== false,
                    );
                    const isCategoryActive = category.isActive !== false;

                    return (
                      <tr
                        key={category.id}
                        className="align-top transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white">{category.name}</div>
                          {category.description ? (
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{category.description}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                              isCategoryActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                                : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isCategoryActive ? 'bg-emerald-600' : 'bg-slate-500'}`} />
                            {isCategoryActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                              {subCategories.length} subcategories
                            </span>
                            <button
                              type="button"
                              onClick={() => openSubCategoryManager(category)}
                              className="rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-200"
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <details className="relative inline-block text-left">
                            <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">
                              ⋯
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => openCreateSubCategory(category)}
                                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                              >
                                Add garment type
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCategory(category)}
                                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                              >
                                Edit category
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCategoryActive(category)}
                                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
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
                        No garment categories found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'measurements' ? (
        <section className="space-y-6">
          {/* Measurement Points Search & Toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
                {allMeasurementPoints.length} measurement points
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                Unit: {measurementUnitMode}
              </span>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[260px]">
                <input
                  value={measurementSearch}
                  onChange={(event) => setMeasurementSearch(event.target.value)}
                  placeholder="Search measurement points..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 pl-9 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <UniversalSelect
                value={measurementSortMode}
                onChange={(val) => setMeasurementSortMode(val as any)}
                options={measurementSortOptions}
                className="w-full sm:w-44"
              />

              {/* Unit Switcher IN / CM */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMeasurementUnitMode('IN')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    measurementUnitMode === 'IN'
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  in
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementUnitMode('CM')}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    measurementUnitMode === 'CM'
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  cm
                </button>
              </div>

              {/* View Mode Toggle Cards vs List */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMeasurementViewMode('cards')}
                  className={`rounded-lg p-1.5 transition ${
                    measurementViewMode === 'cards'
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                  title="Card View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementViewMode('list')}
                  className={`rounded-lg p-1.5 transition ${
                    measurementViewMode === 'list'
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                  title="List View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={fetchTaxonomy}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                title="Refresh"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Pending Moderation Queues Section */}
          {canReviewModerationQueue && (freeformPoints.length > 0 || sizeCharts.length > 0) && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Freeform Points Queue */}
              {freeformPoints.length > 0 && (
                <div className="rounded-3xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                      Pending Freeform Points ({freeformPoints.length})
                    </h3>
                    {queueLoading && <span className="text-xs text-amber-600">Syncing...</span>}
                  </div>
                  {queueError && <p className="mb-2 text-xs text-rose-600">{queueError}</p>}
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {pagedFreeformPoints.map((point) => (
                      <div key={point.id} className="flex items-center justify-between rounded-2xl border border-amber-200/60 bg-white p-3 shadow-xs dark:border-amber-500/20 dark:bg-slate-900">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{point.label}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Category: {formatCategory(point.category)} · Key: {point.key}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openMeasurementLifecycle(point)}
                            className="rounded-xl bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Size Charts Queue */}
              {sizeCharts.length > 0 && (
                <div className="rounded-3xl border border-indigo-200/80 bg-indigo-50/40 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                      Pending Brand Size Charts ({sizeCharts.length})
                    </h3>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {pagedSizeCharts.map((chart) => (
                      <div key={chart.id} className="flex items-center justify-between rounded-2xl border border-indigo-200/60 bg-white p-3 shadow-xs dark:border-indigo-500/20 dark:bg-slate-900">
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{chart.name || 'Untitled chart'}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Version: {chart.version ?? 1} · Status: {chart.status ?? 'PENDING'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openSizeChartDetails(chart)}
                            className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewSizeChart(chart.id, 'approve')}
                            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Measurement Points Main Grid / List Display */}
          {measurementPointsLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-36 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/10" />
              ))}
            </div>
          ) : measurementViewMode === 'cards' ? (
            <div className="space-y-6">
              {pointsByCategory.map((group) => (
                <div key={group.category} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2 dark:border-white/10">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatCategory(group.category)}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {group.points.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.points.map((pt) => {
                      const minVal = pt.minValueCm ?? 0;
                      const maxVal = pt.maxValueCm ?? 100;
                      const displayMin = formatMeasurementValue(minVal, measurementUnitMode);
                      const displayMax = formatMeasurementValue(maxVal, measurementUnitMode);

                      return (
                        <div
                          key={pt.id}
                          className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-indigo-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-indigo-500/40"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  {pt.key}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {pt.label}
                                </h4>
                              </div>
                              {pt.source === 'SYSTEM' && (
                                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                  Universal
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                              {pt.description || 'Global industrial measurement point standard.'}
                            </p>
                          </div>

                          {/* Range Visualizer Bar */}
                          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/5">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>Range ({measurementUnitMode.toLowerCase()})</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {displayMin} – {displayMax}
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: '70%' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List Mode Table */
            <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    <th className="px-6 py-4 font-bold">Key</th>
                    <th className="px-6 py-4 font-bold">Measurement Point</th>
                    <th className="px-5 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Default Range ({measurementUnitMode.toLowerCase()})</th>
                    <th className="px-5 py-4 text-right font-bold">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {allMeasurementPoints.map((pt) => {
                    const minVal = pt.minValueCm ?? 0;
                    const maxVal = pt.maxValueCm ?? 100;
                    const displayMin = formatMeasurementValue(minVal, measurementUnitMode);
                    const displayMax = formatMeasurementValue(maxVal, measurementUnitMode);

                    return (
                      <tr key={pt.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5">
                        <td className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400">{pt.key}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white">{pt.label}</div>
                          {pt.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{pt.description}</div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                            {formatCategory(pt.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {displayMin} – {displayMax}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {pt.source === 'SYSTEM' ? (
                            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              Universal
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-400">
                              Custom
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Measurement Lifecycle Management Table */}
          <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Measurement Point Lifecycle & Audit Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track governance history, approvals, and active visibility of measurement points.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <UniversalSelect
                  value="all"
                  onChange={(val) => setMeasurementLifecycleCategoryMode(val as any)}
                  options={measurementLifecycleCategoryOptions}
                  className="w-40 text-xs"
                />
                <UniversalSelect
                  value="all"
                  onChange={(val) => setMeasurementLifecycleActiveMode(val as any)}
                  options={measurementLifecycleActiveOptions}
                  className="w-36 text-xs"
                />
              </div>
            </div>

            {measurementLifecycleError && (
              <p className="mb-3 text-xs text-rose-600">{measurementLifecycleError}</p>
            )}

            {measurementLifecycleLoading ? (
              <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/10" />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 bg-slate-50/50 text-left uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-bold">Key</th>
                      <th className="px-4 py-3 font-bold">Point Label</th>
                      <th className="px-4 py-3 font-bold">Category</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {measurementLifecycleRows.slice(0, 10).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{row.key}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.label}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatCategory(row.category)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instant Unit Converter Card */}
          <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-6 shadow-sm dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                  Precision Conversion Calculator
                </h4>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80">
                  Instantly convert between Inches (in) and Centimeters (cm) for sizing specs.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={converterInput}
                  onChange={(e) => setConverterInput(e.target.value)}
                  placeholder="Enter value"
                  className="w-28 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setConverterFromUnit(converterFromUnit === 'IN' ? 'CM' : 'IN')}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-700 shadow-xs dark:bg-slate-800 dark:text-indigo-300"
                >
                  {converterFromUnit} → {converterFromUnit === 'IN' ? 'CM' : 'IN'}
                </button>
                <div className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow-sm">
                  = {convertMeasurement(parseFloat(converterInput) || 0, converterFromUnit, converterFromUnit === 'IN' ? 'CM' : 'IN').toFixed(2)} {converterFromUnit === 'IN' ? 'cm' : 'in'}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <Modal
        open={Boolean(showCategoryCreate)}
        onClose={() => {
          setShowCategoryCreate(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? `Edit ${editingCategory.name}` : 'Create garment category'}
        size="sm"
        backdropStyle="light"
      >
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Garment category name</label>
            <input
              value={categoryFormName}
              onChange={(event) => setCategoryFormName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              value={categoryFormDescription}
              onChange={(event) => setCategoryFormDescription(event.target.value)}
              rows={3}
              required
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
              disabled={categorySaving || !categoryFormName.trim() || !categoryFormDescription.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {categorySaving ? 'Saving...' : editingCategory ? 'Update garment category' : 'Create garment category'}
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
        title={editingSubCategory ? `Edit ${editingSubCategory.name}` : `Add garment type to ${showSubCategoryCreateFor?.name ?? ''}`}
        size="sm"
        backdropStyle="light"
      >
        <form onSubmit={saveSubCategory} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Garment type name</label>
            <input
              value={subCategoryFormName}
              onChange={(event) => setSubCategoryFormName(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              value={subCategoryFormDescription}
              onChange={(event) => setSubCategoryFormDescription(event.target.value)}
              rows={3}
              required
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
              disabled={subCategorySaving || !subCategoryFormName.trim() || !subCategoryFormDescription.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {subCategorySaving ? 'Saving...' : editingSubCategory ? 'Update garment type' : 'Create garment type'}
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
                  setSelectedMeasurementPoint(null);
                  setSelectedMeasurementLifecycle(null);
                  setMeasurementLifecycleRejectReason('');
                  setMeasurementLifecycleModalLoading(false);
                  setMeasurementLifecycleActionLoading(false);
                }}
                disabled={measurementLifecycleActionLoading}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              {canReviewMeasurementLifecycle ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void applyMeasurementLifecycleAction('approve');
                    }}
                    disabled={measurementLifecycleActionLoading}
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    Approve
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
                </>
              ) : (
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Read-only: no review permission
                </span>
              )}
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
                  setSelectedMeasurementPoint(null);
                  setSelectedMeasurementLifecycle(null);
                  setMeasurementLifecycleRejectReason('');
                  setMeasurementLifecycleModalLoading(false);
                  setMeasurementLifecycleActionLoading(false);
                }}
                disabled={measurementLifecycleActionLoading}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              {canReviewMeasurementLifecycle ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void applyMeasurementLifecycleAction('approve');
                    }}
                    disabled={measurementLifecycleActionLoading}
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    Approve
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
                </>
              ) : (
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Read-only: no review permission
                </span>
              )}
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
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(selectedSizeChart)}
        onClose={closeSizeChartDetails}
        title={
          selectedSizeChart
            ? `Size Chart Request • ${selectedSizeChart.name ?? `Version ${selectedSizeChart.version ?? '—'}`}`
            : 'Size Chart Request'
        }
        size="lg"
        backdropStyle="light"
      >
        {selectedSizeChart ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">ID:</span>{' '}
                  {selectedSizeChart.id}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Brand:</span>{' '}
                  {selectedSizeChart.brandId ?? '—'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span>{' '}
                  {selectedSizeChart.status ?? 'PENDING'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Version:</span>{' '}
                  {selectedSizeChart.version ?? '—'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Created:</span>{' '}
                  {formatDateTime(selectedSizeChart.createdAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Updated:</span>{' '}
                  {formatDateTime(selectedSizeChart.updatedAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Published:</span>{' '}
                  {formatDateTime(selectedSizeChart.publishedAt)}
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Notes:</span>{' '}
                {selectedSizeChart.notes?.trim() || 'No notes provided.'}
              </div>
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Full request payload
                </div>
                <pre className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
{JSON.stringify(selectedSizeChart.data ?? {}, null, 2)}
                </pre>
              </div>
            </div>

            {canReviewModerationQueue ? (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Rejection feedback
                </label>
                <textarea
                  value={sizeChartRejectReason}
                  onChange={(event) => setSizeChartRejectReason(event.target.value)}
                  rows={2}
                  placeholder="Required when rejecting this size chart request"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                Read-only access. You need moderation review permission to approve or reject size chart requests.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeSizeChartDetails}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              {canReviewModerationQueue ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void handleReviewSizeChart(selectedSizeChart.id, 'approve');
                    }}
                    disabled={Boolean(reviewingIds[selectedSizeChart.id])}
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleReviewSizeChart(
                        selectedSizeChart.id,
                        'reject',
                        sizeChartRejectReason,
                      );
                    }}
                    disabled={Boolean(reviewingIds[selectedSizeChart.id])}
                    className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/20 dark:text-rose-200"
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Lifecycle timeline
              </div>
              {selectedSizeChartLoading ? (
                <div className="mt-2 space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-12 animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10"
                    />
                  ))}
                </div>
              ) : selectedSizeChartTimeline.length === 0 ? (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No lifecycle entries available.
                </div>
              ) : (
                <div className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
                  {selectedSizeChartTimeline.map((event) => (
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
                  ))}
                </div>
              )}
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
