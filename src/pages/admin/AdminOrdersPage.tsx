import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import ImageWithFallback from '@/components/ImageWithFallback';
import UniversalSelect from '@/components/forms/UniversalSelect';
import OrderMessagesPanel from '@/components/messaging/OrderMessagesPanel';
import { adminFinanceApi, adminOrdersApi } from '@/api/AdminApi';
import { configApi } from '@/api/ConfigApi';
import {
  customOrdersAdminApi,
  type CustomOrderListItem,
  type CustomOrderStatus,
} from '@/api/CustomOrderApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminCommissionRule,
  AdminStandardOrderDetail,
  AdminStandardOrderListItem,
  AdminStandardOrderListResponse,
} from '@/types/admin';
import {
  CustomOrderBadge,
  CustomOrderKeyValueList,
  formatDateTime,
} from '@/components/custom-orders/CustomOrderUi';

type OrdersTab = 'STANDARD' | 'CUSTOM' | 'COMMISSION';
type OrdersView = 'TABLE' | 'LIST' | 'CARDS';
type CustomSort = 'ATTENTION' | 'NEWEST' | 'OLDEST' | 'AMOUNT_DESC';

const CUSTOM_PAGE_SIZE = 30;

const COMMISSION_CONFIG_KEYS = {
  fallback: 'finance.commission.defaultPercent',
  standard: 'finance.commission.standardOrderPercent',
  custom: 'finance.commission.customOrderPercent',
} as const;

const DEFAULT_STANDARD_COMMISSION = 10;
const DEFAULT_CUSTOM_COMMISSION = 12;

const formatCurrency = (amount: number | string | null | undefined, currency = 'NGN') => {
  const parsed = Number(amount ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(safe);
};

const isLikelyFileId = (value?: string | null) =>
  Boolean(value && !/^https?:/i.test(value) && /^[0-9a-f-]{30,}$/i.test(value));

const safeMediaRef = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeBadgeTone = (value?: string | null) => {
  const normalized = String(value || '').toUpperCase();
  if (
    normalized === 'PAID' ||
    normalized === 'DELIVERED' ||
    normalized === 'COMPLETED' ||
    normalized === 'ACCEPTED'
  ) {
    return 'bg-[#10B981]/10 text-[#10B981] dark:bg-[#10B981]/20 dark:text-[#34D399]';
  }
  if (
    normalized === 'PENDING' ||
    normalized === 'PROCESSING' ||
    normalized === 'IN_PRODUCTION' ||
    normalized === 'IN_TRANSIT'
  ) {
    return 'bg-[#0284C7]/10 text-[#0284C7] dark:bg-[#0284C7]/20 dark:text-[#38BDF8]';
  }
  if (
    normalized === 'FAILED' ||
    normalized === 'CANCELLED' ||
    normalized === 'RETURNED' ||
    normalized === 'DISPUTED' ||
    normalized === 'REFUND_IN_PROGRESS'
  ) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300';
};

const humanizeToken = (value?: string | null) =>
  String(value || 'UNKNOWN')
    .replaceAll('_', ' ')
    .trim();

const normalizePercentInput = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return String(fallback);
  }
  return parsed.toFixed(2).replace(/\.00$/, '');
};

const formatPercent = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '—';
  }
  return `${parsed.toFixed(2).replace(/\.00$/, '')}%`;
};

const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin } = useAdminPermissions();
  const canManageCommission = isSuperAdmin;
  const initialTab = (searchParams.get('tab') || '').toUpperCase();
  const [activeTab, setActiveTab] = useState<OrdersTab>(
    initialTab === 'CUSTOM' ? 'CUSTOM' : initialTab === 'COMMISSION' ? 'COMMISSION' : 'STANDARD',
  );
  const [viewMode, setViewMode] = useState<OrdersView>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [standardStatusFilter, setStandardStatusFilter] = useState('');
  const [customStatusFilter, setCustomStatusFilter] = useState('');
  const [customSort, setCustomSort] = useState<CustomSort>('ATTENTION');
  const [attentionOnly, setAttentionOnly] = useState(searchParams.get('attention') === '1');
  const [customPage, setCustomPage] = useState(1);
  const [customTotal, setCustomTotal] = useState(0);
  const [customAttentionTotal, setCustomAttentionTotal] = useState(0);
  const [customNextCursor, setCustomNextCursor] = useState<string | null>(null);
  const [customCursor, setCustomCursor] = useState<string | undefined>(undefined);
  const [customCursorStack, setCustomCursorStack] = useState<Array<string | undefined>>([]);

  const [standardOrders, setStandardOrders] = useState<AdminStandardOrderListItem[]>([]);
  const [standardSummary, setStandardSummary] = useState<AdminStandardOrderListResponse['summary'] | null>(null);
  const [customOrders, setCustomOrders] = useState<CustomOrderListItem[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);

  const [loadingStandard, setLoadingStandard] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const customRequestSeqRef = useRef(0);
  const standardRequestSeqRef = useRef(0);

  const [selectedStandard, setSelectedStandard] = useState<AdminStandardOrderDetail | null>(null);
  const [standardModalOpen, setStandardModalOpen] = useState(false);
  const [standardDetailLoading, setStandardDetailLoading] = useState(false);
  const [commissionDraft, setCommissionDraft] = useState({
    standard: String(DEFAULT_STANDARD_COMMISSION),
    custom: String(DEFAULT_CUSTOM_COMMISSION),
  });
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionUpdatedAt, setCommissionUpdatedAt] = useState<string | null>(null);
  const [commissionRules, setCommissionRules] = useState<AdminCommissionRule[]>([]);

  const sortParam =
    customSort === 'NEWEST'
      ? 'newest'
      : customSort === 'OLDEST'
        ? 'oldest'
        : customSort === 'AMOUNT_DESC'
          ? 'amount'
          : 'attention';

  const loadStandardOrders = useCallback(async () => {
    const seq = standardRequestSeqRef.current + 1;
    standardRequestSeqRef.current = seq;
    setLoadingStandard(true);
    try {
      const response = await adminOrdersApi.list({
        limit: '30',
        q: deferredSearchQuery.trim() || '',
        status: standardStatusFilter,
      });
      if (standardRequestSeqRef.current !== seq) return;
      const payload = unwrapApiResponse<AdminStandardOrderListResponse>(response.data as any);
      setStandardOrders(Array.isArray(payload?.items) ? payload.items : []);
      setStandardSummary(payload?.summary ?? null);
    } catch (error: any) {
      if (standardRequestSeqRef.current !== seq) return;
      toast.error(error?.response?.data?.message || 'Unable to load standard-order queue');
      setStandardOrders([]);
      setStandardSummary(null);
    } finally {
      if (standardRequestSeqRef.current === seq) {
        setLoadingStandard(false);
      }
    }
  }, [deferredSearchQuery, standardStatusFilter]);

  const loadCustomOrders = useCallback(async () => {
    const seq = customRequestSeqRef.current + 1;
    customRequestSeqRef.current = seq;
    setLoadingCustom(true);
    try {
      const payload = await customOrdersAdminApi.list({
        ...(customCursor
          ? { cursor: customCursor }
          : { page: customPage }),
        limit: CUSTOM_PAGE_SIZE,
        q: deferredSearchQuery.trim() || undefined,
        status: customStatusFilter ? (customStatusFilter as CustomOrderStatus) : undefined,
        attention: attentionOnly ? 1 : undefined,
        sort: sortParam,
      });
      if (customRequestSeqRef.current !== seq) return;
      setCustomOrders(Array.isArray(payload?.items) ? payload.items : []);
      setCustomTotal(Number(payload?.total ?? 0));
      setCustomAttentionTotal(Number(payload?.attentionTotal ?? 0));
      setCustomNextCursor(payload?.nextCursor ?? null);
      setCustomLoaded(true);
    } catch (error: any) {
      if (customRequestSeqRef.current !== seq) return;
      toast.error(error?.response?.data?.message || 'Unable to load custom-order queue');
    } finally {
      if (customRequestSeqRef.current === seq) {
        setLoadingCustom(false);
      }
    }
  }, [customPage, customCursor, customStatusFilter, deferredSearchQuery, attentionOnly, sortParam]);

  useEffect(() => {
    setCustomPage(1);
    setCustomCursor(undefined);
    setCustomCursorStack([]);
    setCustomNextCursor(null);
  }, [customStatusFilter, deferredSearchQuery, attentionOnly, customSort]);

  useEffect(() => {
    const tab = (searchParams.get('tab') || '').toUpperCase();
    if (tab === 'CUSTOM') {
      setActiveTab('CUSTOM');
    } else if (tab === 'COMMISSION') {
      setActiveTab('COMMISSION');
    } else if (tab === 'STANDARD') {
      setActiveTab('STANDARD');
    }
    setAttentionOnly(searchParams.get('attention') === '1');
  }, [searchParams]);

  const loadStandardDetail = useCallback(async (orderId: string) => {
    setStandardModalOpen(true);
    setStandardDetailLoading(true);
    try {
      const response = await adminOrdersApi.getById(orderId);
      setSelectedStandard(unwrapApiResponse<AdminStandardOrderDetail>(response.data as any));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load standard-order detail');
      setSelectedStandard(null);
      setStandardModalOpen(false);
    } finally {
      setStandardDetailLoading(false);
    }
  }, []);

  const loadCommissionConfig = useCallback(async () => {
    if (!canManageCommission) return;

    setCommissionLoading(true);
    try {
      const [configResult, rulesResult] = await Promise.allSettled([
        configApi.listSystemConfig(),
        adminFinanceApi.listCommissionRules(),
      ]);

      if (rulesResult.status !== 'fulfilled') {
        throw rulesResult.reason;
      }

      const entries =
        configResult.status === 'fulfilled' && Array.isArray(configResult.value)
          ? configResult.value
          : [];

      const configMap = new Map(entries.map((entry) => [entry.key, entry]));
      const fallbackValue =
        configMap.get(COMMISSION_CONFIG_KEYS.fallback)?.value ??
        String(DEFAULT_STANDARD_COMMISSION);
      const standardValue =
        configMap.get(COMMISSION_CONFIG_KEYS.standard)?.value ?? fallbackValue;
      const customValue =
        configMap.get(COMMISSION_CONFIG_KEYS.custom)?.value ??
        String(DEFAULT_CUSTOM_COMMISSION);

      setCommissionDraft({
        standard: normalizePercentInput(standardValue, DEFAULT_STANDARD_COMMISSION),
        custom: normalizePercentInput(customValue, DEFAULT_CUSTOM_COMMISSION),
      });

      setCommissionUpdatedAt(
        configMap.get(COMMISSION_CONFIG_KEYS.standard)?.updatedAt ??
          configMap.get(COMMISSION_CONFIG_KEYS.custom)?.updatedAt ??
          configMap.get(COMMISSION_CONFIG_KEYS.fallback)?.updatedAt ??
          null,
      );

      const payload = unwrapApiResponse<AdminCommissionRule[]>(rulesResult.value.data as any);
      setCommissionRules(Array.isArray(payload) ? payload : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load commission configuration');
      setCommissionRules([]);
    } finally {
      setCommissionLoading(false);
    }
  }, [canManageCommission]);

  useEffect(() => {
    if (activeTab === 'STANDARD') {
      void loadStandardOrders();
    }
  }, [activeTab, loadStandardOrders]);

  useEffect(() => {
    if (activeTab === 'CUSTOM') {
      void loadCustomOrders();
    }
  }, [activeTab, loadCustomOrders]);

  useEffect(() => {
    if (activeTab === 'COMMISSION') {
      void loadCommissionConfig();
    }
  }, [activeTab, loadCommissionConfig]);

  const standardMetrics = useMemo(() => {
    if (!standardSummary) {
      return [
        { label: 'TOTAL ORDERS', value: '—' },
        { label: 'PENDING', value: '—' },
        { label: 'IN-FLIGHT', value: '—' },
        { label: 'REVENUE', value: '—' },
      ];
    }

    return [
      { label: 'TOTAL ORDERS', value: String(standardSummary.totalOrders ?? 0) },
      { label: 'PENDING', value: String(standardSummary.pendingCount ?? 0) },
      {
        label: 'IN-FLIGHT',
        value: String((standardSummary.processingCount ?? 0) + (standardSummary.shippedCount ?? 0)),
      },
      {
        label: 'REVENUE',
        value: formatCurrency(standardSummary.totalRevenue ?? 0, 'NGN'),
      },
    ];
  }, [standardSummary]);

  const visibleCustomOrders = useMemo(() => {
    if (customSort !== 'AMOUNT_DESC') {
      return customOrders;
    }
    const amount = (entry: CustomOrderListItem) => Number(entry.buyerPriceSummary?.grandTotal ?? 0);
    return [...customOrders].sort((a, b) => amount(b) - amount(a));
  }, [customOrders, customSort]);

  const customMetrics = useMemo(() => {
    const paid = customOrders.filter(
      (entry) => String(entry.paymentStatus).toUpperCase() === 'PAID',
    );
    const revenue = paid.reduce(
      (sum, entry) => sum + Number(entry.buyerPriceSummary?.grandTotal ?? 0),
      0,
    );
    return [
      { label: 'TOTAL ORDERS', value: String(customTotal || customOrders.length) },
      { label: 'PENDING', value: String(customAttentionTotal) },
      { label: 'IN-FLIGHT', value: String(paid.length) },
      { label: 'REVENUE', value: formatCurrency(revenue, 'NGN') },
    ];
  }, [customOrders, customTotal, customAttentionTotal]);

  const customTotalPages = Math.max(1, Math.ceil((customTotal || 0) / CUSTOM_PAGE_SIZE));
  const canGoPrevCustom = Boolean(customCursor) || customPage > 1;
  const canGoNextCustom = Boolean(customNextCursor) || customPage < customTotalPages;

  const goCustomPrev = () => {
    if (customCursorStack.length > 0) {
      const stack = [...customCursorStack];
      const prev = stack.pop();
      setCustomCursorStack(stack);
      setCustomCursor(prev);
      setCustomPage((p) => Math.max(1, p - 1));
      return;
    }
    setCustomCursor(undefined);
    setCustomPage((prev) => Math.max(1, prev - 1));
  };

  const goCustomNext = () => {
    if (customNextCursor) {
      setCustomCursorStack((stack) => [...stack, customCursor]);
      setCustomCursor(customNextCursor);
      setCustomPage((p) => p + 1);
      return;
    }
    setCustomPage((prev) => Math.min(customTotalPages, prev + 1));
  };

  const customAmount = (entry: CustomOrderListItem) =>
    formatCurrency(
      entry.buyerPriceSummary?.grandTotal,
      entry.buyerPriceSummary?.currency || entry.currency || 'NGN',
    );

  const commissionPreview = useMemo(() => {
    const gross = 100000;
    const standardRate = Number(commissionDraft.standard);
    const customRate = Number(commissionDraft.custom);
    const safeStandardRate = Number.isFinite(standardRate) ? standardRate : DEFAULT_STANDARD_COMMISSION;
    const safeCustomRate = Number.isFinite(customRate) ? customRate : DEFAULT_CUSTOM_COMMISSION;

    return {
      gross,
      standardCommission: (gross * safeStandardRate) / 100,
      standardNet: gross - (gross * safeStandardRate) / 100,
      customCommission: (gross * safeCustomRate) / 100,
      customNet: gross - (gross * safeCustomRate) / 100,
    };
  }, [commissionDraft.custom, commissionDraft.standard]);

  const activeRulePreview = useMemo(
    () => commissionRules.filter((rule) => rule.isActive).slice(0, 8),
    [commissionRules],
  );

  const saveCommissionConfig = useCallback(async () => {
    if (!canManageCommission) return;

    const standardRate = Number(commissionDraft.standard);
    const customRate = Number(commissionDraft.custom);

    if (!Number.isFinite(standardRate) || standardRate <= 0) {
      toast.error('Standard order commission must be a positive number');
      return;
    }

    if (!Number.isFinite(customRate) || customRate <= 0) {
      toast.error('Custom order commission must be a positive number');
      return;
    }

    setCommissionSaving(true);
    try {
      await configApi.bulkUpdateConfig([
        {
          key: COMMISSION_CONFIG_KEYS.standard,
          value: standardRate.toFixed(2),
        },
        {
          key: COMMISSION_CONFIG_KEYS.custom,
          value: customRate.toFixed(2),
        },
        {
          key: COMMISSION_CONFIG_KEYS.fallback,
          value: standardRate.toFixed(2),
        },
      ]);

      toast.success('Commission configuration saved. New rates apply to newly created orders only.');
      await loadCommissionConfig();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save commission configuration');
    } finally {
      setCommissionSaving(false);
    }
  }, [canManageCommission, commissionDraft.custom, commissionDraft.standard, loadCommissionConfig]);

  const renderCommissionWorkspace = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
              SUPER ADMIN COMMISSION CONTROL
            </div>
            <div className="mt-1 font-hanken-grotesk text-sm text-slate-600 dark:text-slate-300">
              Set global platform commission for newly created orders. Existing orders keep the rate resolved from their order creation time.
            </div>
          </div>
          {commissionUpdatedAt ? (
            <div className="font-geist text-xs text-slate-500 dark:text-slate-400">
              Last updated {formatDateTime(commissionUpdatedAt)}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Standard order commission (%)
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={commissionDraft.standard}
              onChange={(event) =>
                setCommissionDraft((prev) => ({ ...prev, standard: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-hanken-grotesk text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <label className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
            <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Custom order commission (%)
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={commissionDraft.custom}
              onChange={(event) =>
                setCommissionDraft((prev) => ({ ...prev, custom: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-hanken-grotesk text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadCommissionConfig()}
            disabled={commissionLoading || commissionSaving}
            className="rounded-full border border-slate-200/80 bg-white px-5 py-2 font-geist text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {commissionLoading ? 'Refreshing...' : 'Refresh config'}
          </button>
          <button
            type="button"
            onClick={() => void saveCommissionConfig()}
            disabled={commissionSaving || commissionLoading}
            className="rounded-full bg-[#0A0A0A] px-6 py-2 font-geist text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {commissionSaving ? 'Saving...' : 'Save commission rates'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Standard order example
          </div>
          <div className="mt-3 space-y-1.5 font-hanken-grotesk text-sm text-slate-700 dark:text-slate-200">
            <div>Gross: {formatCurrency(commissionPreview.gross)}</div>
            <div>Commission ({formatPercent(commissionDraft.standard)}): {formatCurrency(commissionPreview.standardCommission)}</div>
            <div className="font-bold text-slate-900 dark:text-white">Brand net: {formatCurrency(commissionPreview.standardNet)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
          <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Custom order example
          </div>
          <div className="mt-3 space-y-1.5 font-hanken-grotesk text-sm text-slate-700 dark:text-slate-200">
            <div>Gross: {formatCurrency(commissionPreview.gross)}</div>
            <div>Commission ({formatPercent(commissionDraft.custom)}): {formatCurrency(commissionPreview.customCommission)}</div>
            <div className="font-bold text-slate-900 dark:text-white">Brand net: {formatCurrency(commissionPreview.customNet)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Active finance rules snapshot
        </div>
        {commissionLoading ? (
          <div className="mt-3 font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">Loading active rules...</div>
        ) : activeRulePreview.length === 0 ? (
          <div className="mt-3 font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">
            No active explicit commission rules are configured. System config defaults are currently in effect.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {activeRulePreview.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex flex-wrap items-center justify-between gap-2 font-hanken-grotesk">
                  <div className="font-bold text-slate-900 dark:text-white">{rule.name}</div>
                  <div className="font-semibold text-slate-500 dark:text-slate-400">{formatPercent(rule.ratePercent)}</div>
                </div>
                <div className="mt-1 font-hanken-grotesk text-slate-500 dark:text-slate-400">
                  Scope {rule.scope} • Currency {rule.currency || 'ANY'} • Effective {formatDateTime(rule.effectiveFrom)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStandardTable = () => (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-white/5 font-geist text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            <th className="py-3 px-5">ORDER</th>
            <th className="py-3 px-5">BUYER</th>
            <th className="py-3 px-5">BRAND</th>
            <th className="py-3 px-5">LIFECYCLE</th>
            <th className="py-3 px-5">FINANCIAL</th>
          </tr>
        </thead>
        <tbody className="font-hanken-grotesk text-sm text-slate-900 dark:text-white divide-y divide-slate-100/80 dark:divide-white/5 bg-white dark:bg-slate-900">
          {standardOrders.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => void loadStandardDetail(entry.id)}
              className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <td className="py-3.5 px-5 align-middle">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {entry.primaryItemName || 'Standard order'}
                </div>
                <div className="text-slate-400 dark:text-slate-400 mt-0.5 font-geist text-xs">
                  #{entry.id.slice(0, 8).toUpperCase()}
                </div>
              </td>
              <td className="py-3.5 px-5 align-middle">
                <div className="font-medium text-slate-900 dark:text-white">
                  {entry.customerName || 'Customer'}
                </div>
                <div className="text-slate-400 dark:text-slate-400 mt-0.5 text-xs">
                  {entry.customerEmail || 'No email'}
                </div>
              </td>
              <td className="py-3.5 px-5 align-middle">
                <div className="font-medium text-slate-900 dark:text-white">
                  {entry.brand?.name || 'Brand'}
                </div>
              </td>
              <td className="py-3.5 px-5 align-middle">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
                    {entry.paymentStatus}
                  </span>
                </div>
              </td>
              <td className="py-3.5 px-5 align-middle">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(entry.totalAmount, entry.currency || 'NGN')}
                </div>
                <div className="text-slate-400 dark:text-slate-400 mt-0.5 font-geist text-xs">
                  {formatDateTime(entry.createdAt)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderStandardList = () => (
    <div className="space-y-2.5 p-3.5">
      {standardOrders.map((entry) => {
        const thumbnail = safeMediaRef(entry.primaryItemImage);
        const fileId = isLikelyFileId(thumbnail) ? thumbnail : undefined;
        const src = fileId ? undefined : thumbnail;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => void loadStandardDetail(entry.id)}
            className="w-full rounded-xl border border-slate-100 dark:border-white/5 bg-white p-3.5 text-left shadow-2xs transition hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-white/[0.04]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-slate-950 flex-shrink-0">
                  {thumbnail ? (
                    <ImageWithFallback
                      src={src}
                      fileId={fileId}
                      alt={entry.primaryItemName || 'Standard order item'}
                      className="h-full w-full object-cover"
                      containerClassName="h-full w-full"
                      rounded="none"
                      fit="cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-slate-400">🧵</div>
                  )}
                </div>
                <div>
                  <div className="font-hanken-grotesk font-semibold text-slate-900 dark:text-white text-sm">
                    {entry.primaryItemName || `Order #${entry.id.slice(0, 8).toUpperCase()}`}
                  </div>
                  <div className="mt-0.5 font-hanken-grotesk text-xs text-slate-500 dark:text-slate-400">
                    {entry.customerName} • {entry.brand?.name || 'Brand'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-hanken-grotesk font-bold text-slate-900 dark:text-white text-sm">
                  {formatCurrency(entry.totalAmount, entry.currency || 'NGN')}
                </div>
                <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
                    {entry.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderStandardCards = () => (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 p-3.5">
      {standardOrders.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => void loadStandardDetail(entry.id)}
          className="rounded-xl border border-slate-100 dark:border-white/5 bg-white p-4 text-left shadow-2xs transition hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-white/[0.04]"
        >
          <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            #{entry.id.slice(0, 8).toUpperCase()}
          </div>
          <div className="mt-1.5 font-hanken-grotesk font-bold text-slate-900 dark:text-white text-sm">
            {entry.primaryItemName || 'Standard order'}
          </div>
          <div className="mt-0.5 font-hanken-grotesk text-xs text-slate-500 dark:text-slate-400">
            {entry.customerName} • {entry.brand?.name || 'Brand'}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.status)}`}>
              {entry.status}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
              {entry.paymentStatus}
            </span>
          </div>
          <div className="mt-3 font-hanken-grotesk font-extrabold text-slate-900 dark:text-white text-base">
            {formatCurrency(entry.totalAmount, entry.currency || 'NGN')}
          </div>
        </button>
      ))}
    </div>
  );

  const renderCustomTable = () => (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-white/5 font-geist text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            <th className="py-3 px-5">ORDER</th>
            <th className="py-3 px-5">BUYER</th>
            <th className="py-3 px-5">BRAND</th>
            <th className="py-3 px-5">LIFECYCLE</th>
            <th className="py-3 px-5">FINANCIAL</th>
          </tr>
        </thead>
        <tbody className="font-hanken-grotesk text-sm text-slate-900 dark:text-white divide-y divide-slate-100/80 dark:divide-white/5 bg-white dark:bg-slate-900">
          {visibleCustomOrders.map((entry) => {
            const flagged = Boolean(entry.adminAttentionRequiredAt);
            return (
              <tr
                key={entry.id}
                onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
                className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${
                  flagged
                    ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.06]'
                    : ''
                }`}
              >
                <td className="py-3.5 px-5 align-middle">
                  <div className="flex items-center gap-2">
                    {flagged ? (
                      <span className="motion-safe:animate-pulse text-base leading-none" title="Needs admin review" aria-label="Needs admin review">🚩</span>
                    ) : null}
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {entry.sourceTitle || 'Custom order configuration'}
                    </div>
                  </div>
                  <div className="text-slate-400 dark:text-slate-400 mt-0.5 font-geist text-xs">
                    #{entry.id.slice(0, 8).toUpperCase()}
                  </div>
                </td>
                <td className="py-3.5 px-5 align-middle">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {entry.buyer?.name || 'Buyer'}
                  </div>
                  <div className="text-slate-400 dark:text-slate-400 mt-0.5 text-xs">
                    {entry.buyer?.email || 'No email'}
                  </div>
                </td>
                <td className="py-3.5 px-5 align-middle">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {entry.brand.name || 'Brand'}
                  </div>
                </td>
                <td className="py-3.5 px-5 align-middle">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CustomOrderBadge value={entry.status} />
                    <CustomOrderBadge value={entry.currentProgressStage || 'ORDER_PLACED'} type="stage" />
                  </div>
                </td>
                <td className="py-3.5 px-5 align-middle">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {customAmount(entry)}
                  </div>
                  <div className="text-slate-400 dark:text-slate-400 mt-0.5 font-geist text-xs font-semibold uppercase">
                    {entry.paymentStatus}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCustomList = () => (
    <div className="space-y-2.5 p-3.5">
      {visibleCustomOrders.map((entry) => {
        const flagged = Boolean(entry.adminAttentionRequiredAt);
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
            className={`w-full rounded-xl border p-3.5 text-left transition hover:bg-slate-50/80 dark:hover:bg-white/[0.04] ${
              flagged
                ? 'border-rose-300/60 bg-rose-500/[0.04] dark:border-rose-500/30 dark:bg-rose-500/[0.06]'
                : 'border-slate-100 bg-white dark:border-white/5 dark:bg-slate-900'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {flagged ? <span className="motion-safe:animate-pulse text-base leading-none" aria-label="Needs admin review">🚩</span> : null}
                  <div className="font-hanken-grotesk font-semibold text-slate-900 dark:text-white text-sm">
                    {entry.sourceTitle || 'Custom order configuration'}
                  </div>
                </div>
                <div className="mt-0.5 font-hanken-grotesk text-xs text-slate-500 dark:text-slate-400">
                  Buyer: {entry.buyer?.name || 'Buyer'} • Brand: {entry.brand.name || 'Brand'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-hanken-grotesk font-bold text-slate-900 dark:text-white text-sm">
                  {customAmount(entry)}
                </div>
                <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                  <CustomOrderBadge value={entry.status} />
                  <CustomOrderBadge value={entry.paymentStatus} type="payment" />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderCustomCards = () => (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 p-3.5">
      {visibleCustomOrders.map((entry) => {
        const flagged = Boolean(entry.adminAttentionRequiredAt);
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
            className={`rounded-xl border p-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-white/[0.04] ${
              flagged
                ? 'border-rose-300/60 bg-rose-500/[0.04] dark:border-rose-500/30 dark:bg-rose-500/[0.06]'
                : 'border-slate-100 bg-white dark:border-white/5 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-geist text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                #{entry.id.slice(0, 8).toUpperCase()}
              </div>
              {flagged ? <span className="motion-safe:animate-pulse text-base leading-none" aria-label="Needs admin review">🚩</span> : null}
            </div>
            <div className="mt-1.5 font-hanken-grotesk font-bold text-slate-900 dark:text-white text-sm">
              {entry.sourceTitle || 'Custom order configuration'}
            </div>
            <div className="mt-0.5 font-hanken-grotesk text-xs text-slate-500 dark:text-slate-400">
              {entry.brand.name || 'Brand'}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <CustomOrderBadge value={entry.status} />
              <CustomOrderBadge value={entry.currentProgressStage || 'ORDER_PLACED'} type="stage" />
            </div>
            <div className="mt-3 font-hanken-grotesk font-extrabold text-slate-900 dark:text-white text-base">
              {customAmount(entry)}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 font-geist text-xs text-slate-500 dark:text-slate-400">
        <Link to="/admin" className="hover:underline">Dashboard</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-semibold text-slate-900 dark:text-white">Orders</span>
      </nav>

      {/* Page Header & Main Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-geist text-xs font-semibold tracking-widest text-[#10B981] uppercase mb-1 block">
            ADMIN
          </span>
          <h1 className="font-hanken-grotesk text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Orders
          </h1>
          <p className="font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unified order operations across standard checkout orders and custom commissions.
          </p>
        </div>

        <div className="inline-flex items-center bg-slate-100/70 dark:bg-slate-900 rounded-full p-1 border border-slate-100 dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('STANDARD')}
            className={`px-5 py-1.5 rounded-full font-geist text-xs font-semibold transition-colors ${
              activeTab === 'STANDARD'
                ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOM')}
            className={`px-6 py-1.5 rounded-full font-geist text-xs font-semibold transition-colors ${
              activeTab === 'CUSTOM'
                ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Custom
          </button>
          {canManageCommission ? (
            <button
              type="button"
              onClick={() => setActiveTab('COMMISSION')}
              className={`px-5 py-1.5 rounded-full font-geist text-xs font-semibold transition-colors ${
                activeTab === 'COMMISSION'
                  ? 'bg-[#0A0A0A] text-white dark:bg-white dark:text-slate-950 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Commission
            </button>
          ) : null}
        </div>
      </div>

      {/* Stats Grid */}
      {activeTab !== 'COMMISSION' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(activeTab === 'CUSTOM' ? customMetrics : standardMetrics).map((metric) => (
            <div
              key={metric.label}
              className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-white/5 shadow-2xs flex flex-col justify-between min-h-[100px]"
            >
              <span className="font-geist text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {metric.label}
              </span>
              <span className="font-hanken-grotesk font-bold text-2xl text-slate-900 dark:text-white mt-1">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Main Data Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 shadow-2xs overflow-hidden flex flex-col">
        {activeTab === 'COMMISSION' ? (
          <div className="p-6">{renderCommissionWorkspace()}</div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="p-3.5 border-b border-slate-100 dark:border-white/5 flex flex-wrap md:flex-nowrap gap-2.5 justify-between items-center bg-white dark:bg-slate-900">
              <div className="relative w-full sm:w-60 md:w-64 shrink-0">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={activeTab === 'STANDARD' ? 'Search standard orders' : 'Search custom orders'}
                  className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200/60 dark:border-white/10 rounded-xl px-3.5 py-1.5 font-hanken-grotesk text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/60 transition-all shadow-2xs"
                />
              </div>

              <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-none">
                {activeTab === 'STANDARD' ? (
                  <UniversalSelect
                    value={standardStatusFilter}
                    onChange={setStandardStatusFilter}
                    options={[
                      { value: '', label: 'All statuses' },
                      { value: 'PENDING', label: 'Pending' },
                      { value: 'PROCESSING', label: 'Processing' },
                      { value: 'SHIPPED', label: 'Shipped' },
                      { value: 'DELIVERED', label: 'Delivered' },
                      { value: 'RETURNED', label: 'Returned' },
                      { value: 'CANCELLED', label: 'Cancelled' },
                    ]}
                    size="sm"
                    fitContent
                  />
                ) : (
                  <>
                    <UniversalSelect
                      value={customStatusFilter}
                      onChange={setCustomStatusFilter}
                      options={[
                        { value: '', label: 'All statuses' },
                        { value: 'PENDING_BRAND_ACCEPTANCE', label: 'Pending acceptance' },
                        { value: 'ACCEPTED', label: 'Accepted' },
                        { value: 'IN_PRODUCTION', label: 'In production' },
                        { value: 'IN_TRANSIT', label: 'In transit' },
                        { value: 'DELIVERED_PENDING_BUYER_CONFIRMATION', label: 'Pending buyer confirmation' },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'DISPUTED', label: 'Disputed' },
                        { value: 'REFUND_IN_PROGRESS', label: 'Refund in progress' },
                      ]}
                      size="sm"
                      fitContent
                    />
                    <UniversalSelect
                      value={customSort}
                      onChange={(value) => setCustomSort(value as CustomSort)}
                      options={[
                        { value: 'ATTENTION', label: 'Needs review first' },
                        { value: 'NEWEST', label: 'Newest first' },
                        { value: 'OLDEST', label: 'Oldest first' },
                        { value: 'AMOUNT_DESC', label: 'Amount: high to low' },
                      ]}
                      size="sm"
                      fitContent
                    />
                    <button
                      type="button"
                      onClick={() => setAttentionOnly((prev) => !prev)}
                      aria-pressed={attentionOnly}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-geist text-xs font-semibold shrink-0 transition ${
                        attentionOnly
                          ? 'border-rose-300/80 bg-rose-500/10 text-rose-700 dark:border-rose-500/40 dark:text-rose-300'
                          : 'border-slate-200/60 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:text-slate-200'
                      }`}
                    >
                      🚩 Needs review{customAttentionTotal > 0 ? ` (${customAttentionTotal})` : ''}
                    </button>
                  </>
                )}

                <div className="inline-flex items-center bg-slate-100/70 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/60 dark:border-white/10 shrink-0 ml-auto md:ml-0">
                  {(['TABLE', 'LIST', 'CARDS'] as OrdersView[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`px-2.5 py-1 rounded-lg font-geist text-[11px] font-bold tracking-wider transition-colors ${
                        viewMode === mode
                          ? 'bg-[#10B981] text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div>
              {activeTab === 'STANDARD' ? (
                loadingStandard ? (
                  <div className="p-8 text-center font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">
                    Loading standard-order queue...
                  </div>
                ) : standardOrders.length === 0 ? (
                  <div className="p-8 text-center font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">
                    No standard orders match your filter.
                  </div>
                ) : viewMode === 'TABLE' ? (
                  renderStandardTable()
                ) : viewMode === 'LIST' ? (
                  renderStandardList()
                ) : (
                  renderStandardCards()
                )
              ) : loadingCustom && !customLoaded ? (
                <div className="p-8 text-center font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">
                  Loading custom-order queue...
                </div>
              ) : visibleCustomOrders.length === 0 ? (
                <div className="p-8 text-center font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">
                  {attentionOnly ? 'No custom orders currently need review.' : 'No custom orders match your filter.'}
                </div>
              ) : (
                <>
                  <div className={loadingCustom ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
                    {viewMode === 'TABLE'
                      ? renderCustomTable()
                      : viewMode === 'LIST'
                        ? renderCustomList()
                        : renderCustomCards()}
                  </div>

                  <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.01]">
                    <div className="font-geist text-xs text-slate-500 dark:text-slate-400">
                      Page {customPage} of {customTotalPages} • {customTotal}{' '}
                      {attentionOnly ? 'needing review' : 'total'}
                      {!attentionOnly && customAttentionTotal > 0
                        ? ` • ${customAttentionTotal} need review`
                        : ''}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canGoPrevCustom || loadingCustom}
                        onClick={goCustomPrev}
                        className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-geist text-xs font-bold text-slate-700 shadow-xs transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNextCustom || loadingCustom}
                        onClick={goCustomNext}
                        className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-geist text-xs font-bold text-slate-700 shadow-xs transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* Standard Order Detail Modal */}
      <Modal
        open={standardModalOpen}
        onClose={() => {
          setStandardModalOpen(false);
          setSelectedStandard(null);
        }}
        title={selectedStandard ? `🧾 Standard #${selectedStandard.id.slice(0, 8).toUpperCase()}` : '🧾 Standard Order'}
        size="xl"
      >
        {standardDetailLoading || !selectedStandard ? (
          <div className="py-8 font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">Loading standard-order detail...</div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${normalizeBadgeTone(selectedStandard.status)}`}>
                {selectedStandard.status}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${normalizeBadgeTone(selectedStandard.paymentStatus)}`}>
                {selectedStandard.paymentStatus}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 p-3 text-sm dark:border-white/10">
                <div className="font-geist text-xs uppercase tracking-widest text-slate-500">Buyer</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.customerName || 'Buyer'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.customerEmail || 'No email'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-3 text-sm dark:border-white/10">
                <div className="font-geist text-xs uppercase tracking-widest text-slate-500">Seller</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.brand?.name || 'Brand'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.brand?.contactEmail || 'No support email'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-3 text-sm dark:border-white/10">
                <div className="font-geist text-xs uppercase tracking-widest text-slate-500">Order total</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{formatCurrency(selectedStandard.totalAmount, selectedStandard.currency || 'NGN')}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.currency}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-3 text-sm dark:border-white/10">
                <div className="font-geist text-xs uppercase tracking-widest text-slate-500">Payment reference</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.paymentReference || 'Not set'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Paid {formatDateTime(selectedStandard.paidAt)}</div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Lifecycle + fulfillment</div>
                <CustomOrderKeyValueList
                  items={[
                    { label: 'Created', value: formatDateTime(selectedStandard.createdAt) },
                    { label: 'Updated', value: formatDateTime(selectedStandard.updatedAt) },
                    { label: 'Delivered at', value: formatDateTime(selectedStandard.deliveredAt) },
                    { label: 'Shipping address', value: selectedStandard.formattedShippingAddress || 'Not captured' },
                    { label: 'Customer phone', value: selectedStandard.customerPhone || 'Not captured' },
                  ]}
                />
              </div>
              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Finance snapshot</div>
                <CustomOrderKeyValueList
                  items={[
                    {
                      label: 'Subtotal',
                      value: formatCurrency(selectedStandard.financeBreakdown?.itemSubtotal, selectedStandard.currency || 'NGN'),
                    },
                    {
                      label: 'Shipping',
                      value: formatCurrency(selectedStandard.financeBreakdown?.shippingAmount, selectedStandard.currency || 'NGN'),
                    },
                    {
                      label: 'Discount',
                      value: formatCurrency(selectedStandard.financeBreakdown?.discountAmount, selectedStandard.currency || 'NGN'),
                    },
                    {
                      label: 'Gross amount',
                      value: formatCurrency(selectedStandard.financeBreakdown?.grossAmount ?? selectedStandard.totalAmount, selectedStandard.currency || 'NGN'),
                    },
                    {
                      label: 'Net brand amount',
                      value: selectedStandard.financeBreakdown?.netBrandAmount != null
                        ? formatCurrency(selectedStandard.financeBreakdown.netBrandAmount, selectedStandard.currency || 'NGN')
                        : 'Pending release',
                    },
                    {
                      label: 'Escrow status',
                      value: selectedStandard.financeBreakdown?.escrowStatus || 'Not available',
                    },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Buyer receipt</div>
                {selectedStandard.buyerReceipt ? (
                  <CustomOrderKeyValueList
                    items={[
                      { label: 'Receipt ID', value: selectedStandard.buyerReceipt.documentNumber },
                      { label: 'Issued', value: formatDateTime(selectedStandard.buyerReceipt.issuedAt) },
                      {
                        label: 'Gross paid',
                        value: formatCurrency(
                          selectedStandard.buyerReceipt.grossAmount,
                          selectedStandard.buyerReceipt.currency || selectedStandard.currency || 'NGN',
                        ),
                      },
                      {
                        label: 'Commission',
                        value:
                          selectedStandard.buyerReceipt.commissionAmount != null
                            ? formatCurrency(
                                selectedStandard.buyerReceipt.commissionAmount,
                                selectedStandard.buyerReceipt.currency || selectedStandard.currency || 'NGN',
                              )
                            : 'Not recorded',
                      },
                      {
                        label: 'Net amount',
                        value:
                          selectedStandard.buyerReceipt.netAmount != null
                            ? formatCurrency(
                                selectedStandard.buyerReceipt.netAmount,
                                selectedStandard.buyerReceipt.currency || selectedStandard.currency || 'NGN',
                              )
                            : 'Pending release',
                      },
                      {
                        label: 'Settlement',
                        value:
                          selectedStandard.buyerReceipt.settlementAmount != null
                            ? `${selectedStandard.buyerReceipt.settlementCurrency || selectedStandard.currency || 'NGN'} ${Number(
                                selectedStandard.buyerReceipt.settlementAmount,
                              ).toFixed(2)}`
                            : 'Not available',
                      },
                    ]}
                  />
                ) : (
                  <div className="font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">No receipt document is attached to this order yet.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
                <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Escrow release schedule</div>
                {(selectedStandard.financeBreakdown?.releaseSchedule ?? []).length === 0 ? (
                  <div className="font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">No release schedule is attached to this order.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedStandard.financeBreakdown?.releaseSchedule ?? []).map((stage, index) => (
                      <div key={`${stage.stage}-${index}`} className="rounded-xl border border-slate-200/80 p-3 font-hanken-grotesk text-sm dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-bold text-slate-900 dark:text-white">{humanizeToken(stage.stage)}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {stage.releasedAt
                              ? `Released ${formatDateTime(stage.releasedAt)}`
                              : stage.eligibleAt
                                ? `Eligible ${formatDateTime(stage.eligibleAt)}`
                                : 'Awaiting milestone'}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                          <div>Gross: {formatCurrency(stage.grossAmount, selectedStandard.currency || 'NGN')}</div>
                          <div>Commission: {formatCurrency(stage.commissionAmount, selectedStandard.currency || 'NGN')}</div>
                          <div>Net: {formatCurrency(stage.netAmount, selectedStandard.currency || 'NGN')}</div>
                        </div>
                        {stage.condition ? (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Condition: {humanizeToken(stage.condition)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
              <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Ledger postings</div>
              {(selectedStandard.financeBreakdown?.ledgerTransactions ?? []).length === 0 ? (
                <div className="font-hanken-grotesk text-sm text-slate-500 dark:text-slate-400">No ledger transactions were returned for this order.</div>
              ) : (
                <div className="space-y-3">
                  {(selectedStandard.financeBreakdown?.ledgerTransactions ?? []).map((transaction) => (
                    <div key={transaction.id} className="rounded-xl border border-slate-200/80 p-3 font-hanken-grotesk dark:border-white/10">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{humanizeToken(transaction.type)}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{transaction.description || 'Ledger transaction'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(transaction.totalAmount, transaction.currency || selectedStandard.currency || 'NGN')}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(transaction.createdAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {transaction.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">{humanizeToken(entry.direction)}</div>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">
                              {formatCurrency(entry.amount, transaction.currency || selectedStandard.currency || 'NGN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
              <div className="mb-3 font-hanken-grotesk text-sm font-semibold text-slate-900 dark:text-white">Super-admin interventions</div>
              <p className="font-hanken-grotesk text-sm text-slate-600 dark:text-slate-300">
                Buyer/brand cancellation is blocked. To reverse funds or force lifecycle adjustments, use Finance controls and message both parties in-thread.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/orders/${selectedStandard.id}`)}
                  className="rounded-full border border-slate-200 px-4 py-2 font-geist text-xs font-bold text-slate-800 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-slate-800"
                >
                  Open finance drill-through
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/finance')}
                  className="rounded-full border border-slate-200 px-4 py-2 font-geist text-xs font-bold text-slate-800 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-slate-800"
                >
                  Open finance workspace
                </button>
              </div>
            </div>

            <OrderMessagesPanel
              contextType="STANDARD_ORDER"
              orderId={selectedStandard.id}
              actorSurface="ADMIN"
              title="Order messaging"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminOrdersPage;
