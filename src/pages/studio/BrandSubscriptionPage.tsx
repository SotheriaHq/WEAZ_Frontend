import { LEGAL_PAGE_VERSION } from '@/pages/legal/legalDocuments';
import { getFriendlyErrorMessage } from '@/utils/errorMessage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import { brandSubscriptionApi, type SubscriptionPreview, type SubscriptionCheckout } from '@/api/BrandSubscriptionApi';
import { isBrandOwner } from '@/lib/brandAccess';
import type { RootState } from '@/store';
import { QueueBrandCounts, queueTierName } from '@/components/custom-orders/CustomOrderQueue';
import { useQueueConfirm } from '@/components/custom-orders/useQueueConfirm';
import { openPaystackInline } from '@/lib/paystackInline';
import { resolvePaymentLaunchPlan } from '@/lib/inAppPaymentSession';

const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
const date = (value?: string | null) => value ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) + ' WAT' : 'Not scheduled';

export default function BrandSubscriptionPage() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const [params] = useSearchParams();
  const store = useQuery({ queryKey: ['subscription-store', profile?.activeBrandId ?? profile?.id], queryFn: () => getStoreStatus() });
  const brandId = store.data?.brandId;
  const canManage = Boolean(brandId && isBrandOwner(profile, brandId));
  const billing = useQuery({ queryKey: ['brand-queue-subscription', brandId], queryFn: () => brandSubscriptionApi.get(brandId!), enabled: Boolean(brandId) });
  const refetchBilling = billing.refetch;
  const [consent, setConsent] = useState(false);
  const [selectedTier, setSelectedTier] = useState('');
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [pending, setPending] = useState<SubscriptionCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const verificationRef = useRef<string | null>(null);
  const { confirm, ConfirmDialog } = useQueueConfirm();
  const callbackReference = params.get('subscriptionReference') || params.get('reference') || params.get('trxref');
  const verify = useCallback(async (reference: string) => {
    if (!brandId) return;
    setBusy(true);
    try {
      const result = await brandSubscriptionApi.verify(brandId, reference);
      setVerificationMessage(['PAID', 'SUCCESS', 'ACTIVE'].includes(result.status?.toUpperCase()) ? 'Payment verified. Your subscription has been refreshed from WIEZ.' : `Payment status: ${result.status}. Your existing entitlement is preserved until the payment is confirmed.`);
      await refetchBilling();
    } catch (error: unknown) {
      setVerificationMessage(getFriendlyErrorMessage(error, 'Payment could not be verified yet. Retry verification; do not start another payment.'));
    } finally { setBusy(false); }
  }, [brandId, refetchBilling]);

  useEffect(() => {
    if (!brandId || !callbackReference || verificationRef.current === callbackReference) return;
    verificationRef.current = callbackReference;
    setPending({ reference: callbackReference, amountNgn: 0, effectiveAt: '', action: 'VERIFYING' });
    void verify(callbackReference);
  }, [brandId, callbackReference, verify]);

  async function loadPreview(tierKey: string) {
    if (!brandId) return;
    setSelectedTier(tierKey); setPreview(null); setConsent(false); setBusy(true);
    try { setPreview(await brandSubscriptionApi.preview(brandId, tierKey)); }
    catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Unable to preview the change.')); }
    finally { setBusy(false); }
  }

  async function launch(result: SubscriptionCheckout) {
    const plan = resolvePaymentLaunchPlan({ status: result.status, providerAccessCode: result.providerAccessCode, authorizationUrl: result.authorizationUrl });
    if (plan.kind === 'INLINE') {
      await openPaystackInline(plan.accessCode, { onSuccess: () => { if (result.reference) void verify(result.reference); }, onCancel: () => setVerificationMessage('Payment window closed. Check the payment status before trying a new checkout.') });
    } else if (plan.kind === 'REDIRECT') {
      const target = new URL(plan.url);
      if (target.protocol !== 'https:') throw new Error('The secure payment address is invalid.');
      window.location.assign(target.toString());
    } else if (plan.kind === 'FAILED') throw new Error(plan.message);
    else if (result.reference) await verify(result.reference);
  }

  async function checkout() {
    if (!brandId || !preview || !consent || !canManage) return;
    if (!(await confirm({ title: 'Confirm subscription change', message: `${money(preview.amountNgn)} due now. Effective ${date(preview.effectiveAt)}. ${preview.kind.includes('DOWNGRADE') ? 'The current paid period is not refunded.' : 'The billing anniversary is preserved for an upgrade.'} Recurring monthly charges use the accepted subscription price.`, confirmText: preview.amountNgn > 0 ? 'Continue to secure payment' : 'Confirm change' }))) return;
    setBusy(true);
    try {
      const callback = new URL('/studio', window.location.origin);
      callback.searchParams.set('tab', 'subscription');
      const embedded = params.get('surface'); if (embedded) callback.searchParams.set('surface', embedded);
      const result = await brandSubscriptionApi.checkout(brandId, selectedTier, callback.toString(), preview.amountNgn);
      setPending(result);
      if (result.action === 'SCHEDULED_DOWNGRADE' || result.action === 'UNCHANGED') {
        await billing.refetch(); toast.success(result.action === 'SCHEDULED_DOWNGRADE' ? 'Downgrade scheduled for renewal.' : 'This tier is already current.');
      } else await launch(result);
    } catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Unable to initialize subscription checkout.')); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!brandId || !(await confirm({ title: 'Stop automatic renewal?', message: 'Your subscription remains available until the current paid period ends. New intake then pauses; existing paid orders continue. The current paid period is not refunded.', confirmText: 'Stop renewal', isDestructive: true }))) return;
    setBusy(true);
    try { await brandSubscriptionApi.cancelRenewal(brandId); await billing.refetch(); toast.success('Automatic renewal cancelled.'); }
    catch (error: unknown) { toast.error(getFriendlyErrorMessage(error, 'Unable to cancel renewal.')); }
    finally { setBusy(false); }
  }

  const subscription = billing.data?.subscription;
  return <div className="space-y-5 pb-6 text-slate-900 dark:text-white">
    {ConfirmDialog}
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">🧵 Subscription and billing</h1><Link className="queue-button" to="/studio?tab=orders&orderTab=custom">Custom orders</Link></div>
    {brandId ? <QueueBrandCounts brandId={brandId} /> : null}
    {store.isPending || billing.isPending ? <p role="status">Loading subscription…</p> : null}
    {store.isError || billing.isError ? <p role="alert">Unable to load subscription. <button className="queue-button" onClick={() => { void store.refetch(); void billing.refetch(); }}>Retry</button></p> : null}
    {subscription ? <section className="queue-section">
      <h2 className="font-bold">Current: {queueTierName(subscription.tierKey)} · {subscription.status}</h2>
      <p>Locked monthly price: {money(subscription.lockedMonthlyPriceNgn)}</p><p>Period: {date(subscription.currentPeriodStart)} — {date(subscription.currentPeriodEnd)}</p>
      <p>{subscription.cancelAtPeriodEnd ? 'Renewal stopped at the end of this paid period.' : 'Renews monthly on your billing anniversary; if that date does not exist, the last day of the month applies.'}</p>
      {subscription.pendingTierKey ? <p>Next renewal: {queueTierName(subscription.pendingTierKey)}</p> : null}
      {subscription.recoveryUntil ? <p>Payment recovery deadline: {date(subscription.recoveryUntil)}. New intake pauses at paid expiry. Retries on days 1, 3 and 7 retain the locked price during the 7-day recovery period.</p> : null}
      {canManage && !subscription.cancelAtPeriodEnd && subscription.tierKey !== 'LEGACY' ? <button className="queue-button" disabled={busy} onClick={() => void cancel()}>Stop automatic renewal</button> : null}
    </section> : !billing.isPending && !billing.isError ? <p>{billing.data?.legacyEligible ? 'Your existing brand has free, unlimited Legacy custom-order capacity. A paid tier takes effect only after verified payment. Legacy does not include paid queue jumps.' : 'No paid subscription. Select a tier to open custom-order intake.'}</p> : null}
    {billing.data?.assignedTierKey ? <p className="border-l-2 border-violet-400 pl-4 text-sm">An admin assigned a {queueTierName(billing.data.assignedTierKey)} offer. Your current entitlement continues until you review, consent and successfully pay. <button className="queue-button" disabled={busy || !canManage} onClick={() => void loadPreview(billing.data!.assignedTierKey!)}>Review assigned offer</button></p> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(billing.data?.tiers ?? []).filter((tier) => tier.tierKey !== 'LEGACY').map((tier) => <section className="queue-section min-w-0" key={tier.tierKey}>
      <h2 className="break-words text-lg font-bold">{tier.label ?? tier.tierKey}</h2><p className="break-words font-semibold">{money(tier.monthlyPriceNgn)} / month</p><p className="text-sm">{tier.maxActive} Active · {tier.maxInDelivery} Delivery · 1 Up Next · Unlimited Pending</p><p className="text-xs">Paid jumps: {tier.queueJumpAllowed ? 'May be enabled' : 'Unavailable'}</p><button className="queue-button w-full" disabled={!canManage || busy} onClick={() => void loadPreview(tier.tierKey)}>Preview {subscription?.tierKey === tier.tierKey ? 'current tier' : 'change'}</button>
    </section>)}</div>
    {preview ? <section className="space-y-4 border-t border-violet-300 py-5 dark:border-violet-800"><h2 className="font-bold">Review {queueTierName(selectedTier)}</h2><dl className="space-y-1"><div>Charge now: <strong>{money(preview.amountNgn)}</strong></div><div>Effective: {date(preview.effectiveAt)}</div><div>Period ends: {date(preview.periodEnd)}</div></dl><p className="text-sm">Upgrades take effect after successful payment, with the difference prorated for the remaining billing period. Downgrades start at renewal, with no refund of the current period. Existing captured orders are preserved after cancellation or failed renewal.</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I authorize recurring monthly subscription charges and accept the latest <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms and Conditions</Link>, <Link to="/seller-terms" target="_blank" rel="noopener noreferrer" className="underline">Seller Terms</Link> and <Link to="/payment-policy" target="_blank" rel="noopener noreferrer" className="underline">Payment and Subscription Policy</Link> ({LEGAL_PAGE_VERSION}).</span></label><button className="queue-button bg-violet-700 text-white" disabled={!consent || busy || !canManage} onClick={() => void checkout()}>{busy ? 'Processing…' : 'Confirm and continue'}</button>
    </section> : null}
    {pending?.reference ? <section className="queue-section"><p className="break-all text-sm">Payment reference: {pending.reference}</p><p role="status">{verificationMessage || 'Check the server payment status before starting another payment.'}</p><button className="queue-button" disabled={busy} onClick={() => void verify(pending.reference!)}>Verify payment status</button>{pending.authorizationUrl || pending.providerAccessCode ? <button className="queue-button" disabled={busy} onClick={() => void launch(pending).catch(() => toast.error('Unable to open payment. Verify its status before retrying.'))}>Resume existing payment</button> : null}</section> : null}
    <section className="space-y-3"><h2 className="font-bold">🧾 Invoice history</h2>{billing.data?.invoices.length === 0 ? <p>No subscription invoices yet.</p> : billing.data?.invoices.map((invoice) => <article className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 py-4 last:border-0 dark:border-slate-800" key={invoice.id}><div><p className="font-semibold">{money(invoice.amountNgn)} · {invoice.status}</p><p className="text-xs">{date(invoice.createdAt)}</p><p className="break-all text-xs">{invoice.reference ?? invoice.id}</p></div>{invoice.authorizationUrl && canManage && ['ACTION_REQUIRED', 'PENDING'].includes(invoice.status) ? <button className="queue-button" disabled={busy} onClick={() => { const target = new URL(invoice.authorizationUrl!); if (target.protocol === 'https:') window.location.assign(target.toString()); }}>Complete payment authorization</button> : null}{invoice.reference && canManage ? <button className="queue-button" disabled={busy} onClick={() => void verify(invoice.reference!)}>Check payment</button> : null}</article>)}</section>
    {(billing.data?.compensations?.length ?? 0) > 0 ? <section className="space-y-3"><h2 className="font-bold">Subscription payment refunds</h2>{billing.data?.compensations?.map((item) => <article key={item.reference} className="space-y-2 border-b border-slate-200 py-4 last:border-0 dark:border-slate-800"><p className="font-semibold">{money(item.amountNgn)} | {item.status}</p><p className="break-all text-xs">{item.reference}</p><p className="text-sm">{item.reason || 'Captured payment could not be applied to this subscription.'}</p><p className="text-xs">{item.refundedAt ? `Provider refund confirmed ${date(item.refundedAt)}. Bank receipt may take longer.` : 'Refund processing is tracked separately from your subscription. Do not pay again to resolve a pending refund.'}</p></article>)}</section> : null}
    {!canManage ? <p>Only the brand owner can change subscription or payment settings.</p> : null}
  </div>;
}
