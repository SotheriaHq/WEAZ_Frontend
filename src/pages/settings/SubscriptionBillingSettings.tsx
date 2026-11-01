import { LEGAL_PAGE_VERSION } from '@/pages/legal/legalVersion';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import { brandApi } from '@/api/BrandApi';
import {
  brandSubscriptionApi,
  type SubscriptionPreview,
  type SubscriptionCheckout,
} from '@/api/BrandSubscriptionApi';
import {
  isBrandOwner,
  getActiveBrandId,
  setStoredActiveBrandId,
  hasActiveBrandMembership,
} from '@/lib/brandAccess';
import type { RootState } from '@/store';
import {
  QueueBrandCounts,
  queueTierName,
} from '@/components/custom-orders/CustomOrderQueue';
import { useQueueConfirm } from '@/components/custom-orders/useQueueConfirm';
import { openPaystackInline } from '@/lib/paystackInline';
import { resolvePaymentLaunchPlan } from '@/lib/inAppPaymentSession';
import { SubscriptionHistory } from '@/components/custom-orders/SubscriptionHistory';
import { BrandQueueSettings } from '@/components/custom-orders/QueueBrandControls';
import { SubscriptionPaymentMethods } from '@/components/custom-orders/SubscriptionPaymentMethods';
import Button from '@/components/ui/Button';

const money = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    amount,
  );

const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) +
      ' WAT'
    : 'Not scheduled';

export default function SubscriptionBillingSettings() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const [params] = useSearchParams();
  const requestedBrandId = params.get('brandId');
  const activeBrandId = getActiveBrandId(profile);
  const switching = Boolean(
    requestedBrandId &&
      requestedBrandId !== activeBrandId &&
      isBrandOwner(profile, requestedBrandId),
  );

  useEffect(() => {
    if (!switching || !requestedBrandId) return;
    setStoredActiveBrandId(requestedBrandId);
    window.dispatchEvent(
      new CustomEvent('wiez:active-brand-change', {
        detail: { brandId: requestedBrandId },
      }),
    );
    window.location.reload();
  }, [switching, requestedBrandId]);

  if (requestedBrandId && requestedBrandId !== activeBrandId)
    return (
      <div className="rounded-2xl p-6 text-center text-slate-600 dark:text-slate-300">
        <p role="status">
          {switching
            ? 'Opening your billing workspace…'
            : 'Only the brand owner can open this billing workspace.'}
        </p>
      </div>
    );

  if (!hasActiveBrandMembership(profile))
    return (
      <div className="rounded-2xl p-6 text-center text-slate-600 dark:text-slate-300">
        <p>Billing & subscriptions is available to verified brand owners.</p>
      </div>
    );

  return (
    <BrandSubscriptionContent
      key={`${profile?.id || ''}:${getActiveBrandId(profile) || ''}`}
    />
  );
}

function BrandSubscriptionContent() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const store = useQuery({
    queryKey: ['subscription-store', profile?.activeBrandId ?? profile?.id],
    queryFn: () => getStoreStatus(),
  });
  const brandId = store.data?.brandId;
  const canManage = Boolean(brandId && isBrandOwner(profile, brandId));

  const verification = useQuery({
    queryKey: ['brand-verification-status', brandId],
    queryFn: () => brandApi.getVerificationStatus(brandId!),
    enabled: Boolean(brandId),
  });

  const isBrandVerified =
    verification.data?.verificationStatus === 'APPROVED' ||
    Boolean((profile as any)?.isBrandVerified);

  const billing = useQuery({
    queryKey: ['brand-queue-subscription', brandId],
    queryFn: () => brandSubscriptionApi.get(brandId!),
    enabled: canManage,
  });

  const client = useQueryClient();
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ['brand-commerce-access'] });
  }, [
    client,
    billing.data?.subscription?.tierKey,
    billing.data?.subscription?.status,
    billing.data?.subscription?.currentPeriodEnd,
  ]);

  const refetchBilling = billing.refetch;
  const [consent, setConsent] = useState(false);
  const [selectedCard, setSelectedCard] = useState('');
  const [section, setSection] = useState<
    'plans' | 'history' | 'cards' | 'preferences'
  >('plans');
  const [selectedTier, setSelectedTier] = useState('');
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [pending, setPending] = useState<SubscriptionCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [verificationMessage, setVerificationMessage] = useState('');
  const verificationRef = useRef<string | null>(null);
  const { confirm, ConfirmDialog } = useQueueConfirm();

  const callbackReference =
    params.get('subscriptionReference') ||
    params.get('reference') ||
    params.get('trxref');

  const verify = useCallback(
    async (reference: string) => {
      if (!brandId) return;
      setBusy(true);
      try {
        const result = await brandSubscriptionApi.verify(brandId, reference);
        setVerificationMessage(
          ['PAID', 'SUCCESS', 'ACTIVE'].includes(result.status?.toUpperCase())
            ? 'Payment verified. Your subscription has been refreshed from WIEZ.'
            : `Payment status: ${result.status}. Your existing entitlement is preserved until the payment is confirmed.`,
        );
        await refetchBilling();
      } catch (error: unknown) {
        setVerificationMessage(
          getFriendlyErrorMessage(
            error,
            'Payment could not be verified yet. Retry verification; do not start another payment.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [brandId, refetchBilling],
  );

  useEffect(() => {
    if (
      !brandId ||
      !callbackReference ||
      verificationRef.current === callbackReference
    )
      return;
    verificationRef.current = callbackReference;
    setPending({
      reference: callbackReference,
      amountNgn: 0,
      effectiveAt: '',
      action: 'VERIFYING',
    });
    void verify(callbackReference);
  }, [brandId, callbackReference, verify]);

  async function loadPreview(tierKey: string) {
    if (!brandId) return;
    setSelectedTier(tierKey);
    setPreview(null);
    setConsent(false);
    setBusy(true);
    try {
      setPreview(await brandSubscriptionApi.preview(brandId, tierKey));
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(error, 'Unable to preview the subscription change.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function launch(result: SubscriptionCheckout) {
    if (!mounted.current) return;
    const plan = resolvePaymentLaunchPlan({
      status: result.status,
      providerAccessCode: result.providerAccessCode,
      authorizationUrl: result.authorizationUrl,
    });
    if (plan.kind === 'INLINE') {
      await openPaystackInline(plan.accessCode, {
        onSuccess: () => {
          if (result.reference) void verify(result.reference);
        },
        onCancel: () =>
          setVerificationMessage(
            'Payment window closed. Check the payment status before trying a new checkout.',
          ),
      });
    } else if (plan.kind === 'REDIRECT') {
      const target = new URL(plan.url);
      if (target.protocol !== 'https:')
        throw new Error('The secure payment address is invalid.');
      window.location.assign(target.toString());
    } else if (plan.kind === 'FAILED') throw new Error(plan.message);
    else if (result.reference) await verify(result.reference);
  }

  async function checkout() {
    if (!brandId || !preview || !consent || !canManage) return;
    if (
      !(await confirm({
        title: 'Confirm subscription change',
        message: `${money(preview.amountNgn)} ${preview.kind === 'DOWNGRADE' ? 'due at renewal' : 'due now'}. Effective ${date(preview.effectiveAt)}. ${preview.kind.includes('DOWNGRADE') ? 'The current paid period is not refunded.' : 'The billing anniversary is preserved for an upgrade.'} Recurring monthly charges use the accepted subscription price.`,
        confirmText:
          preview.amountNgn > 0
            ? 'Continue to secure payment'
            : 'Confirm change',
      }))
    )
      return;
    if (!mounted.current) return;
    setBusy(true);
    try {
      const callback = new URL('/settings', window.location.origin);
      callback.searchParams.set('tab', 'subscription-billing');
      callback.searchParams.set('brandId', brandId);
      const embedded = params.get('surface');
      if (embedded) callback.searchParams.set('surface', embedded);
      const result = await brandSubscriptionApi.checkout(
        brandId,
        selectedTier,
        callback.toString(),
        preview.amountNgn,
        selectedCard || undefined,
      );
      if (!mounted.current) return;
      setPending(result);
      if (
        result.action === 'SCHEDULED_DOWNGRADE' ||
        result.action === 'UNCHANGED'
      ) {
        await billing.refetch();
        toast.success(
          result.action === 'SCHEDULED_DOWNGRADE'
            ? 'Downgrade scheduled for renewal.'
            : 'This tier is already current.',
        );
      } else await launch(result);
    } catch (error: unknown) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          'Unable to initialize subscription checkout.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (
      !brandId ||
      !(await confirm({
        title: 'Stop automatic renewal?',
        message:
          'Your subscription remains available until the current paid period ends. New intake then pauses; existing paid orders continue to completion. The current paid period is not refunded.',
        confirmText: 'Stop renewal',
        isDestructive: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await brandSubscriptionApi.cancelRenewal(brandId);
      await billing.refetch();
      toast.success('Automatic renewal cancelled.');
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, 'Unable to cancel renewal.'));
    } finally {
      setBusy(false);
    }
  }

  const subscription = billing.data?.subscription;

  if (store.isSuccess && !canManage)
    return (
      <div className="rounded-2xl p-6 text-center text-slate-600 dark:text-slate-300">
        <p role="status">
          Only the brand owner can access billing, subscription history, and saved payment methods.
        </p>
      </div>
    );

  const tiers = billing.data?.tiers ?? [];

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-white">
      {ConfirmDialog}

      {/* Navigation and Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/studio?tab=store"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 mb-1"
          >
            <span aria-hidden="true">←</span> Back to Studio
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Billing & Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your custom order capacity, intake priority, and renewal schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-3.5 py-2 text-xs font-semibold transition hover:bg-purple-100 dark:hover:bg-purple-900/50 shadow-sm"
            to="/studio?tab=orders&orderTab=custom"
          >
            Custom Orders Queue →
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav
        aria-label="Billing sections"
        className="flex space-x-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-900/60 shadow-inner"
      >
        {(['plans', 'history', 'cards', 'preferences'] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              aria-pressed={section === value}
              className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                section === value
                  ? 'bg-white text-purple-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              onClick={() => setSection(value)}
            >
              {
                {
                  plans: 'Plans & Capacity',
                  history: 'Billing History',
                  cards: 'Payment Methods',
                  preferences: 'Queue Preferences',
                }[value]
              }
            </button>
          ),
        )}
      </nav>

      {/* Preferences Section */}
      {section === 'preferences' && brandId ? (
        <div className="space-y-6">
          <QueueBrandCounts brandId={brandId} />
          <BrandQueueSettings brandId={brandId} />
        </div>
      ) : null}

      {/* Loading & Error States */}
      {(store.isPending || billing.isPending) && (
        <div className="wiez-card-base rounded-2xl p-8 text-center text-gray-500">
          <p role="status">Loading subscription details…</p>
        </div>
      )}

      {(store.isError || billing.isError) && (
        <div className="wiez-card-base rounded-2xl p-6 text-center text-red-600 dark:text-red-400">
          <p role="alert" className="mb-3">
            Unable to load subscription information.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void store.refetch();
              void billing.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Plans Section */}
      {section === 'plans' ? (
        <div className="space-y-6">
          {/* Seller Verification Required Banner if unverified */}
          {!isBrandVerified ? (
            <div className="wiez-card-base rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 dark:from-amber-900/20 dark:via-purple-900/20 dark:to-indigo-900/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      Brand Verification Required for Upgrades
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
                    To maintain catalog trust and ensure high fulfillment standards on WIEZ, subscription upgrades and expanded custom order capacity are available exclusively to verified brands.
                  </p>
                </div>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => navigate('/studio/verification')}
                  className="shrink-0"
                >
                  Verify Brand
                </Button>
              </div>
            </div>
          ) : null}

          {/* Current Subscription Overview (ITEM 24) */}
          {subscription ? (
            <div className="wiez-card-base wiez-shade-9 rounded-3xl p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Current Subscription
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        subscription.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : subscription.status === 'PAST_DUE'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-500/20 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          subscription.status === 'ACTIVE'
                            ? 'bg-emerald-500'
                            : subscription.status === 'PAST_DUE'
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
                        }`}
                      />
                      {subscription.status}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                    {queueTierName(subscription.tierKey)} Plan
                  </h2>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-200">
                    {money(subscription.lockedMonthlyPriceNgn)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400"> / month</span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Locked subscription rate
                  </p>
                </div>
              </div>

              {/* Cycle Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 p-3 shadow-sm">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Current Period</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                    {date(subscription.currentPeriodStart)} — {date(subscription.currentPeriodEnd)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 p-3 shadow-sm">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Renewal Status</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                    {subscription.cancelAtPeriodEnd
                      ? 'Stopping at period end'
                      : 'Monthly on Lagos anniversary'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 p-3 shadow-sm">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Next Scheduled Tier</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                    {subscription.pendingTierKey
                      ? queueTierName(subscription.pendingTierKey)
                      : queueTierName(subscription.tierKey)}
                  </p>
                </div>
              </div>

              {/* Recovery Banner if Past Due */}
              {subscription.recoveryUntil ? (
                <div className="rounded-xl bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">⚠️ Payment Recovery Period Active</p>
                  <p className="mt-1">
                    Automatic retry attempts occur on days 1, 3, and 7 until {date(subscription.recoveryUntil)}, preserving your locked rate. New order intake pauses at paid expiry.
                  </p>
                </div>
              ) : null}

              {/* Management Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSection('cards')}
                  >
                    💳 Manage Payment Methods
                  </Button>
                </div>
                {canManage && !subscription.cancelAtPeriodEnd ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void cancel()}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Stop automatic renewal
                  </Button>
                ) : null}
              </div>
            </div>
          ) : !billing.isPending && !billing.isError ? (
            <div className="wiez-card-base wiez-shade-1 rounded-3xl p-6 sm:p-8 text-center space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                No Active Paid Tier
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
                Select a WIEZ studio tier below to open custom-order intake, set order capacity, and enable fast-track priority queue jumps for your clients.
              </p>
            </div>
          ) : null}

          {/* Admin Assigned Offer */}
          {billing.data?.assignedTierKey ? (
            <div className="wiez-card-base wiez-shade-10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  Special Offer Available
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  An administrator has assigned a {queueTierName(billing.data.assignedTierKey)} offer to your brand.
                </p>
              </div>
              <Button
                variant="brand"
                size="sm"
                disabled={busy || !canManage}
                onClick={() => void loadPreview(billing.data!.assignedTierKey!)}
              >
                Review Assigned Offer
              </Button>
            </div>
          ) : null}

          {/* Tier Cards Grid (ITEM 25) */}
          <div>
            <div className="mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Available Studio Tiers
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Choose the capacity tier that fits your bespoke atelier pipeline.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map((tier, idx) => {
                const isCurrent = subscription?.tierKey === tier.tierKey;
                const isSelected = selectedTier === tier.tierKey;
                const isAru = tier.tierKey === 'ARU';
                const isIgwe = tier.tierKey === 'IGWE';
                const shadeClass = `wiez-shade-${idx + 1}`;

                return (
                  <div
                    key={tier.tierKey}
                    className={`wiez-card-base ${shadeClass} rounded-3xl p-5 flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'ring-2 ring-purple-500 shadow-[0_12px_32px_-4px_rgba(168,85,247,0.25)]'
                        : ''
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 min-h-[24px]">
                        {isCurrent ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            ✓ CURRENT PLAN
                          </span>
                        ) : isAru ? (
                          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            ⭐ POPULAR
                          </span>
                        ) : isIgwe ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            👑 COUTURE
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            ESSENTIAL
                          </span>
                        )}
                      </div>

                      {/* Title & Price */}
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                          {tier.label ?? tier.tierKey}
                        </h3>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {money(tier.monthlyPriceNgn)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            / month
                          </span>
                        </div>
                      </div>

                      {/* Feature Highlights */}
                      <div className="space-y-2 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-xs">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>{tier.maxActive}</strong> Active custom orders</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>{tier.maxInDelivery}</strong> In-delivery orders</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>1</strong> Up Next staging slot</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span>Unlimited pending intake</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                          {tier.queueJumpAllowed ? (
                            <>
                              <span className="text-purple-600 dark:text-purple-400 font-bold">⚡</span>
                              <span className="font-semibold text-purple-700 dark:text-purple-300">
                                Paid queue jumps enabled
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-400">—</span>
                              <span className="text-gray-400">No paid queue jumps</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-5">
                      {isCurrent ? (
                        <Button
                          variant="secondary"
                          fullWidth
                          size="sm"
                          disabled
                          className="opacity-75 cursor-default"
                        >
                          Current Plan
                        </Button>
                      ) : !isBrandVerified ? (
                        <Button
                          variant="outline"
                          fullWidth
                          size="sm"
                          onClick={() => navigate('/studio/verification')}
                        >
                          Verify to Upgrade
                        </Button>
                      ) : (
                        <Button
                          variant={isAru || isIgwe ? 'brand' : 'secondary'}
                          fullWidth
                          size="sm"
                          disabled={!canManage || busy}
                          onClick={() => void loadPreview(tier.tierKey)}
                        >
                          {isSelected ? 'Selected' : 'Select Plan'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feature Comparison Matrix (ITEM 26) */}
          <div className="wiez-card-base wiez-shade-10 rounded-3xl p-5 sm:p-7 space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Detailed Tier Comparison
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Understand full capacity and queue privileges across all four WIEZ tiers.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-200 dark:border-purple-800/60">
                    <th className="py-3 pr-4 font-bold text-gray-700 dark:text-gray-200">Capability</th>
                    <th className="py-3 px-3 font-bold text-gray-900 dark:text-white">Thread</th>
                    <th className="py-3 px-3 font-bold text-gray-900 dark:text-white">Aso-oke</th>
                    <th className="py-3 px-3 font-bold text-purple-700 dark:text-purple-300">Aru (Popular)</th>
                    <th className="py-3 px-3 font-bold text-gray-900 dark:text-white">Igwe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Monthly Rate</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">₦10,000</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">₦15,000</td>
                    <td className="py-3 px-3 font-bold text-purple-700 dark:text-purple-300">₦30,000</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">₦50,000</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Active Custom Orders</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">2 active</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">3 active</td>
                    <td className="py-3 px-3 font-semibold text-purple-700 dark:text-purple-300">4 active</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">6 active</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">In-Delivery Orders</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">2 in transit</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">4 in transit</td>
                    <td className="py-3 px-3 font-semibold text-purple-700 dark:text-purple-300">5 in transit</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">5 in transit</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Up Next Staging Slot</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">1 slot</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">1 slot</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">1 slot</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">1 slot</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Paid Queue Jumps (Priority Intake)</td>
                    <td className="py-3 px-3 text-gray-400">—</td>
                    <td className="py-3 px-3 text-gray-400">—</td>
                    <td className="py-3 px-3 font-bold text-purple-700 dark:text-purple-300">✓ Included</td>
                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">✓ Included</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Pending Request Storage</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Unlimited</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Unlimited</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Unlimited</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Runway Discovery Weight</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Standard</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-200">Standard</td>
                    <td className="py-3 px-3 font-semibold text-purple-700 dark:text-purple-300">Elevated</td>
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">Maximum</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-2 border-t border-purple-100 dark:border-purple-900/30">
              * Paid Queue Jumps allow clients to pay an optional 20% expedited surcharge to bypass normal queue intake, while keeping existing Up Next orders protected.
            </p>
          </div>

          {/* Checkout & Plan Review Drawer (ITEM 28) */}
          {preview ? (
            <div className="wiez-card-base wiez-shade-11 rounded-3xl p-5 sm:p-7 space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Review & Confirm Plan Change: {queueTierName(selectedTier)}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200">
                  {preview.kind}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 p-3.5 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {preview.kind === 'DOWNGRADE' ? 'Due at Next Renewal' : 'Charge Due Now'}
                  </p>
                  <p className="text-xl font-black text-purple-900 dark:text-purple-200 mt-1">
                    {money(preview.amountNgn)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 p-3.5 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Effective Date</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-1">
                    {date(preview.effectiveAt)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 p-3.5 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Billing Period Ends</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-1">
                    {date(preview.periodEnd)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Upgrades take effect immediately upon payment confirmation with the difference prorated to the second for your remaining billing cycle. Downgrades take effect on your next Lagos billing anniversary without refunding the current period.
              </p>

              {/* Payment Method Selector */}
              <div className="rounded-2xl bg-white/50 dark:bg-slate-900/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Payment Method
                  </span>
                  <button
                    type="button"
                    onClick={() => setSection('cards')}
                    className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 underline"
                  >
                    Manage Cards
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCard
                    ? 'Using your selected saved card'
                    : 'Using a new card in secure Paystack checkout'}
                </p>
              </div>

              {/* Legal Consent Checkbox */}
              <label className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  I authorize recurring monthly subscription charges for the chosen tier and accept the latest{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline text-purple-600 dark:text-purple-400"
                  >
                    Terms and Conditions
                  </Link>
                  ,{' '}
                  <Link
                    to="/seller-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline text-purple-600 dark:text-purple-400"
                  >
                    Seller Terms
                  </Link>
                  , and{' '}
                  <Link
                    to="/payment-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline text-purple-600 dark:text-purple-400"
                  >
                    Payment and Subscription Policy
                  </Link>{' '}
                  ({LEGAL_PAGE_VERSION}).
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="brand"
                  size="lg"
                  disabled={!consent || busy || !canManage}
                  loading={busy}
                  onClick={() => void checkout()}
                >
                  Confirm & Proceed to Payment
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={busy}
                  onClick={() => {
                    setPreview(null);
                    setSelectedTier('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Pending Payment Verification Banner */}
      {pending?.reference ? (
        <div className="wiez-card-base wiez-shade-12 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-400">
            Payment reference: {pending.reference}
          </p>
          <p role="status" className="text-xs sm:text-sm font-semibold text-purple-900 dark:text-purple-200">
            {verificationMessage ||
              'Checking the payment status from WIEZ server. Do not start another checkout.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="brand"
              size="sm"
              disabled={busy}
              onClick={() => void verify(pending.reference!)}
            >
              Verify Payment Status
            </Button>
            {pending.authorizationUrl || pending.providerAccessCode ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void launch(pending).catch(() =>
                    toast.error(
                      'Unable to open payment. Verify its status before retrying.',
                    ),
                  )
                }
              >
                Resume Payment Window
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* History Section */}
      {section === 'history' ? (
        <div className="space-y-6">
          <div className="wiez-card-base wiez-shade-10 rounded-3xl p-5 sm:p-7 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Recent Invoices & Payment Recovery
            </h2>
            {billing.data?.invoices.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500">No subscription invoices yet.</p>
            ) : (
              <div className="divide-y divide-purple-100 dark:divide-purple-900/30">
                {billing.data?.invoices.map((invoice) => (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                    key={invoice.id}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {money(invoice.amountNgn)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            invoice.status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {date(invoice.createdAt)} · Ref: {invoice.reference ?? invoice.id}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {invoice.authorizationUrl &&
                      canManage &&
                      ['ACTION_REQUIRED', 'PENDING'].includes(invoice.status) ? (
                        <Button
                          variant="brand"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const target = new URL(invoice.authorizationUrl!);
                            if (target.protocol === 'https:')
                              window.location.assign(target.toString());
                          }}
                        >
                          Complete Authorization
                        </Button>
                      ) : null}
                      {invoice.reference && canManage ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void verify(invoice.reference!)}
                        >
                          Verify
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {(billing.data?.compensations?.length ?? 0) > 0 ? (
            <div className="wiez-card-base wiez-shade-1 rounded-3xl p-5 sm:p-7 space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Subscription Payment Refunds
              </h2>
              <div className="divide-y divide-purple-100 dark:divide-purple-900/30">
                {billing.data?.compensations?.map((item) => (
                  <article key={item.reference} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white">
                        {money(item.amountNgn)}
                      </span>
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {item.reason || 'Captured payment could not be applied to this subscription.'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.refundedAt
                        ? `Provider refund confirmed ${date(item.refundedAt)}. Bank arrival may take longer.`
                        : 'Refund processing is tracked separately. Do not pay again to resolve a pending refund.'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {brandId && canManage ? (
            <SubscriptionHistory brandId={brandId} />
          ) : null}
        </div>
      ) : null}

      {/* Cards Section */}
      {section === 'cards' && brandId && canManage ? (
        <SubscriptionPaymentMethods
          key={brandId}
          brandId={brandId}
          renewalCardId={subscription?.savedPaymentMethodId}
          selectedCardId={selectedCard}
          onSelect={(id) => {
            setSelectedCard(id);
            setConsent(false);
          }}
          hasSubscription={Boolean(
            subscription &&
              ['ACTIVE', 'PAST_DUE'].includes(subscription.status),
          )}
        />
      ) : null}
    </div>
  );
}
