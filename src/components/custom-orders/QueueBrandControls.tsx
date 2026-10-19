import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  adminOrderQueueApi,
  customOrderQueueApi,
} from '@/api/CustomOrderQueueApi';
import { QueueBrandCounts } from './CustomOrderQueue';
import { useQueueConfirm } from '@/components/custom-orders/useQueueConfirm';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { isBrandOwner } from '@/lib/brandAccess';
import type { RootState } from '@/store';

export function BrandQueueSettings({ brandId }: { brandId: string }) {
  const profile = useSelector((state: RootState) => state.user.profile);
  const canManage = isBrandOwner(profile, brandId);
  const query = useQuery({
    queryKey: ['custom-order-queue-brand', brandId],
    queryFn: () => customOrderQueueApi.brand(brandId),
    staleTime: 15000,
  });
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (
      !query.data ||
      !(await confirm({
        title: query.data.queueJumpEnabled
          ? 'Turn paid jumps off?'
          : 'Enable paid jumps?',
        message:
          'Paid jumps cost 20% of garment subtotal. The brand earns 90% of this fee only when the order becomes Active. Up Next is protected; paid jumps remain FIFO, with at most two paid-priority promotions before one ordinary waiting order.',
        confirmText: 'Confirm setting',
      }))
    )
      return;
    setBusy(true);
    try {
      await customOrderQueueApi.settings(brandId, !query.data.queueJumpEnabled);
      await query.refetch();
      toast.success('Paid-jump setting saved.');
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(error, 'Unable to change paid jumps.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="queue-section text-slate-900 dark:text-white">
      {ConfirmDialog}
      <h2 className="font-bold">🧵 Custom-order subscription and priority</h2>
      <Link
        className="queue-button inline-flex"
        to="/settings?tab=subscription-billing"
      >
        Manage subscription and billing
      </Link>
      {query.isError ? (
        <p role="alert">
          Unable to load queue settings.{' '}
          <button className="queue-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : query.isPending ? (
        <p role="status">Loading queue settings…</p>
      ) : (
        <>
          <p className="text-sm">
            Paid queue jumps:{' '}
            {query.data.queueJumpEnabled ? 'Enabled' : 'Disabled'}. Available
            only on Aru and Igwe. Existing paid jumps retain their priority if
            disabled.
          </p>
          <button
            className="queue-button"
            disabled={
              !canManage || busy || !query.data.capacity.queueJumpAllowed
            }
            onClick={() => void toggle()}
          >
            {busy
              ? 'Saving…'
              : query.data.queueJumpEnabled
                ? 'Disable paid jumps'
                : 'Enable paid jumps'}
          </button>
          {!canManage ? (
            <p className="text-xs">
              Only the brand owner can manage billing and paid-jump settings.
            </p>
          ) : !query.data.capacity.queueJumpAllowed ? (
            <p className="text-xs">
              Subscribe to Aru or Igwe to enable paid jumps. Legacy has no jump
              entitlement.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
export function AdminBrandQueueControls({ brandId }: { brandId: string }) {
  const query = useQuery({
    queryKey: ['admin-custom-order-queue-brand', brandId],
    queryFn: () => adminOrderQueueApi.brand(brandId),
  });
  const { hasPermission } = useAdminPermissions();
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const [reason, setReason] = useState('');
  const [assignedTier, setAssignedTier] = useState('');
  const tiers = useQuery({
    queryKey: ['queue-admin-tiers'],
    queryFn: adminOrderQueueApi.tiers,
    enabled: hasPermission('brands.read'),
  });
  const [cap, setCap] = useState('');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  async function change(override: boolean, clear = false) {
    if (reason.trim().length < 3) return;
    if (
      !(await confirm({
        title: override
          ? clear
            ? 'Remove brand capacity override?'
            : 'Apply brand capacity override?'
          : query.data?.intakeBlocked
            ? 'Resume new custom orders?'
            : 'Pause new custom orders?',
        message: override
          ? 'Brand overrides take priority over tier capacity and campaigns. Existing paid orders are preserved when capacity falls. An empty expiry keeps the override until removed manually.'
          : 'Existing paid orders continue to be fulfilled. This intake control is separate from a safety suspension, which can also hold promotions and payouts.',
        confirmText: 'Apply change',
      }))
    )
      return;
    setBusy(true);
    try {
      if (override)
        await adminOrderQueueApi.override(
          brandId,
          clear ? null : Number(cap),
          expiry && !clear
            ? new Date(`${expiry}+01:00`).toISOString()
            : undefined,
          reason.trim(),
        );
      else
        await adminOrderQueueApi.intake(
          brandId,
          !query.data?.intakeBlocked,
          reason.trim(),
        );
      await query.refetch();
      toast.success('Brand queue policy updated.');
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(error, 'Unable to update this brand.'),
      );
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (
      reason.trim().length < 3 ||
      !assignedTier ||
      !(await confirm({
        title: 'Assign subscription offer?',
        message:
          'This assigns an offer for the brand owner to review. It does not charge the brand or grant unpaid capacity. Existing Legacy access continues until the owner consents and payment succeeds.',
        confirmText: 'Assign offer',
      }))
    )
      return;
    setBusy(true);
    try {
      await adminOrderQueueApi.assignTier(brandId, assignedTier, reason.trim());
      await query.refetch();
      toast.success(
        'Subscription offer assigned. The owner must consent and pay.',
      );
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(error, 'Unable to assign this offer.'),
      );
    } finally {
      setBusy(false);
    }
  }
  const tierOptions = (
    Array.isArray(tiers.data) ? tiers.data : (tiers.data?.tiers ?? [])
  )
    .filter((tier) => tier.tierKey !== 'LEGACY')
    .map((tier) => ({
      value: tier.tierKey,
      label: tier.label ?? tier.tierKey,
    }));
  return (
    <section className="queue-section">
      {ConfirmDialog}
      <QueueBrandCounts brandId={brandId} />
      {query.data?.massCancelAttentionAt ? (
        <p
          role="alert"
          className="border-l-2 border-rose-500 pl-3 text-sm text-rose-900 dark:text-rose-200"
        >
          Bulk cancellation attention: more than five cancellations occurred in
          one action or a rolling 24 hours. Review the brand orders; this flag
          does not suspend the brand automatically.
        </p>
      ) : null}
      {query.data?.activeOrderCapOverride != null ? (
        <p className="text-sm">
          Current Active override: {query.data.activeOrderCapOverride}.{' '}
          {query.data.activeOrderCapOverrideUntil
            ? `Expires ${new Date(query.data.activeOrderCapOverrideUntil).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`
            : 'Continues until removed manually'}
          .
        </p>
      ) : null}
      {query.isError ? (
        <p role="alert">
          Unable to load admin controls.{' '}
          <button className="queue-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : null}
      <label className="block text-sm">
        Audit reason
        <textarea
          className="mt-1 w-full rounded-xl border bg-white p-3 dark:bg-slate-950"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className="queue-button"
          disabled={
            busy ||
            !query.data ||
            reason.trim().length < 3 ||
            !hasPermission('brands.suspend')
          }
          onClick={() => void change(false)}
        >
          {query.data?.intakeBlocked
            ? 'Resume custom-order intake'
            : 'Pause custom-order intake'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Active capacity override
          <input
            type="number"
            min="0"
            step="1"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            className="mt-1 w-full rounded-xl border bg-white p-3 dark:bg-slate-950"
          />
        </label>
        <label className="text-sm">
          Expires (WAT, optional)
          <input
            type="datetime-local"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="mt-1 w-full min-w-0 rounded-xl border bg-white p-3 dark:bg-slate-950"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="queue-button"
          disabled={
            busy ||
            !hasPermission('brands.store_override') ||
            reason.trim().length < 3 ||
            !Number.isInteger(Number(cap)) ||
            Number(cap) < 0
          }
          onClick={() => void change(true)}
        >
          Review override
        </button>
        <button
          className="queue-button"
          disabled={
            busy ||
            !hasPermission('brands.store_override') ||
            reason.trim().length < 3
          }
          onClick={() => void change(true, true)}
        >
          Remove override
        </button>
      </div>
      <UniversalSelect
        label="Subscription offer"
        value={assignedTier}
        onChange={setAssignedTier}
        options={tierOptions}
        disabled={!hasPermission('brands.store_override')}
      />
      <button
        className="queue-button"
        disabled={
          busy ||
          !assignedTier ||
          reason.trim().length < 3 ||
          !hasPermission('brands.store_override')
        }
        onClick={() => void assign()}
      >
        Assign paid tier offer
      </button>
      <Link to="/admin/orders" className="queue-button inline-flex">
        Subscription policies
      </Link>
    </section>
  );
}
