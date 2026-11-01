import React from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { hasActiveBrandMembership, getActiveBrandId } from '@/lib/brandAccess';
import Button from '@/components/ui/Button';

const Subscriptions: React.FC = () => {
  const profile = useSelector((state: RootState) => state.user.profile);
  const isBrandOwnerUser = hasActiveBrandMembership(profile);
  const brandId = getActiveBrandId(profile);
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="wiez-card-base wiez-shade-9 rounded-3xl p-6 sm:p-10 relative overflow-hidden">
        <div className="max-w-2xl space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            WIEZ Subscriptions
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            Elevate Your Creative Atelier & Client Reach
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            Scalable custom-order capacity, expedited queue jumps, and runway visibility designed for bespoke African fashion houses and independent creators.
          </p>

          {isBrandOwnerUser ? (
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="brand"
                size="md"
                onClick={() =>
                  navigate(
                    brandId
                      ? `/settings?tab=subscription-billing&brandId=${brandId}`
                      : '/settings?tab=subscription-billing',
                  )
                }
              >
                Manage Studio Subscription →
              </Button>
              <Link
                to="/studio?tab=store"
                className="inline-flex min-h-11 items-center px-4 py-2 text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300 hover:underline"
              >
                Storefront Settings
              </Link>
            </div>
          ) : (
            <div className="pt-4">
              <Link
                to="/market"
                className="inline-flex items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 text-sm font-semibold transition active:scale-[0.985] shadow-md"
              >
                Explore Market & Designers →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tier Overview Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Studio Capacity Tiers
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Each tier provides dedicated intake capacity and client queue privilege.
            </p>
          </div>
          {isBrandOwnerUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings?tab=subscription-billing')}
            >
              View Full Billing Matrix
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Thread Tier */}
          <div className="wiez-card-base wiez-shade-1 rounded-3xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                STARTER
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Thread</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900 dark:text-white">₦10,000</span>
                <span className="text-xs text-gray-500">/ month</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Ideal for independent tailors and emerging custom designers starting bespoke intake.
              </p>
              <ul className="text-xs space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-gray-700 dark:text-gray-200">
                <li>✓ 2 Active custom orders</li>
                <li>✓ 2 In-delivery orders</li>
                <li>✓ 1 Up Next staging slot</li>
                <li>✓ Unlimited pending requests</li>
              </ul>
            </div>
          </div>

          {/* Aso-oke Tier */}
          <div className="wiez-card-base wiez-shade-2 rounded-3xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                EXPANDING
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aso-oke</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900 dark:text-white">₦15,000</span>
                <span className="text-xs text-gray-500">/ month</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                For established fashion creators maintaining active delivery pipelines and collection releases.
              </p>
              <ul className="text-xs space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-gray-700 dark:text-gray-200">
                <li>✓ 3 Active custom orders</li>
                <li>✓ 4 In-delivery orders</li>
                <li>✓ 1 Up Next staging slot</li>
                <li>✓ Expanded drop visibility</li>
              </ul>
            </div>
          </div>

          {/* Aru Tier */}
          <div className="wiez-card-base wiez-shade-3 rounded-3xl p-5 flex flex-col justify-between space-y-4 ring-1 ring-purple-500/30">
            <div className="space-y-3">
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                ⭐ POPULAR ATELIER
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aru</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900 dark:text-white">₦30,000</span>
                <span className="text-xs text-gray-500">/ month</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Unlocks Paid Queue Jumps, giving high-intent clients the option to pay for expedited queue intake.
              </p>
              <ul className="text-xs space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-gray-700 dark:text-gray-200">
                <li>✓ 4 Active custom orders</li>
                <li>✓ 5 In-delivery orders</li>
                <li>✓ <strong>Paid queue jumps enabled</strong></li>
                <li>✓ Elevated Runway exposure</li>
              </ul>
            </div>
          </div>

          {/* Igwe Tier */}
          <div className="wiez-card-base wiez-shade-4 rounded-3xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                👑 COUTURE ELITE
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Igwe</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-gray-900 dark:text-white">₦50,000</span>
                <span className="text-xs text-gray-500">/ month</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Maximum atelier bandwidth for established luxury fashion houses and multi-staff ateliers.
              </p>
              <ul className="text-xs space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40 text-gray-700 dark:text-gray-200">
                <li>✓ 6 Active custom orders (Max)</li>
                <li>✓ 5 In-delivery orders</li>
                <li>✓ Paid queue jumps enabled</li>
                <li>✓ Highest priority discovery</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Shopper Patches Preview for non-brands */}
      {!isBrandOwnerUser && (
        <div className="wiez-card-base wiez-shade-10 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="max-w-xl space-y-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Creator Patches & Direct VIP Connections
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              Patch with top designers to follow real-time garment production, get notified on private drop releases, and access private fittings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
