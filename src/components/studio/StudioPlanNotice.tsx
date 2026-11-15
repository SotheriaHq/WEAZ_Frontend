import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { RootState } from '@/store';
import { getActiveBrandId, isBrandOwner } from '@/lib/brandAccess';
import { brandSubscriptionApi } from '@/api/BrandSubscriptionApi';
import { planNotice } from '@/lib/subscriptionPlanNotice';
import { PlanNoticeBanner } from '@/components/custom-orders/PlanNoticeBanner';

const DISMISSED_KEY = 'wiez.studio.planNotice.dismissed';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/**
 * Studio's plan banner (owner, Nov 2026: a plan ending must reach the owner
 * "on all fronts"). Only the owner sees it, and only when it matters soon:
 * a cancelled plan in its last week, a failed renewal, a lapsed plan, or a
 * smaller plan starting within three days. Dismissing hides it for this
 * session until the message changes (the day count is in the title), so it
 * comes back as the date gets closer.
 */
export function StudioPlanNotice() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const brandId = getActiveBrandId(profile);
  const owner = Boolean(brandId && isBrandOwner(profile, brandId));
  const billing = useQuery({
    queryKey: ['brand-queue-subscription', brandId],
    queryFn: () => brandSubscriptionApi.get(brandId!),
    enabled: owner,
    // Shared with the billing page; the message changes by the day.
    staleTime: 5 * 60_000,
  });
  const [dismissed, setDismissed] = useState(readDismissed);

  const tiers = billing.data?.tiers ?? [];
  const notice = owner
    ? planNotice(
        billing.data?.subscription,
        tiers,
        (key) =>
          tiers.find((tier) => tier.tierKey === key)?.label ?? key ?? 'paid',
        // Days are counted on the server's clock, not the device's.
        billing.data?.serverNow ? Date.parse(billing.data.serverNow) : undefined,
      )
    : null;
  const identity = notice ? `${brandId}:${notice.title}` : null;
  if (!notice || notice.tone !== 'warning' || identity === dismissed) return null;

  function dismiss() {
    setDismissed(identity);
    try {
      if (identity) sessionStorage.setItem(DISMISSED_KEY, identity);
    } catch {
      // Private mode: hidden for this page view only.
    }
  }

  return (
    <div className="mb-3">
      <PlanNoticeBanner notice={notice}>
        <Link
          to="/settings?tab=subscription-billing&from=studio"
          className="inline-flex min-h-10 items-center rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
        >
          See plans
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-10 rounded-xl px-3 text-sm font-semibold text-gray-700 transition hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 dark:text-gray-300 dark:hover:text-white"
        >
          Not now
        </button>
      </PlanNoticeBanner>
    </div>
  );
}
