import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import StoreProductsPanel from '@/components/studio/store/StoreProductsPanel';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import {
  clearStoreOpenPending,
  isStoreOpenPending,
  resolveStoreSetupDestination,
  sleep,
} from '@/utils/storeSetup';
import {
  getAvatarFallback,
  resolveProfileImageSource,
} from '@/utils/profileImage';
import LazyEntityQrModal from '@/components/qr/LazyEntityQrModal';
import { buildStorefrontUrl } from '@/utils/publicLinks';

export default function StoreManagement() {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsOpen] = useState(true);
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(true);
  const [layoutMode, setLayoutMode] = useState(false);
  const [draftCollections, setDraftCollections] = useState<any[]>([]);
  const [draftCollectionsLoading, setDraftCollectionsLoading] = useState(false);
  const [showStoreQr, setShowStoreQr] = useState(false);

  const resolvedAvatar = useMemo(
    () =>
      resolveProfileImageSource({
        profileImage: user?.profileImage,
        profileImageId: user?.profileImageId,
        profileImageFile: user?.profileImageFile,
      }),
    [user?.profileImage, user?.profileImageFile, user?.profileImageId],
  );
  const { url: avatarUrl } = useSignedFileUrl(
    resolvedAvatar.fileId,
    resolvedAvatar.src,
  );
  const avatarFallback = useMemo(
    () =>
      getAvatarFallback(
        `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        user?.username,
      ),
    [user?.firstName, user?.lastName, user?.username],
  );

  const brandName = useMemo(() => {
    if (status?.profile?.name) return status.profile.name;
    if (user?.brandFullName) return user.brandFullName;
    const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return fullName || user?.username || 'Your Store';
  }, [
    status?.profile?.name,
    user?.brandFullName,
    user?.firstName,
    user?.lastName,
    user?.username,
  ]);

  const brandDescription = useMemo(() => {
    return (
      status?.profile?.description ||
      status?.profile?.tagline ||
      user?.brandDescription ||
      'Showcase your collection, manage products, and track performance.'
    );
  }, [
    status?.profile?.description,
    status?.profile?.tagline,
    user?.brandDescription,
  ]);

  const brandLocation = useMemo(() => {
    if (user?.companyLocation) return user.companyLocation;
    const bits = [user?.brandCity, user?.brandState, user?.brandCountry].filter(
      Boolean,
    );
    return bits.length ? bits.join(', ') : null;
  }, [
    user?.companyLocation,
    user?.brandCity,
    user?.brandState,
    user?.brandCountry,
  ]);

  const kpis = overview?.kpis || {};
  const recentOrders = overview?.recentOrders || [];
  const verificationMarker = user?.verificationBadgeVisible
    ? '✅'
    : user?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED'
      ? '🛠️'
      : user?.verificationStatus === 'PENDING' ||
          user?.verificationStatus === 'IN_REVIEW'
        ? '⏳'
        : user?.verificationStatus === 'REJECTED'
          ? '⚠️'
          : '🪪';
  const verificationLabel = user?.verificationBadgeVisible
    ? 'Seller verified'
    : user?.verificationStatus === 'ADDITIONAL_INFO_REQUESTED'
      ? 'Reviewer requested updates'
      : user?.verificationStatus === 'PENDING' ||
          user?.verificationStatus === 'IN_REVIEW'
        ? 'Verification in progress'
        : 'Open verification workspace';

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(val || 0);
  const formatNumber = (val: number) => {
    if (!val) return '0';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return String(val);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        let s = await getStoreStatus();

        if (!s?.isStoreOpen && isStoreOpenPending()) {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await sleep(500);
            try {
              const retryStatus = await getStoreStatus();
              s = retryStatus;
              if (retryStatus?.isStoreOpen) {
                break;
              }
            } catch {
              // Keep trying while in pending-open grace period.
            }
          }
        }

        if (!mounted) return;
        setStatus(s);

        if (s?.isStoreOpen) {
          clearStoreOpenPending();
        }

        if (s?.profile == null) {
          if (isStoreOpenPending()) {
            return;
          }
          navigate('/studio/store/setup', { replace: true });
          return;
        }

        if (!s?.isStoreOpen) {
          if (isStoreOpenPending()) {
            return;
          }

          navigate(resolveStoreSetupDestination(), { replace: true });
        }
      } catch (e) {
        const code = (e as any)?.response?.status;
        if (code === 404) {
          if (isStoreOpenPending()) {
            return;
          }
          navigate('/studio/store/setup', { replace: true });
          return;
        }
        toast.error('Failed to load store status');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user?.id) return;
      setOverviewLoading(true);
      try {
        const [overviewData, analyticsData] = await Promise.all([
          brandApi.getDashboardOverview(user.id),
          brandApi.getDashboardAnalytics(user.id, '7d'),
        ]);
        if (!mounted) return;
        setOverview(overviewData);
        setAnalytics(analyticsData);
      } catch {
        if (!mounted) return;
        setOverview({
          kpis: {
            totalRevenue: 0,
            totalOrders: 0,
            conversionRate: 0,
            storeViews: 0,
            reviewScore: 0,
            reviewCount: 0,
          },
          recentOrders: [],
          store: {
            name: brandName,
            slug: user?.username || 'your-store',
            isLive: status?.isStoreOpen ?? false,
          },
        });
        setAnalytics({ salesChart: [] });
      } finally {
        if (mounted) setOverviewLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [brandName, status?.isStoreOpen, user?.id, user?.username]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id) return;
      setDraftCollectionsLoading(true);
      try {
        const drafts = await brandApi.getMyDraftCollections();
        if (!mounted) return;
        setDraftCollections(drafts || []);
      } catch {
        if (!mounted) return;
        setDraftCollections([]);
      } finally {
        if (mounted) setDraftCollectionsLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="mb-3 h-8 w-48 animate-pulse rounded bg-gray-200/80 dark:bg-white/10" />
        <div className="h-4 w-96 animate-pulse rounded bg-gray-200/80 dark:bg-white/10" />
        <div className="mt-6 h-72 animate-pulse rounded-2xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <div className="font-semibold text-gray-900 dark:text-white">Store</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Unable to load store status.
        </div>
      </div>
    );
  }

  if (!status.isStoreOpen) {
    if (isStoreOpenPending()) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="font-semibold text-gray-900 dark:text-white">
            Finalizing Store
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Your store is being activated. This usually takes a few seconds.
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="animate-in fade-in space-y-8 duration-500">
      <div className="sticky top-0 z-30">
        <div className="rounded-2xl border border-gray-200/60 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#111118]/90">
          <div className="flex items-center gap-4">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-md dark:border-white/10">
              {avatarUrl ? (
                <MediaRenderer
                  kind="image"
                  src={avatarUrl}
                  alt={brandName}
                  fit="cover"
                  className="h-full w-full"
                  mediaClassName="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 text-sm font-bold text-white">
                  {avatarFallback}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold leading-tight text-gray-900 dark:text-white">
                {brandName}
              </h1>
              <p className="mt-0.5 truncate text-xs leading-tight text-gray-500 dark:text-gray-400">
                {brandDescription}
              </p>
            </div>

            <div className="hidden items-center gap-1 sm:flex">
              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  {kpis.reviewScore ? '⭐' : '☆'}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  {kpis.reviewScore
                    ? `${kpis.reviewScore.toFixed(1)} (${kpis.reviewCount || 0} reviews)`
                    : 'No reviews yet'}
                </span>
              </div>

              {brandLocation ? (
                <div className="inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  <span aria-hidden="true">📍</span>
                  <span className="truncate" title={brandLocation}>
                    {brandLocation}
                  </span>
                </div>
              ) : null}

              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  🚚
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  Ships Nationwide
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/studio/verification')}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300"
                aria-label="Open verification workspace"
                title={verificationLabel}
              >
                <span>{verificationMarker}</span>
                <span className="max-w-[140px] truncate">{verificationLabel}</span>
              </button>

              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  🛡️
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  Buyer Protection
                </span>
              </div>
            </div>

            <div className="hidden h-6 w-px bg-gray-200 dark:bg-white/10 sm:block" />

            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status.isStoreOpen
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300'
              }`}
            >
              <span className="text-xs">{status.isStoreOpen ? '🟢' : '🟡'}</span>
              {status.isStoreOpen ? 'Live' : 'Draft'}
            </div>

            <button
              type="button"
              onClick={() => setShowStoreQr(true)}
              className="group relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition-all hover:scale-105 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-emerald-300"
              aria-label="Open storefront QR code"
            >
              <span className="text-sm">🪪</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                Storefront QR code
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="group relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition-all hover:scale-105 hover:bg-purple-50 hover:text-purple-600 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-purple-400"
              aria-label="Preview as visitor"
            >
              <span className="text-sm">👁️</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                Preview as visitor
              </span>
            </button>
          </div>
        </div>
      </div>

      <StoreProductsPanel
        layoutMode={layoutMode}
        onToggleLayoutMode={() => setLayoutMode((prev) => !prev)}
        draftCollections={draftCollections}
        draftCollectionsLoading={draftCollectionsLoading}
      />

      <LazyEntityQrModal
        open={showStoreQr}
        onClose={() => setShowStoreQr(false)}
        title="Storefront QR Code"
        subtitle="Scan to open this storefront."
        url={buildStorefrontUrl({
          ownerId: user?.id,
          slug: overview?.store?.slug || user?.username,
          username: user?.username,
        })}
        downloadFileName="storefront-qr.png"
        logoUrl={avatarUrl || resolvedAvatar.src}
        logoFileId={resolvedAvatar.fileId}
      />

      {analyticsOpen && analyticsCollapsed ? (
        <button
          type="button"
          onClick={() => setAnalyticsCollapsed(false)}
          className="fixed bottom-20 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-2xl"
          aria-label="Open analytics panel"
        >
          📊 Analytics
          <span className="text-xs font-semibold text-green-200">● Live</span>
        </button>
      ) : null}

      {analyticsOpen && !analyticsCollapsed ? (
        <aside className="fixed bottom-6 right-6 top-24 z-40 w-[320px] max-w-[90vw] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Analytics
              </h3>
              <p className="text-xs text-gray-500">Live store performance</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-green-600">● Live</span>
              <button
                type="button"
                onClick={() => setAnalyticsCollapsed(true)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ▾
              </button>
            </div>
          </div>

          <div className="space-y-6 px-5 pb-5">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="text-xs font-semibold text-gray-500">
                Store Views (7d)
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {formatNumber(kpis.storeViews)}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Top Performing
              </h4>
              {Array.isArray(overview?.topProducts) &&
              overview.topProducts.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {overview.topProducts.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200">
                        {item.thumbnail ? (
                          <MediaRenderer
                            kind="image"
                            src={item.thumbnail}
                            alt={item.name}
                            className="h-full w-full"
                            mediaClassName="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(item.views || 0)} views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No top products yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Recent Orders
              </h4>
              {recentOrders.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {recentOrders.slice(0, 3).map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          #{order.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items?.length || 0} items
                        </p>
                      </div>
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                        {order.status || 'Paid'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No recent orders yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Revenue (7 days)
              </h4>
              <div className="mt-3 space-y-2">
                {(analytics?.salesChart || []).slice(-7).map((entry: any) => (
                  <div
                    key={entry.date}
                    className="flex items-center justify-between text-xs text-gray-500"
                  >
                    <span>{entry.date}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(entry.amount || 0)}
                    </span>
                  </div>
                ))}
                {!analytics?.salesChart || analytics.salesChart.length === 0 ? (
                  <p className="text-xs text-gray-500">No revenue data yet.</p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAnalyticsCollapsed(true)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close Analytics
            </button>
          </div>
        </aside>
      ) : null}

      {overviewLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5">
          Loading store stats...
        </div>
      ) : null}
    </div>
  );
}
