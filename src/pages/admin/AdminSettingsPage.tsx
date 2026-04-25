import React, { useEffect, useState, useCallback } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { adminSlaApi, adminFeatureFlagsApi } from '@/api/AdminApi';
import { configApi, type UploadLimits } from '@/api/ConfigApi';
import type { AdminSlaConfig, FeatureFlag } from '@/types/admin';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';
import { useUploadLimits } from '@/context/UploadLimitsContext';
import UniversalSelect from '@/components/forms/UniversalSelect';

type Tab = 'sla' | 'flags' | 'uploads' | 'dashboard' | 'messaging';

/** Human-readable labels for upload config keys */
const UPLOAD_KEY_LABELS: Record<string, { label: string; hint: string }> = {
  'upload.maxSize.profileImage':      { label: 'Profile Image',         hint: 'User avatar / profile picture' },
  'upload.maxSize.bannerImage':       { label: 'Banner Image',          hint: 'Profile / brand banner' },
  'upload.maxSize.postImage':         { label: 'Post Image',            hint: 'Collection & design images' },
  'upload.maxSize.postVideo':         { label: 'Post Video',            hint: 'Design & collection videos' },
  'upload.maxSize.reviewImage':       { label: 'Review Image',          hint: 'Product review photos' },
  'upload.maxSize.reviewVideo':       { label: 'Review Video',          hint: 'Product review videos' },
  'upload.maxSize.document':          { label: 'Document',              hint: 'PDFs and office documents' },
  'upload.maxSize.brandVerification': { label: 'Brand Verification',    hint: 'Verification documents' },
  'upload.maxSize.messageImage':      { label: 'Message Image',         hint: 'Chat/message image attachments' },
  'upload.maxSize.messageDocument':   { label: 'Message Document',      hint: 'Chat/message PDF attachments' },
  'upload.maxSize.productMedia':      { label: 'Product Media',         hint: 'Product images from store' },
  'upload.maxSize.collectionBulk':    { label: 'Collection Bulk Upload',hint: 'CSV bulk upload file' },
};

type SizeUnit = 'KB' | 'MB' | 'GB';
const UNIT_BYTES: Record<SizeUnit, number> = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
const UNITS: SizeUnit[] = ['KB', 'MB', 'GB'];
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: u }));

/** Pick the best human-readable unit for a byte value. */
const bestUnit = (bytes: number): SizeUnit => {
  if (bytes >= UNIT_BYTES.GB && bytes % UNIT_BYTES.GB === 0) return 'GB';
  if (bytes >= UNIT_BYTES.MB && bytes % UNIT_BYTES.MB === 0) return 'MB';
  if (bytes >= UNIT_BYTES.MB) return 'MB';
  return 'KB';
};

const bytesToUnit = (bytes: number, unit: SizeUnit) => bytes / UNIT_BYTES[unit];
const unitToBytes = (value: number, unit: SizeUnit) => Math.round(value * UNIT_BYTES[unit]);

/** Format a byte value with its unit for display. */
const formatBytes = (bytes: number, unit: SizeUnit) => {
  const v = bytesToUnit(bytes, unit);
  return `${v % 1 === 0 ? v : v.toFixed(2)} ${unit}`;
};

const AdminSettingsPage: React.FC = () => {
  const [slaConfigs, setSlaConfigs] = useState<AdminSlaConfig[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [uploadLimits, setUploadLimits] = useState<UploadLimits>({});
  const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
  const [editedLimits, setEditedLimits] = useState<Record<string, string>>({});
  const [editedUnits, setEditedUnits] = useState<Record<string, SizeUnit>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sla');
  const { refresh: refreshGlobalLimits } = useUploadLimits();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [slaRes, flagsRes, limitsData, configEntries] = await Promise.all([
        adminSlaApi.list(),
        adminFeatureFlagsApi.list(),
        configApi.getAdminUploadLimits(),
        configApi.listSystemConfig(),
      ]);
      const slaPayload = unwrapApiResponse<AdminSlaConfig[] | { items?: AdminSlaConfig[] }>(slaRes.data as any);
      const flagsPayload = unwrapApiResponse<FeatureFlag[] | { items?: FeatureFlag[] }>(flagsRes.data as any);
      setSlaConfigs(Array.isArray(slaPayload) ? slaPayload : slaPayload?.items ?? []);
      setFeatureFlags(Array.isArray(flagsPayload) ? flagsPayload : flagsPayload?.items ?? []);
      setUploadLimits(limitsData);
      setSystemConfig(
        Object.fromEntries((configEntries ?? []).map((entry) => [entry.key, entry.value])),
      );

      // Initialize edited values with best-fit units
      const initialValues: Record<string, string> = {};
      const initialUnits: Record<string, SizeUnit> = {};
      for (const [key, val] of Object.entries(limitsData)) {
        const unit = bestUnit(val);
        initialUnits[key] = unit;
        initialValues[key] = String(bytesToUnit(val, unit));
      }
      setEditedLimits(initialValues);
      setEditedUnits(initialUnits);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      await adminFeatureFlagsApi.toggle(flag.id);
      toast.success(`Flag "${flag.key}" ${flag.enabled ? 'disabled' : 'enabled'}`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to toggle feature flag');
    }
  };

  const hasUploadChanges = Object.keys(editedLimits).some((key) => {
    const currentBytes = uploadLimits[key] ?? 0;
    const unit = editedUnits[key] ?? 'MB';
    const editedVal = Number(editedLimits[key]);
    if (!Number.isFinite(editedVal)) return false;
    const editedBytes = unitToBytes(editedVal, unit);
    return Math.abs(editedBytes - currentBytes) > 1;
  });

  const handleSaveUploadLimits = async () => {
    const entries: { key: string; value: string }[] = [];
    for (const [key, valStr] of Object.entries(editedLimits)) {
      const val = Number(valStr);
      const unit = editedUnits[key] ?? 'MB';
      if (!Number.isFinite(val) || val <= 0) {
        toast.error(`Invalid value for ${UPLOAD_KEY_LABELS[key]?.label || key}`);
        return;
      }
      const currentBytes = uploadLimits[key] ?? 0;
      const newBytes = unitToBytes(val, unit);
      if (Math.abs(newBytes - currentBytes) > 1) {
        entries.push({ key, value: String(newBytes) });
      }
    }

    if (entries.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await configApi.bulkUpdateConfig(entries);
      toast.success(`${entries.length} upload limit${entries.length > 1 ? 's' : ''} updated`);
      await fetchData();
      await refreshGlobalLimits();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save upload limits');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { value: Tab; label: string }[] = [
    { value: 'sla', label: 'SLA Config' },
    { value: 'flags', label: 'Feature Flags' },
    { value: 'uploads', label: 'Upload Limits' },
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'messaging', label: 'Messaging Rules' },
  ];

  const showDailySignupCount = (systemConfig['admin.dashboard.showDailySignupCount'] ?? 'true') === 'true';

  /* ---- Messaging auto-hide rules (derived from systemConfig) ---- */
  const MESSAGING_RULES: { key: string; label: string; hint: string; type: 'toggle' | 'hours' }[] = [
    { key: 'messaging.brandToBrand.enabled', label: 'Brand-to-brand messaging', hint: 'Allow brand accounts to initiate direct conversations with other brands', type: 'toggle' },
    { key: 'messaging.autoHide.unverifiedUsers', label: 'Hide messages from unverified users', hint: 'Automatically hide messages sent by users who have not verified their account', type: 'toggle' },
    { key: 'messaging.autoHide.unverifiedUsersDelayHours', label: 'Delay before hiding (hours)', hint: 'Hide messages from unverified users after this many hours', type: 'hours' },
    { key: 'messaging.autoHide.incompleteStoreSetup', label: 'Hide messages from brands without store setup', hint: 'Automatically hide messages from brands that have not completed their store setup', type: 'toggle' },
    { key: 'messaging.autoHide.incompleteStoreSetupDelayHours', label: 'Delay before hiding (hours)', hint: 'Hide messages from incomplete-setup brands after this many hours', type: 'hours' },
    { key: 'messaging.autoHide.newAccounts', label: 'Hide messages from new accounts', hint: 'Automatically hide messages from accounts less than N hours old', type: 'toggle' },
    { key: 'messaging.autoHide.newAccountsDelayHours', label: 'New account age threshold (hours)', hint: 'Accounts younger than this are considered "new"', type: 'hours' },
  ];

  const [messagingDirty, setMessagingDirty] = useState<Record<string, string>>({});

  const getMessagingVal = (key: string) => messagingDirty[key] ?? systemConfig[key] ?? '';
  const setMessagingVal = (key: string, val: string) => setMessagingDirty((prev) => ({ ...prev, [key]: val }));
  const hasMessagingChanges = Object.keys(messagingDirty).some((k) => messagingDirty[k] !== (systemConfig[k] ?? ''));

  const handleSaveMessagingRules = async () => {
    const entries = Object.entries(messagingDirty)
      .filter(([k, v]) => v !== (systemConfig[k] ?? ''))
      .map(([key, value]) => ({ key, value }));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await configApi.bulkUpdateConfig(entries);
      toast.success('Messaging rules saved');
      setMessagingDirty({});
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save messaging rules');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDailySignupCount = async () => {
    setSaving(true);
    try {
      const next = !showDailySignupCount;
      await configApi.bulkUpdateConfig([
        {
          key: 'admin.dashboard.showDailySignupCount',
          value: next ? 'true' : 'false',
        },
      ]);
      setSystemConfig((prev) => ({
        ...prev,
        'admin.dashboard.showDailySignupCount': next ? 'true' : 'false',
      }));
      toast.success(`Daily signup card ${next ? 'enabled' : 'hidden'}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update dashboard setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Settings' }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm rounded-lg transition ${tab === t.value ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : tab === 'sla' ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Configurations</h2>
          {slaConfigs.length === 0 ? (
            <div className="text-gray-500 text-sm">No SLA configs defined. Create one to set response targets.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                    <th className="py-3 px-3">Area</th>
                    <th className="py-3 px-3">Target Hours</th>
                    <th className="py-3 px-3">Active</th>
                    <th className="py-3 px-3">Created By</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slaConfigs.map((config) => (
                    <tr key={config.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2.5 px-3 font-medium">{config.area}</td>
                      <td className="py-2.5 px-3">{config.targetHours}h</td>
                      <td className="py-2.5 px-3">{config.isActive ? 'Yes' : 'No'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{config.createdBy?.email ?? '—'}</td>
                      <td className="py-2.5 px-3">
                        <button className="text-purple-600 hover:underline text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'flags' ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feature Flags</h2>
          {featureFlags.length === 0 ? (
            <div className="text-gray-500 text-sm">No feature flags defined.</div>
          ) : (
            <div className="space-y-2">
              {featureFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-white/5"
                >
                  <div>
                    <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">{flag.key}</div>
                    {flag.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{flag.description}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleFlag(flag)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                      flag.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'dashboard' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dashboard Visibility</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Control whether system admins see the daily user signup count card on the admin dashboard.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Daily signup count</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {showDailySignupCount ? 'Visible on admin dashboard' : 'Hidden from admin dashboard'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleDailySignupCount()}
                disabled={saving}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  showDailySignupCount
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300'
                } disabled:opacity-60`}
              >
                {saving ? 'Saving...' : showDailySignupCount ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </div>
        </div>
      ) : tab === 'messaging' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Hide Message Rules</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure global rules that automatically hide messages matching certain criteria.
                These rules are evaluated by the backend when messages are sent.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveMessagingRules}
              disabled={!hasMessagingChanges || saving}
              className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-3">
            {MESSAGING_RULES.map((rule) => {
              const val = getMessagingVal(rule.key);
              if (rule.type === 'toggle') {
                const isEnabled = val === 'true';
                return (
                  <div key={rule.key} className="rounded-xl border border-gray-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{rule.label}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{rule.hint}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMessagingVal(rule.key, isEnabled ? 'false' : 'true')}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          isEnabled
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                );
              }
              // hours input
              return (
                <div key={rule.key} className="rounded-xl border border-gray-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{rule.label}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{rule.hint}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={val || '24'}
                      onChange={(e) => setMessagingVal(rule.key, e.target.value)}
                      className="w-20 shrink-0 rounded-lg border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-right font-mono outline-none focus:ring-1 focus:ring-purple-400/50"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Upload Limits tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Size Limits</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure maximum file sizes for each upload type. Use the unit selector (KB / MB / GB) per entry.
                Changes apply immediately across all upload screens.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveUploadLimits}
              disabled={!hasUploadChanges || saving}
              className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(UPLOAD_KEY_LABELS).map((key) => {
              const info = UPLOAD_KEY_LABELS[key];
              const currentBytes = uploadLimits[key] ?? 0;
              const unit = editedUnits[key] ?? 'MB';
              const editedVal = Number(editedLimits[key] ?? 0);
              const editedBytes = Number.isFinite(editedVal) ? unitToBytes(editedVal, unit) : 0;
              const changed = Number.isFinite(editedVal) && Math.abs(editedBytes - currentBytes) > 1;

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    changed
                      ? 'border-purple-300 bg-purple-50/50 dark:border-purple-500/30 dark:bg-purple-500/5'
                      : 'border-gray-200/60 dark:border-white/8 bg-white/60 dark:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{info.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{info.hint}</p>
                    </div>
                    {changed && (
                      <span className="shrink-0 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-1.5 py-0.5 rounded">
                        Changed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      value={editedLimits[key] ?? ''}
                      onChange={(e) => setEditedLimits((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 min-w-0 rounded-lg border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-right font-mono outline-none focus:ring-1 focus:ring-purple-400/50 transition-shadow"
                    />
                    <UniversalSelect
                      value={unit}
                      onChange={(newUnit) => {
                        const nu = newUnit as SizeUnit;
                        const oldUnit = editedUnits[key] ?? 'MB';
                        const oldVal = Number(editedLimits[key]);
                        // Convert the current numeric value to the new unit
                        if (Number.isFinite(oldVal) && oldVal > 0) {
                          const bytes = unitToBytes(oldVal, oldUnit);
                          const converted = bytesToUnit(bytes, nu);
                          setEditedLimits((prev) => ({ ...prev, [key]: String(parseFloat(converted.toFixed(4))) }));
                        }
                        setEditedUnits((prev) => ({ ...prev, [key]: nu }));
                      }}
                      options={UNIT_OPTIONS}
                      className="w-20 shrink-0 [&_button]:!px-2 [&_button]:!py-1.5 [&_button]:!rounded-lg [&_button]:!text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                    Current: {formatBytes(currentBytes, bestUnit(currentBytes))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
