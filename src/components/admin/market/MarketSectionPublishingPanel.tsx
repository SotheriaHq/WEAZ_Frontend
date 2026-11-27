import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminMarketGovernanceApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminMarketSectionLifecycle,
  AdminMarketSectionPreview,
  AdminMarketSectionSpec,
  AdminMarketSectionStatusChange,
  AdminMarketSectionTemplate,
  AdminMarketSectionVersion,
} from '@/types/admin';
import {
  editorTemplates,
  formFromSpec,
  isValidSectionKey,
  needsPlacementKey,
  specFromForm,
  validateSectionForm,
  type SectionSpecForm,
  type SectionSpecFormErrors,
} from '@/pages/admin/marketSectionSpecForm';

interface MarketSectionPublishingPanelProps {
  /** Keys the governance list already knows; an admin can also start a new key. */
  sectionKeys: readonly string[];
  canWrite: boolean;
  canRelease: boolean;
}

const NEW_KEY = '__new__';
const DEFAULT_TEMPLATE = 'CATALOG_FILTER';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:border-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300 dark:border-white/10 dark:bg-black/20 dark:text-white';
const panelClass =
  'rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]';
const buttonClass =
  'rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400';
const primaryButton = `${buttonClass} bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950`;
const quietButton = `${buttonClass} border border-slate-300 bg-white/70 text-slate-700 hover:bg-white dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200`;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Live once published' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DRAFT', label: 'Hidden (draft)' },
];

function errorText(error: unknown, fallback: string): string {
  const maybe = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = maybe.response?.data?.message ?? maybe.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatPrice(amount: number | null, currency: string | null): string {
  if (amount === null) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Draft → preview → publish for one Market section (WP10 slice 10e).
 * Saving a draft never changes the Market. Publishing, pausing, archiving and
 * restoring need the separate release grant and a reason; the server checks both.
 */
export default function MarketSectionPublishingPanel({
  sectionKeys,
  canWrite,
  canRelease,
}: MarketSectionPublishingPanelProps) {
  const idBase = useId();
  const fieldId = (name: string) => `${idBase}-${name}`;
  const [templates, setTemplates] = useState<AdminMarketSectionTemplate[]>([]);
  const [selected, setSelected] = useState<string>(sectionKeys[0] ?? NEW_KEY);
  const [newKey, setNewKey] = useState('');
  const [lifecycle, setLifecycle] = useState<AdminMarketSectionLifecycle | null>(null);
  const [versions, setVersions] = useState<AdminMarketSectionVersion[]>([]);
  const [form, setForm] = useState<SectionSpecForm>(() => formFromSpec(null, DEFAULT_TEMPLATE));
  const [base, setBase] = useState<AdminMarketSectionSpec | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<SectionSpecFormErrors>({});
  const [preview, setPreview] = useState<AdminMarketSectionPreview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const sectionKey = selected === NEW_KEY ? newKey.trim() : selected;
  const keyValid = isValidSectionKey(sectionKey);
  const shownTemplates = useMemo(() => editorTemplates(templates), [templates]);
  const template = templates.find((item) => item.template === form.template);

  useEffect(() => {
    const controller = new AbortController();
    adminMarketGovernanceApi
      .getSectionTemplates({ signal: controller.signal })
      .then((response) => setTemplates(unwrapApiResponse<AdminMarketSectionTemplate[]>(response.data)))
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorText(error, 'Unable to load section templates.'));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!keyValid) {
      setLifecycle(null);
      setVersions([]);
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    Promise.all([
      adminMarketGovernanceApi.getSectionLifecycle(sectionKey, { signal: controller.signal }),
      adminMarketGovernanceApi.getSectionVersions(sectionKey, { signal: controller.signal }),
    ])
      .then(([lifecycleResponse, versionsResponse]) => {
        const next = unwrapApiResponse<AdminMarketSectionLifecycle>(lifecycleResponse.data);
        const spec = next.draft?.spec ?? next.published ?? null;
        setLifecycle(next);
        setVersions(unwrapApiResponse<{ items: AdminMarketSectionVersion[] }>(versionsResponse.data).items ?? []);
        setBase(spec);
        setForm(formFromSpec(spec, DEFAULT_TEMPLATE));
        setDirty(false);
        setErrors({});
        setPreview(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(errorText(error, 'Unable to load this section.'));
      });
    return () => controller.abort();
  }, [sectionKey, keyValid, reloadToken]);

  const update = useCallback(<K extends keyof SectionSpecForm>(key: K, value: SectionSpecForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }, []);

  const reload = () => setReloadToken((token) => token + 1);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      toast.error(errorText(error, 'That change did not go through.'));
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = () => {
    const nextErrors = validateSectionForm(form, template);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !lifecycle) return;
    void run('save', async () => {
      await adminMarketGovernanceApi.saveSectionDraft(sectionKey, {
        spec: specFromForm(form, base),
        expectedRevision: lifecycle.draftRevision,
        reason: reason.trim() || undefined,
      });
      toast.success('Draft saved. The Market has not changed.');
      reload();
    });
  };

  const runPreview = () =>
    void run('preview', async () => {
      const response = await adminMarketGovernanceApi.previewSectionDraft(sectionKey);
      setPreview(unwrapApiResponse<AdminMarketSectionPreview>(response.data));
    });

  const requireReason = (): string | null => {
    const text = reason.trim();
    if (!text) toast.error('Give a reason for this change.');
    return text || null;
  };

  const publish = () => {
    const text = requireReason();
    if (!text || !preview) return;
    void run('publish', async () => {
      const response = await adminMarketGovernanceApi.publishSection(sectionKey, {
        draftRevision: preview.draftRevision,
        reason: text,
      });
      const result = unwrapApiResponse<{ version: number }>(response.data);
      toast.success(`Published version ${result.version}.`);
      setReason('');
      reload();
    });
  };

  const changeStatus = (change: AdminMarketSectionStatusChange) => {
    const text = requireReason();
    if (!text) return;
    void run(change, async () => {
      await adminMarketGovernanceApi.changeSectionStatus(sectionKey, change, text);
      toast.success(`Section ${change === 'archive' ? 'archived' : change === 'pause' ? 'paused' : 'resumed'}.`);
      setReason('');
      reload();
    });
  };

  const restore = (version: number) => {
    const text = requireReason();
    if (!text) return;
    void run(`restore-${version}`, async () => {
      const response = await adminMarketGovernanceApi.restoreSectionVersion(sectionKey, version, text);
      const result = unwrapApiResponse<{ version: number }>(response.data);
      toast.success(`Version ${version} restored as version ${result.version}.`);
      setReason('');
      reload();
    });
  };

  const liveStatus = lifecycle?.published?.status ?? null;
  const previewIsCurrent =
    preview !== null && lifecycle !== null && preview.draftRevision === lifecycle.draftRevision && !dirty;
  const canChangeLive = canRelease && Boolean(lifecycle?.published) && !lifecycle?.hasUnpublishedDraft;
  const sectionOptions = [
    ...sectionKeys.map((key) => ({ value: key, label: key })),
    { value: NEW_KEY, label: 'New section…' },
  ];

  const textInput = (
    name: keyof SectionSpecForm,
    label: string,
    options: { hint?: string; inputMode?: 'numeric'; type?: string; placeholder?: string } = {},
  ) => (
    <Field id={fieldId(name)} label={label} error={errors[name]} hint={options.hint}>
      <input
        id={fieldId(name)}
        type={options.type ?? 'text'}
        inputMode={options.inputMode}
        className={inputClass}
        value={String(form[name])}
        placeholder={options.placeholder}
        disabled={!canWrite}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${fieldId(name)}-error` : options.hint ? `${fieldId(name)}-hint` : undefined}
        onChange={(event) => update(name, event.target.value as never)}
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Section publishing</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Saving a draft never changes the Market. Preview shows the draft as a signed-out shopper would see it.
          Publishing, pausing, archiving and restoring need the release permission and a reason, and each one
          becomes a new version you can restore.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <UniversalSelect
            label="Section"
            value={selected}
            onChange={setSelected}
            options={sectionOptions}
            searchable
          />
          {selected === NEW_KEY ? (
            <Field
              id={fieldId('key')}
              label="New section key"
              hint="Lowercase letters, digits and hyphens, for example adire-casual."
              error={newKey && !keyValid ? 'Use lowercase letters, digits and hyphens.' : undefined}
            >
              <input
                id={fieldId('key')}
                className={inputClass}
                value={newKey}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setNewKey(event.target.value.toLowerCase())}
                aria-describedby={`${fieldId('key')}-${newKey && !keyValid ? 'error' : 'hint'}`}
              />
            </Field>
          ) : null}
        </div>
        {loadError ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
            {loadError}
          </p>
        ) : null}
        {lifecycle ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
            {lifecycle.published
              ? `Live: version ${lifecycle.publishedVersion} (${(liveStatus ?? 'ACTIVE').toLowerCase()}), published ${formatDate(lifecycle.publishedAt)}.`
              : 'Not published yet; the Market uses the built-in default for this key.'}{' '}
            {lifecycle.hasUnpublishedDraft ? 'There is an unpublished draft.' : ''}
          </p>
        ) : null}
      </div>

      {lifecycle ? (
        <div className={panelClass}>
          <div className="grid gap-4 md:grid-cols-2">
            <UniversalSelect
              label="Template"
              value={form.template}
              onChange={(value) => update('template', value)}
              options={shownTemplates.map((item) => ({
                value: item.template,
                label: item.title,
                description: item.template,
              }))}
              disabled={!canWrite}
              error={errors.template}
            />
            <UniversalSelect
              label="Status after publishing"
              value={form.status}
              onChange={(value) => update('status', value as SectionSpecForm['status'])}
              options={STATUS_OPTIONS}
              disabled={!canWrite}
            />
            {textInput('title', 'Title', { hint: template ? `Leave empty to use "${template.title}".` : undefined })}
            {textInput('subtitle', 'Subtitle')}
            {needsPlacementKey(form.template)
              ? textInput('placementKey', 'Curated placement key', { placeholder: 'STYLE_PICKS' })
              : null}
            {textInput('order', 'Position on the Market', { inputMode: 'numeric', hint: '0 to 100; lower shows first.' })}
            {textInput('preview', 'Items on the Market rail', { inputMode: 'numeric', hint: '1 to 12.' })}
            {textInput('minItems', 'Fewest items to show the rail', { inputMode: 'numeric' })}
            {textInput('page', 'Items per See All page', { inputMode: 'numeric', hint: '12 to 60.' })}
            {textInput('startsAt', 'Starts', { type: 'datetime-local', hint: 'Optional. Your local time.' })}
            {textInput('endsAt', 'Ends', { type: 'datetime-local', hint: 'Optional. Your local time.' })}
          </div>

          <fieldset className="mt-5 grid gap-4 md:grid-cols-2">
            <legend className="text-sm font-bold text-slate-900 dark:text-white">Which products</legend>
            {textInput('tags', 'Tags', { hint: 'Comma separated, for example adire, ankara.' })}
            {textInput('colors', 'Colours', { hint: 'Comma separated.' })}
            {textInput('sizes', 'Sizes', { hint: 'Comma separated.' })}
            <div className="grid grid-cols-2 gap-3">
              {textInput('priceMin', 'Price from (₦)', { inputMode: 'numeric' })}
              {textInput('priceMax', 'Price to (₦)', { inputMode: 'numeric' })}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.onSale}
                disabled={!canWrite}
                onChange={(event) => update('onSale', event.target.checked)}
              />
              On sale only
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.inStockOnly}
                disabled={!canWrite}
                onChange={(event) => update('inStockOnly', event.target.checked)}
              />
              In stock only
            </label>
          </fieldset>

          <div className="mt-5">
            <Field
              id={fieldId('reason')}
              label="Reason for this change"
              hint="Required to publish, pause, archive or restore. Saved in the audit log."
            >
              <textarea
                id={fieldId('reason')}
                className={inputClass}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby={`${fieldId('reason')}-hint`}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={quietButton} disabled={!canWrite || busy !== null} onClick={saveDraft}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              className={quietButton}
              disabled={!lifecycle.draft || dirty || busy !== null}
              onClick={runPreview}
            >
              {busy === 'preview' ? 'Previewing…' : 'Preview as a shopper'}
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={!canRelease || !previewIsCurrent || busy !== null}
              onClick={publish}
            >
              {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {!canWrite
              ? 'You can view this section. Editing needs "Edit market governance".'
              : dirty
                ? 'Save the draft before previewing it.'
                : !previewIsCurrent
                  ? 'Preview the saved draft to enable Publish.'
                  : !canRelease
                    ? 'Publishing needs "Release governance changes".'
                    : 'This preview matches the saved draft.'}
          </p>
        </div>
      ) : null}

      {preview ? (
        <div className={panelClass} aria-live="polite">
          <h3 className="text-base font-bold text-slate-950 dark:text-white">
            Preview: {preview.preview.title}
          </h3>
          {preview.preview.subtitle ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{preview.preview.subtitle}</p>
          ) : null}
          {preview.preview.fallbackUsed ? (
            <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Too few matching products ({preview.preview.candidateCount} of {preview.preview.minItems} needed), so
              shoppers would see the fallback section instead.
            </p>
          ) : null}
          {!preview.preview.productList ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This template lists brands, styles or looks rather than products.
            </p>
          ) : preview.preview.items.length ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.preview.items.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span className="block break-words font-semibold text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">{formatPrice(item.price, item.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No products match this draft yet.</p>
          )}
        </div>
      ) : null}

      {lifecycle?.published ? (
        <div className={panelClass}>
          <h3 className="text-base font-bold text-slate-950 dark:text-white">Live controls</h3>
          {lifecycle.hasUnpublishedDraft ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Publish the draft, or save the live settings as the draft, before pausing, archiving or restoring.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {liveStatus === 'ACTIVE' ? (
              <button type="button" className={quietButton} disabled={!canChangeLive || busy !== null} onClick={() => changeStatus('pause')}>
                Pause
              </button>
            ) : null}
            {liveStatus === 'PAUSED' ? (
              <button type="button" className={quietButton} disabled={!canChangeLive || busy !== null} onClick={() => changeStatus('resume')}>
                Resume
              </button>
            ) : null}
            {liveStatus !== 'ARCHIVED' ? (
              <button
                type="button"
                className={`${buttonClass} border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300`}
                disabled={!canChangeLive || busy !== null}
                onClick={() => changeStatus('archive')}
              >
                Archive
              </button>
            ) : null}
          </div>
          {versions.length ? (
            <ol className="mt-4 space-y-2">
              {versions.map((version) => (
                <li
                  key={version.version}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
                >
                  <span className="min-w-0 break-words text-slate-700 dark:text-slate-200">
                    <strong>Version {version.version}</strong> · {formatDate(version.publishedAt)} · {version.reason}
                  </span>
                  {version.version !== lifecycle.publishedVersion ? (
                    <button
                      type="button"
                      className={quietButton}
                      disabled={!canChangeLive || busy !== null}
                      onClick={() => restore(version.version)}
                    >
                      {busy === `restore-${version.version}` ? 'Restoring…' : 'Restore'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Live</span>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
