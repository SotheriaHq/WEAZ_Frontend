import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminFinanceApi } from '@/api/AdminApi';
import type {
  AdminCommissionRule,
  AdminFinancialDocument,
  AdminFinanceOverview,
  AdminLedgerTransaction,
  AdminReconciliationItem,
  AdminReconciliationRun,
} from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'rules', label: 'Commission Rules' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'books', label: 'Books' },
  { key: 'documents', label: 'Documents' },
] as const;

const RECON_SCOPE_OPTIONS = [
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'PAYOUTS', label: 'Payouts' },
  { value: 'LEDGER_INTEGRITY', label: 'Ledger integrity' },
];

const ITEM_STATUS_OPTIONS = [
  { value: '', label: 'All item statuses' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'UNMATCHED_INTERNAL', label: 'Unmatched internal' },
  { value: 'DISCREPANCY', label: 'Discrepancy' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'All document types' },
  { value: 'BUYER_RECEIPT', label: 'Buyer receipts' },
  { value: 'BRAND_SETTLEMENT_STATEMENT', label: 'Settlement statements' },
  { value: 'PLATFORM_COMMISSION_INVOICE', label: 'Commission invoices' },
  { value: 'CREDIT_NOTE', label: 'Credit notes' },
];

const BOOK_TYPE_OPTIONS = [
  { value: '', label: 'All book entries' },
  { value: 'PAYMENT_RECEIVED', label: 'Money in' },
  { value: 'ESCROW_RELEASE', label: 'Escrow releases' },
  { value: 'PAYOUT_DISBURSED', label: 'Money out' },
  { value: 'REFUND_ISSUED', label: 'Refunds' },
  { value: 'REVERSAL', label: 'Reversals' },
];

const RULE_SCOPE_OPTIONS = [
  { value: 'PLATFORM', label: 'Platform' },
  { value: 'BRAND', label: 'Brand' },
];

const statusDot: Record<string, string> = {
  MATCHED: 'bg-emerald-500',
  UNMATCHED_INTERNAL: 'bg-amber-500',
  DISCREPANCY: 'bg-rose-500',
  RESOLVED: 'bg-sky-500',
  RUNNING: 'bg-yellow-500',
  COMPLETED: 'bg-emerald-500',
  FAILED: 'bg-rose-500',
  GENERATED: 'bg-emerald-500',
  VOIDED: 'bg-slate-400',
};

const formatMoney = (value: number | undefined, currency = 'NGN') =>
  typeof value === 'number'
    ? new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
    : '—';

const formatReferenceLabel = (referenceType?: string | null) => {
  const normalized = String(referenceType || 'GENERAL').trim();
  if (!normalized) return 'General';
  if (normalized.toUpperCase() === 'CUSTOMORDER') return 'Custom order';
  if (normalized.toUpperCase() === 'ORDER') return 'Standard order';
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim();
};

const getReferenceTone = (referenceType?: string | null) => {
  const normalized = String(referenceType || '').trim().toUpperCase();
  if (normalized === 'CUSTOMORDER') {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300';
  }
  if (normalized === 'ORDER') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  }
  if (normalized === 'PAYOUT') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300';
};

const formatReferenceCode = (referenceId?: string | null) =>
  referenceId ? `#${String(referenceId).slice(0, 8).toUpperCase()}` : 'â€”';

const AdminFinancePage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canWrite = hasPermission('PAYOUTS_PROCESS');
  const canReadBooks = hasPermission('PAYOUTS_READ');

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [rules, setRules] = useState<AdminCommissionRule[]>([]);
  const [runs, setRuns] = useState<AdminReconciliationRun[]>([]);
  const [items, setItems] = useState<AdminReconciliationItem[]>([]);
  const [books, setBooks] = useState<AdminLedgerTransaction[]>([]);
  const [documents, setDocuments] = useState<AdminFinancialDocument[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedItemStatus, setSelectedItemStatus] = useState('');
  const [selectedBookType, setSelectedBookType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<AdminFinancialDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningScope, setRunningScope] = useState<'PAYMENTS' | 'PAYOUTS' | 'LEDGER_INTEGRITY'>('PAYMENTS');
  const [ruleDraft, setRuleDraft] = useState({
    name: '',
    scope: 'PLATFORM',
    brandId: '',
    currency: 'NGN',
    ratePercent: '10',
    minFeeAmount: '',
    maxFeeAmount: '',
    isDefault: true,
  });
  const [resolutionNote, setResolutionNote] = useState('');

  const loadOverview = async () => {
    const response = await adminFinanceApi.getOverview();
    setOverview(unwrapApiResponse<AdminFinanceOverview>(response.data as any));
  };

  const loadRules = async () => {
    const response = await adminFinanceApi.listCommissionRules();
    setRules(unwrapApiResponse<AdminCommissionRule[]>(response.data as any));
  };

  const loadRuns = async () => {
    const response = await adminFinanceApi.listReconciliationRuns();
    const data = unwrapApiResponse<AdminReconciliationRun[]>(response.data as any);
    setRuns(data);
    if (data.length > 0 && !selectedRunId) {
      setSelectedRunId(data[0].id);
    }
  };

  const loadItems = async (runId: string, status?: string) => {
    const response = await adminFinanceApi.listReconciliationItems({
      ...(runId ? { runId } : {}),
      ...(status ? { status } : {}),
    });
    setItems(unwrapApiResponse<AdminReconciliationItem[]>(response.data as any));
  };

  const loadDocuments = async (type?: string) => {
    const response = await adminFinanceApi.listDocuments(type ? { type } : undefined);
    const data = unwrapApiResponse<AdminFinancialDocument[]>(response.data as any);
    setDocuments(data);
    if (data.length > 0 && !selectedDocument) {
      setSelectedDocument(data[0]);
    }
  };

  const loadBooks = async (type?: string) => {
    if (!canReadBooks) {
      setBooks([]);
      return;
    }

    const response = await adminFinanceApi.listBooks(type ? { type, limit: '50' } : { limit: '50' });
    setBooks(unwrapApiResponse<AdminLedgerTransaction[]>(response.data as any));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadOverview(),
      loadRules(),
      loadRuns(),
      loadDocuments(),
      canReadBooks ? loadBooks() : Promise.resolve(),
    ])
      .catch(() => toast.error('Failed to load finance data'))
      .finally(() => setLoading(false));
  }, [canReadBooks]);

  useEffect(() => {
    if (!selectedRunId) {
      setItems([]);
      return;
    }
    loadItems(selectedRunId, selectedItemStatus).catch(() =>
      toast.error('Failed to load reconciliation items'),
    );
  }, [selectedRunId, selectedItemStatus]);

  useEffect(() => {
    loadDocuments(selectedDocType || undefined).catch(() =>
      toast.error('Failed to load finance documents'),
    );
  }, [selectedDocType]);

  useEffect(() => {
    if (!canReadBooks) {
      setBooks([]);
      return;
    }

    loadBooks(selectedBookType || undefined).catch(() =>
      toast.error('Failed to load finance books'),
    );
  }, [canReadBooks, selectedBookType]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const unresolvedItems = useMemo(
    () => items.filter((item) => item.status !== 'MATCHED' && item.status !== 'RESOLVED'),
    [items],
  );

  const runCommand = async () => {
    try {
      await adminFinanceApi.createReconciliationRun({ scope: runningScope });
      toast.success('Reconciliation run completed');
      await Promise.all([loadOverview(), loadRuns()]);
      if (selectedRunId) {
        await loadItems(selectedRunId, selectedItemStatus);
      }
    } catch {
      toast.error('Failed to run reconciliation');
    }
  };

  const saveRule = async () => {
    if (!ruleDraft.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    try {
      await adminFinanceApi.createCommissionRule({
        name: ruleDraft.name.trim(),
        scope: ruleDraft.scope as 'PLATFORM' | 'BRAND',
        brandId: ruleDraft.scope === 'BRAND' ? ruleDraft.brandId.trim() || null : null,
        currency: ruleDraft.currency.trim() || null,
        ratePercent: Number(ruleDraft.ratePercent),
        minFeeAmount: ruleDraft.minFeeAmount ? Number(ruleDraft.minFeeAmount) : null,
        maxFeeAmount: ruleDraft.maxFeeAmount ? Number(ruleDraft.maxFeeAmount) : null,
        isDefault: ruleDraft.isDefault,
      });
      toast.success('Commission rule saved');
      setRuleDraft({
        name: '',
        scope: 'PLATFORM',
        brandId: '',
        currency: 'NGN',
        ratePercent: '10',
        minFeeAmount: '',
        maxFeeAmount: '',
        isDefault: true,
      });
      await Promise.all([loadRules(), loadOverview()]);
    } catch {
      toast.error('Failed to save commission rule');
    }
  };

  const handleItemAction = async (
    item: AdminReconciliationItem,
    action: 'claim' | 'release' | 'resolve',
  ) => {
    try {
      if (action === 'claim') {
        await adminFinanceApi.claimReconciliationItem(item.id);
      } else if (action === 'release') {
        await adminFinanceApi.releaseReconciliationItem(item.id, resolutionNote || undefined);
      } else {
        if (!resolutionNote.trim()) {
          toast.error('Resolution note is required');
          return;
        }
        await adminFinanceApi.resolveReconciliationItem(item.id, resolutionNote.trim());
      }
      toast.success(`Reconciliation item ${action}ed`);
      await Promise.all([loadOverview(), loadRuns(), loadItems(selectedRunId, selectedItemStatus)]);
      setResolutionNote('');
    } catch {
      toast.error(`Failed to ${action} reconciliation item`);
    }
  };

  const refreshDocument = async (documentId: string) => {
    const response = await adminFinanceApi.getDocument(documentId);
    setSelectedDocument(unwrapApiResponse<AdminFinancialDocument>(response.data as any));
  };

  /* ------------------------------------------------------------------ */
  /*  Loading skeleton                                                   */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segments={[{ label: 'Finance' }]} />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
          <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Metric cards data                                                  */
  /* ------------------------------------------------------------------ */
  const metricCards = [
    { label: 'GMV', value: formatMoney(overview?.gmv, overview?.currency), tone: 'border-emerald-500/30 bg-emerald-500/5' },
    { label: 'Commissions', value: formatMoney(overview?.totalCommissions, overview?.currency), tone: 'border-indigo-500/30 bg-indigo-500/5' },
    { label: 'Paid Out', value: formatMoney(overview?.totalPayouts, overview?.currency), tone: 'border-sky-500/30 bg-sky-500/5' },
    { label: 'Refunds', value: formatMoney(overview?.totalRefunds, overview?.currency), tone: 'border-rose-500/30 bg-rose-500/5' },
    { label: 'Active Rules', value: String(overview?.activeCommissionRules ?? 0), tone: 'border-amber-500/30 bg-amber-500/5' },
    { label: 'Open Items', value: String(overview?.unresolvedReconciliationItems ?? 0), tone: 'border-orange-500/30 bg-orange-500/5' },
  ];

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
  const cardCls = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]';

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Finance' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Finance Workspace</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Commissions, reconciliation, documents, and finance reporting.
        </p>
      </div>

      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        {metricCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </section>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold transition ${
                active
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ============================================================ */}
      {/*  OVERVIEW TAB                                                 */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Reconciliation Runs</h3>
            <div className="mt-4 space-y-2">
              {overview?.recentRuns?.length ? overview.recentRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 dark:border-white/5">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot[run.status] ?? 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{run.scope.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{run.status} · {new Date(run.startedAt).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <p className="py-6 text-center text-sm text-slate-400">No reconciliation runs yet.</p>
              )}
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Financial Documents</h3>
            <div className="mt-4 space-y-2">
              {overview?.recentDocuments?.length ? overview.recentDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => { setActiveTab('documents'); setSelectedDocument(doc); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]"
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot[doc.status] ?? 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{doc.documentNumber}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{doc.type.replace(/_/g, ' ')} · {new Date(doc.issuedAt).toLocaleString()}</p>
                  </div>
                </button>
              )) : (
                <p className="py-6 text-center text-sm text-slate-400">No financial documents yet.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  COMMISSION RULES TAB                                         */}
      {/* ============================================================ */}
      {activeTab === 'rules' && (
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Rules list */}
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Commission Rules</h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 dark:border-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Scope</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    {canWrite && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {rules.length === 0 ? (
                    <tr><td colSpan={canWrite ? 5 : 4} className="px-4 py-8 text-center text-slate-400">No commission rules configured.</td></tr>
                  ) : rules.map((rule) => (
                    <tr key={rule.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {rule.isDefault && <span className="text-xs text-amber-500" title="Default">★</span>}
                          <span className="font-medium text-slate-900 dark:text-white">{rule.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {rule.scope} · {rule.currency || 'ALL'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{rule.ratePercent}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${rule.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                          {rule.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await adminFinanceApi.updateCommissionRule(rule.id, { isActive: !rule.isActive });
                                toast.success('Rule updated');
                                await loadRules();
                              } catch {
                                toast.error('Failed to update rule');
                              }
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                          >
                            {rule.isActive ? 'Pause' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create rule form */}
          <div className={cardCls}>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Create Rule</h3>
            <div className="mt-4 space-y-3">
              <input value={ruleDraft.name} onChange={(e) => setRuleDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Rule name" className={inputCls} />
              <UniversalSelect label="Scope" value={ruleDraft.scope} onChange={(v) => setRuleDraft((c) => ({ ...c, scope: v }))} options={RULE_SCOPE_OPTIONS} placeholder="Choose scope" />
              {ruleDraft.scope === 'BRAND' && (
                <input value={ruleDraft.brandId} onChange={(e) => setRuleDraft((c) => ({ ...c, brandId: e.target.value }))} placeholder="Brand ID" className={inputCls} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <input value={ruleDraft.currency} onChange={(e) => setRuleDraft((c) => ({ ...c, currency: e.target.value.toUpperCase() }))} placeholder="Currency" className={inputCls} />
                <input value={ruleDraft.ratePercent} onChange={(e) => setRuleDraft((c) => ({ ...c, ratePercent: e.target.value }))} placeholder="Rate %" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={ruleDraft.minFeeAmount} onChange={(e) => setRuleDraft((c) => ({ ...c, minFeeAmount: e.target.value }))} placeholder="Min fee" className={inputCls} />
                <input value={ruleDraft.maxFeeAmount} onChange={(e) => setRuleDraft((c) => ({ ...c, maxFeeAmount: e.target.value }))} placeholder="Max fee" className={inputCls} />
              </div>
              <button
                type="button"
                onClick={() => setRuleDraft((c) => ({ ...c, isDefault: !c.isDefault }))}
                className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${ruleDraft.isDefault ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400'}`}
              >
                {ruleDraft.isDefault ? '★ Default rule' : 'Not default'}
              </button>
              <button
                type="button"
                onClick={saveRule}
                disabled={!canWrite}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Rule
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  RECONCILIATION TAB                                           */}
      {/* ============================================================ */}
      {activeTab === 'reconciliation' && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            {/* Run reconciliation */}
            <div className={cardCls}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Run Reconciliation</h3>
              <div className="mt-4 flex items-end gap-3">
                <div className="flex-1">
                  <UniversalSelect label="Scope" value={runningScope} onChange={(v) => setRunningScope(v as any)} options={RECON_SCOPE_OPTIONS} placeholder="Scope" />
                </div>
                <button
                  type="button"
                  onClick={runCommand}
                  disabled={!canWrite}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  Run
                </button>
              </div>
            </div>

            {/* Runs list */}
            <div className={cardCls}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Run History</h3>
              <div className="mt-4 space-y-2">
                {runs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No runs yet.</p>
                ) : runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selectedRunId === run.id
                        ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                        : 'border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot[run.status] ?? 'bg-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{run.scope.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{run.status} · {(run._count?.items ?? 0)} items</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items panel */}
          <div className={cardCls}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Reconciliation Items</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedRun ? `${selectedRun.scope.replace(/_/g, ' ')} run · ${unresolvedItems.length} open` : 'Select a run to inspect'}
                </p>
              </div>
              <div className="w-full sm:w-52">
                <UniversalSelect value={selectedItemStatus} onChange={setSelectedItemStatus} options={ITEM_STATUS_OPTIONS} placeholder="Filter" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No items found.</p>
              ) : items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-4 dark:border-white/5">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${statusDot[item.status] ?? 'bg-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{item.summary}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone(item.referenceType)}`}>
                          {formatReferenceLabel(item.referenceType)}
                        </span>
                        <span className="font-mono text-[11px]">{formatReferenceCode(item.referenceId)}</span>
                        <span>Expected {item.expectedAmount ?? '—'}</span>
                        <span>Actual {item.actualAmount ?? '—'}</span>
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.status === 'MATCHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' :
                      item.status === 'RESOLVED' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' :
                      'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {canWrite && item.status !== 'MATCHED' && item.status !== 'RESOLVED' && (
                    <div className="mt-3 flex flex-col gap-2 pl-5">
                      <input value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Resolution note..." className={inputCls} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleItemAction(item, 'claim')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300">Claim</button>
                        <button type="button" onClick={() => handleItemAction(item, 'release')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300">Release</button>
                        <button type="button" onClick={() => handleItemAction(item, 'resolve')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Resolve</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  BOOKS TAB                                                    */}
      {/* ============================================================ */}
      {activeTab === 'books' && (
        <section className={cardCls}>
          {!canReadBooks ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              Book access requires audit-read permission.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Books of accounts</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    System-wide money in, money out, refunds, reversals, and release postings.
                  </p>
                </div>
                <div className="w-full lg:w-72">
                  <UniversalSelect
                    label="Book type"
                    value={selectedBookType}
                    onChange={setSelectedBookType}
                    options={BOOK_TYPE_OPTIONS}
                    placeholder="Filter"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/5">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-white/[0.03]">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Entry</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Reference</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Split</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {books.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No book entries found.
                        </td>
                      </tr>
                    ) : (
                      books.map((book) => (
                        <tr key={book.id} className="align-top transition hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {book.type.replace(/_/g, ' ')}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {book.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone(book.referenceType)}`}>
                                {formatReferenceLabel(book.referenceType)}
                              </span>
                              <span className="font-mono text-[11px]">
                                {formatReferenceCode(book.referenceId)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                            {new Date(book.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {formatMoney(Number(book.totalAmount), book.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                              {book.entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-white/5">
                                  <span>
                                    {entry.direction} · {entry.account.subType}
                                  </span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {formatMoney(Number(entry.amount), book.currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/*  DOCUMENTS TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'documents' && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className={cardCls}>
            <div className="mb-4">
              <UniversalSelect label="Document type" value={selectedDocType} onChange={setSelectedDocType} options={DOC_TYPE_OPTIONS} placeholder="Filter" />
            </div>
            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No documents found.</p>
              ) : documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={async () => { await refreshDocument(doc.id); }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    selectedDocument?.id === doc.id
                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                      : 'border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusDot[doc.status] ?? 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{doc.documentNumber}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{doc.type.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span>{new Date(doc.issuedAt).toLocaleString()}</span>
                      {doc.customOrderId ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone('CustomOrder')}`}>
                          Custom order {formatReferenceCode(doc.customOrderId)}
                        </span>
                      ) : doc.orderId ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone('Order')}`}>
                          Standard order {formatReferenceCode(doc.orderId)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={cardCls}>
            {selectedDocument ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{selectedDocument.documentNumber}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {selectedDocument.type.replace(/_/g, ' ')} · {selectedDocument.currency} {selectedDocument.grossAmount}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {selectedDocument.customOrderId ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone('CustomOrder')}`}>
                          Custom order {formatReferenceCode(selectedDocument.customOrderId)}
                        </span>
                      ) : selectedDocument.orderId ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getReferenceTone('Order')}`}>
                          Standard order {formatReferenceCode(selectedDocument.orderId)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusDot[selectedDocument.status] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                    {selectedDocument.status}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700 dark:border-white/5 dark:bg-slate-950 dark:text-slate-200">
                  <div dangerouslySetInnerHTML={{ __html: selectedDocument.contentHtml ?? '<p>No rendered document body.</p>' }} />
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                Select a document to preview.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminFinancePage;
