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
  const [isExpanded, setIsExpanded] = useState(false);

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

  const summary = query.data;

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-slate-50/90 shadow-sm dark:border-white/10 dark:bg-[#120a1f] text-slate-900 dark:text-white transition-all">
      {ConfirmDialog}
      
      {/* Clickable Header Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse queue priority settings' : 'Expand queue priority settings'}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/15 text-sm dark:bg-violet-400/20 shrink-0">
            🧵
          </span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
              Custom-Order Priority & Jumps
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {summary ? (
                <>
                  <span className="font-semibold text-violet-700 dark:text-violet-300">
                    {summary.capacity.tierKey ? `${summary.capacity.tierKey} Tier` : 'Standard Tier'}
                  </span>
                  <span>•</span>
                  <span>
                    Paid jumps: {summary.queueJumpEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </>
              ) : (
                <span>Loading priority options…</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
            {isExpanded ? 'Collapse ⌃' : 'Configure ⌄'}
          </span>
        </div>
      </button>

      {/* Expanded Accordion Body */}
      {isExpanded && (
        <div className="border-t border-black/5 dark:border-white/10 p-3.5 sm:p-5 space-y-4 bg-white/50 dark:bg-black/20 animate-in fade-in duration-200">
          {query.isError ? (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              Unable to load queue settings.{' '}
              <button
                className="underline font-semibold ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  void query.refetch();
                }}
              >
                Retry
              </button>
            </p>
          ) : query.isPending ? (
            <p role="status" className="text-xs text-slate-500">Loading queue settings…</p>
          ) : summary ? (
            <>
              <div className="rounded-xl bg-violet-500/[0.06] border border-violet-500/15 p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                <span className="font-bold text-violet-800 dark:text-violet-300">How Paid Jumps Work: </span>
                Buyers can opt to pay a 20% surcharge on their bespoke order to skip ahead in line. Your brand earns 90% of this fee once the order moves into Active production. Up Next is protected to ensure fair progression.
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Paid Priority Queue Jumps
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {summary.queueJumpEnabled
                      ? 'Currently active. Clients can pay to jump the queue.'
                      : 'Currently disabled. All waiting orders progress strictly standard FIFO.'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage || busy || !summary.capacity.queueJumpAllowed}
                    onClick={() => void toggle()}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${
                      summary.queueJumpEnabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300'
                        : 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {busy
                      ? 'Saving…'
                      : summary.queueJumpEnabled
                        ? 'Disable paid jumps'
                        : 'Enable paid jumps'}
                  </button>
                </div>
              </div>

              {!canManage ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Only the brand owner can manage billing and paid-jump settings.
                </p>
              ) : !summary.capacity.queueJumpAllowed ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <span>Subscribe to Aru or Igwe to unlock paid jumps.</span>
                  <Link
                    to="/settings?tab=subscription-billing"
                    className="font-bold underline shrink-0"
                  >
                    Upgrade Tier
                  </Link>
                </div>
              ) : null}

              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                <Link
                  to="/settings?tab=subscription-billing"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  <span>💳 Manage subscription and billing</span>
                  <span aria-hidden="true">›</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
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
