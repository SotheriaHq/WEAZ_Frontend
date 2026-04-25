import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
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
    normalized === 'COMPLETED'
  ) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (
    normalized === 'PENDING' ||
    normalized === 'PROCESSING' ||
    normalized === 'IN_PRODUCTION' ||
    normalized === 'IN_TRANSIT'
  ) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
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
  return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300';
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
  const { isSuperAdmin } = useAdminPermissions();
  const canManageCommission = isSuperAdmin;
  const [activeTab, setActiveTab] = useState<OrdersTab>('STANDARD');
  const [viewMode, setViewMode] = useState<OrdersView>('TABLE');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [standardStatusFilter, setStandardStatusFilter] = useState('');
  const [customStatusFilter, setCustomStatusFilter] = useState('');

  const [standardOrders, setStandardOrders] = useState<AdminStandardOrderListItem[]>([]);
  const [standardSummary, setStandardSummary] = useState<AdminStandardOrderListResponse['summary'] | null>(null);
  const [customOrders, setCustomOrders] = useState<CustomOrderListItem[]>([]);

  const [loadingStandard, setLoadingStandard] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

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

  const loadStandardOrders = useCallback(async () => {
    setLoadingStandard(true);
    try {
      const response = await adminOrdersApi.list({
        limit: '30',
        q: deferredSearchQuery.trim() || '',
        status: standardStatusFilter,
      });
      const payload = unwrapApiResponse<AdminStandardOrderListResponse>(response.data as any);
      setStandardOrders(Array.isArray(payload?.items) ? payload.items : []);
      setStandardSummary(payload?.summary ?? null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load standard-order queue');
      setStandardOrders([]);
      setStandardSummary(null);
    } finally {
      setLoadingStandard(false);
    }
  }, [deferredSearchQuery, standardStatusFilter]);

  const loadCustomOrders = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const payload = await customOrdersAdminApi.list({
        limit: 30,
        q: deferredSearchQuery.trim() || undefined,
        status: customStatusFilter ? (customStatusFilter as CustomOrderStatus) : undefined,
      });
      setCustomOrders(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load custom-order queue');
      setCustomOrders([]);
    } finally {
      setLoadingCustom(false);
    }
  }, [customStatusFilter, deferredSearchQuery]);

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
    void loadStandardOrders();
  }, [loadStandardOrders]);

  useEffect(() => {
    void loadCustomOrders();
  }, [loadCustomOrders]);

  useEffect(() => {
    if (activeTab === 'COMMISSION') {
      void loadCommissionConfig();
    }
  }, [activeTab, loadCommissionConfig]);

  const standardMetrics = useMemo(() => {
    if (!standardSummary) {
      return [
        { label: 'Total orders', value: '—' },
        { label: 'Pending', value: '—' },
        { label: 'In-flight', value: '—' },
        { label: 'Revenue', value: '—' },
      ];
    }

    return [
      { label: 'Total orders', value: String(standardSummary.totalOrders ?? 0) },
      { label: 'Pending', value: String(standardSummary.pendingCount ?? 0) },
      {
        label: 'In-flight',
        value: String((standardSummary.processingCount ?? 0) + (standardSummary.shippedCount ?? 0)),
      },
      {
        label: 'Revenue',
        value: formatCurrency(standardSummary.totalRevenue ?? 0, 'NGN'),
      },
    ];
  }, [standardSummary]);

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
              Super admin commission control
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Set global platform commission for newly created orders. Existing orders keep the rate resolved from their order creation time.
            </div>
          </div>
          {commissionUpdatedAt ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Last updated {formatDateTime(commissionUpdatedAt)}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
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
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <label className="space-y-2 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
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
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadCommissionConfig()}
            disabled={commissionLoading || commissionSaving}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
          >
            {commissionLoading ? 'Refreshing...' : 'Refresh config'}
          </button>
          <button
            type="button"
            onClick={() => void saveCommissionConfig()}
            disabled={commissionSaving || commissionLoading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {commissionSaving ? 'Saving...' : 'Save commission rates'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
            Standard order example
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            <div>Gross: {formatCurrency(commissionPreview.gross)}</div>
            <div>Commission ({formatPercent(commissionDraft.standard)}): {formatCurrency(commissionPreview.standardCommission)}</div>
            <div className="font-semibold text-slate-900 dark:text-white">Brand net: {formatCurrency(commissionPreview.standardNet)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
            Custom order example
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            <div>Gross: {formatCurrency(commissionPreview.gross)}</div>
            <div>Commission ({formatPercent(commissionDraft.custom)}): {formatCurrency(commissionPreview.customCommission)}</div>
            <div className="font-semibold text-slate-900 dark:text-white">Brand net: {formatCurrency(commissionPreview.customNet)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
          Active finance rules snapshot
        </div>
        {commissionLoading ? (
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading active rules...</div>
        ) : activeRulePreview.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No active explicit commission rules are configured. System config defaults are currently in effect.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {activeRulePreview.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-black/10 px-3 py-2 text-xs dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900 dark:text-white">{rule.name}</div>
                  <div className="text-slate-500 dark:text-slate-400">{formatPercent(rule.ratePercent)}</div>
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
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
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="min-w-full divide-y divide-black/10 text-sm dark:divide-white/10">
        <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left">Order</th>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Brand</th>
            <th className="px-4 py-3 text-left">Lifecycle</th>
            <th className="px-4 py-3 text-left">Financial</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 dark:divide-white/10">
          {standardOrders.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => void loadStandardDetail(entry.id)}
              className="cursor-pointer bg-white/70 transition hover:bg-emerald-500/10 dark:bg-white/[0.02]"
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900 dark:text-white">#{entry.id.slice(0, 8).toUpperCase()}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.primaryItemName || 'Standard order'}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-white">{entry.customerName || 'Customer'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.customerEmail || 'No email'}</div>
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{entry.brand?.name || 'Brand'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeBadgeTone(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
                    {entry.paymentStatus}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(entry.totalAmount, entry.currency || 'NGN')}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(entry.createdAt)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderStandardList = () => (
    <div className="space-y-3">
      {standardOrders.map((entry) => {
        const thumbnail = safeMediaRef(entry.primaryItemImage);
        const fileId = isLikelyFileId(thumbnail) ? thumbnail : undefined;
        const src = fileId ? undefined : thumbnail;

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => void loadStandardDetail(entry.id)}
            className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.05]">
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
                    <div className="flex h-full w-full items-center justify-center text-xl text-slate-400">🧵</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900 dark:text-white">
                    {entry.primaryItemName || `Order #${entry.id.slice(0, 8).toUpperCase()}`}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {entry.customerName} • {entry.brand?.name || 'Brand'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(entry.totalAmount, entry.currency || 'NGN')}
                </div>
                <div className="mt-1 flex flex-wrap justify-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${normalizeBadgeTone(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {standardOrders.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => void loadStandardDetail(entry.id)}
          className="rounded-2xl border border-black/10 bg-white/80 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
            #{entry.id.slice(0, 8).toUpperCase()}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            {entry.primaryItemName || 'Standard order'}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {entry.customerName} • {entry.brand?.name || 'Brand'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeBadgeTone(entry.status)}`}>
              {entry.status}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeBadgeTone(entry.paymentStatus)}`}>
              {entry.paymentStatus}
            </span>
          </div>
          <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
            {formatCurrency(entry.totalAmount, entry.currency || 'NGN')}
          </div>
        </button>
      ))}
    </div>
  );

  const renderCustomTable = () => (
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="min-w-full divide-y divide-black/10 text-sm dark:divide-white/10">
        <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left">Order</th>
            <th className="px-4 py-3 text-left">Buyer</th>
            <th className="px-4 py-3 text-left">Brand</th>
            <th className="px-4 py-3 text-left">Lifecycle</th>
            <th className="px-4 py-3 text-left">Financial</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 dark:divide-white/10">
          {customOrders.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
              className="cursor-pointer bg-white/70 transition hover:bg-emerald-500/10 dark:bg-white/[0.02]"
            >
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900 dark:text-white">{entry.sourceTitle || `Custom #${entry.id.slice(0, 8)}`}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{entry.id.slice(0, 8).toUpperCase()}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-white">{entry.buyer?.name || 'Buyer'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.buyer?.email || 'No email'}</div>
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{entry.brand.name || 'Brand'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <CustomOrderBadge value={entry.status} />
                  <CustomOrderBadge value={entry.currentProgressStage || 'ORDER_PLACED'} type="stage" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-900 dark:text-white">{entry.buyerPriceSummary?.currency || 'NGN'} {String(entry.buyerPriceSummary?.grandTotal ?? 0)}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.paymentStatus}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCustomList = () => (
    <div className="space-y-3">
      {customOrders.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
          className="w-full rounded-2xl border border-black/10 bg-white/75 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900 dark:text-white">{entry.sourceTitle || 'Custom order'}</div>
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  Buyer {entry.buyer?.name || 'Buyer'} • Brand {entry.brand.name || 'Brand'}
              </div>
            </div>
            <div className="text-right">
                <div className="font-semibold text-slate-900 dark:text-white">{entry.buyerPriceSummary?.currency || 'NGN'} {String(entry.buyerPriceSummary?.grandTotal ?? 0)}</div>
              <div className="mt-1 flex flex-wrap justify-end gap-2">
                <CustomOrderBadge value={entry.status} />
                <CustomOrderBadge value={entry.paymentStatus} type="payment" />
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  const renderCustomCards = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {customOrders.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => navigate(`/admin/custom-orders/${entry.id}`)}
          className="rounded-2xl border border-black/10 bg-white/80 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-500/10 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
            #{entry.id.slice(0, 8).toUpperCase()}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{entry.sourceTitle || 'Custom order'}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.brand.name || 'Brand'}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CustomOrderBadge value={entry.status} />
            <CustomOrderBadge value={entry.currentProgressStage || 'ORDER_PLACED'} type="stage" />
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{entry.buyerPriceSummary?.currency || 'NGN'} {String(entry.buyerPriceSummary?.grandTotal ?? 0)}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Orders' }]} />

      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Admin</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Orders</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Unified order operations across standard checkout orders and custom commissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setActiveTab('STANDARD')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'STANDARD' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CUSTOM')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'CUSTOM' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}
              >
                Custom
              </button>
              {canManageCommission ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('COMMISSION')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'COMMISSION' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Commission
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {activeTab !== 'COMMISSION' ? (
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {standardMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-black/10 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">{metric.label}</div>
                <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/[0.03]">
        {activeTab === 'COMMISSION' ? (
          renderCommissionWorkspace()
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={activeTab === 'STANDARD' ? 'Search standard orders' : 'Search custom orders'}
                className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"
              />
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
                  className="min-w-[220px]"
                />
              ) : (
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
                  className="min-w-[220px]"
                />
              )}

              <div className="ml-auto inline-flex rounded-full border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-slate-950">
                {(['TABLE', 'LIST', 'CARDS'] as OrdersView[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide ${viewMode === mode ? 'bg-emerald-500 text-white' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              {activeTab === 'STANDARD' ? (
                loadingStandard ? (
                  <div className="rounded-2xl border border-black/10 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Loading standard-order queue...
                  </div>
                ) : standardOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No standard orders match your filter.
                  </div>
                ) : viewMode === 'TABLE' ? (
                  renderStandardTable()
                ) : viewMode === 'LIST' ? (
                  renderStandardList()
                ) : (
                  renderStandardCards()
                )
              ) : loadingCustom ? (
                <div className="rounded-2xl border border-black/10 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Loading custom-order queue...
                </div>
              ) : customOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No custom orders match your filter.
                </div>
              ) : viewMode === 'TABLE' ? (
                renderCustomTable()
              ) : viewMode === 'LIST' ? (
                renderCustomList()
              ) : (
                renderCustomCards()
              )}
            </div>
          </>
        )}
      </section>

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
          <div className="py-8 text-sm text-slate-500 dark:text-slate-400">Loading standard-order detail...</div>
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
              <div className="rounded-2xl border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Buyer</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.customerName || 'Buyer'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.customerEmail || 'No email'}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Seller</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.brand?.name || 'Brand'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.brand?.contactEmail || 'No support email'}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Order total</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{formatCurrency(selectedStandard.totalAmount, selectedStandard.currency || 'NGN')}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedStandard.currency}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Payment reference</div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedStandard.paymentReference || 'Not set'}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Paid {formatDateTime(selectedStandard.paidAt)}</div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Lifecycle + fulfillment</div>
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
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Finance snapshot</div>
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
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Buyer receipt</div>
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
                  <div className="text-sm text-slate-500 dark:text-slate-400">No receipt document is attached to this order yet.</div>
                )}
              </div>

              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Escrow release schedule</div>
                {(selectedStandard.financeBreakdown?.releaseSchedule ?? []).length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No release schedule is attached to this order.</div>
                ) : (
                  <div className="space-y-3">
                    {(selectedStandard.financeBreakdown?.releaseSchedule ?? []).map((stage, index) => (
                      <div key={`${stage.stage}-${index}`} className="rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/10">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900 dark:text-white">{humanizeToken(stage.stage)}</div>
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

            <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Ledger postings</div>
              {(selectedStandard.financeBreakdown?.ledgerTransactions ?? []).length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">No ledger transactions were returned for this order.</div>
              ) : (
                <div className="space-y-3">
                  {(selectedStandard.financeBreakdown?.ledgerTransactions ?? []).map((transaction) => (
                    <div key={transaction.id} className="rounded-xl border border-black/10 px-3 py-3 dark:border-white/10">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{humanizeToken(transaction.type)}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{transaction.description || 'Ledger transaction'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(transaction.totalAmount, transaction.currency || selectedStandard.currency || 'NGN')}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(transaction.createdAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {transaction.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-black/10 bg-slate-50/70 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/[0.03]"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">{humanizeToken(entry.direction)}</div>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">
                              {entry.accountCode || entry.accountSubType || entry.accountName || 'Ledger account'}
                            </div>
                            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
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

            <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Super-admin interventions</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Buyer/brand cancellation is blocked. To reverse funds or force lifecycle adjustments, use Finance controls and message both parties in-thread.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/orders/${selectedStandard.id}`)}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white"
                >
                  Open finance drill-through
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/finance')}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white"
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
