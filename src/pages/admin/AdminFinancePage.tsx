import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminFinanceApi } from '@/api/AdminApi';
import type {
  AdminCommissionRule,
  AdminFinancialDocument,
  AdminFinanceOverview,
  AdminReconciliationItem,
  AdminReconciliationRun,
} from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const SECTION_OPTIONS = [
  { value: 'overview', label: '📈 Overview' },
  { value: 'rules', label: '🧮 Commission Rules' },
  { value: 'reconciliation', label: '🧾 Reconciliation' },
  { value: 'documents', label: '📄 Documents' },
];

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

const RULE_SCOPE_OPTIONS = [
  { value: 'PLATFORM', label: 'Platform' },
  { value: 'BRAND', label: 'Brand' },
];

const statusEmoji: Record<string, string> = {
  MATCHED: '🟢',
  UNMATCHED_INTERNAL: '🟠',
  DISCREPANCY: '🔴',
  RESOLVED: '🔵',
  RUNNING: '🟡',
  COMPLETED: '🟢',
  FAILED: '🔴',
  GENERATED: '🟢',
  VOIDED: '⚪',
};

const AdminFinancePage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canWrite = hasPermission('PAYOUTS_PROCESS');

  const [section, setSection] = useState('overview');
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [rules, setRules] = useState<AdminCommissionRule[]>([]);
  const [runs, setRuns] = useState<AdminReconciliationRun[]>([]);
  const [items, setItems] = useState<AdminReconciliationItem[]>([]);
  const [documents, setDocuments] = useState<AdminFinancialDocument[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedItemStatus, setSelectedItemStatus] = useState('');
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOverview(), loadRules(), loadRuns(), loadDocuments()])
      .catch(() => toast.error('Failed to load finance data'))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading finance workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Finance' }]} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🏦 Finance Workspace</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Operate commissions, reconciliation, documents, and finance reporting from one surface.
          </p>
        </div>

        <div className="w-full lg:w-64">
          <UniversalSelect
            label="Section"
            value={section}
            onChange={setSection}
            options={SECTION_OPTIONS}
            placeholder="Choose section"
          />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        {[
          { label: 'GMV', value: overview?.gmv, emoji: '💳', money: true },
          { label: 'Commissions', value: overview?.totalCommissions, emoji: '🧮', money: true },
          { label: 'Paid Out', value: overview?.totalPayouts, emoji: '💸', money: true },
          { label: 'Refunds', value: overview?.totalRefunds, emoji: '↩️', money: true },
          { label: 'Active Rules', value: overview?.activeCommissionRules, emoji: '📐', money: false },
          { label: 'Open Reconciliation', value: overview?.unresolvedReconciliationItems, emoji: '🧾', money: false },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {card.emoji} {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {typeof card.value === 'number'
                ? card.money
                  ? `${overview?.currency ?? 'NGN'} ${card.value.toLocaleString()}`
                  : card.value.toLocaleString()
                : card.value}
            </div>
          </div>
        ))}
      </section>

      {section === 'overview' && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">🧾 Recent reconciliation runs</div>
            <div className="mt-4 space-y-3">
              {overview?.recentRuns?.length ? overview.recentRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {statusEmoji[run.status] ?? '⚪'} {run.scope.replace(/_/g, ' ')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {run.status} • {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
              )) : <div className="text-sm text-slate-500 dark:text-slate-400">No reconciliation runs yet.</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">📄 Recent financial documents</div>
            <div className="mt-4 space-y-3">
              {overview?.recentDocuments?.length ? overview.recentDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => {
                    setSection('documents');
                    setSelectedDocument(document);
                  }}
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 text-left dark:border-white/10"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {statusEmoji[document.status] ?? '⚪'} {document.documentNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {document.type.replace(/_/g, ' ')} • {new Date(document.issuedAt).toLocaleString()}
                  </div>
                </button>
              )) : <div className="text-sm text-slate-500 dark:text-slate-400">No financial documents yet.</div>}
            </div>
          </div>
        </section>
      )}

      {section === 'rules' && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">🧮 Active commission rules</div>
            <div className="mt-4 space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {rule.isDefault ? '⭐' : '📐'} {rule.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {rule.scope} • {rule.currency || 'ALL'} • {rule.ratePercent}% • {rule.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await adminFinanceApi.updateCommissionRule(rule.id, { isActive: !rule.isActive });
                            toast.success('Commission rule updated');
                            await loadRules();
                          } catch {
                            toast.error('Failed to update commission rule');
                          }
                        }}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold dark:border-white/10 dark:text-white"
                      >
                        {rule.isActive ? 'Pause' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">➕ Create rule</div>
            <div className="mt-4 space-y-4">
              <input value={ruleDraft.name} onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Rule name" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
              <UniversalSelect label="Scope" value={ruleDraft.scope} onChange={(value) => setRuleDraft((current) => ({ ...current, scope: value }))} options={RULE_SCOPE_OPTIONS} placeholder="Choose scope" />
              {ruleDraft.scope === 'BRAND' && (
                <input value={ruleDraft.brandId} onChange={(event) => setRuleDraft((current) => ({ ...current, brandId: event.target.value }))} placeholder="Brand ID" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
              )}
              <input value={ruleDraft.currency} onChange={(event) => setRuleDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="Currency" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
              <input value={ruleDraft.ratePercent} onChange={(event) => setRuleDraft((current) => ({ ...current, ratePercent: event.target.value }))} placeholder="Rate percent" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input value={ruleDraft.minFeeAmount} onChange={(event) => setRuleDraft((current) => ({ ...current, minFeeAmount: event.target.value }))} placeholder="Min fee" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
                <input value={ruleDraft.maxFeeAmount} onChange={(event) => setRuleDraft((current) => ({ ...current, maxFeeAmount: event.target.value }))} placeholder="Max fee" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
              </div>
              <button
                type="button"
                onClick={() => setRuleDraft((current) => ({ ...current, isDefault: !current.isDefault }))}
                className="rounded-2xl border border-black/10 px-4 py-3 text-left text-sm font-semibold dark:border-white/10 dark:text-white"
              >
                {ruleDraft.isDefault ? '⭐ Default rule' : '⚪ Not default'}
              </button>
              <button
                type="button"
                onClick={saveRule}
                disabled={!canWrite}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                Save commission rule
              </button>
            </div>
          </div>
        </section>
      )}

      {section === 'reconciliation' && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">▶️ Run reconciliation</div>
              <div className="mt-4 space-y-4">
                <UniversalSelect label="Scope" value={runningScope} onChange={(value) => setRunningScope(value as 'PAYMENTS' | 'PAYOUTS' | 'LEDGER_INTEGRITY')} options={RECON_SCOPE_OPTIONS} placeholder="Choose run scope" />
                <button
                  type="button"
                  onClick={runCommand}
                  disabled={!canWrite}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  Run {runningScope.replace(/_/g, ' ').toLowerCase()}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">🧾 Runs</div>
              <div className="mt-4 space-y-3">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedRunId === run.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 dark:border-white/10'}`}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {statusEmoji[run.status] ?? '⚪'} {run.scope.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {run.status} • {(run._count?.items ?? 0)} items
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">🔍 Reconciliation items</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selectedRun ? `${selectedRun.scope.replace(/_/g, ' ')} run selected` : 'Choose a run to inspect'}
                </div>
              </div>
              <div className="w-full lg:w-64">
                <UniversalSelect label="Item status" value={selectedItemStatus} onChange={setSelectedItemStatus} options={ITEM_STATUS_OPTIONS} placeholder="Filter items" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              Open items in this view: {unresolvedItems.length}
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/10 px-4 py-4 dark:border-white/10">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {statusEmoji[item.status] ?? '⚪'} {item.summary}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.referenceType} • Expected {item.expectedAmount ?? '—'} • Actual {item.actualAmount ?? '—'}
                  </div>
                  {canWrite && item.status !== 'MATCHED' && (
                    <div className="mt-3 flex flex-col gap-3">
                      <input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Resolution note" className="w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10 dark:text-white" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleItemAction(item, 'claim')} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold dark:border-white/10 dark:text-white">Claim</button>
                        <button type="button" onClick={() => handleItemAction(item, 'release')} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold dark:border-white/10 dark:text-white">Release</button>
                        <button type="button" onClick={() => handleItemAction(item, 'resolve')} className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Resolve</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">No reconciliation items found.</div>}
            </div>
          </div>
        </section>
      )}

      {section === 'documents' && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="w-full">
              <UniversalSelect label="Document type" value={selectedDocType} onChange={setSelectedDocType} options={DOC_TYPE_OPTIONS} placeholder="Filter documents" />
            </div>
            <div className="mt-4 space-y-3">
              {documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={async () => {
                    await refreshDocument(document.id);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedDocument?.id === document.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/10 dark:border-white/10'}`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {statusEmoji[document.status] ?? '⚪'} {document.documentNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {document.type.replace(/_/g, ' ')} • {new Date(document.issuedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            {selectedDocument ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    📄 {selectedDocument.documentNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedDocument.type.replace(/_/g, ' ')} • {selectedDocument.currency} {selectedDocument.grossAmount}
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                  <div dangerouslySetInnerHTML={{ __html: selectedDocument.contentHtml ?? '<p>No rendered document body.</p>' }} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">Select a document to preview it.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminFinancePage;
