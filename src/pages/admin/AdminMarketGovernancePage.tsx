import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import Modal from '@/components/ui/Modal';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminMarketGovernanceApi } from '@/api/AdminApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminAuditLog,
  AdminMarketGovernanceListResponse,
  AdminMarketGovernanceReleaseStatus,
  AdminMarketSectionConfig,
  AdminMarketSectionConfigCreate,
  AdminMarketSectionConfigUpdate,
  AdminMarketSectionKey,
  AdminMarketSuggestionBlockConfig,
  AdminMarketSuggestionBlockUpsert,
  AdminMarketSuggestionContext,
  AdminMarketSuggestionSourceType,
  AdminMarketSuggestionTargetType,
} from '@/types/admin';

type TabKey =
  | 'overview'
  | 'sections'
  | 'suggestions'
  | 'audit';

type SectionDraft = {
  mode: 'create' | 'edit';
  originalKey?: string;
  sectionKey: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  status: NonNullable<AdminMarketSectionConfig['status']>;
  sourceType: NonNullable<AdminMarketSectionConfig['sourceType']>;
  rankingProfileKey: string;
  displayOrder: string;
  previewItemLimit: string;
  detailPageLimit: string;
  minimumItems: string;
  viewAllEnabled: boolean;
  viewAllLabel: string;
  fallbackMode: string;
  fallbackSectionKey: string;
  guestEnabled: boolean;
  requiresAuth: boolean;
  newBrandReservedRatio: string;
  reason: string;
};

type SuggestionDraft = {
  mode: 'create' | 'edit';
  originalKey?: string;
  blockKey: string;
  context: AdminMarketSuggestionContext;
  targetType: AdminMarketSuggestionTargetType;
  title: string;
  subtitle: string;
  enabled: boolean;
  displayOrder: string;
  sourceType: AdminMarketSuggestionSourceType;
  fallbackSourceType: string;
  itemLimit: string;
  reason: string;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void>;
} | null;

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'sections', label: 'Market Sections' },
  { key: 'suggestions', label: 'Suggestion Blocks' },
  { key: 'audit', label: 'Audit Log' },
];

const SECTION_KEYS: AdminMarketSectionKey[] = [
  'hot-right-now',
  'fresh-drops',
  'picked-for-you',
  'new-designers-to-watch',
  'shop-by-style',
  'loved-near-you',
  'shop-the-look',
  'almost-gone',
  'still-thinking-about-these',
  'more-from-brands-you-like',
  'style-picks-of-the-week',
];

const SECTION_STATUSES: Array<NonNullable<AdminMarketSectionConfig['status']>> = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
];

const SECTION_SOURCE_TYPES: Array<NonNullable<AdminMarketSectionConfig['sourceType']>> = [
  'PRODUCT',
  'COLLECTION',
  'DESIGN',
  'BRAND',
  'MIXED',
];

const SUGGESTION_CONTEXTS: AdminMarketSuggestionContext[] = [
  'PRODUCT_DETAIL',
  'COLLECTION_DETAIL',
  'BRAND_DETAIL',
  'BRAND_STORE',
  'SEARCH_EMPTY',
  'MARKET_SECTION_DETAIL',
  'WISHLIST',
];

const SUGGESTION_TARGET_TYPES: AdminMarketSuggestionTargetType[] = [
  'PRODUCT',
  'COLLECTION',
  'BRAND',
  'CATEGORY',
  'SECTION',
  'QUERY',
];

const SUGGESTION_SOURCE_TYPES: AdminMarketSuggestionSourceType[] = [
  'PRODUCT',
  'COLLECTION',
  'BRAND',
  'CATEGORY',
  'MIXED',
];

export const MARKET_GOVERNANCE_FIELD_HELP = [
  {
    title: 'Ranking enabled',
    body: 'Controls whether backend ranking is allowed to influence market ordering. Disabled is the safe release state.',
  },
  {
    title: 'Default state',
    body: 'Shows whether ranking remains disabled by default unless an explicit release gate enables it.',
  },
  {
    title: 'Fallback',
    body: 'Confirms deterministic fallback ordering is available when ranking config is missing, disabled, or rolled back.',
  },
  {
    title: 'Phase 14',
    body: 'Marks the final validation gate required before ranking can be treated as production-ready.',
  },
  {
    title: 'Market Sections',
    body: 'Configurable marketplace rails such as Fresh Drops and Shop by Style. They control labels, limits, order, and View All behavior.',
  },
  {
    title: 'Suggestion Blocks',
    body: 'Related-item surfaces for product, collection, brand, search-empty, and section-detail contexts.',
  },
  {
    title: 'Audit Log',
    body: 'Immutable admin activity trail for governance changes.',
  },
];

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not set';

const humanize = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || 'Not set';

const getErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = maybeError.response?.data?.message ?? maybeError.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || fallback;
};

const unwrap = <T,>(payload: unknown): T =>
  unwrapApiResponse<T>(payload as T);

const normalizeList = <T,>(
  payload: T[] | AdminMarketGovernanceListResponse<T>,
): AdminMarketGovernanceListResponse<T> => {
  if (Array.isArray(payload)) return { items: payload };
  return {
    items: payload.items ?? [],
    nextCursor: payload.nextCursor ?? null,
    configReadStatus: payload.configReadStatus ?? null,
  };
};

const toInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const SummaryValue: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">Not set</span>;
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return <span>{value.length ? value.join(', ') : 'None'}</span>;
  if (isRecord(value)) {
    const label = value.name ?? value.versionKey ?? value.profileKey ?? value.id;
    return <span>{label ? String(label) : `${Object.keys(value).length} fields`}</span>;
  }
  return <span>{String(value)}</span>;
};

const StatusPill: React.FC<{ tone?: 'safe' | 'warn' | 'danger' | 'neutral'; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => {
  const classes = {
    safe: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </span>
    {children}
    {hint ? <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
  </label>
);

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white';

const panelClass =
  'rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]';

const createSectionDraft = (section?: AdminMarketSectionConfig): SectionDraft => ({
  mode: section ? 'edit' : 'create',
  originalKey: section?.sectionKey,
  sectionKey: section?.sectionKey ?? '',
  title: section?.title ?? '',
  subtitle: section?.subtitle ?? '',
  enabled: section?.enabled ?? true,
  status: section?.status ?? 'ACTIVE',
  sourceType: section?.sourceType ?? 'PRODUCT',
  rankingProfileKey: section?.rankingProfileKey ?? 'deterministic-v1',
  displayOrder: String(section?.displayOrder ?? 100),
  previewItemLimit: String(section?.previewItemLimit ?? 8),
  detailPageLimit: String(section?.detailPageLimit ?? 24),
  minimumItems: String(section?.minimumItems ?? 1),
  viewAllEnabled: section?.viewAllEnabled ?? true,
  viewAllLabel: section?.viewAllLabel ?? '',
  fallbackMode: section?.fallbackMode ?? 'SOURCE_TEMPLATE',
  fallbackSectionKey: section?.fallbackSectionKey ?? '',
  guestEnabled: section?.guestEnabled ?? true,
  requiresAuth: section?.requiresAuth ?? false,
  newBrandReservedRatio: String(section?.newBrandReservedRatio ?? 0),
  reason: '',
});

const createSuggestionDraft = (block?: AdminMarketSuggestionBlockConfig): SuggestionDraft => ({
  mode: block ? 'edit' : 'create',
  originalKey: block?.blockKey,
  blockKey: block?.blockKey ?? '',
  context: block?.context ?? 'PRODUCT_DETAIL',
  targetType: block?.targetType ?? 'PRODUCT',
  title: block?.title ?? '',
  subtitle: block?.subtitle ?? '',
  enabled: block?.enabled ?? true,
  displayOrder: String(block?.displayOrder ?? 0),
  sourceType: (block?.sourceType as AdminMarketSuggestionSourceType) ?? 'PRODUCT',
  fallbackSourceType: block?.fallbackSourceType ?? '',
  itemLimit: String(block?.itemLimit ?? 8),
  reason: '',
});

const AdminMarketGovernancePage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canWrite = hasPermission('MARKET_GOVERNANCE_WRITE');
  const canWriteSuggestions = hasPermission('MARKET_SUGGESTIONS_WRITE');

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<AdminMarketGovernanceReleaseStatus | null>(null);
  const [sections, setSections] = useState<AdminMarketSectionConfig[]>([]);
  const [sectionReadStatus, setSectionReadStatus] = useState<string | null>(null);
  const [suggestionBlocks, setSuggestionBlocks] = useState<AdminMarketSuggestionBlockConfig[]>([]);
  const [suggestionReadStatus, setSuggestionReadStatus] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const [editingSection, setEditingSection] = useState<AdminMarketSectionConfig | null>(null);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null);
  const [suggestionDraft, setSuggestionDraft] = useState<SuggestionDraft | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmReason, setConfirmReason] = useState('');

  const sectionOptions = useMemo(() => {
    const byKey = new Map<string, { value: string; label: string; description?: string }>();
    for (const key of SECTION_KEYS) {
      byKey.set(key, { value: key, label: humanize(key), description: 'Built-in section' });
    }
    for (const section of sections) {
      byKey.set(section.sectionKey, {
        value: section.sectionKey,
        label: section.title || humanize(section.sectionKey),
        description: `${humanize(section.sourceType ?? 'PRODUCT')} · ${section.source ?? 'db'}`,
      });
    }
    return Array.from(byKey.values());
  }, [sections]);

  const loadAuditLogs = useCallback(async (cursor?: string, append = false) => {
    const response = await adminMarketGovernanceApi.getAuditLogs({ cursor, limit: 25 });
    const payload = normalizeList(unwrap<AdminMarketGovernanceListResponse<AdminAuditLog>>(response.data));
    setAuditLogs((current) => (append ? [...current, ...payload.items] : payload.items));
    setAuditNextCursor(payload.nextCursor ?? null);
  }, []);

  const loadGovernance = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      setLoading(true);
      try {
        const [
          releaseResponse,
          sectionResponse,
          suggestionResponse,
          auditResponse,
        ] = await Promise.all([
          adminMarketGovernanceApi.getReleaseStatus({ signal }),
          adminMarketGovernanceApi.getSections({ signal }),
          adminMarketGovernanceApi.getSuggestionBlocks({ signal }),
          adminMarketGovernanceApi.getAuditLogs({ limit: 25 }, { signal }),
        ]);

        const sectionPayload = normalizeList(
          unwrap<AdminMarketGovernanceListResponse<AdminMarketSectionConfig>>(sectionResponse.data),
        );
        const suggestionPayload = normalizeList(
          unwrap<AdminMarketGovernanceListResponse<AdminMarketSuggestionBlockConfig>>(suggestionResponse.data),
        );
        const auditPayload = normalizeList(
          unwrap<AdminMarketGovernanceListResponse<AdminAuditLog>>(auditResponse.data),
        );

        setReleaseStatus(unwrap<AdminMarketGovernanceReleaseStatus>(releaseResponse.data));
        setSections(sectionPayload.items);
        setSectionReadStatus(sectionPayload.configReadStatus ?? null);
        setSuggestionBlocks(suggestionPayload.items);
        setSuggestionReadStatus(suggestionPayload.configReadStatus ?? null);
        setAuditLogs(auditPayload.items);
        setAuditNextCursor(auditPayload.nextCursor ?? null);
      } catch (loadError) {
        if (signal?.aborted) return;
        const message = getErrorMessage(loadError, 'Unable to load market governance.');
        setError(message);
        toast.error(message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadGovernance(controller.signal);
    return () => controller.abort();
  }, [loadGovernance]);

  const refreshAfterMutation = useCallback(async () => {
    await loadGovernance();
  }, [loadGovernance]);

  const runMutation = useCallback(
    async (key: string, action: () => Promise<void>, successMessage: string) => {
      setBusyKey(key);
      try {
        await action();
        toast.success(successMessage);
        await refreshAfterMutation();
      } catch (mutationError) {
        toast.error(getErrorMessage(mutationError, 'Market governance update failed.'));
      } finally {
        setBusyKey(null);
      }
    },
    [refreshAfterMutation],
  );

  const saveSection = useCallback(
    async (reasonOverride?: string) => {
      if (!sectionDraft) return;
      const isCreate = sectionDraft.mode === 'create';
      const targetKey = sectionDraft.originalKey ?? sectionDraft.sectionKey.trim();
      if (isCreate && !sectionDraft.sectionKey.trim()) {
        toast.error('Section key is required.');
        return;
      }
      if (!sectionDraft.title.trim()) {
        toast.error('Section title is required.');
        return;
      }
      if (!sectionDraft.sourceType) {
        toast.error('Section source type is required.');
        return;
      }
      const payload: AdminMarketSectionConfigUpdate = {
        title: sectionDraft.title.trim(),
        subtitle: sectionDraft.subtitle.trim() || null,
        enabled: sectionDraft.enabled,
        status: sectionDraft.status,
        sourceType: sectionDraft.sourceType,
        rankingProfileKey: sectionDraft.rankingProfileKey.trim() || null,
        displayOrder: toInt(sectionDraft.displayOrder, isCreate ? 100 : editingSection?.displayOrder ?? 100),
        previewItemLimit: toInt(sectionDraft.previewItemLimit, isCreate ? 8 : editingSection?.previewItemLimit ?? 8),
        detailPageLimit: toInt(sectionDraft.detailPageLimit, isCreate ? 24 : editingSection?.detailPageLimit ?? 24),
        minimumItems: toInt(sectionDraft.minimumItems, isCreate ? 1 : editingSection?.minimumItems ?? 1),
        viewAllEnabled: sectionDraft.viewAllEnabled,
        viewAllLabel: sectionDraft.viewAllLabel.trim() || null,
        fallbackMode: sectionDraft.fallbackMode.trim() || 'CODE_DEFAULTS',
        fallbackSectionKey: sectionDraft.fallbackSectionKey.trim() || null,
        guestEnabled: sectionDraft.guestEnabled,
        requiresAuth: sectionDraft.requiresAuth,
        newBrandReservedRatio: toInt(sectionDraft.newBrandReservedRatio, 0),
        reason: reasonOverride || sectionDraft.reason.trim() || undefined,
      };
      await runMutation(
        `section:${targetKey || 'new'}`,
        async () => {
          if (isCreate) {
            await adminMarketGovernanceApi.createSection({
              ...(payload as AdminMarketSectionConfigCreate),
              sectionKey: sectionDraft.sectionKey.trim(),
              title: sectionDraft.title.trim(),
              sourceType: sectionDraft.sourceType,
            });
          } else if (targetKey) {
            await adminMarketGovernanceApi.updateSection(targetKey, payload);
          }
          setEditingSection(null);
          setSectionDraft(null);
        },
        isCreate ? 'Market section created.' : 'Market section saved.',
      );
    },
    [editingSection, sectionDraft, runMutation],
  );

  const requestSectionSave = () => {
    if (!sectionDraft) return;
    const currentEditingSection = editingSection;
    const disabling =
      sectionDraft.mode === 'edit' &&
      currentEditingSection !== null &&
      ((currentEditingSection.enabled && !sectionDraft.enabled) ||
        (currentEditingSection.status === 'ACTIVE' &&
          (sectionDraft.status === 'PAUSED' || sectionDraft.status === 'ARCHIVED')));
    if (disabling) {
      setConfirmState({
        title: 'Disable market section?',
        message:
          'This can remove a section from the market experience. The backend will reject the change if it would leave no primary sections enabled.',
        confirmLabel: 'Disable section',
        destructive: true,
        reasonRequired: true,
        reasonPlaceholder: 'Why is this section being disabled?',
        onConfirm: async (reason) => saveSection(reason),
      });
      return;
    }
    void saveSection();
  };

  const saveSuggestionBlock = async () => {
    if (!suggestionDraft) return;
    if (!suggestionDraft.title.trim()) {
      toast.error('Suggestion block title is required.');
      return;
    }
    if (suggestionDraft.mode === 'create' && !suggestionDraft.blockKey.trim()) {
      toast.error('Suggestion block key is required.');
      return;
    }
    const payload: AdminMarketSuggestionBlockUpsert = {
      context: suggestionDraft.context,
      targetType: suggestionDraft.targetType,
      title: suggestionDraft.title.trim(),
      subtitle: suggestionDraft.subtitle.trim() || null,
      enabled: suggestionDraft.enabled,
      displayOrder: toInt(suggestionDraft.displayOrder, 0),
      sourceType: suggestionDraft.sourceType,
      fallbackSourceType: suggestionDraft.fallbackSourceType || null,
      itemLimit: toInt(suggestionDraft.itemLimit, 8),
      reason: suggestionDraft.reason.trim() || undefined,
    };
    await runMutation(
      `suggestion:${suggestionDraft.originalKey ?? 'new'}`,
      async () => {
        if (suggestionDraft.mode === 'create') {
          await adminMarketGovernanceApi.createSuggestionBlock({
            ...payload,
            blockKey: suggestionDraft.blockKey.trim(),
            context: suggestionDraft.context,
            targetType: suggestionDraft.targetType,
            title: suggestionDraft.title.trim(),
            sourceType: suggestionDraft.sourceType,
          });
        } else if (suggestionDraft.originalKey) {
          await adminMarketGovernanceApi.updateSuggestionBlock(suggestionDraft.originalKey, payload);
        }
        setSuggestionDraft(null);
      },
      'Suggestion block saved.',
    );
  };

  const confirm = async () => {
    if (!confirmState) return;
    if (confirmState.reasonRequired && !confirmReason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    const nextAction = confirmState.onConfirm;
    const reason = confirmReason.trim();
    setConfirmState(null);
    setConfirmReason('');
    await nextAction(reason);
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <div className={panelClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Release Status</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Governance settings are available for controlled configuration. Release readiness still requires
              Phase 14 validation, monitoring, and final signoff.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Ranking enabled',
              value: releaseStatus?.rankingEnabled ? 'Enabled' : 'Disabled',
              tone: releaseStatus?.rankingEnabled ? 'warn' : 'safe',
              hint: 'Disabled keeps live market ordering on deterministic defaults.',
            },
            {
              label: 'Default state',
              value: releaseStatus?.rankingDefaultDisabled ? 'Disabled by default' : 'Needs review',
              tone: releaseStatus?.rankingDefaultDisabled ? 'safe' : 'danger',
              hint: 'The backend should stay disabled by default until the release gate changes.',
            },
            {
              label: 'Fallback',
              value: releaseStatus?.deterministicFallbackEnabled ? 'Deterministic fallback on' : 'Needs review',
              tone: releaseStatus?.deterministicFallbackEnabled ? 'safe' : 'danger',
              hint: 'Fallback protects market pages if ranking config is absent or rolled back.',
            },
            {
              label: 'Phase 14',
              value: releaseStatus?.phase14Required ? 'Required' : 'Not required',
              tone: releaseStatus?.phase14Required ? 'warn' : 'safe',
              hint: 'Final readiness still requires Phase 14 validation and signoff.',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              <div className="mt-2">
                <StatusPill tone={item.tone as 'safe' | 'warn' | 'danger'}>{item.value}</StatusPill>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {item.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <KeyValue
            label="Shadow mode"
            value={releaseStatus?.shadowMode ? 'On' : 'Off'}
            hint="Shadow mode lets ranking run for observation without changing live ordering."
          />
          <KeyValue
            label="Config read status"
            value={releaseStatus?.configReadStatus ?? 'Unknown'}
            hint="Shows whether this page is reading database governance config or code defaults."
          />
          <KeyValue
            label="Release readiness"
            value={releaseStatus?.productionReady ? 'Needs Phase 14 confirmation' : 'Not cleared'}
            hint="Not cleared means do not treat ranking as production-ready."
          />
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="text-sm font-bold text-slate-950 dark:text-white">What this page controls</h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          These controls govern marketplace section configuration and suggestion blocks. They do not enable ranking for production unless the release gate and backend flags allow it.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {MARKET_GOVERNANCE_FIELD_HELP.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-black/20"
            >
              <p className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  const renderSections = () => (
    <div className="space-y-4">
      <TabHeader
        title="Market Sections"
        description="Control market section labels, limits, order, enabled state, and View All behavior. Backend validation keeps at least one section available."
        meta={sectionReadStatus ? `Config: ${sectionReadStatus}` : undefined}
        action={
          canWrite ? (
            <button
              type="button"
              onClick={() => {
                setEditingSection(null);
                setSectionDraft(createSectionDraft());
              }}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            >
              Create section
            </button>
          ) : null
        }
      />
      <div className="grid gap-3">
        {sections.map((section) => (
          <div key={section.sectionKey} className={panelClass}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">{section.title}</h3>
                  <StatusPill tone={section.enabled ? 'safe' : 'warn'}>
                    {section.enabled ? 'Enabled' : 'Disabled'}
                  </StatusPill>
                  <StatusPill tone={section.status === 'ACTIVE' ? 'safe' : 'warn'}>
                    {humanize(section.status ?? 'ACTIVE')}
                  </StatusPill>
                  <StatusPill>{humanize(section.sourceType ?? 'PRODUCT')}</StatusPill>
                  <StatusPill>{section.source ?? 'db'}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{section.subtitle || 'No subtitle'}</p>
                <p className="mt-2 text-xs font-mono text-slate-500">{section.sectionKey}</p>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSection(section);
                    setSectionDraft(createSectionDraft(section));
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <KeyValue label="Order" value={section.displayOrder} />
              <KeyValue label="Preview limit" value={section.previewItemLimit} />
              <KeyValue label="Detail limit" value={section.detailPageLimit} />
              <KeyValue label="Minimum items" value={section.minimumItems} />
              <KeyValue label="View All" value={section.viewAllEnabled ? 'Enabled' : 'Disabled'} />
              <KeyValue label="New-brand reserve" value={`${section.newBrandReservedRatio ?? 0}%`} />
              <KeyValue label="Fallback" value={section.fallbackSectionKey ?? section.fallbackMode} />
            </div>
          </div>
        ))}
        {!sections.length && !loading ? <EmptyState label="No market section configs returned." /> : null}
      </div>
    </div>
  );

  const renderSuggestions = () => (
    <div className="space-y-4">
      <TabHeader
        title="Suggestion Blocks"
        description="Configure deterministic suggestion block titles, limits, source strategy, fallback source, and enabled state by context."
        meta={suggestionReadStatus ? `Config: ${suggestionReadStatus}` : undefined}
        action={
          canWriteSuggestions ? (
            <button
              type="button"
              onClick={() => setSuggestionDraft(createSuggestionDraft())}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            >
              Create block
            </button>
          ) : null
        }
      />
      <div className="grid gap-3">
        {suggestionBlocks.map((block) => (
          <div key={block.blockKey} className={panelClass}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">{block.title}</h3>
                  <StatusPill tone={block.enabled ? 'safe' : 'warn'}>
                    {block.enabled ? 'Enabled' : 'Disabled'}
                  </StatusPill>
                  <StatusPill>{block.source ?? 'db'}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{block.subtitle || 'No subtitle'}</p>
                <p className="mt-2 text-xs font-mono text-slate-500">{block.blockKey}</p>
              </div>
              {canWriteSuggestions ? (
                <button
                  type="button"
                  onClick={() => setSuggestionDraft(createSuggestionDraft(block))}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <KeyValue label="Context" value={humanize(block.context)} />
              <KeyValue label="Target type" value={humanize(block.targetType)} />
              <KeyValue label="Source" value={humanize(block.sourceType)} />
              <KeyValue label="Fallback" value={humanize(block.fallbackSourceType)} />
              <KeyValue label="Item limit" value={block.itemLimit} />
            </div>
          </div>
        ))}
        {!suggestionBlocks.length && !loading ? <EmptyState label="No suggestion block configs returned." /> : null}
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="space-y-4">
      <TabHeader
        title="Governance Audit Log"
        description="Audit-backed market governance mutations. Before and after states stay collapsed until needed."
        action={
          auditNextCursor ? (
            <button
              type="button"
              onClick={() => void loadAuditLogs(auditNextCursor, true)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Load more
            </button>
          ) : null
        }
      />
      <div className="grid gap-3">
        {auditLogs.map((log) => {
          const expanded = expandedAuditId === log.id;
          return (
            <div key={log.id} className={panelClass}>
              <button
                type="button"
                onClick={() => setExpandedAuditId(expanded ? null : log.id)}
                className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-start lg:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill>{humanize(log.action)}</StatusPill>
                    <span className="text-sm font-semibold text-slate-950 dark:text-white">
                      {log.targetType ?? 'Governance target'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {log.targetId ?? 'No target ID'} by {log.actor?.email ?? log.actorUserId}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
              </button>
              {expanded ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <StatePanel title="Before" value={log.previousState} />
                  <StatePanel title="After" value={log.newState} />
                  <div className="lg:col-span-2">
                    <StatePanel title="Metadata" value={log.metadata} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {!auditLogs.length && !loading ? <EmptyState label="No market governance audit entries yet." /> : null}
      </div>
    </div>
  );

  const currentTab = {
    overview: renderOverview,
    sections: renderSections,
    suggestions: renderSuggestions,
    audit: renderAudit,
  }[activeTab];

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Market Governance' }]} />

      <section className="rounded-2xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#140c1d] dark:to-[#1a1026]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Market Governance</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Configure market sections, suggestion blocks, and audit review. Ranking remains
              backend-disabled unless the release gate explicitly changes it later.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadGovernance()}
            disabled={loading}
            className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-white/70 text-slate-700 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadGovernance()}
              className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold dark:border-rose-500/40"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.05]"
            />
          ))}
        </div>
      ) : (
        currentTab()
      )}

      <SectionModal
        section={editingSection}
        draft={sectionDraft}
        setDraft={setSectionDraft}
        sectionOptions={sectionOptions}
        onClose={() => {
          setEditingSection(null);
          setSectionDraft(null);
        }}
        onSave={requestSectionSave}
        busy={Boolean(
          sectionDraft &&
            busyKey === `section:${(sectionDraft.originalKey ?? sectionDraft.sectionKey) || 'new'}`,
        )}
      />

      <SuggestionModal
        draft={suggestionDraft}
        setDraft={setSuggestionDraft}
        onClose={() => setSuggestionDraft(null)}
        onSave={() => void saveSuggestionBlock()}
        busy={Boolean(suggestionDraft && busyKey === `suggestion:${suggestionDraft.originalKey ?? 'new'}`)}
      />

      <Modal
        open={Boolean(confirmState)}
        onClose={() => {
          setConfirmState(null);
          setConfirmReason('');
        }}
        title={confirmState?.title}
        size="sm"
      >
        {confirmState ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">{confirmState.message}</p>
            {confirmState.reasonRequired ? (
              <Field label="Reason">
                <textarea
                  value={confirmReason}
                  onChange={(event) => setConfirmReason(event.target.value)}
                  placeholder={confirmState.reasonPlaceholder ?? 'Enter a reason'}
                  className={`${inputClass} min-h-[96px] resize-y`}
                  maxLength={500}
                />
              </Field>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmState(null);
                  setConfirmReason('');
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
                  confirmState.destructive ? 'bg-rose-600' : 'bg-slate-950 dark:bg-white dark:text-slate-950'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

const KeyValue: React.FC<{ label: string; value: unknown; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <div className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
      <SummaryValue value={value} />
    </div>
    {hint ? (
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {hint}
      </p>
    ) : null}
  </div>
);

const TabHeader: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
  meta?: string;
}> = ({ title, description, action, meta }) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h2>
        {meta ? <StatusPill>{meta}</StatusPill> : null}
      </div>
      <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
    {action}
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400">
    {label}
  </div>
);

const StatePanel: React.FC<{ title: string; value: Record<string, unknown> | null }> = ({ title, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/20">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  </div>
);

const SectionModal: React.FC<{
  section: AdminMarketSectionConfig | null;
  draft: SectionDraft | null;
  setDraft: React.Dispatch<React.SetStateAction<SectionDraft | null>>;
  sectionOptions: Array<{ value: string; label: string; description?: string }>;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
}> = ({ section, draft, setDraft, sectionOptions, onClose, onSave, busy }) => (
  <Modal
    open={Boolean(draft)}
    onClose={onClose}
    title={draft?.mode === 'create' ? 'Create market section' : 'Edit market section'}
    size="xl"
  >
    {draft ? (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Admins configure the section source, copy, limits, and rollout state. Ranking, fallback,
          suppression, View All, and suggestions are inherited automatically from the market section
          system.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Section key" hint={draft.mode === 'create' ? 'Lowercase slug. This becomes the stable API and View All key.' : section?.sectionKey}>
            <input
              value={draft.sectionKey}
              onChange={(event) => setDraft((current) => current && { ...current, sectionKey: event.target.value })}
              disabled={draft.mode === 'edit'}
              className={inputClass}
              maxLength={80}
            />
          </Field>
          <Field label="Title">
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => current && { ...current, title: event.target.value })}
              className={inputClass}
              maxLength={120}
            />
          </Field>
          <UniversalSelect
            label="Status"
            value={draft.status}
            onChange={(value) =>
              setDraft((current) => current && { ...current, status: value as SectionDraft['status'] })
            }
            options={SECTION_STATUSES.map((status) => ({ value: status, label: humanize(status) }))}
          />
          <UniversalSelect
            label="Source type"
            value={draft.sourceType}
            onChange={(value) =>
              setDraft((current) => current && { ...current, sourceType: value as SectionDraft['sourceType'] })
            }
            options={SECTION_SOURCE_TYPES.map((sourceType) => ({
              value: sourceType,
              label: humanize(sourceType),
              description:
                sourceType === 'DESIGN'
                  ? 'Runway/design cards'
                  : sourceType === 'MIXED'
                    ? 'Category grid'
                    : `${humanize(sourceType)} rail`,
            }))}
          />
          <div className="md:col-span-2">
            <Field label="Subtitle">
              <textarea
                value={draft.subtitle}
                onChange={(event) => setDraft((current) => current && { ...current, subtitle: event.target.value })}
                className={`${inputClass} min-h-[80px] resize-y`}
                maxLength={240}
              />
            </Field>
          </div>
          <Field label="Ranking profile key">
            <input
              value={draft.rankingProfileKey}
              onChange={(event) =>
                setDraft((current) => current && { ...current, rankingProfileKey: event.target.value })
              }
              className={inputClass}
              maxLength={80}
            />
          </Field>
          <Field label="View All label">
            <input
              value={draft.viewAllLabel}
              onChange={(event) => setDraft((current) => current && { ...current, viewAllLabel: event.target.value })}
              className={inputClass}
              maxLength={80}
            />
          </Field>
          <Field label="Fallback mode">
            <input
              value={draft.fallbackMode}
              onChange={(event) => setDraft((current) => current && { ...current, fallbackMode: event.target.value })}
              className={inputClass}
              maxLength={40}
            />
          </Field>
          <UniversalSelect
            label="Fallback section"
            value={draft.fallbackSectionKey}
            onChange={(value) => setDraft((current) => current && { ...current, fallbackSectionKey: value })}
            options={[
              { value: '', label: 'No explicit fallback' },
              ...sectionOptions.filter((option) => option.value !== draft.sectionKey),
            ]}
            searchable
          />
          <NumberField label="Display order" value={draft.displayOrder} min={0} max={100} onChange={(value) => setDraft((current) => current && { ...current, displayOrder: value })} />
          <NumberField label="Preview item limit" value={draft.previewItemLimit} min={1} max={12} onChange={(value) => setDraft((current) => current && { ...current, previewItemLimit: value })} />
          <NumberField label="Detail page limit" value={draft.detailPageLimit} min={1} max={60} onChange={(value) => setDraft((current) => current && { ...current, detailPageLimit: value })} />
          <NumberField label="Minimum items" value={draft.minimumItems} min={0} max={12} onChange={(value) => setDraft((current) => current && { ...current, minimumItems: value })} />
          <NumberField label="New-brand reserve %" value={draft.newBrandReservedRatio} min={0} max={50} onChange={(value) => setDraft((current) => current && { ...current, newBrandReservedRatio: value })} />
          <CheckboxField label="Section enabled" checked={draft.enabled} onChange={(enabled) => setDraft((current) => current && { ...current, enabled })} />
          <CheckboxField label="View All enabled" checked={draft.viewAllEnabled} onChange={(viewAllEnabled) => setDraft((current) => current && { ...current, viewAllEnabled })} />
          <CheckboxField label="Guest visible" checked={draft.guestEnabled} onChange={(guestEnabled) => setDraft((current) => current && { ...current, guestEnabled })} />
          <CheckboxField label="Requires auth" checked={draft.requiresAuth} onChange={(requiresAuth) => setDraft((current) => current && { ...current, requiresAuth })} />
          <div className="md:col-span-2">
            <Field label="Reason">
              <textarea
                value={draft.reason}
                onChange={(event) => setDraft((current) => current && { ...current, reason: event.target.value })}
                className={`${inputClass} min-h-[80px] resize-y`}
                maxLength={500}
              />
            </Field>
          </div>
        </div>
        <ModalActions
          onClose={onClose}
          onSave={onSave}
          busy={busy}
          saveLabel={draft.mode === 'create' ? 'Create section' : 'Save section'}
        />
      </div>
    ) : null}
  </Modal>
);

const SuggestionModal: React.FC<{
  draft: SuggestionDraft | null;
  setDraft: React.Dispatch<React.SetStateAction<SuggestionDraft | null>>;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
}> = ({ draft, setDraft, onClose, onSave, busy }) => (
  <Modal open={Boolean(draft)} onClose={onClose} title={draft?.mode === 'create' ? 'Create suggestion block' : 'Edit suggestion block'} size="xl">
    {draft ? (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Disabling a block only affects that suggestion block; parent market and detail screens keep rendering.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Block key">
            <input
              value={draft.blockKey}
              onChange={(event) => setDraft((current) => current && { ...current, blockKey: event.target.value })}
              disabled={draft.mode === 'edit'}
              className={inputClass}
              maxLength={120}
            />
          </Field>
          <Field label="Title">
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => current && { ...current, title: event.target.value })}
              className={inputClass}
              maxLength={120}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Subtitle">
              <textarea
                value={draft.subtitle}
                onChange={(event) => setDraft((current) => current && { ...current, subtitle: event.target.value })}
                className={`${inputClass} min-h-[80px] resize-y`}
                maxLength={240}
              />
            </Field>
          </div>
          <UniversalSelect
            label="Context"
            value={draft.context}
            onChange={(value) => setDraft((current) => current && { ...current, context: value as AdminMarketSuggestionContext })}
            options={SUGGESTION_CONTEXTS.map((context) => ({ value: context, label: humanize(context) }))}
          />
          <UniversalSelect
            label="Target type"
            value={draft.targetType}
            onChange={(value) => setDraft((current) => current && { ...current, targetType: value as AdminMarketSuggestionTargetType })}
            options={SUGGESTION_TARGET_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
          />
          <UniversalSelect
            label="Source type"
            value={draft.sourceType}
            onChange={(value) => setDraft((current) => current && { ...current, sourceType: value as AdminMarketSuggestionSourceType })}
            options={SUGGESTION_SOURCE_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
          />
          <UniversalSelect
            label="Fallback source"
            value={draft.fallbackSourceType}
            onChange={(value) => setDraft((current) => current && { ...current, fallbackSourceType: value })}
            options={[
              { value: '', label: 'No fallback source' },
              ...SUGGESTION_SOURCE_TYPES.map((type) => ({ value: type, label: humanize(type) })),
            ]}
          />
          <NumberField label="Display order" value={draft.displayOrder} min={0} max={100} onChange={(value) => setDraft((current) => current && { ...current, displayOrder: value })} />
          <NumberField label="Item limit" value={draft.itemLimit} min={1} max={12} onChange={(value) => setDraft((current) => current && { ...current, itemLimit: value })} />
          <CheckboxField label="Block enabled" checked={draft.enabled} onChange={(enabled) => setDraft((current) => current && { ...current, enabled })} />
          <div className="md:col-span-2">
            <Field label="Reason">
              <textarea
                value={draft.reason}
                onChange={(event) => setDraft((current) => current && { ...current, reason: event.target.value })}
                className={`${inputClass} min-h-[80px] resize-y`}
                maxLength={500}
              />
            </Field>
          </div>
        </div>
        <ModalActions onClose={onClose} onSave={onSave} busy={busy} saveLabel="Save block" />
      </div>
    ) : null}
  </Modal>
);

const NumberField: React.FC<{
  label: string;
  value: string;
  min: number;
  max: number;
  step?: string;
  disabled?: boolean;
  hint?: string;
  onChange: (value: string) => void;
}> = ({ label, value, min, max, step = '1', disabled, hint, onChange }) => (
  <Field label={label} hint={hint}>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  </Field>
);

const CheckboxField: React.FC<{
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, disabled, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-200">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4"
    />
  </label>
);

const ModalActions: React.FC<{
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  saveLabel: string;
}> = ({ onClose, onSave, busy, saveLabel }) => (
  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={onClose}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06]"
    >
      Cancel
    </button>
    <button
      type="button"
      onClick={onSave}
      disabled={busy}
      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
    >
      {busy ? 'Saving...' : saveLabel}
    </button>
  </div>
);

export default AdminMarketGovernancePage;
