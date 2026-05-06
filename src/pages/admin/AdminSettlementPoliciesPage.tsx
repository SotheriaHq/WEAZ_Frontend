import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import VLoader from '@/components/loaders/VLoader';
import Modal from '@/components/ui/Modal';
import { adminBrandsApi, adminFinanceApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import type {
  AdminBrand,
  AdminSettlementPolicy,
  AdminSettlementPolicyPreview,
} from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import {
  createEmptySettlementPolicyForm,
  normalizeSettlementPolicyFormValues,
  SETTLEMENT_ORDER_TYPE_OPTIONS,
  SETTLEMENT_RELEASE_MODE_OPTIONS,
  SETTLEMENT_SCOPE_OPTIONS,
  SETTLEMENT_TRIGGER_OPTIONS,
  toSettlementPolicyFormValues,
  toSettlementPolicyPayload,
  type SettlementPolicyFormErrors,
  type SettlementPolicyFormValues,
  validateSettlementPolicyForm,
} from './financeSettlementPolicyForm';

type PolicyFilterState = {
  orderType: string;
  scope: string;
  brandId: string;
  currency: string;
  isActive: string;
};

type PreviewFormState = {
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  brandId: string;
  currency: string;
  amount: string;
  effectiveAt: string;
};

type ConfirmState =
  | {
      action: 'activate' | 'deactivate';
      policy: AdminSettlementPolicy;
    }
  | null;

const initialFilters: PolicyFilterState = {
  orderType: '',
  scope: '',
  brandId: '',
  currency: '',
  isActive: '',
};

const createPreviewFormState = (): PreviewFormState => ({
  orderType: 'STANDARD_ORDER',
  brandId: '',
  currency: 'NGN',
  amount: '',
  effectiveAt: '',
});

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not set';

const formatMoney = (value: number | string | null | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatPercent = (value: number | string | null | undefined) =>
  `${Number(value || 0).toFixed(2)}%`;

const prettifyValue = (value?: string | null) =>
  String(value || 'Not set').replaceAll('_', ' ');

const normalizeErrorMessage = (error: any, fallback: string) => {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const AdminSettlementPoliciesPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminPermissions();
  const canRead = hasPermission('PAYOUTS_READ');
  const canProcess = hasPermission('PAYOUTS_PROCESS');

  const [filters, setFilters] = useState<PolicyFilterState>(initialFilters);
  const [policies, setPolicies] = useState<AdminSettlementPolicy[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AdminSettlementPolicy | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<SettlementPolicyFormValues>(
    createEmptySettlementPolicyForm(),
  );
  const [formErrors, setFormErrors] = useState<SettlementPolicyFormErrors>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formApiError, setFormApiError] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState<PreviewFormState>(
    createPreviewFormState(),
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<AdminSettlementPolicyPreview | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const brandOptions = [
    { value: '', label: 'All brands' },
    ...brands.map((brand) => ({
      value: brand.id,
      label: brand.name?.trim() || brand.owner?.email || brand.id,
      description: brand.owner?.email || undefined,
    })),
  ];

  const brandSelectOptions = [
    { value: '', label: 'Select a brand' },
    ...brands.map((brand) => ({
      value: brand.id,
      label: brand.name?.trim() || brand.owner?.email || brand.id,
      description: brand.owner?.email || undefined,
    })),
  ];

  const loadPolicies = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await adminFinanceApi.listSettlementPolicies({
        ...(filters.orderType ? { orderType: filters.orderType } : {}),
        ...(filters.scope ? { scope: filters.scope } : {}),
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.currency.trim() ? { currency: filters.currency.trim().toUpperCase() } : {}),
        ...(filters.isActive ? { isActive: filters.isActive } : {}),
        take: '100',
      });
      const data = unwrapApiResponse<AdminSettlementPolicy[]>(response.data as any);
      setPolicies(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErrorMessage(normalizeErrorMessage(error, 'Unable to load settlement policies.'));
    } finally {
      setLoading(false);
    }
  }, [canRead, filters.brandId, filters.currency, filters.isActive, filters.orderType, filters.scope]);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const response = await adminBrandsApi.list({ limit: '100' } as Record<string, string>);
      const data = unwrapApiResponse<{ items: AdminBrand[] }>(response.data as any);
      setBrands(Array.isArray(data.items) ? data.items : []);
    } catch {
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const updateFormValue = <K extends keyof SettlementPolicyFormValues>(
    key: K,
    value: SettlementPolicyFormValues[K],
  ) => {
    setFormValues((current) => {
      const next = normalizeSettlementPolicyFormValues({
        ...current,
        [key]: value,
      });
      return next;
    });
    setFormErrors((current) => {
      if (!current[key as keyof SettlementPolicyFormErrors]) {
        return current;
      }
      return { ...current, [key]: undefined };
    });
    setFormApiError(null);
  };

  const openCreateModal = () => {
    setEditingPolicyId(null);
    setFormValues(createEmptySettlementPolicyForm());
    setFormErrors({});
    setFormApiError(null);
    setFormOpen(true);
  };

  const openEditModal = async (policy: AdminSettlementPolicy) => {
    setEditingPolicyId(policy.id);
    setFormLoadingState();
    try {
      const response = await adminFinanceApi.getSettlementPolicy(policy.id);
      const detail = unwrapApiResponse<AdminSettlementPolicy>(response.data as any);
      setFormValues(toSettlementPolicyFormValues(detail));
      setFormErrors({});
      setFormApiError(null);
      setFormOpen(true);
      setDetailLoading(false);
    } catch (error: any) {
      toast.error(normalizeErrorMessage(error, 'Unable to load settlement policy.'));
      setDetailLoading(false);
    }
  };

  const setFormLoadingState = () => {
    setDetailLoading(true);
    setFormApiError(null);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setEditingPolicyId(null);
    setFormSubmitting(false);
    setDetailLoading(false);
    setFormErrors({});
    setFormApiError(null);
  };

  const openViewModal = async (policy: AdminSettlementPolicy) => {
    setViewOpen(true);
    setDetailLoading(true);
    try {
      const response = await adminFinanceApi.getSettlementPolicy(policy.id);
      const detail = unwrapApiResponse<AdminSettlementPolicy>(response.data as any);
      setSelectedPolicy(detail);
    } catch (error: any) {
      toast.error(normalizeErrorMessage(error, 'Unable to load settlement policy details.'));
      setViewOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openPreviewModal = (policy?: AdminSettlementPolicy) => {
    setPreviewError(null);
    setPreviewResult(null);
    setPreviewValues({
      orderType: policy?.orderType ?? 'STANDARD_ORDER',
      brandId: policy?.scope === 'BRAND' ? policy.brandId ?? '' : '',
      currency: policy?.currency ?? 'NGN',
      amount: '',
      effectiveAt: policy?.effectiveFrom ? toDateTimeLocalValue(policy.effectiveFrom) : '',
    });
    setPreviewOpen(true);
  };

  const submitForm = async () => {
    const validation = validateSettlementPolicyForm(formValues);
    setFormValues(validation.values);
    setFormErrors(validation.errors);
    setFormApiError(null);

    if (Object.keys(validation.errors).length > 0) {
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = toSettlementPolicyPayload(validation.values);
      if (editingPolicyId) {
        await adminFinanceApi.updateSettlementPolicy(editingPolicyId, payload);
        toast.success('Settlement policy updated.');
      } else {
        await adminFinanceApi.createSettlementPolicy(payload);
        toast.success('Settlement policy created.');
      }
      closeFormModal();
      void loadPolicies();
    } catch (error: any) {
      setFormApiError(
        normalizeErrorMessage(error, 'Unable to save settlement policy.'),
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const runPreview = async () => {
    setPreviewError(null);
    setPreviewResult(null);

    if (!previewValues.brandId) {
      setPreviewError('Select a brand to resolve settlement policy preview.');
      return;
    }

    if (!previewValues.currency.trim()) {
      setPreviewError('Currency is required.');
      return;
    }

    const amount = Number(previewValues.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPreviewError('Amount must be greater than 0.');
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await adminFinanceApi.previewSettlementPolicy({
        orderType: previewValues.orderType,
        brandId: previewValues.brandId,
        currency: previewValues.currency.trim().toUpperCase(),
        amount,
        ...(previewValues.effectiveAt
          ? { effectiveAt: new Date(previewValues.effectiveAt).toISOString() }
          : {}),
      });
      const data = unwrapApiResponse<AdminSettlementPolicyPreview>(response.data as any);
      setPreviewResult(data);
    } catch (error: any) {
      setPreviewError(normalizeErrorMessage(error, 'Unable to preview settlement policy.'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmPolicyAction = async () => {
    if (!confirmState) return;
    const { action, policy } = confirmState;
    setBusyId(`${action}:${policy.id}`);
    try {
      if (action === 'activate') {
        await adminFinanceApi.activateSettlementPolicy(policy.id);
        toast.success('Settlement policy activated.');
      } else {
        await adminFinanceApi.deactivateSettlementPolicy(policy.id);
        toast.success('Settlement policy deactivated.');
      }
      setConfirmState(null);
      void loadPolicies();
    } catch (error: any) {
      toast.error(
        normalizeErrorMessage(error, `Unable to ${action} settlement policy.`),
      );
    } finally {
      setBusyId(null);
    }
  };

  const getBrandLabel = (brandId?: string | null) => {
    if (!brandId) return 'Platform-wide';
    const brand = brands.find((item) => item.id === brandId);
    return brand?.name?.trim() || brand?.owner?.email || brandId;
  };

  if (!canRead) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumb segments={[{ label: 'Finance', path: '/admin/finance' }, { label: 'Settlement Policies' }]} />
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-500/30 dark:bg-rose-500/10">
          <h1 className="text-xl font-semibold text-rose-700 dark:text-rose-200">
            Permission denied
          </h1>
          <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-200/80">
            Settlement policy reads require the `payouts.read` permission.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        segments={[
          { label: 'Finance', path: '/admin/finance' },
          { label: 'Settlement Policies' },
        ]}
      />

      <section className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Settlement Release Policies
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Settlement policy controls release timing and tranche percentages. Commission policy controls platform earnings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/finance')}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Open finance console
            </button>
            <button
              type="button"
              onClick={() => void loadPolicies()}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => openPreviewModal()}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              Preview settlement
            </button>
            {canProcess ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
              >
                Create policy
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Callout tone="slate">
            Existing paid orders keep their snapshot values. Policy edits affect future paid orders only.
          </Callout>
          <Callout tone="amber">
            Preview is read-only. It does not create an order, snapshot, ledger entry, payout, or wallet credit.
          </Callout>
        </div>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <UniversalSelect
            value={filters.orderType}
            onChange={(value) => setFilters((current) => ({ ...current, orderType: value }))}
            options={[{ value: '', label: 'All order types' }, ...SETTLEMENT_ORDER_TYPE_OPTIONS]}
            placeholder="Order type"
          />
          <UniversalSelect
            value={filters.scope}
            onChange={(value) => setFilters((current) => ({ ...current, scope: value }))}
            options={[{ value: '', label: 'All scopes' }, ...SETTLEMENT_SCOPE_OPTIONS]}
            placeholder="Scope"
          />
          <UniversalSelect
            value={filters.brandId}
            onChange={(value) => setFilters((current) => ({ ...current, brandId: value }))}
            options={brandOptions}
            placeholder={brandsLoading ? 'Loading brands...' : 'Brand'}
            searchable
            disabled={brandsLoading}
          />
          <InputShell>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Currency
            </div>
            <input
              value={filters.currency}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  currency: event.target.value.toUpperCase(),
                }))
              }
              placeholder="NGN"
              className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
            />
          </InputShell>
          <UniversalSelect
            value={filters.isActive}
            onChange={(value) => setFilters((current) => ({ ...current, isActive: value }))}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            placeholder="Status"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="border-b border-black/5 px-5 py-4 dark:border-white/5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Policies
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Release settings remain separate from commission rules.
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <SkeletonTable />
          ) : errorMessage ? (
            <ErrorState message={errorMessage} onRetry={() => void loadPolicies()} />
          ) : policies.length === 0 ? (
            <EmptyState message="No settlement policies matched the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-slate-500 dark:border-white/5 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">Order type</th>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Brand</th>
                    <th className="px-4 py-3 font-medium">Currency</th>
                    <th className="px-4 py-3 font-medium">Release mode</th>
                    <th className="px-4 py-3 font-medium">Upfront enabled</th>
                    <th className="px-4 py-3 font-medium">Upfront %</th>
                    <th className="px-4 py-3 font-medium">Delay hours</th>
                    <th className="px-4 py-3 font-medium">Auto release days</th>
                    <th className="px-4 py-3 font-medium">Final trigger</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Default</th>
                    <th className="px-4 py-3 font-medium">Effective window</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr
                      key={policy.id}
                      className="border-b border-black/5 last:border-b-0 dark:border-white/5"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {prettifyValue(policy.orderType)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {prettifyValue(policy.scope)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {getBrandLabel(policy.brandId)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {policy.currency || 'All currencies'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {prettifyValue(policy.releaseMode)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {policy.upfrontReleaseEnabled ? 'Enabled' : 'Disabled'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatPercent(policy.upfrontReleasePercent)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {policy.settlementDelayHours}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {policy.autoReleaseDays}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {prettifyValue(policy.finalReleaseTrigger)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={policy.isActive ? 'emerald' : 'slate'}
                          label={policy.isActive ? 'Active' : 'Inactive'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={policy.isDefault ? 'sky' : 'slate'}
                          label={policy.isDefault ? 'Default' : 'No'}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div>{formatDateTime(policy.effectiveFrom)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          to {formatDateTime(policy.effectiveTo)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            label="View"
                            onClick={() => void openViewModal(policy)}
                          />
                          <ActionButton
                            label="Preview"
                            onClick={() => openPreviewModal(policy)}
                          />
                          <ActionButton
                            label="Edit"
                            onClick={() => void openEditModal(policy)}
                            disabled={!canProcess}
                          />
                          {policy.isActive ? (
                            <ActionButton
                              label={busyId === `deactivate:${policy.id}` ? 'Deactivating...' : 'Deactivate'}
                              onClick={() =>
                                setConfirmState({ action: 'deactivate', policy })
                              }
                              disabled={!canProcess || busyId === `deactivate:${policy.id}`}
                            />
                          ) : (
                            <ActionButton
                              label={busyId === `activate:${policy.id}` ? 'Activating...' : 'Activate'}
                              onClick={() => setConfirmState({ action: 'activate', policy })}
                              disabled={!canProcess || busyId === `activate:${policy.id}`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedPolicy(null);
        }}
        title="Settlement Policy Detail"
        size="lg"
      >
        {detailLoading ? (
          <LoaderBlock />
        ) : selectedPolicy ? (
          <div className="space-y-4">
            <Callout tone="slate">
              Snapshot protection applies. Existing paid orders keep their original settlement snapshot values.
            </Callout>
            <DetailList
              items={[
                { label: 'Order type', value: prettifyValue(selectedPolicy.orderType) },
                { label: 'Scope', value: prettifyValue(selectedPolicy.scope) },
                { label: 'Brand', value: getBrandLabel(selectedPolicy.brandId) },
                { label: 'Currency', value: selectedPolicy.currency || 'All currencies' },
                { label: 'Release mode', value: prettifyValue(selectedPolicy.releaseMode) },
                {
                  label: 'Upfront release enabled',
                  value: selectedPolicy.upfrontReleaseEnabled ? 'Yes' : 'No',
                },
                {
                  label: 'Upfront release percent',
                  value: formatPercent(selectedPolicy.upfrontReleasePercent),
                },
                {
                  label: 'Settlement delay hours',
                  value: String(selectedPolicy.settlementDelayHours),
                },
                { label: 'Auto release days', value: String(selectedPolicy.autoReleaseDays) },
                {
                  label: 'Final release trigger',
                  value: prettifyValue(selectedPolicy.finalReleaseTrigger),
                },
                { label: 'Default policy', value: selectedPolicy.isDefault ? 'Yes' : 'No' },
                { label: 'Active', value: selectedPolicy.isActive ? 'Yes' : 'No' },
                { label: 'Effective from', value: formatDateTime(selectedPolicy.effectiveFrom) },
                { label: 'Effective to', value: formatDateTime(selectedPolicy.effectiveTo) },
              ]}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={editingPolicyId ? 'Edit Settlement Policy' : 'Create Settlement Policy'}
        size="lg"
      >
        {detailLoading && editingPolicyId ? (
          <LoaderBlock />
        ) : (
          <div className="space-y-4">
            <Callout tone="amber">
              Changes affect future paid orders only. Existing paid orders keep their snapshot values.
            </Callout>
            {formApiError ? <InlineError message={formApiError} /> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <UniversalSelect
                value={formValues.orderType}
                onChange={(value) =>
                  updateFormValue('orderType', value as SettlementPolicyFormValues['orderType'])
                }
                options={[...SETTLEMENT_ORDER_TYPE_OPTIONS]}
                placeholder="Order type"
              />
              <UniversalSelect
                value={formValues.scope}
                onChange={(value) =>
                  updateFormValue('scope', value as SettlementPolicyFormValues['scope'])
                }
                options={[...SETTLEMENT_SCOPE_OPTIONS]}
                placeholder="Scope"
              />
              {formValues.scope === 'BRAND' ? (
                <UniversalSelect
                  value={formValues.brandId}
                  onChange={(value) => updateFormValue('brandId', value)}
                  options={brandSelectOptions}
                  placeholder={brandsLoading ? 'Loading brands...' : 'Select a brand'}
                  searchable
                  disabled={brandsLoading}
                  error={formErrors.brandId}
                />
              ) : null}
              <FieldShell label="Currency" error={formErrors.currency}>
                <input
                  value={formValues.currency}
                  onChange={(event) =>
                    updateFormValue('currency', event.target.value.toUpperCase())
                  }
                  className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
                />
              </FieldShell>
              <UniversalSelect
                value={formValues.releaseMode}
                onChange={(value) =>
                  updateFormValue(
                    'releaseMode',
                    value as SettlementPolicyFormValues['releaseMode'],
                  )
                }
                options={[...SETTLEMENT_RELEASE_MODE_OPTIONS]}
                placeholder="Release mode"
              />
              <ToggleField
                label="Upfront release enabled"
                checked={formValues.upfrontReleaseEnabled}
                disabled={formValues.releaseMode === 'HOLD_UNTIL_DELIVERY'}
                onToggle={() =>
                  updateFormValue(
                    'upfrontReleaseEnabled',
                    !formValues.upfrontReleaseEnabled,
                  )
                }
                helper={
                  formValues.releaseMode === 'HOLD_UNTIL_DELIVERY'
                    ? 'Hold-until-delivery forces this off.'
                    : 'Use this only for split release policies.'
                }
              />
              <FieldShell
                label="Upfront release percent"
                error={formErrors.upfrontReleasePercent}
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={formValues.upfrontReleasePercent}
                  disabled={!formValues.upfrontReleaseEnabled}
                  onChange={(event) =>
                    updateFormValue('upfrontReleasePercent', event.target.value)
                  }
                  className="mt-1 w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                />
              </FieldShell>
              <FieldShell
                label="Settlement delay hours"
                error={formErrors.settlementDelayHours}
              >
                <input
                  type="number"
                  min={0}
                  value={formValues.settlementDelayHours}
                  onChange={(event) =>
                    updateFormValue('settlementDelayHours', event.target.value)
                  }
                  className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
                />
              </FieldShell>
              <FieldShell label="Auto release days" error={formErrors.autoReleaseDays}>
                <input
                  type="number"
                  min={0}
                  value={formValues.autoReleaseDays}
                  onChange={(event) =>
                    updateFormValue('autoReleaseDays', event.target.value)
                  }
                  className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
                />
              </FieldShell>
              <UniversalSelect
                value={formValues.finalReleaseTrigger}
                onChange={(value) =>
                  updateFormValue(
                    'finalReleaseTrigger',
                    value as SettlementPolicyFormValues['finalReleaseTrigger'],
                  )
                }
                options={[...SETTLEMENT_TRIGGER_OPTIONS]}
                placeholder="Final release trigger"
              />
              <ToggleField
                label="Default policy"
                checked={formValues.isDefault}
                onToggle={() => updateFormValue('isDefault', !formValues.isDefault)}
              />
              <ToggleField
                label="Active"
                checked={formValues.isActive}
                onToggle={() => updateFormValue('isActive', !formValues.isActive)}
              />
              <FieldShell label="Effective from" error={formErrors.effectiveFrom}>
                <input
                  type="datetime-local"
                  value={formValues.effectiveFrom}
                  onChange={(event) => updateFormValue('effectiveFrom', event.target.value)}
                  className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
                />
              </FieldShell>
              <FieldShell label="Effective to" error={formErrors.effectiveTo}>
                <input
                  type="datetime-local"
                  value={formValues.effectiveTo}
                  onChange={(event) => updateFormValue('effectiveTo', event.target.value)}
                  className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
                />
              </FieldShell>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitForm()}
                disabled={formSubmitting}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {formSubmitting ? 'Saving...' : editingPolicyId ? 'Save changes' : 'Create policy'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewResult(null);
          setPreviewError(null);
        }}
        title="Settlement Preview"
        size="lg"
      >
        <div className="space-y-4">
          <Callout tone="amber">
            This does not create an order, snapshot, ledger entry, payout, or wallet credit.
          </Callout>
          {previewError ? <InlineError message={previewError} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <UniversalSelect
              value={previewValues.orderType}
              onChange={(value) =>
                setPreviewValues((current) => ({
                  ...current,
                  orderType: value as PreviewFormState['orderType'],
                }))
              }
              options={[...SETTLEMENT_ORDER_TYPE_OPTIONS]}
              placeholder="Order type"
            />
            <UniversalSelect
              value={previewValues.brandId}
              onChange={(value) =>
                setPreviewValues((current) => ({ ...current, brandId: value }))
              }
              options={brandSelectOptions}
              placeholder={brandsLoading ? 'Loading brands...' : 'Select a brand'}
              searchable
              disabled={brandsLoading}
            />
            <FieldShell label="Currency">
              <input
                value={previewValues.currency}
                onChange={(event) =>
                  setPreviewValues((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
              />
            </FieldShell>
            <FieldShell label="Amount">
              <input
                type="number"
                min={0}
                step="0.01"
                value={previewValues.amount}
                onChange={(event) =>
                  setPreviewValues((current) => ({ ...current, amount: event.target.value }))
                }
                className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
              />
            </FieldShell>
            <FieldShell label="Effective at">
              <input
                type="datetime-local"
                value={previewValues.effectiveAt}
                onChange={(event) =>
                  setPreviewValues((current) => ({
                    ...current,
                    effectiveAt: event.target.value,
                  }))
                }
                className="mt-1 w-full bg-transparent text-sm outline-none dark:text-white"
              />
            </FieldShell>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={previewLoading}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {previewLoading ? 'Previewing...' : 'Run preview'}
            </button>
          </div>

          {previewLoading ? <LoaderBlock /> : null}

          {previewResult ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Resolved policy
                </h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <DetailList
                    items={[
                      {
                        label: 'Policy ID',
                        value: previewResult.resolvedSettlementPolicy.id || 'No policy id',
                      },
                      {
                        label: 'Release mode',
                        value: prettifyValue(
                          previewResult.settlementBreakdown.releaseMode,
                        ),
                      },
                      {
                        label: 'Upfront enabled',
                        value: previewResult.settlementBreakdown.upfrontReleaseEnabled
                          ? 'Yes'
                          : 'No',
                      },
                      {
                        label: 'Upfront percent',
                        value: formatPercent(
                          previewResult.settlementBreakdown.upfrontReleasePercent,
                        ),
                      },
                    ]}
                  />
                  <DetailList
                    items={[
                      {
                        label: 'Final release trigger',
                        value: prettifyValue(
                          previewResult.settlementBreakdown.finalReleaseTrigger,
                        ),
                      },
                      {
                        label: 'Settlement delay hours',
                        value: String(
                          previewResult.settlementBreakdown.settlementDelayHours,
                        ),
                      },
                      {
                        label: 'Auto release days',
                        value: String(previewResult.settlementBreakdown.autoReleaseDays),
                      },
                      {
                        label: 'Commission rule ID',
                        value: previewResult.commissionBreakdown.commissionRuleId || 'No rule id',
                      },
                    ]}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-black/10 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Settlement breakdown
                </h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <DetailList
                    items={[
                      {
                        label: 'Upfront gross',
                        value: formatMoney(
                          previewResult.settlementBreakdown.upfrontReleaseGrossAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Upfront commission',
                        value: formatMoney(
                          previewResult.settlementBreakdown.upfrontReleaseCommissionAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Upfront brand net',
                        value: formatMoney(
                          previewResult.settlementBreakdown.upfrontReleaseNetBrandAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Final gross',
                        value: formatMoney(
                          previewResult.settlementBreakdown.finalReleaseGrossAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                    ]}
                  />
                  <DetailList
                    items={[
                      {
                        label: 'Final commission',
                        value: formatMoney(
                          previewResult.settlementBreakdown.finalReleaseCommissionAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Final brand net',
                        value: formatMoney(
                          previewResult.settlementBreakdown.finalReleaseNetBrandAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Total commission',
                        value: formatMoney(
                          previewResult.settlementBreakdown.commissionAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                      {
                        label: 'Total brand net',
                        value: formatMoney(
                          previewResult.settlementBreakdown.brandNetAmount,
                          previewResult.settlementBreakdown.currency,
                        ),
                      },
                    ]}
                  />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        title={confirmState?.action === 'activate' ? 'Activate policy' : 'Deactivate policy'}
        size="sm"
      >
        {confirmState ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {confirmState.action === 'activate'
                ? 'Activate this settlement policy for future paid orders? Existing paid orders keep their original snapshot values.'
                : 'Deactivate this settlement policy? Existing paid orders keep their original snapshot values.'}
            </p>
            <div className="rounded-2xl border border-black/10 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              {prettifyValue(confirmState.policy.orderType)} · {getBrandLabel(confirmState.policy.brandId)}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmPolicyAction()}
                disabled={busyId === `${confirmState.action}:${confirmState.policy.id}`}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {busyId === `${confirmState.action}:${confirmState.policy.id}`
                  ? 'Working...'
                  : confirmState.action === 'activate'
                    ? 'Activate policy'
                    : 'Deactivate policy'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

const Callout: React.FC<{
  tone: 'slate' | 'amber';
  children: React.ReactNode;
}> = ({ tone, children }) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-sm ${
      tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
        : 'border-black/10 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
    }`}
  >
    {children}
  </div>
);

const StatusBadge: React.FC<{
  tone: 'emerald' | 'sky' | 'slate';
  label: string;
}> = ({ tone, label }) => {
  const className =
    tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'sky'
        ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
};

const ActionButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, onClick, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
  >
    {label}
  </button>
);

const InputShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
    {children}
  </div>
);

const FieldShell: React.FC<{
  label: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, error, children }) => (
  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {label}
    </div>
    {children}
    {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
  </div>
);

const ToggleField: React.FC<{
  label: string;
  checked: boolean;
  onToggle: () => void;
  helper?: string;
  disabled?: boolean;
}> = ({ label, checked, onToggle, helper, disabled = false }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`rounded-2xl border px-4 py-3 text-left transition ${
      checked
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
        : 'border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.03]'
    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
  >
    <div className="text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {helper || (checked ? 'Enabled' : 'Disabled')}
    </div>
  </button>
);

const DetailList: React.FC<{
  items: Array<{ label: string; value: React.ReactNode }>;
}> = ({ items }) => (
  <div className="divide-y divide-dashed divide-black/10 dark:divide-white/10">
    {items.map((item) => (
      <div
        key={item.label}
        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
      >
        <span className="text-sm text-slate-500 dark:text-slate-400">{item.label}</span>
        <span className="max-w-[60%] text-right text-sm font-medium text-slate-900 dark:text-white">
          {item.value}
        </span>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
    {message}
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
    <div>{message}</div>
    <button
      type="button"
      onClick={onRetry}
      className="mt-3 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold transition hover:bg-rose-100 dark:border-rose-500/30 dark:hover:bg-rose-500/20"
    >
      Retry
    </button>
  </div>
);

const InlineError: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
    {message}
  </div>
);

const LoaderBlock = () => (
  <div className="flex items-center justify-center py-14">
    <VLoader size={34} phase="loading" showLabel={false} />
  </div>
);

const SkeletonTable = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]"
      />
    ))}
  </div>
);

export default AdminSettlementPoliciesPage;
