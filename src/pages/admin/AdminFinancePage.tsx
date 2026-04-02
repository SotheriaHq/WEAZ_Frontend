import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import VLoader from '@/components/loaders/VLoader';
import Modal from '@/components/ui/Modal';
import { adminFinanceApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminCommissionRule,
  AdminEscrowHold,
  AdminFinancialDocument,
  AdminFinanceOverview,
  AdminFinancePaymentAttempt,
  AdminFinancePaymentDetail,
  AdminFinanceTransaction,
  AdminReconciliationItem,
  AdminReconciliationRun,
} from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

type FinanceTab =
  | 'overview'
  | 'payments'
  | 'escrow'
  | 'transactions'
  | 'commission'
  | 'reconciliation'
  | 'documents';

type CommissionDraft = {
  name: string;
  scope: 'PLATFORM' | 'BRAND';
  brandId: string;
  currency: string;
  ratePercent: string;
  minFeeAmount: string;
  maxFeeAmount: string;
  isDefault: boolean;
  isActive: boolean;
};

const FINANCE_TABS: Array<{ key: FinanceTab; label: string }> = [
  { key: 'overview', label: '📒 Overview' },
  { key: 'payments', label: '💳 Payments' },
  { key: 'escrow', label: '🔒 Escrow' },
  { key: 'transactions', label: '📚 Transactions' },
  { key: 'commission', label: '🧮 Commission' },
  { key: 'reconciliation', label: '🧾 Reconciliation' },
  { key: 'documents', label: '📄 Documents' },
];

const SELECTS = {
  paymentStatus: [
    { value: '', label: 'All statuses' },
    { value: 'PAID', label: 'Paid' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'REQUIRES_ACTION', label: 'Requires action' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'EXPIRED', label: 'Expired' },
  ],
  paymentGateway: [
    { value: '', label: 'All gateways' },
    { value: 'PAYSTACK', label: 'Paystack' },
    { value: 'FLUTTERWAVE', label: 'Flutterwave' },
    { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  ],
  paymentSubject: [
    { value: '', label: 'All subjects' },
    { value: 'STANDARD_ORDER', label: 'Standard orders' },
    { value: 'CUSTOM_ORDER', label: 'Custom orders' },
  ],
  escrowStatus: [
    { value: '', label: 'Open holds' },
    { value: 'HELD', label: 'Held' },
    { value: 'PARTIALLY_RELEASED', label: 'Partially released' },
    { value: 'FROZEN', label: 'Frozen' },
  ],
  transactionType: [
    { value: '', label: 'All types' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment received' },
    { value: 'ESCROW_RELEASE', label: 'Escrow release' },
    { value: 'PAYOUT_DISBURSED', label: 'Payout disbursed' },
    { value: 'REFUND_ISSUED', label: 'Refund issued' },
    { value: 'REVERSAL', label: 'Reversal' },
  ],
  transactionReference: [
    { value: '', label: 'All references' },
    { value: 'Order', label: 'Standard orders' },
    { value: 'CustomOrder', label: 'Custom orders' },
    { value: 'Payout', label: 'Payouts' },
  ],
  documentType: [
    { value: '', label: 'All documents' },
    { value: 'BUYER_RECEIPT', label: 'Buyer receipts' },
    { value: 'BRAND_SETTLEMENT_STATEMENT', label: 'Brand settlement statements' },
    { value: 'PLATFORM_COMMISSION_INVOICE', label: 'Commission invoices' },
    { value: 'CREDIT_NOTE', label: 'Credit notes' },
  ],
  reconciliationStatus: [
    { value: '', label: 'All items' },
    { value: 'DISCREPANCY', label: 'Discrepancies' },
    { value: 'UNMATCHED_INTERNAL', label: 'Unmatched internal' },
    { value: 'MATCHED', label: 'Matched' },
    { value: 'RESOLVED', label: 'Resolved' },
  ],
  commissionScope: [
    { value: 'PLATFORM', label: 'Platform default' },
    { value: 'BRAND', label: 'Brand specific' },
  ],
};

const THEMES: Record<string, Record<string, string>> = {
  payment: {
    PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    REQUIRES_ACTION: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
    PROCESSING: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    CANCELLED: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
    EXPIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  },
  escrow: {
    HELD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    PARTIALLY_RELEASED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    FROZEN: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    RELEASED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  run: {
    RUNNING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  },
  reconciliation: {
    DISCREPANCY: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    UNMATCHED_INTERNAL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    MATCHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    RESOLVED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  },
  document: {
    GENERATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    VOIDED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  },
};

const emptyCommissionDraft = (): CommissionDraft => ({
  name: '',
  scope: 'PLATFORM',
  brandId: '',
  currency: 'NGN',
  ratePercent: '',
  minFeeAmount: '',
  maxFeeAmount: '',
  isDefault: false,
  isActive: true,
});

const prettify = (value?: string | null) => String(value || 'UNKNOWN').replaceAll('_', ' ');
const compactId = (value?: string | null) => (value ? `#${String(value).slice(0, 8).toUpperCase()}` : '—');
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
const jsonPreview = (value: unknown) => (value == null ? '—' : JSON.stringify(value, null, 2));
const amountOf = (value: number | string | null | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
};

const toneFor = (value: string | null | undefined, kind: keyof typeof THEMES) =>
  THEMES[kind][String(value || '').trim().toUpperCase()] ||
  'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300';

const AdminFinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { reference: routePaymentReference } = useParams<{ reference?: string }>();
  const { hasPermission } = useAdminPermissions();
  const canProcess = hasPermission('PAYOUTS_PROCESS');
  const mountedRef = useRef(true);
  const requestRef = useRef<Record<string, number>>({});

  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [payments, setPayments] = useState<AdminFinancePaymentAttempt[]>([]);
  const [escrowHolds, setEscrowHolds] = useState<AdminEscrowHold[]>([]);
  const [transactions, setTransactions] = useState<AdminFinanceTransaction[]>([]);
  const [commissionRules, setCommissionRules] = useState<AdminCommissionRule[]>([]);
  const [reconciliationRuns, setReconciliationRuns] = useState<AdminReconciliationRun[]>([]);
  const [reconciliationItems, setReconciliationItems] = useState<AdminReconciliationItem[]>([]);
  const [documents, setDocuments] = useState<AdminFinancialDocument[]>([]);
  const [paymentDetail, setPaymentDetail] = useState<AdminFinancePaymentDetail | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<AdminFinancialDocument | null>(null);
  const [editingRule, setEditingRule] = useState<AdminCommissionRule | null>(null);
  const [commissionDraft, setCommissionDraft] = useState<CommissionDraft>(emptyCommissionDraft);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);
  const [documentDetailLoading, setDocumentDetailLoading] = useState(false);
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentGatewayFilter, setPaymentGatewayFilter] = useState('');
  const [paymentSubjectFilter, setPaymentSubjectFilter] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [escrowStatusFilter, setEscrowStatusFilter] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('');
  const [transactionReferenceFilter, setTransactionReferenceFilter] = useState('');
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [reconciliationStatusFilter, setReconciliationStatusFilter] = useState('');

  const nextRequest = useCallback((key: string) => {
    const next = (requestRef.current[key] ?? 0) + 1;
    requestRef.current[key] = next;
    return next;
  }, []);

  const isLatest = useCallback(
    (key: string, requestId: number) => mountedRef.current && requestRef.current[key] === requestId,
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadOverview = useCallback(async () => {
    const requestId = nextRequest('overview');
    setOverviewLoading(true);
    try {
      const response = await adminFinanceApi.getOverview();
      const data = unwrapApiResponse<AdminFinanceOverview>(response.data as any);
      if (!isLatest('overview', requestId)) return;
      setOverview(data);
    } catch (error: any) {
      if (isLatest('overview', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load finance overview');
      }
    } finally {
      if (isLatest('overview', requestId)) setOverviewLoading(false);
    }
  }, [isLatest, nextRequest]);

  const loadPayments = useCallback(async () => {
    const requestId = nextRequest('payments');
    setPaymentsLoading(true);
    try {
      const response = await adminFinanceApi.listPayments({
        take: '50',
        ...(paymentStatusFilter ? { status: paymentStatusFilter } : {}),
        ...(paymentGatewayFilter ? { gateway: paymentGatewayFilter } : {}),
        ...(paymentSubjectFilter ? { subjectType: paymentSubjectFilter } : {}),
        ...(paymentQuery.trim() ? { q: paymentQuery.trim() } : {}),
      });
      const data = unwrapApiResponse<{ items: AdminFinancePaymentAttempt[] }>(response.data as any);
      if (!isLatest('payments', requestId)) return;
      setPayments(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      if (isLatest('payments', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load payment attempts');
      }
    } finally {
      if (isLatest('payments', requestId)) setPaymentsLoading(false);
    }
  }, [
    isLatest,
    nextRequest,
    paymentGatewayFilter,
    paymentQuery,
    paymentStatusFilter,
    paymentSubjectFilter,
  ]);

  const loadEscrow = useCallback(async () => {
    const requestId = nextRequest('escrow');
    setEscrowLoading(true);
    try {
      const response = await adminFinanceApi.listEscrowHolds({
        take: '60',
        ...(escrowStatusFilter ? { status: escrowStatusFilter } : {}),
      });
      const data = unwrapApiResponse<{ items: AdminEscrowHold[] }>(response.data as any);
      if (!isLatest('escrow', requestId)) return;
      setEscrowHolds(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      if (isLatest('escrow', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load escrow holds');
      }
    } finally {
      if (isLatest('escrow', requestId)) setEscrowLoading(false);
    }
  }, [escrowStatusFilter, isLatest, nextRequest]);

  const loadTransactions = useCallback(async () => {
    const requestId = nextRequest('transactions');
    setTransactionsLoading(true);
    try {
      const response = await adminFinanceApi.listTransactions({
        take: '60',
        ...(transactionTypeFilter ? { type: transactionTypeFilter } : {}),
        ...(transactionReferenceFilter ? { referenceType: transactionReferenceFilter } : {}),
        ...(transactionDateFrom ? { dateFrom: transactionDateFrom } : {}),
        ...(transactionDateTo ? { dateTo: transactionDateTo } : {}),
      });
      const data = unwrapApiResponse<{ items: AdminFinanceTransaction[] }>(response.data as any);
      if (!isLatest('transactions', requestId)) return;
      setTransactions(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      if (isLatest('transactions', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load ledger transactions');
      }
    } finally {
      if (isLatest('transactions', requestId)) setTransactionsLoading(false);
    }
  }, [
    isLatest,
    nextRequest,
    transactionDateFrom,
    transactionDateTo,
    transactionReferenceFilter,
    transactionTypeFilter,
  ]);

  const loadCommissionRules = useCallback(async () => {
    const requestId = nextRequest('commission');
    setCommissionLoading(true);
    try {
      const response = await adminFinanceApi.listCommissionRules();
      const data = unwrapApiResponse<AdminCommissionRule[]>(response.data as any);
      if (!isLatest('commission', requestId)) return;
      setCommissionRules(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (isLatest('commission', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load commission rules');
      }
    } finally {
      if (isLatest('commission', requestId)) setCommissionLoading(false);
    }
  }, [isLatest, nextRequest]);

  const loadReconciliation = useCallback(async () => {
    const requestId = nextRequest('reconciliation');
    setReconciliationLoading(true);
    try {
      const [runsResponse, itemsResponse] = await Promise.all([
        adminFinanceApi.listReconciliationRuns({ take: '12' }),
        adminFinanceApi.listReconciliationItems({
          take: '30',
          ...(reconciliationStatusFilter ? { status: reconciliationStatusFilter } : {}),
        }),
      ]);
      const runs = unwrapApiResponse<AdminReconciliationRun[]>(runsResponse.data as any);
      const items = unwrapApiResponse<AdminReconciliationItem[]>(itemsResponse.data as any);
      if (!isLatest('reconciliation', requestId)) return;
      setReconciliationRuns(Array.isArray(runs) ? runs : []);
      setReconciliationItems(Array.isArray(items) ? items : []);
    } catch (error: any) {
      if (isLatest('reconciliation', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load reconciliation queue');
      }
    } finally {
      if (isLatest('reconciliation', requestId)) setReconciliationLoading(false);
    }
  }, [isLatest, nextRequest, reconciliationStatusFilter]);

  const loadDocuments = useCallback(async () => {
    const requestId = nextRequest('documents');
    setDocumentsLoading(true);
    try {
      const response = await adminFinanceApi.listDocuments({
        take: '40',
        ...(documentTypeFilter ? { type: documentTypeFilter } : {}),
      });
      const data = unwrapApiResponse<AdminFinancialDocument[]>(response.data as any);
      if (!isLatest('documents', requestId)) return;
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (isLatest('documents', requestId)) {
        toast.error(error?.response?.data?.message || 'Unable to load financial documents');
      }
    } finally {
      if (isLatest('documents', requestId)) setDocumentsLoading(false);
    }
  }, [documentTypeFilter, isLatest, nextRequest]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'payments') void loadPayments();
    if (activeTab === 'escrow') void loadEscrow();
    if (activeTab === 'transactions') void loadTransactions();
    if (activeTab === 'commission') void loadCommissionRules();
    if (activeTab === 'reconciliation') void loadReconciliation();
    if (activeTab === 'documents') void loadDocuments();
  }, [activeTab, loadCommissionRules, loadDocuments, loadEscrow, loadPayments, loadReconciliation, loadTransactions]);

  const openReference = useCallback(
    (referenceType?: string | null, referenceId?: string | null) => {
      const normalized = String(referenceType || '').trim().toUpperCase();
      if (!referenceId) {
        toast.error('This finance record has no linked order reference.');
        return;
      }
      if (normalized === 'CUSTOMORDER' || normalized === 'CUSTOM_ORDER') {
        navigate(`/admin/custom-orders/${referenceId}`);
        return;
      }
      if (normalized === 'ORDER' || normalized === 'STANDARD_ORDER') {
        navigate(`/admin/orders/${referenceId}`);
        return;
      }
      toast.error('This finance record is linked, but the reference type is not routable in the admin app.');
    },
    [navigate],
  );

  const refreshCurrentTab = useCallback(() => {
    void loadOverview();
    if (activeTab === 'payments') void loadPayments();
    if (activeTab === 'escrow') void loadEscrow();
    if (activeTab === 'transactions') void loadTransactions();
    if (activeTab === 'commission') void loadCommissionRules();
    if (activeTab === 'reconciliation') void loadReconciliation();
    if (activeTab === 'documents') void loadDocuments();
  }, [activeTab, loadCommissionRules, loadDocuments, loadEscrow, loadOverview, loadPayments, loadReconciliation, loadTransactions]);

  const openPaymentDetail = useCallback(async (reference: string) => {
    setPaymentDetail(null);
    setPaymentDetailLoading(true);
    try {
      const response = await adminFinanceApi.getPayment(reference);
      const detail = unwrapApiResponse<AdminFinancePaymentDetail>(response.data as any);
      setPaymentDetail(detail);
      return detail;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load payment detail');
      return null;
    } finally {
      setPaymentDetailLoading(false);
    }
  }, []);

  const closePaymentDetail = useCallback(() => {
    setPaymentDetail(null);
    setPaymentDetailLoading(false);
    if (routePaymentReference) {
      navigate('/admin/finance', { replace: true });
    }
  }, [navigate, routePaymentReference]);

  useEffect(() => {
    if (!routePaymentReference) {
      setPaymentDetail(null);
      setPaymentDetailLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const nextDetail = await openPaymentDetail(routePaymentReference);
      if (!nextDetail && !cancelled) {
        navigate('/admin/finance', { replace: true });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, openPaymentDetail, routePaymentReference]);

  const openDocumentDetail = useCallback(async (id: string) => {
    setSelectedDocument(null);
    setDocumentDetailLoading(true);
    try {
      const response = await adminFinanceApi.getDocument(id);
      setSelectedDocument(unwrapApiResponse<AdminFinancialDocument>(response.data as any));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load document detail');
    } finally {
      setDocumentDetailLoading(false);
    }
  }, []);

  const handleEscrowAction = useCallback(
    async (hold: AdminEscrowHold, action: 'release' | 'freeze' | 'unfreeze') => {
      setBusyKey(`${action}:${hold.id}`);
      try {
        if (action === 'release') {
          const note = window.prompt('Optional release note', '') || '';
          await adminFinanceApi.releaseEscrowHold(hold.id, {
            holdType: hold.holdType === 'CUSTOM_ORDER' ? 'CUSTOM_ORDER' : 'STANDARD_ORDER',
            note: note.trim() || undefined,
          });
          toast.success('Escrow hold released');
        }
        if (action === 'freeze') {
          const reason = window.prompt('Freeze reason');
          if (!reason || !reason.trim()) {
            toast.error('Freeze reason is required');
            return;
          }
          await adminFinanceApi.freezeEscrowHold(hold.id, reason.trim());
          toast.success('Escrow hold frozen');
        }
        if (action === 'unfreeze') {
          await adminFinanceApi.unfreezeEscrowHold(hold.id);
          toast.success('Escrow hold unfrozen');
        }
        void loadEscrow();
        void loadOverview();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Escrow action failed');
      } finally {
        setBusyKey(null);
      }
    },
    [loadEscrow, loadOverview],
  );

  const handleRunReconciliation = useCallback(
    async (scope: 'PAYMENTS' | 'PAYOUTS' | 'LEDGER_INTEGRITY') => {
      setBusyKey(`run:${scope}`);
      try {
        await adminFinanceApi.createReconciliationRun({ scope });
        toast.success(`${prettify(scope)} reconciliation started`);
        void loadReconciliation();
        void loadOverview();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Unable to start reconciliation run');
      } finally {
        setBusyKey(null);
      }
    },
    [loadOverview, loadReconciliation],
  );

  const handleReconciliationAction = useCallback(
    async (item: AdminReconciliationItem, action: 'claim' | 'release' | 'resolve') => {
      setBusyKey(`${action}:${item.id}`);
      try {
        if (action === 'claim') await adminFinanceApi.claimReconciliationItem(item.id);
        if (action === 'release') {
          const reason = window.prompt('Optional release reason', '') || '';
          await adminFinanceApi.releaseReconciliationItem(item.id, reason.trim() || undefined);
        }
        if (action === 'resolve') {
          const note = window.prompt('Resolution note');
          if (!note || !note.trim()) {
            toast.error('Resolution note is required');
            return;
          }
          await adminFinanceApi.resolveReconciliationItem(item.id, note.trim());
        }
        toast.success(`Reconciliation item ${action}d`);
        void loadReconciliation();
        void loadOverview();
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Reconciliation action failed');
      } finally {
        setBusyKey(null);
      }
    },
    [loadOverview, loadReconciliation],
  );

  const openCreateRule = useCallback(() => {
    setEditingRule(null);
    setCommissionDraft(emptyCommissionDraft());
    setCommissionModalOpen(true);
  }, []);

  const openEditRule = useCallback((rule: AdminCommissionRule) => {
    setEditingRule(rule);
    setCommissionDraft({
      name: rule.name,
      scope: rule.scope,
      brandId: String(rule.brandId || ''),
      currency: String(rule.currency || 'NGN'),
      ratePercent: String(rule.ratePercent || ''),
      minFeeAmount: String(rule.minFeeAmount || ''),
      maxFeeAmount: String(rule.maxFeeAmount || ''),
      isDefault: Boolean(rule.isDefault),
      isActive: Boolean(rule.isActive),
    });
    setCommissionModalOpen(true);
  }, []);

  const closeRuleModal = useCallback(() => {
    setEditingRule(null);
    setCommissionDraft(emptyCommissionDraft());
    setCommissionModalOpen(false);
  }, []);

  const submitRule = useCallback(async () => {
    const name = commissionDraft.name.trim();
    const ratePercent = Number(commissionDraft.ratePercent || 0);
    if (!name) {
      toast.error('Rule name is required');
      return;
    }
    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      toast.error('Commission rate must be a valid number');
      return;
    }

    setCommissionSubmitting(true);
    try {
      if (editingRule) {
        await adminFinanceApi.updateCommissionRule(editingRule.id, {
          name,
          currency: commissionDraft.currency.trim().toUpperCase(),
          ratePercent,
          minFeeAmount: parseOptionalNumber(commissionDraft.minFeeAmount) ?? null,
          maxFeeAmount: parseOptionalNumber(commissionDraft.maxFeeAmount) ?? null,
          isDefault: commissionDraft.isDefault,
          isActive: commissionDraft.isActive,
        });
        toast.success('Commission rule updated');
      } else {
        await adminFinanceApi.createCommissionRule({
          name,
          scope: commissionDraft.scope,
          brandId: commissionDraft.scope === 'BRAND' ? commissionDraft.brandId.trim() || null : null,
          currency: commissionDraft.currency.trim().toUpperCase(),
          ratePercent,
          minFeeAmount: parseOptionalNumber(commissionDraft.minFeeAmount) ?? null,
          maxFeeAmount: parseOptionalNumber(commissionDraft.maxFeeAmount) ?? null,
          isDefault: commissionDraft.isDefault,
          isActive: commissionDraft.isActive,
        });
        toast.success('Commission rule created');
      }
      closeRuleModal();
      void loadCommissionRules();
      void loadOverview();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save commission rule');
    } finally {
      setCommissionSubmitting(false);
    }
  }, [closeRuleModal, commissionDraft, editingRule, loadCommissionRules, loadOverview]);

  const unresolvedPayments = useMemo(
    () => payments.filter((item) => String(item.status).toUpperCase() !== 'PAID').length,
    [payments],
  );

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Finance' }]} />
      <section className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">📒 Finance Console</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Admin source of truth for captured payments, escrow, ledger activity, commission rules, reconciliation, and generated finance documents.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshCurrentTab}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              🔄 Refresh
            </button>
            {canProcess && (
              <button
                type="button"
                onClick={() => void handleRunReconciliation('LEDGER_INTEGRITY')}
                disabled={busyKey === 'run:LEDGER_INTEGRITY'}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {busyKey === 'run:LEDGER_INTEGRITY' ? 'Running...' : '🧾 Run ledger check'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overviewLoading ? (
            [1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.04]" />)
          ) : (
            <>
              <MetricCard label="Gross volume" value={amountOf(overview?.gmv, overview?.currency)} note="Captured buyer payments" />
              <MetricCard label="Commissions" value={amountOf(overview?.totalCommissions, overview?.currency)} note="Platform revenue" />
              <MetricCard label="Payouts" value={amountOf(overview?.totalPayouts, overview?.currency)} note="Paid out to brands" />
              <MetricCard label="Refunds" value={amountOf(overview?.totalRefunds, overview?.currency)} note="Money returned out" />
            </>
          )}
        </div>

        {!overviewLoading && overview ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <PillStat label="Pending payouts" value={String(overview.pendingPayouts ?? 0)} />
            <PillStat label="Open escrow" value={String(overview.activeEscrowHolds ?? 0)} />
            <PillStat label="Unresolved reconciliation" value={String(overview.unresolvedReconciliationItems)} />
            <PillStat label="Unresolved payments" value={String(unresolvedPayments)} />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border border-black/10 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {FINANCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[76vh] overflow-y-auto px-4 py-4">
          {activeTab === 'overview' && (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <Panel title="Recent Reconciliation Runs" description="Latest finance integrity jobs">
                <TableWrap loading={overviewLoading} empty={!overview?.recentRuns?.length} emptyMessage="No reconciliation runs yet.">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                        <th className="px-4 py-3 font-medium">Scope</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Started</th>
                        <th className="px-4 py-3 font-medium">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview?.recentRuns ?? []).map((run) => (
                        <tr key={run.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{prettify(run.scope)}</td>
                          <td className="px-4 py-3"><Badge tone={toneFor(run.status, 'run')} label={prettify(run.status)} /></td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(run.startedAt)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{run._count?.items ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>

              <Panel title="Recent Finance Documents" description="Newest receipts and statements">
                <TableWrap loading={overviewLoading} empty={!overview?.recentDocuments?.length} emptyMessage="No finance documents yet.">
                  <div className="space-y-2">
                    {(overview?.recentDocuments ?? []).map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => void openDocumentDetail(document.id)}
                        className="w-full rounded-2xl border border-black/5 bg-slate-50/70 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100/80 dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{prettify(document.type)}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{document.documentNumber} • {formatDate(document.issuedAt)}</div>
                          </div>
                          <Badge tone={toneFor(document.status, 'document')} label={prettify(document.status)} />
                        </div>
                      </button>
                    ))}
                  </div>
                </TableWrap>
              </Panel>
            </div>
          )}

          {activeTab === 'payments' && (
            <Panel title="Payment Attempts" description="Every captured or attempted payment across standard and custom orders">
              <div className="grid gap-3 pb-4 md:grid-cols-2 xl:grid-cols-4">
                <UniversalSelect value={paymentStatusFilter} onChange={setPaymentStatusFilter} options={SELECTS.paymentStatus} placeholder="Status" />
                <UniversalSelect value={paymentGatewayFilter} onChange={setPaymentGatewayFilter} options={SELECTS.paymentGateway} placeholder="Gateway" />
                <UniversalSelect value={paymentSubjectFilter} onChange={setPaymentSubjectFilter} options={SELECTS.paymentSubject} placeholder="Subject" />
                <InputShell>
                  <input value={paymentQuery} onChange={(event) => setPaymentQuery(event.target.value)} placeholder="Reference or gateway" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white" />
                </InputShell>
              </div>
              <TableWrap loading={paymentsLoading} empty={!payments.length} emptyMessage="No payment attempts matched the current filters.">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Brands</th>
                      <th className="px-4 py-3 font-medium">Orders</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Gateway</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{attempt.reference}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{prettify(attempt.subjectType)} • {formatDate(attempt.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{attempt.buyer?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{attempt.brands.map((brand) => brand.name || compactId(brand.id)).join(', ') || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{attempt.orders.map((order) => order.title).join(', ')}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{amountOf(attempt.amount, attempt.currency)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{prettify(attempt.gateway)} • {attempt.providerMode}</td>
                        <td className="px-4 py-3"><Badge tone={toneFor(attempt.status, 'payment')} label={prettify(attempt.status)} /></td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => navigate(`/admin/finance/payments/${encodeURIComponent(attempt.reference)}`)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}

          {activeTab === 'escrow' && (
            <Panel title="Escrow Holds" description="Held funds, frozen positions, and manual-release controls">
              <div className="grid gap-3 pb-4 md:max-w-sm">
                <UniversalSelect value={escrowStatusFilter} onChange={setEscrowStatusFilter} options={SELECTS.escrowStatus} placeholder="Hold status" />
              </div>
              <TableWrap loading={escrowLoading} empty={!escrowHolds.length} emptyMessage="No escrow holds matched the current filters.">
                <table className="w-full min-w-[1020px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Brand</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Gross</th>
                      <th className="px-4 py-3 font-medium">Released</th>
                      <th className="px-4 py-3 font-medium">Still held</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrowHolds.map((hold) => (
                      <tr key={hold.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{hold.title}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{prettify(hold.holdType)} • {compactId(hold.referenceId)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{hold.brand?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{hold.buyerName || '—'}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{amountOf(hold.grossAmount, hold.currency)}</td>
                        <td className="px-4 py-3 text-sky-700 dark:text-sky-300">{amountOf(hold.releasedNetAmount, hold.currency)}</td>
                        <td className="px-4 py-3 font-semibold text-rose-700 dark:text-rose-300">{amountOf(hold.heldNetAmount, hold.currency)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={toneFor(hold.status, 'escrow')} label={prettify(hold.status)} />
                          {hold.frozenReason ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">{hold.frozenReason}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openReference(hold.holdType === 'CUSTOM_ORDER' ? 'CustomOrder' : 'Order', hold.referenceId)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                              View order
                            </button>
                            {canProcess && hold.canManualRelease && (
                              <button type="button" onClick={() => void handleEscrowAction(hold, 'release')} disabled={busyKey === `release:${hold.id}`} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                                Release
                              </button>
                            )}
                            {canProcess && hold.holdType === 'STANDARD_ORDER' && hold.status !== 'FROZEN' && (
                              <button type="button" onClick={() => void handleEscrowAction(hold, 'freeze')} disabled={busyKey === `freeze:${hold.id}`} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                                Freeze
                              </button>
                            )}
                            {canProcess && hold.holdType === 'STANDARD_ORDER' && hold.status === 'FROZEN' && (
                              <button type="button" onClick={() => void handleEscrowAction(hold, 'unfreeze')} disabled={busyKey === `unfreeze:${hold.id}`} className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                                Unfreeze
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}

          {activeTab === 'transactions' && (
            <Panel title="Ledger Transactions" description="Filterable payment, release, payout, refund, and reversal activity">
              <div className="grid gap-3 pb-4 md:grid-cols-2 xl:grid-cols-4">
                <UniversalSelect value={transactionTypeFilter} onChange={setTransactionTypeFilter} options={SELECTS.transactionType} placeholder="Transaction type" />
                <UniversalSelect value={transactionReferenceFilter} onChange={setTransactionReferenceFilter} options={SELECTS.transactionReference} placeholder="Reference type" />
                <InputShell>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Date from</div>
                  <input type="date" value={transactionDateFrom} onChange={(event) => setTransactionDateFrom(event.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" />
                </InputShell>
                <InputShell>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Date to</div>
                  <input type="date" value={transactionDateTo} onChange={(event) => setTransactionDateTo(event.target.value)} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" />
                </InputShell>
              </div>
              <TableWrap loading={transactionsLoading} empty={!transactions.length} emptyMessage="No ledger transactions matched the current filters.">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Brand</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{transaction.description}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{transaction.referenceTitle || '—'} • {formatDate(transaction.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{prettify(transaction.type)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{prettify(transaction.referenceType)} {compactId(transaction.referenceId)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{transaction.brand?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{transaction.buyerName || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{amountOf(transaction.totalAmount, transaction.currency)}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => openReference(transaction.referenceType, transaction.referenceId)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                            View order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}

          {activeTab === 'commission' && (
            <Panel title="Commission Rules" description="Platform and brand-specific commission configuration">
              <div className="mb-4 flex justify-end">
                {canProcess && (
                  <button type="button" onClick={openCreateRule} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950">
                    ➕ New rule
                  </button>
                )}
              </div>
              <TableWrap loading={commissionLoading} empty={!commissionRules.length} emptyMessage="No commission rules found.">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Rule</th>
                      <th className="px-4 py-3 font-medium">Scope</th>
                      <th className="px-4 py-3 font-medium">Currency</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Min fee</th>
                      <th className="px-4 py-3 font-medium">Max fee</th>
                      <th className="px-4 py-3 font-medium">State</th>
                      {canProcess && <th className="px-4 py-3 font-medium">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {commissionRules.map((rule) => (
                      <tr key={rule.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{rule.name}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rule.isDefault ? 'Default rule' : 'Specific override'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{prettify(rule.scope)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rule.currency || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{rule.ratePercent}%</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rule.minFeeAmount || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rule.maxFeeAmount || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{rule.isActive ? 'Active' : 'Inactive'}{rule.isDefault ? ' • Default' : ''}</td>
                        {canProcess && (
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => openEditRule(rule)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}

          {activeTab === 'reconciliation' && (
            <div className="space-y-4">
              <Panel title="Reconciliation Runs" description="Trigger and inspect integrity jobs">
                <div className="mb-4 flex flex-wrap gap-2">
                  {canProcess && (
                    <>
                      <button type="button" onClick={() => void handleRunReconciliation('PAYMENTS')} disabled={busyKey === 'run:PAYMENTS'} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950">
                        {busyKey === 'run:PAYMENTS' ? 'Running...' : '💳 Run payments'}
                      </button>
                      <button type="button" onClick={() => void handleRunReconciliation('PAYOUTS')} disabled={busyKey === 'run:PAYOUTS'} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                        {busyKey === 'run:PAYOUTS' ? 'Running...' : '💰 Run payouts'}
                      </button>
                    </>
                  )}
                </div>
                <TableWrap loading={reconciliationLoading} empty={!reconciliationRuns.length} emptyMessage="No reconciliation runs yet.">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                        <th className="px-4 py-3 font-medium">Scope</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Started</th>
                        <th className="px-4 py-3 font-medium">Completed</th>
                        <th className="px-4 py-3 font-medium">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationRuns.map((run) => (
                        <tr key={run.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{prettify(run.scope)}</td>
                          <td className="px-4 py-3"><Badge tone={toneFor(run.status, 'run')} label={prettify(run.status)} /></td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(run.startedAt)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(run.completedAt || run.failedAt)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{run._count?.items ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>

              <Panel title="Reconciliation Queue" description="Claim, release, or resolve live finance exceptions">
                <div className="grid gap-3 pb-4 md:max-w-sm">
                  <UniversalSelect value={reconciliationStatusFilter} onChange={setReconciliationStatusFilter} options={SELECTS.reconciliationStatus} placeholder="Exception status" />
                </div>
                <TableWrap loading={reconciliationLoading} empty={!reconciliationItems.length} emptyMessage="No reconciliation items matched the current filters.">
                  <table className="w-full min-w-[1020px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                        <th className="px-4 py-3 font-medium">Summary</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Reference</th>
                        <th className="px-4 py-3 font-medium">Expected</th>
                        <th className="px-4 py-3 font-medium">Actual</th>
                        <th className="px-4 py-3 font-medium">Assigned</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationItems.map((item) => (
                        <tr key={item.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{item.summary}</div>
                            {item.resolutionNote ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.resolutionNote}</div> : null}
                          </td>
                          <td className="px-4 py-3"><Badge tone={toneFor(item.status, 'reconciliation')} label={prettify(item.status)} /></td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{prettify(item.referenceType)} {compactId(item.referenceId)}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.expectedAmount ? amountOf(item.expectedAmount, item.currency || 'NGN') : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.actualAmount ? amountOf(item.actualAmount, item.currency || 'NGN') : '—'}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.assignedAdminId ? compactId(item.assignedAdminId) : 'Unclaimed'}</td>
                          <td className="px-4 py-3">
                            {canProcess && item.status !== 'RESOLVED' ? (
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => void handleReconciliationAction(item, 'claim')} disabled={busyKey === `claim:${item.id}`} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">Claim</button>
                                <button type="button" onClick={() => void handleReconciliationAction(item, 'release')} disabled={busyKey === `release:${item.id}`} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">Release</button>
                                <button type="button" onClick={() => void handleReconciliationAction(item, 'resolve')} disabled={busyKey === `resolve:${item.id}`} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">Resolve</button>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>
            </div>
          )}

          {activeTab === 'documents' && (
            <Panel title="Financial Documents" description="Receipts, settlement statements, commission invoices, and credit notes">
              <div className="grid gap-3 pb-4 md:max-w-sm">
                <UniversalSelect value={documentTypeFilter} onChange={setDocumentTypeFilter} options={SELECTS.documentType} placeholder="Document type" />
              </div>
              <TableWrap loading={documentsLoading} empty={!documents.length} emptyMessage="No documents matched the current filters.">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Gross</th>
                      <th className="px-4 py-3 font-medium">Commission</th>
                      <th className="px-4 py-3 font-medium">Net</th>
                      <th className="px-4 py-3 font-medium">Issued</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id} className="border-b border-black/5 last:border-b-0 dark:border-white/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{prettify(document.type)}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{document.documentNumber}</div>
                        </td>
                        <td className="px-4 py-3"><Badge tone={toneFor(document.status, 'document')} label={prettify(document.status)} /></td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{amountOf(document.grossAmount, document.currency)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{document.commissionAmount ? amountOf(document.commissionAmount, document.currency) : '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{document.netAmount ? amountOf(document.netAmount, document.currency) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(document.issuedAt)}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => void openDocumentDetail(document.id)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}
        </div>
      </section>

      <Modal open={paymentDetailLoading || Boolean(paymentDetail)} onClose={closePaymentDetail} title="Payment Detail" size="xl">
        {paymentDetailLoading ? <LoaderBlock /> : paymentDetail ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Reference" value={paymentDetail.reference} note={prettify(paymentDetail.gateway)} />
              <MetricCard label="Status" value={prettify(paymentDetail.status)} note={paymentDetail.providerMode} />
              <MetricCard label="Amount" value={amountOf(paymentDetail.amount, paymentDetail.currency)} note={formatDate(paymentDetail.confirmedAt || paymentDetail.createdAt)} />
            </div>
            <Panel title="Linked Objects" description="Orders or custom orders tied to this payment">
              <div className="space-y-2">
                {paymentDetail.customOrder ? (
                  <button type="button" onClick={() => openReference('CustomOrder', paymentDetail.customOrder?.id)} className="w-full rounded-2xl border border-black/10 bg-slate-50/70 px-4 py-3 text-left dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="font-semibold text-slate-900 dark:text-white">{paymentDetail.customOrder.title || paymentDetail.customOrder.sourceTitleSnapshot || 'Custom order'}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{paymentDetail.customOrder.brand?.name || '—'} • {compactId(paymentDetail.customOrder.id)}</div>
                  </button>
                ) : paymentDetail.orders.map((order) => (
                  <button key={order.id} type="button" onClick={() => openReference('Order', order.id)} className="w-full rounded-2xl border border-black/10 bg-slate-50/70 px-4 py-3 text-left dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="font-semibold text-slate-900 dark:text-white">Standard order {compactId(order.id)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{order.brand?.name || '—'} • {amountOf(order.totalAmount, order.currency)}</div>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Provider Snapshots" description="Stored request and verification payloads">
              <Snapshot title="Request snapshot" value={paymentDetail.requestSnapshot} />
              <Snapshot title="Response snapshot" value={paymentDetail.responseSnapshot} />
              <Snapshot title="Next action" value={paymentDetail.nextAction} />
              <Snapshot title="Bank account" value={paymentDetail.bankAccount} />
            </Panel>
            <Panel title="Event Trail" description="Recorded payment lifecycle events">
              <div className="space-y-2">
                {paymentDetail.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-black/10 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="font-semibold text-slate-900 dark:text-white">{event.type}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.source} • {formatDate(event.createdAt)}</div>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">{jsonPreview(event.payload)}</pre>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
      </Modal>

      <Modal open={documentDetailLoading || Boolean(selectedDocument)} onClose={() => { setSelectedDocument(null); setDocumentDetailLoading(false); }} title="Financial Document" size="lg">
        {documentDetailLoading ? <LoaderBlock /> : selectedDocument ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Document" value={selectedDocument.documentNumber} note={prettify(selectedDocument.type)} />
              <MetricCard label="Status" value={prettify(selectedDocument.status)} note={formatDate(selectedDocument.issuedAt)} />
            </div>
            <Snapshot title="Metadata" value={selectedDocument.metadataJson} />
            <Snapshot title="Stored HTML source" value={selectedDocument.contentHtml} />
          </div>
        ) : null}
      </Modal>

      <Modal open={commissionModalOpen} onClose={closeRuleModal} title={editingRule ? 'Edit Commission Rule' : 'Create Commission Rule'} size="md">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rule name</div><input value={commissionDraft.name} onChange={(event) => setCommissionDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
            <UniversalSelect value={commissionDraft.scope} onChange={(value) => setCommissionDraft((current) => ({ ...current, scope: value as 'PLATFORM' | 'BRAND' }))} options={SELECTS.commissionScope} placeholder="Scope" />
            {commissionDraft.scope === 'BRAND' ? (
              <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Brand ID</div><input value={commissionDraft.brandId} onChange={(event) => setCommissionDraft((current) => ({ ...current, brandId: event.target.value }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
            ) : null}
            <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Currency</div><input value={commissionDraft.currency} onChange={(event) => setCommissionDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
            <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rate %</div><input value={commissionDraft.ratePercent} onChange={(event) => setCommissionDraft((current) => ({ ...current, ratePercent: event.target.value }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
            <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Min fee</div><input value={commissionDraft.minFeeAmount} onChange={(event) => setCommissionDraft((current) => ({ ...current, minFeeAmount: event.target.value }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
            <InputShell><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Max fee</div><input value={commissionDraft.maxFeeAmount} onChange={(event) => setCommissionDraft((current) => ({ ...current, maxFeeAmount: event.target.value }))} className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white" /></InputShell>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Default rule" checked={commissionDraft.isDefault} onToggle={() => setCommissionDraft((current) => ({ ...current, isDefault: !current.isDefault }))} />
            <Toggle label="Active" checked={commissionDraft.isActive} onToggle={() => setCommissionDraft((current) => ({ ...current, isActive: !current.isActive }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeRuleModal} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]">Cancel</button>
            <button type="button" onClick={() => void submitRule()} disabled={commissionSubmitting} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950">
              {commissionSubmitting ? 'Saving...' : editingRule ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const Panel: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="rounded-3xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
    </div>
    {children}
  </section>
);

const TableWrap: React.FC<{ loading: boolean; empty: boolean; emptyMessage: string; children: React.ReactNode }> = ({ loading, empty, emptyMessage, children }) => {
  if (loading) return <LoaderBlock />;
  if (empty) return <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">{emptyMessage}</div>;
  return <div className="overflow-x-auto scrollbar-hide">{children}</div>;
};

const LoaderBlock = () => (
  <div className="py-16">
    <VLoader size={34} phase="loading" showLabel={false} />
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="rounded-3xl border border-black/10 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</div>
  </div>
);

const PillStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/[0.03]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

const Badge: React.FC<{ tone: string; label: string }> = ({ tone, label }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
);

const InputShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">{children}</div>
);

const Snapshot: React.FC<{ title: string; value: unknown }> = ({ title, value }) => (
  <div>
    <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
    <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">{jsonPreview(value)}</pre>
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onToggle: () => void }> = ({ label, checked, onToggle }) => (
  <button type="button" onClick={onToggle} className={`rounded-2xl border px-4 py-3 text-left transition ${checked ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.03]'}`}>
    <div className="text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{checked ? 'Enabled' : 'Disabled'}</div>
  </button>
);

export default AdminFinancePage;
