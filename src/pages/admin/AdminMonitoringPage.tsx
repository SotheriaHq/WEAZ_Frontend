import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAlertsApi } from '@/api/AdminApi';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminOperationalAlert,
  AdminOperationalAlertListResponse,
  AdminOperationalAlertSeverity,
  AdminOperationalAlertStatus,
  AdminOperationalAlertSummary,
} from '@/types/admin';
import { toast } from 'sonner';

type AlertFilters = {
  severity: string;
  category: string;
  status: string;
  from: string;
  to: string;
  search: string;
};

type MonitoringLoadError = {
  message: string;
  endpoint: string;
  status: string;
};

const defaultSummary: AdminOperationalAlertSummary = {
  open: 0,
  acknowledged: 0,
  resolved: 0,
  ignored: 0,
  critical: 0,
  paymentWebhook: 0,
  ranking: 0,
  uploadSecurity: 0,
};

const sensitiveKeyPattern =
  /(token|cookie|password|secret|signature|signedurl|s3key|authorization|card|cvv|paymentmetadata|rawpayload|payload)/i;

const severityClass: Record<AdminOperationalAlertSeverity, string> = {
  INFO: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  ERROR: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

const statusClass: Record<AdminOperationalAlertStatus, string> = {
  OPEN: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  ACKNOWLEDGED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  IGNORED: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
};

const severityOptions = [
  { value: 'ALL', label: 'All severities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'ERROR', label: 'Error' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'INFO', label: 'Info' },
];

const categoryOptions = [
  { value: 'ALL', label: 'All categories' },
  ...[
    'PAYMENT',
    'WEBHOOK',
    'UPLOAD',
    'AUTH',
    'ADMIN',
    'RANKING',
    'QUEUE',
    'MIGRATION',
    'SECURITY',
    'SYSTEM',
  ].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })),
];

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'IGNORED', label: 'Ignored' },
];

const monitoringGuide = [
  {
    title: 'Open',
    body: 'Needs admin review. Select the alert, inspect redacted metadata, then acknowledge, resolve, or ignore it.',
  },
  {
    title: 'Critical',
    body: 'Payment, upload, auth, or system events that can block users or money movement.',
  },
  {
    title: 'Redacted metadata',
    body: 'Secrets, tokens, signatures, raw payloads, and card-like fields are hidden before display.',
  },
];

const formatTime = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
};

const redactForDisplay = (key: string, value: unknown): string => {
  if (sensitiveKeyPattern.test(key)) return '[REDACTED]';
  if (value === null || value === undefined) return 'none';
  if (typeof value === 'string') {
    if (/sk_(live|test)|x-amz-signature|paystack|bearer\s+/i.test(value)) {
      return '[REDACTED]';
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const encoded = JSON.stringify(value);
    if (/sk_(live|test)|x-amz-signature|paystack|bearer\s+/i.test(encoded)) {
      return '[REDACTED]';
    }
    return encoded;
  } catch {
    return '[unavailable]';
  }
};

const metadataEntries = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: redactForDisplay(key, value),
  }));
};

const getApiErrorMessage = (err: any, fallback: string) => {
  const message = err?.response?.data?.message ?? err?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || fallback;
};

const wrapEndpointFailure = async <T,>(
  endpoint: string,
  request: () => Promise<T>,
): Promise<T> => {
  try {
    return await request();
  } catch (error: any) {
    error.__threadlyMonitoringEndpoint = endpoint;
    throw error;
  }
};

const AdminMonitoringPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canRead = hasPermission('ALERTS_READ');
  const canManage = hasPermission('ALERTS_MANAGE');
  const [summary, setSummary] = useState<AdminOperationalAlertSummary>(defaultSummary);
  const [alerts, setAlerts] = useState<AdminOperationalAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AdminOperationalAlert | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({
    severity: 'ALL',
    category: 'ALL',
    status: 'OPEN',
    from: '',
    to: '',
    search: '',
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<MonitoringLoadError | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { limit: '50' };
    if (filters.severity !== 'ALL') params.severity = filters.severity;
    if (filters.category !== 'ALL') params.category = filters.category;
    if (filters.status !== 'ALL') params.status = filters.status;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search.trim()) params.search = filters.search.trim();
    return params;
  }, [filters]);

  const loadAlerts = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, alertsResponse] = await Promise.all([
        wrapEndpointFailure('/admin/alerts/summary', () =>
          adminAlertsApi.summary(),
        ),
        wrapEndpointFailure('/admin/alerts', () =>
          adminAlertsApi.list(queryParams),
        ),
      ]);
      const summaryPayload = unwrapApiResponse<AdminOperationalAlertSummary>(
        summaryResponse.data as any,
      );
      const alertsPayload = unwrapApiResponse<AdminOperationalAlertListResponse>(
        alertsResponse.data as any,
      );
      setSummary(summaryPayload ?? defaultSummary);
      setAlerts(alertsPayload?.items ?? []);
    } catch (err: any) {
      setError({
        message: getApiErrorMessage(
          err,
          'Failed to load operational alerts.',
        ),
        endpoint:
          err?.__threadlyMonitoringEndpoint ??
          '/admin/alerts or /admin/alerts/summary',
        status: err?.response?.status ? String(err.response.status) : 'n/a',
      });
    } finally {
      setLoading(false);
    }
  }, [canRead, queryParams]);

  const hasActiveFilters =
    filters.severity !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.status !== 'OPEN' ||
    Boolean(filters.from || filters.to || filters.search.trim());

  const clearFilters = () => {
    setFilters({
      severity: 'ALL',
      category: 'ALL',
      status: 'OPEN',
      from: '',
      to: '',
      search: '',
    });
  };

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const selectAlert = async (alert: AdminOperationalAlert) => {
    setSelectedAlert(alert);
    try {
      const response = await adminAlertsApi.getById(alert.id);
      setSelectedAlert(unwrapApiResponse<AdminOperationalAlert>(response.data as any));
    } catch {
      setSelectedAlert(alert);
    }
  };

  const runAction = async (
    action: 'acknowledge' | 'resolve' | 'ignore',
    alert: AdminOperationalAlert,
  ) => {
    if (!canManage) return;
    setActionLoading(action);
    try {
      const response = await adminAlertsApi[action](alert.id);
      const updated = unwrapApiResponse<AdminOperationalAlert>(response.data as any);
      setSelectedAlert(updated);
      setAlerts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await loadAlerts();
      toast.success(`Alert ${action}d.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Failed to ${action} alert.`);
    } finally {
      setActionLoading(null);
    }
  };

  const summaryCards = [
    { label: 'Open alerts', value: summary.open },
    { label: 'Critical alerts', value: summary.critical },
    { label: 'Payment and webhook', value: summary.paymentWebhook },
    { label: 'Ranking and aggregation', value: summary.ranking },
    { label: 'Upload and security', value: summary.uploadSecurity },
  ];

  if (!canRead) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segments={[{ label: 'Monitoring' }]} />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          You do not have permission to view operational alerts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Monitoring' }]} />

      <header className="rounded-2xl border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
              Operational Alerts
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Monitor critical payment, upload, security, auth, ranking, and system events with redacted details. Data loads from /admin/alerts/summary and /admin/alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAlerts()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {monitoringGuide.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <p className="text-sm font-bold text-slate-950 dark:text-white">
              {item.title}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {item.body}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
              {loading ? '...' : card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <UniversalSelect
            label="Severity"
            value={filters.severity}
            onChange={(value) => setFilters((current) => ({ ...current, severity: value }))}
            options={severityOptions}
          />
          <UniversalSelect
            label="Category"
            value={filters.category}
            onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
            options={categoryOptions}
          />
          <UniversalSelect
            label="Status"
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={statusOptions}
          />
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Search
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Event, entity, correlation"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-bold">Operational alerts did not load.</p>
              <p className="mt-1">{error.message}</p>
              <p className="mt-2 text-xs">
                Request: {error.endpoint} | Status: {error.status} | Required permission: alerts.read
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAlerts()}
              className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-300/30 dark:bg-transparent dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Alert list</h2>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="space-y-3 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              <p>No alerts match the current filters.</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[62vh] overflow-y-auto">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => void selectAlert(alert)}
                  className={`grid w-full grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 md:grid-cols-[120px_minmax(0,1fr)_120px] ${
                    selectedAlert?.id === alert.id ? 'bg-purple-50/80 dark:bg-purple-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${severityClass[alert.severity]}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {alert.title || alert.event}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {alert.category} · {alert.event} · {formatTime(alert.lastSeenAt)}
                    </p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass[alert.status]}`}>
                      {alert.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
          {selectedAlert ? (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${severityClass[selectedAlert.severity]}`}>
                    {selectedAlert.severity}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass[selectedAlert.status]}`}>
                    {selectedAlert.status}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">
                  {selectedAlert.title || selectedAlert.event}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedAlert.message}
                </p>
              </div>

              <dl className="space-y-2 text-sm">
                {[
                  ['Category', selectedAlert.category],
                  ['Event', selectedAlert.event],
                  ['Correlation ID', selectedAlert.correlationId ?? 'n/a'],
                  ['Entity', selectedAlert.entityType ? `${selectedAlert.entityType}:${selectedAlert.entityId ?? 'unknown'}` : 'n/a'],
                  ['Occurrences', String(selectedAlert.occurrenceCount)],
                  ['First seen', formatTime(selectedAlert.firstSeenAt)],
                  ['Last seen', formatTime(selectedAlert.lastSeenAt)],
                  ['Notification queued', formatTime(selectedAlert.notificationQueuedAt)],
                  ['Email queued', formatTime(selectedAlert.emailQueuedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {label}
                    </dt>
                    <dd className="break-words text-slate-800 dark:text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Redacted metadata
                </h3>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
                  {metadataEntries(selectedAlert.metadata).length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No metadata.</p>
                  ) : (
                    metadataEntries(selectedAlert.metadata).map((entry) => (
                      <div key={entry.key} className="text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {entry.key}:
                        </span>{' '}
                        <span className="break-words text-slate-700 dark:text-slate-200">
                          {entry.value}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Next step: use the category, event, entity, and correlation ID to inspect the owning backend flow. Resolve only after the underlying issue is confirmed fixed.
              </div>

              {canManage && (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={actionLoading === 'acknowledge'}
                    onClick={() => void runAction('acknowledge', selectedAlert)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading === 'resolve'}
                    onClick={() => void runAction('resolve', selectedAlert)}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading === 'ignore'}
                    onClick={() => void runAction('ignore', selectedAlert)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Ignore
                  </button>
                </div>
              )}
              {!canManage && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  Alert lifecycle actions require the alerts.manage permission.
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              Select an alert to inspect redacted details.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

export default AdminMonitoringPage;
