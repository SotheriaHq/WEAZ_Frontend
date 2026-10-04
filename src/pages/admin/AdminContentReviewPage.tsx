import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flag,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  adminContentReviewApi,
} from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { queryKeys } from '@/query/queryKeys';
import type {
  AdminContentReport,
  AdminContentReportListResponse,
  AdminContentReviewListResponse,
  AdminContentSubmission,
  ContentReviewMediaItem,
  ContentReportStatus,
  ContentReviewReasonCode,
  ContentSubmissionStatus,
} from '@/types/admin';

type AdminContentReviewPageProps = {
  embedded?: boolean;
};

type ReviewFilters = {
  status: string;
  entityType: string;
  trustTier: string;
  reviewMode: string;
  brandId: string;
  q: string;
  from: string;
  to: string;
};

type DecisionAction = 'approve' | 'reject' | 'request_changes';

type PendingDecision = {
  action: DecisionAction;
  submission: AdminContentSubmission;
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'IN_REVIEW', label: 'Pending Review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes Requested' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'APPROVED', label: 'Approved/Published' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'SUPERSEDED', label: 'Superseded' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'DESIGN', label: 'Design' },
];

const TRUST_OPTIONS = [
  { value: 'ALL', label: 'All trust tiers' },
  { value: 'NEW', label: 'New' },
  { value: 'LOW_TRUST', label: 'Low Trust' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH_TRUST', label: 'High Trust' },
  { value: 'RESTRICTED', label: 'Restricted' },
];

const REVIEW_MODE_OPTIONS = [
  { value: 'ALL', label: 'All review modes' },
  { value: 'PRE_REVIEW_REQUIRED', label: 'Pre-review Required' },
  { value: 'POST_REVIEW_ALLOWED', label: 'Post-review Allowed' },
  { value: 'AUTO_PUBLISH_ALLOWED', label: 'Auto-publish Allowed' },
  { value: 'PUBLISH_DISABLED', label: 'Publish Disabled' },
];

const REPORT_STATUS_OPTIONS = [
  { value: 'REVIEWED', label: 'Mark Reviewed' },
  { value: 'RESOLVED', label: 'Resolve' },
  { value: 'DISMISSED', label: 'Dismiss' },
];

const statusLabel: Record<ContentSubmissionStatus, string> = {
  IN_REVIEW: 'Pending Review',
  APPROVED: 'Approved/Published',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Requested',
  CANCELLED: 'Cancelled',
  SUPERSEDED: 'Superseded',
};

const statusTone: Record<ContentSubmissionStatus, string> = {
  IN_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  CHANGES_REQUESTED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  SUPERSEDED: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
};

const reportStatusTone: Record<ContentReportStatus, string> = {
  OPEN: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  REVIEWED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  DISMISSED: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
};

const friendlyEnum = (value?: string | null) => {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const buildQuery = (filters: ReviewFilters) => {
  const params: Record<string, string> = { take: '50' };
  if (filters.status !== 'ALL') params.status = filters.status;
  if (filters.entityType !== 'ALL') params.entityType = filters.entityType;
  if (filters.trustTier !== 'ALL') params.trustTier = filters.trustTier;
  if (filters.reviewMode !== 'ALL') params.reviewMode = filters.reviewMode;
  if (filters.brandId.trim()) params.brandId = filters.brandId.trim();
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
};

const mediaIsVideo = (mediaType?: string | null, mimeType?: string | null) =>
  String(mediaType ?? '').toUpperCase().includes('VIDEO') ||
  String(mimeType ?? '').toLowerCase().startsWith('video/');

/**
 * Grid/tile source. Prefers the processed variants and only falls back to the
 * original upload when a file has none (still processing, or uploaded before
 * variants existed) — the original is a full-resolution camera file, and
 * pulling several of those into 300px squares is what made this modal crawl.
 */
const getMediaPreviewSrc = (media?: Pick<ContentReviewMediaItem, 'previewUrl' | 'thumbnailUrl' | 'url'> | null) =>
  media?.previewUrl?.trim() || media?.thumbnailUrl?.trim() || media?.url?.trim() || null;

/** Small source for a list row's 64px thumbnail. */
const getMediaThumbnailSrc = (media?: Pick<ContentReviewMediaItem, 'previewUrl' | 'thumbnailUrl' | 'url'> | null) =>
  media?.thumbnailUrl?.trim() || media?.previewUrl?.trim() || media?.url?.trim() || null;

const formatAmount = (amount?: number | null, currency?: string | null) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null;
  const code = (currency || 'NGN').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${code} ${Number(amount).toLocaleString()}`;
  }
};

const VerificationPill: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <span
    className={
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
      (ok
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200')
    }
  >
    <span aria-hidden="true">{ok ? '✅' : '⚠️'}</span>
    {label}
  </span>
);

const MediaUnavailablePreview: React.FC<{ label?: string }> = ({ label = 'Media unavailable' }) => (
  <div className="flex h-full w-full items-center justify-center bg-gray-100 px-4 text-center text-sm font-medium text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
    {label}
  </div>
);

const AdminReviewImagePreview: React.FC<{
  src: string;
  alt: string;
  /** The one tile a reviewer looks at first; everything else waits its turn. */
  eager?: boolean;
}> = ({ src, alt, eager = false }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return <MediaUnavailablePreview />;
  }

  return (
    <img
      src={src}
      alt={alt}
      // Off-screen tiles in a scrolling queue and a grid below the fold must not
      // compete for connections with the ones on screen.
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'low'}
      draggable={false}
      className={
        'h-full w-full object-cover transition-opacity duration-200 ' +
        (loaded ? 'opacity-100' : 'opacity-0')
      }
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
};

const buildReviewLifecycle = (submission: AdminContentSubmission) => {
  if (submission.reviewHistory.length > 0) {
    return submission.reviewHistory;
  }

  return [
    {
      id: `${submission.id}-current`,
      status: submission.status,
      reasonCode: submission.reasonCode ?? null,
      reasonLabel: submission.reasonLabel ?? null,
      reasonNote: submission.reasonNote ?? null,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt ?? null,
      reviewedById: submission.reviewedBy?.id ?? null,
      reviewedBy: submission.reviewedBy ?? null,
    },
  ];
};

const AdminContentReviewPage: React.FC<AdminContentReviewPageProps> = ({ embedded = false }) => {
  const { hasPermission } = useAdminPermissions();
  const canManage = hasPermission('CONTENT_REVIEW_MANAGE');
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReviewFilters>({
    status: 'ALL',
    entityType: 'ALL',
    trustTier: 'ALL',
    reviewMode: 'ALL',
    brandId: '',
    q: '',
    from: '',
    to: '',
  });
  const [submissions, setSubmissions] = useState<AdminContentSubmission[]>([]);
  const [summary, setSummary] = useState<AdminContentReviewListResponse['summary']>({
    pending: 0,
    changesRequested: 0,
    rejected: 0,
    approvedPublished: 0,
  });
  const [reports, setReports] = useState<AdminContentReport[]>([]);
  const [reportSummary, setReportSummary] = useState<AdminContentReportListResponse['summary']>({
    open: 0,
    reviewed: 0,
    resolved: 0,
    dismissed: 0,
  });
  const [reasonOptions, setReasonOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminContentSubmission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [reportResolution, setReportResolution] = useState<Record<string, { status: string; note: string }>>({});

  const activeFilterCount = useMemo(
    () =>
      Number(filters.status !== 'ALL') +
      Number(filters.entityType !== 'ALL') +
      Number(filters.trustTier !== 'ALL') +
      Number(filters.reviewMode !== 'ALL') +
      Number(Boolean(filters.brandId.trim())) +
      Number(Boolean(filters.q.trim())) +
      Number(Boolean(filters.from)) +
      Number(Boolean(filters.to)),
    [filters],
  );

  const loadReasons = useCallback(async () => {
    // Mirrors backend CONTENT_REVIEW_REASON_LABELS. The decision modal must
    // NEVER offer an empty reason list (reject/request-changes requires a
    // reason), so this local list backstops endpoint failures or old deploys.
    const FALLBACK_REASON_OPTIONS: Array<{ value: string; label: string }> = [
      { value: 'POOR_IMAGE_QUALITY', label: 'Poor image quality' },
      { value: 'MISSING_REQUIRED_VIEW', label: 'Missing required view' },
      { value: 'DUPLICATE_ANGLE', label: 'Duplicate angle uploaded' },
      { value: 'MODEL_FABRIC_MISMATCH', label: 'Media does not match product/design details' },
      { value: 'PROHIBITED_CONTENT', label: 'Offensive or unsafe content' },
      { value: 'AI_OR_MANIPULATED_IMAGE_SUSPECTED', label: 'Image looks AI-generated or heavily edited' },
      { value: 'WRONG_CATEGORY_OR_METADATA_MISMATCH', label: 'Incomplete or misleading product/design information' },
      { value: 'UNSAFE_OR_FALSE_CLAIM', label: 'Listing makes an unsafe or false claim' },
      { value: 'INTELLECTUAL_PROPERTY_OR_BRAND_MISUSE', label: 'Possible stolen or copyrighted image' },
      { value: 'NOT_A_PRODUCT_OR_DESIGN_LISTING', label: 'Wrong or unrelated image' },
      { value: 'OTHER', label: 'Other' },
    ];
    try {
      const response = await adminContentReviewApi.getReasonCodes();
      const payload = unwrapApiResponse(response.data as any) as Array<{ code: string; label: string }>;
      const options = Array.isArray(payload)
        ? payload
            .filter((reason) => reason?.code)
            .map((reason) => ({ value: reason.code, label: reason.label || reason.code }))
        : [];
      setReasonOptions(options.length > 0 ? options : FALLBACK_REASON_OPTIONS);
    } catch {
      setReasonOptions(FALLBACK_REASON_OPTIONS);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminContentReviewApi.listSubmissions(buildQuery(filters));
      const payload = unwrapApiResponse<AdminContentReviewListResponse>(response.data as any);
      setSubmissions(payload?.items ?? []);
      setSummary(payload?.summary ?? {
        pending: 0,
        changesRequested: 0,
        rejected: 0,
        approvedPublished: 0,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load content review queue');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await adminContentReviewApi.listReports({ take: '20' });
      const payload = unwrapApiResponse<AdminContentReportListResponse>(response.data as any);
      setReports(payload?.items ?? []);
      setReportSummary(payload?.summary ?? {
        open: 0,
        reviewed: 0,
        resolved: 0,
        dismissed: 0,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReasons();
  }, [loadReasons]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const loadDetail = async (submission: AdminContentSubmission) => {
    setSelected(submission);
    setDetailLoading(true);
    try {
      const response = await adminContentReviewApi.getSubmission(submission.id);
      const payload = unwrapApiResponse<AdminContentSubmission>(response.data as any);
      setSelected(payload);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load submission detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const openDecision = (submission: AdminContentSubmission, action: DecisionAction) => {
    if (!canManage) {
      toast.error('You do not have permission to manage content reviews.');
      return;
    }
    setPendingDecision({ action, submission });
    setDecisionReason('');
    setDecisionNote('');
    setDecisionError(null);
  };

  const runDecision = async () => {
    if (!pendingDecision) return;
    const { action, submission } = pendingDecision;
    if (action !== 'approve' && !decisionReason) {
      setDecisionError('Select a predefined reason before continuing.');
      return;
    }
    if (action !== 'approve' && decisionReason === 'OTHER' && !decisionNote.trim()) {
      setDecisionError('Add an admin note when using Other.');
      return;
    }

    setDecisionBusy(true);
    try {
      if (action === 'approve') {
        await adminContentReviewApi.approveSubmission(submission.id);
        toast.success('Content approved and published');
        // Fresh catalog/market data must paint after publish without a hard refresh.
        //
        // `['runway']` was missing, and Runway is the surface an admin lands on
        // straight after approving — so the newly published designs were absent
        // until a manual reload. Invalidating by ROOT key covers every
        // parameterised variant (`['runway','feed',{…}]` per filter/category),
        // which a single exact key would not.
        //
        // `refetchType: 'all'` matters here: by default React Query only
        // refetches queries that are currently mounted, and Runway is not
        // mounted yet at this moment. Without it the feed is merely marked
        // stale, and whether it refetches on arrival depends on staleTime —
        // which is exactly the "had to refresh manually" symptom.
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['runway'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['market'], refetchType: 'all' }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.market.sections(),
            refetchType: 'all',
          }),
          queryClient.invalidateQueries({ queryKey: ['designs'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['catalog'], refetchType: 'all' }),
        ]);
      } else if (action === 'reject') {
        await adminContentReviewApi.rejectSubmission(submission.id, {
          reasonCode: decisionReason as ContentReviewReasonCode,
          reasonNote: decisionNote.trim() || undefined,
        });
        toast.success('Submission rejected');
      } else {
        await adminContentReviewApi.requestChanges(submission.id, {
          reasonCode: decisionReason as ContentReviewReasonCode,
          reasonNote: decisionNote.trim() || undefined,
        });
        toast.success('Changes requested');
      }
      // A decision is terminal for this submission — close every modal in
      // the flow (decision dialog AND the review modal) and refresh the list.
      setPendingDecision(null);
      setDecisionReason('');
      setDecisionNote('');
      setSelected(null);
      await loadSubmissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update submission');
    } finally {
      setDecisionBusy(false);
    }
  };

  const resolveReport = async (report: AdminContentReport) => {
    if (!canManage) {
      toast.error('You do not have permission to resolve reports.');
      return;
    }
    const draft = reportResolution[report.id] ?? { status: 'REVIEWED', note: '' };
    try {
      await adminContentReviewApi.resolveReport(report.id, {
        status: draft.status as Exclude<ContentReportStatus, 'OPEN'>,
        resolution: draft.note.trim() || undefined,
      });
      toast.success('Report updated');
      await loadReports();
      if (selected) {
        await loadDetail(selected);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update report');
    }
  };

  const summaryItems = [
    { label: 'Pending Review', value: summary.pending, icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-300' },
    { label: 'Changes Requested', value: summary.changesRequested, icon: RefreshCw, tone: 'text-blue-600 dark:text-blue-300' },
    { label: 'Rejected', value: summary.rejected, icon: XCircle, tone: 'text-red-600 dark:text-red-300' },
    { label: 'Approved/Published', value: summary.approvedPublished, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-300' },
  ];

  return (
    <div className="space-y-6">
      {!embedded && <AdminBreadcrumb segments={[{ label: 'Content Review' }]} />}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Review</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Product and design submissions that need media integrity review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadSubmissions();
            void loadReports();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
                <Icon className={item.tone} size={18} />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-gray-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <UniversalSelect value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
          <UniversalSelect value={filters.entityType} onChange={(value) => setFilters((current) => ({ ...current, entityType: value }))} options={TYPE_OPTIONS} />
          <UniversalSelect value={filters.trustTier} onChange={(value) => setFilters((current) => ({ ...current, trustTier: value }))} options={TRUST_OPTIONS} />
          <UniversalSelect value={filters.reviewMode} onChange={(value) => setFilters((current) => ({ ...current, reviewMode: value }))} options={REVIEW_MODE_OPTIONS} />
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-gray-400" />
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search title or brand"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <input
            value={filters.brandId}
            onChange={(event) => setFilters((current) => ({ ...current, brandId: event.target.value }))}
            placeholder="Brand ID"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Submitted after"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Submitted before"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeFilterCount === 0 ? 'No filters applied' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
          </span>
          <button
            type="button"
            onClick={() => setFilters({ status: 'ALL', entityType: 'ALL', trustTier: 'ALL', reviewMode: 'ALL', brandId: '', q: '', from: '', to: '' })}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300"
          >
            Clear filters
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.08]" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto text-emerald-500" size={34} />
            <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">No content waiting for review.</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Submissions that need approval will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Content</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Trust</th>
                  {/*
                    The "Slots" column is gone. It showed
                    slotCompleteness.present/required — the required media views
                    (Front, Back, Left, Right) — but content cannot be submitted
                    without all four, so it read "4/4" on every row and carried no
                    information. Incompleteness is now surfaced where it matters:
                    inline on the row when it actually happens (a media deleted
                    after submission), and in full on the review drawer's
                    "Required slots" checklist.
                  */}
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.08]">
                {submissions.map((submission) => {
                  const thumbnail = submission.media[0];
                  const thumbnailSrc = getMediaThumbnailSrc(thumbnail);
                  return (
                    <tr key={submission.id} className="align-top text-gray-700 dark:text-gray-200">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[260px] items-center gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/[0.08]">
                            {thumbnailSrc && !mediaIsVideo(thumbnail?.mediaType, thumbnail?.mimeType) ? (
                              <AdminReviewImagePreview
                                src={thumbnailSrc}
                                alt={submission.target.title || 'Content media'}
                              />
                            ) : (
                              <MediaUnavailablePreview label={thumbnail && mediaIsVideo(thumbnail.mediaType, thumbnail.mimeType) ? 'Video' : 'Media unavailable'} />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{submission.target.title || 'Untitled content'}</div>
                            <div className="text-xs text-gray-500">{submission.entityType === 'PRODUCT' ? 'Product' : 'Design'}</div>
                            {submission.previousStatus === 'CHANGES_REQUESTED' && (
                              <div className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
                                Answered a change request
                              </div>
                            )}
                            {/*
                              What actually changed, computed server-side when
                              the brand resubmitted. Without it a reviewer has
                              to reopen the item and remember what it looked
                              like — which is how change requests got forgotten.
                            */}
                            {(submission.changeSummary?.length ?? 0) > 0 && (
                              <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                {submission.changeSummary!.join(' · ')}
                              </div>
                            )}
                            {submission.slotCompleteness.missing.length > 0 && (
                              <div className="mt-1 text-xs text-red-600 dark:text-red-300">
                                Missing {submission.slotCompleteness.missing.map(friendlyEnum).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{submission.brand?.name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone[submission.status]}`}>
                          {statusLabel[submission.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{friendlyEnum(submission.brand?.trustTier)}</div>
                        <div className="mt-1 text-gray-500">{friendlyEnum(submission.brand?.reviewMode)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(submission.submittedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void loadDetail(submission)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.08]"
                        >
                          <Eye size={14} />
                          Review
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

      <section className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Reports and Flags</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Open {reportSummary.open} · Reviewed {reportSummary.reviewed} · Resolved {reportSummary.resolved} · Dismissed {reportSummary.dismissed}
            </p>
          </div>
          <Flag size={20} className="text-red-500" />
        </div>
        {reportsLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.08]" />
        ) : reports.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
            No reports are waiting for review.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.map((report) => {
              const draft = reportResolution[report.id] ?? { status: 'REVIEWED', note: '' };
              return (
                <div key={report.id} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reportStatusTone[report.status]}`}>
                          {friendlyEnum(report.status)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{report.reasonLabel}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{report.target?.title ?? 'Reported content'}</p>
                      {report.note && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{report.note}</p>}
                      <p className="mt-2 text-xs text-gray-500">Reported {formatDate(report.createdAt)}</p>
                    </div>
                    {canManage && report.status === 'OPEN' && (
                      <div className="grid min-w-[260px] gap-2">
                        <UniversalSelect
                          value={draft.status}
                          onChange={(value) =>
                            setReportResolution((current) => ({
                              ...current,
                              [report.id]: { ...draft, status: value },
                            }))
                          }
                          options={REPORT_STATUS_OPTIONS}
                          optionCompact
                        />
                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            setReportResolution((current) => ({
                              ...current,
                              [report.id]: { ...draft, note: event.target.value },
                            }))
                          }
                          rows={2}
                          maxLength={500}
                          placeholder="Resolution note"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => void resolveReport(report)}
                          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                        >
                          Update report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Review Submission" size="xl" backdropStyle="light">
        {!selected || detailLoading ? (
          <div className="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.08]" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.target.title || 'Untitled content'}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selected.entityType === 'PRODUCT' ? 'Product' : 'Design'} · {selected.brand?.name ?? 'Unknown brand'}
                </p>
                {/* Whether the brand is verified, and whether its owner ever
                    confirmed their email, changes how much benefit of the doubt
                    a first listing earns. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <VerificationPill
                    label={selected.brand?.isVerified ? 'Brand verified' : `Brand ${friendlyEnum(selected.brand?.verificationStatus).toLowerCase()}`}
                    ok={Boolean(selected.brand?.isVerified)}
                  />
                  <VerificationPill
                    label={selected.brand?.emailVerified ? 'Email verified' : 'Email unverified'}
                    ok={Boolean(selected.brand?.emailVerified)}
                  />
                  {selected.entityType === 'PRODUCT' && selected.target.customOrderEnabled !== null && selected.target.customOrderEnabled !== undefined ? (
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                        (selected.target.customOrderEnabled
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-200'
                          : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300')
                      }
                    >
                      <span aria-hidden="true">🧵</span>
                      {selected.target.customOrderEnabled ? 'Custom orders on' : 'Custom orders off'}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${statusTone[selected.status]}`}>
                {statusLabel[selected.status]}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {selected.entityType === 'PRODUCT' ? (
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Price</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {formatAmount(selected.target.salePrice ?? selected.target.price, selected.target.currency) ?? '-'}
                  </p>
                  {selected.target.salePrice !== null && selected.target.salePrice !== undefined ? (
                    <p className="mt-0.5 text-xs text-gray-500 line-through">
                      {formatAmount(selected.target.price, selected.target.currency) ?? ''}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trust tier</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{friendlyEnum(selected.brand?.trustTier)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review mode</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{friendlyEnum(selected.brand?.reviewMode)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Required slots</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {selected.slotCompleteness.present}/{selected.slotCompleteness.required} complete
                </p>
              </div>
            </div>

            {/* The description is half of what is being approved — a listing can
                pass on photos and fail on its copy. The API had always returned
                it; the modal simply never showed it. */}
            {selected.target.description?.trim() ? (
              <div className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Description</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {selected.target.description}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                No description was submitted with this {selected.entityType === 'PRODUCT' ? 'product' : 'design'}.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selected.media.map((media, mediaIndex) => {
                const mediaPreviewSrc = getMediaPreviewSrc(media);
                const isVideo = mediaIsVideo(media.mediaType, media.mimeType);
                return (
                  <div key={media.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                    <div className="aspect-square bg-gray-100 dark:bg-white/[0.08]">
                      {mediaPreviewSrc && !isVideo ? (
                        <AdminReviewImagePreview
                          src={mediaPreviewSrc}
                          alt={`${media.slotLabel} media`}
                          eager={mediaIndex === 0}
                        />
                      ) : (
                        <MediaUnavailablePreview label={isVideo ? 'Video preview unavailable' : 'Media unavailable'} />
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{media.slotLabel}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                          {friendlyEnum(media.reviewStatus)}
                        </span>
                      </div>
                      {media.reviewReasonLabel && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{media.reviewReasonLabel}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selected.slotCompleteness.missing.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 dark:border-red-500/25 dark:bg-red-500/10">
                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Missing Required Views</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {selected.requiredSlotChecklist
                    .filter((slot) => !slot.present)
                    .map((slot) => (
                      <div key={slot.slot} className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-800 dark:border-red-500/25 dark:bg-white/5 dark:text-red-200">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{slot.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Review History</h3>
                <div className="mt-3 space-y-3">
                  {buildReviewLifecycle(selected).map((history, index, all) => (
                    <div key={history.id} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {statusLabel[history.status]}
                        </span>
                        {/* History is newest-first, so cycle 1 is the last row.
                            Numbering it makes "which round was this?" answerable
                            without counting entries by hand. */}
                        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          {index === 0 ? 'Latest' : `Cycle ${all.length - index}`}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">Submitted: {formatDate(history.submittedAt)}</div>
                      {history.reviewedAt && (
                        <div className="mt-1 text-xs text-gray-500">Reviewed: {formatDate(history.reviewedAt)}</div>
                      )}
                      {history.reviewedBy?.username || history.reviewedById ? (
                        <div className="mt-1 text-xs text-gray-500">
                          Reviewer: {history.reviewedBy?.username || history.reviewedById}
                        </div>
                      ) : null}
                      {history.reasonLabel && <div className="mt-1 text-gray-500 dark:text-gray-400">{history.reasonLabel}</div>}
                      {history.reasonNote && <div className="mt-1 text-gray-500 dark:text-gray-400">{history.reasonNote}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Reports Tied to Content</h3>
                <div className="mt-3 space-y-3">
                  {selected.reports.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No reports tied to this submission.</p>
                  ) : selected.reports.map((report) => (
                    <div key={report.id} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
                      <div className="font-semibold text-gray-900 dark:text-white">{report.reasonLabel}</div>
                      <div className="mt-1 text-gray-500 dark:text-gray-400">{friendlyEnum(report.status)}</div>
                      {report.note && <div className="mt-1 text-gray-500 dark:text-gray-400">{report.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selected.reasonLabel && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                <div className="font-semibold">{selected.reasonLabel}</div>
                {selected.reasonNote && <p className="mt-1">{selected.reasonNote}</p>}
              </div>
            )}

            {canManage && selected.status === 'IN_REVIEW' && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openDecision(selected, 'approve')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => openDecision(selected, 'request_changes')}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  onClick={() => openDecision(selected, 'reject')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(pendingDecision && pendingDecision.action !== 'approve')}
        onClose={() => setPendingDecision(null)}
        title={pendingDecision?.action === 'reject' ? 'Reject Submission' : 'Request Changes'}
        size="md"
        backdropStyle="light"
      >
        <div className="space-y-4">
          <UniversalSelect
            label="Reason"
            value={decisionReason}
            onChange={(value) => {
              setDecisionReason(value);
              setDecisionError(null);
            }}
            options={reasonOptions}
            placeholder="Select reason"
            error={decisionError ?? undefined}
            selectedAllowWrap
            optionAllowWrap
            // Nested inside Modal (z-modal). Default dropdown layer sits under the
            // modal and appears empty/unresponsive on iPad Safari / touch devices.
            menuLayer="modal"
          />
          <textarea
            value={decisionNote}
            onChange={(event) => {
              setDecisionNote(event.target.value);
              setDecisionError(null);
            }}
            rows={5}
            maxLength={1000}
            placeholder="Optional admin note"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDecision(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.08]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runDecision()}
              disabled={decisionBusy}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDecision && pendingDecision.action === 'approve')}
        title="Approve content?"
        message="This will publish the approved product or design and notify the creator."
        confirmText="Approve"
        cancelText="Cancel"
        isLoading={decisionBusy}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => void runDecision()}
      />
    </div>
  );
};

export default AdminContentReviewPage;
